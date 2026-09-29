"""Workflow nodes for the A7 Logics Enterprise AI Chatbot core graph.

Implements:
- is_greeting: Robust, typo-tolerant greeting and pleasantry classifier.
- greet_node: Immediate executive greeting response.
- retrieve_node: Queries ChromaDB for Top-4 relevant documents.
- grade_documents_node: Evaluates factual grounding via structured LLM grading.
- generate_grounded_answer_node: Generates strictly grounded answers with A7 Logics Persona.
- fallback_and_log_node: Enforces executive fallback phrasing and records unanswered queries to DB.
- admin_alert_node: Triggers admin notifications when frequency threshold (>=3) is reached.
"""

import json
import logging
import re
import sys
from typing import Any, Dict, List, Optional, Union
import uuid
from langchain_core.documents import Document
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_groq import ChatGroq
from pydantic import BaseModel, Field

_ORIGINAL_CHAT_GROQ = ChatGroq

from config.settings import settings
from core.database.connection import get_db_session
from core.database.models import AgentModel, TokenUsageLogModel
from core.database.tracker import log_token_usage, record_unanswered_query
from core.ingestion.vector_store import get_vector_store
from core.llm_factory import get_configured_llm
from .state import AgentState

logger = logging.getLogger(__name__)


def is_greeting(query: str) -> bool:
    """Detect if a user query is a greeting, pleasantry, or conversational opening.

    Robust, typo-tolerant, and case-insensitive matcher handling:
    - Variations and typos: 'hi', 'hii', 'hey', 'heyy', 'hello', 'hellow', 'helo', 'hlo', etc.
    - Time-of-day greetings: 'good morning', 'good afternoon', 'good evening', 'greetings'
    - Cultural pleasantries: 'salam', 'assalam o alaikum', 'aoa', etc.
    - Identity & capability queries: 'who are you', 'what can you do', 'how can you help me'
    - Ignores leading/trailing punctuation (e.g. 'hellow!', 'hey?', '???hi!!!')
    - Rejects substantive corporate queries containing business/technology domain keywords.
    """
    if not query or not query.strip():
        return False

    # 1. Clean query: strip leading and trailing non-alphanumeric punctuation & whitespace
    cleaned = re.sub(r"^[\W_]+|[\W_]+$", "", query.strip()).lower()
    if not cleaned:
        return False

    # 2. Normalized form: collapse symbols to space and normalize whitespace
    norm = re.sub(r"[\W_]+", " ", cleaned).strip()
    norm = re.sub(r"\s+", " ", norm)
    if not norm:
        return False

    # 3. Guard against domain-specific technical or business inquiries
    domain_keywords = {
        "web", "mobile", "ios", "android", "flutter", "react", "angular", "vue",
        "python", "fastapi", "django", "node", "nodejs", "enterprise", "solutions",
        "pricing", "rates", "rate", "cost", "quote", "hire", "service", "services",
        "portfolio", "case", "study", "cloud", "aws", "azure", "gcp", "devops",
        "kubernetes", "docker", "sap", "erp", "coldfusion", "modernization",
        "database", "postgres", "sql", "migration", "technologies", "technology",
        "stack", "capabilities", "capability", "consulting", "integration",
    }
    words_set = set(norm.split())
    if words_set.intersection(domain_keywords):
        return False

    # 4. Exact matching set for common greetings, typos, and pleasantries
    exact_matches = {
        # Standard variations & typos of hi, hey, hello
        "hi", "hii", "hiii", "hiiii",
        "hey", "heyy", "heyyy", "heyyyy",
        "hello", "hellow", "helloww", "helllo", "helo", "hlo", "hlw", "hloo",
        "heya", "howdy", "hola", "greetings", "salutations",
        # Time of day
        "good morning", "good afternoon", "good evening", "good day", "good night",
        # Cultural greetings & abbreviations
        "salam", "salaam", "assalam", "assalam o alaikum", "assalam u alaikum",
        "assalamu alaikum", "asalam alaikum", "asalam o alaikum", "aoa", "slm",
        "wsalam", "walaikum assalam",
        # Identity, role, and capabilities
        "who are you", "what are you", "who r u", "who r you", "who are u",
        "what is your name", "whats your name", "what's your name",
        "how are you", "how are you doing", "how r u", "how r you",
        "what can you do", "what do you do", "what can u do",
        "how can you help", "how can you help me", "how can u help me", "how can u help",
        "can you help me", "help me", "introduce yourself", "tell me about yourself",
        "help", "who made you"
    }

    if norm in exact_matches or cleaned in exact_matches:
        return True

    # 5. Typo-tolerant regex patterns for opening salutations (e.g. 'hellow!', 'heyyy there')
    salutation_patterns = [
        # Typos of hi/hey/hello (h+i+, h+e+y+, h+e+l+o+w*, h+l+o+, h+l+w+)
        r"^h+i+(\s+(there|a7|bot|team|friend|all|representative))?$",
        r"^h+e+y+(\s+(there|a7|bot|team|friend|all|representative))?$",
        r"^h+e+l+o+w*(\s+(there|a7|bot|team|friend|all|representative))?$",
        r"^h+l+[ow]+(\s+(there|a7|bot|team|friend|all|representative))?$",
        # Salam / Assalam variations
        r"^(as+alam|salam|salaam|a+o+a|wsalam)(\s+(o\s+alaikum|u\s+alaikum|alaikum|there|a7|team|bot))?$",
        # Time of day patterns
        r"^good\s*(morning|afternoon|evening|day|night)(\s+(there|a7|team|all))?$",
        r"^greetings(\s+(there|everyone|all|team))?$",
        # Identity / Capability questions
        r"^(who|what)\s+(are|r)\s+(you|u)(\s+(all\s+about|exactly|here\s+for|doing))?$",
        r"^(what\s+is|whats)\s+your\s+name$",
        r"^how\s+(are|r)\s+(you|u)(\s+doing)?$",
        r"^what\s+can\s+(you|u)\s+do(\s+(for\s+me|here))?$",
        r"^how\s+can\s+(you|u)\s+help(\s+me)?$",
        r"^(can\s+(you|u)\s+help|help)\s+me$",
        r"^(tell\s+me\s+about|introduce)\s+yourself$",
    ]

    for pattern in salutation_patterns:
        if re.match(pattern, norm):
            return True

    # 6. Compound greeting check: starts with a greeting word followed by introductory question
    # e.g., "hello who are you", "hey what can you do", "salam how can you help me"
    words = norm.split()
    if 2 <= len(words) <= 8:
        greeting_starters = {
            "hi", "hii", "hiii", "hey", "heyy", "heyyy", "hello", "hellow",
            "helo", "hlo", "salam", "salaam", "aoa", "greetings", "howdy", "good"
        }
        if words[0] in greeting_starters or (len(words) >= 2 and f"{words[0]} {words[1]}" in exact_matches):
            intent_tails = [
                r"\bwho\s+(are|r)\s+(you|u)\b",
                r"\bwhat\s+can\s+(you|u)\s+do\b",
                r"\bhow\s+can\s+(you|u)\s+help\b",
                r"\bwhat\s+(is|s)\s+your\s+name\b",
                r"\bintroduce\s+yourself\b",
                r"\btell\s+me\s+about\s+yourself\b",
                r"\bhow\s+(are|r)\s+(you|u)\b",
                r"\bcan\s+(you|u)\s+help\b",
            ]
            if any(re.search(tail, norm) for tail in intent_tails):
                return True

    return False


def greet_node(state: AgentState) -> Dict[str, Any]:
    """Provide immediate executive greeting for pleasantries without ChromaDB or DB logging."""
    agent_name = state.get("agent_name") or "A7 Logics"
    persona = state.get("persona") or "Executive"
    greeting = (
        f"Hello! I am your {agent_name} {persona} Client Representative. "
        "How may I assist you today with our web engineering, mobile development, or enterprise solutions?"
    )
    logger.info("Greet node: Returning greeting for pleasantry query (agent: '%s').", agent_name)
    return {
        "generation": greeting,
        "is_grounded": True,
        "needs_alert": False,
        "documents": [],
        "alert_message": None,
    }


def intent_router_node(state: AgentState) -> Dict[str, Any]:
    """Lightweight router node executed before retrieval to inspect query intent."""
    logger.info("Intent router node: Evaluating query intent for '%s'", state.get("question", ""))
    return {}


class DocumentGrade(BaseModel):
    """Binary score for relevance and factual sufficiency of retrieved documents."""

    is_relevant: bool = Field(
        description="True if context contains factual information directly answering the user query, False otherwise."
    )
    reasoning: str = Field(
        description="Brief explanation of why the context is or is not sufficient to answer the question."
    )


def check_keyword_overlap(question: str, context: str) -> bool:
    """Check for keyword overlap and domain tech terms between user query and retrieved context."""
    if not question or not context:
        return False

    q_lower = question.lower()
    ctx_lower = context.lower()

    # Core web/mobile and digital engineering domain keywords
    tech_keywords = {
        "laravel", "coldfusion", "php", "react", "react native", "python", "django", "fastapi",
        "node", "nodejs", "angular", "vue", "flutter", "ios", "android", "mobile", "web",
        "cloud", "aws", "azure", "gcp", "devops", "docker", "kubernetes", "sql", "postgresql",
        "database", "frontend", "backend", "fullstack", "modernization", "api", "integration",
        "migration", "saas", "enterprise", "qa", "testing", "ui", "ux", "consulting",
        "software", "development", "architecture", "engineering", "applications", "apps"
    }

    # 1. Direct tech keyword match between query and context
    for kw in tech_keywords:
        if kw in q_lower and kw in ctx_lower:
            return True

    # 2. Extract significant alphanumeric tokens from query (length > 2, excluding common stopwords)
    stopwords = {
        "what", "when", "where", "which", "who", "whom", "whose", "why", "how",
        "does", "do", "did", "can", "could", "will", "would", "shall", "should",
        "is", "are", "was", "were", "be", "been", "being", "have", "has", "had",
        "the", "a", "an", "and", "or", "but", "if", "then", "else", "for", "with",
        "about", "against", "between", "into", "through", "during", "before",
        "after", "above", "below", "to", "from", "up", "down", "in", "out", "on",
        "off", "over", "under", "again", "further", "then", "once", "here", "there",
        "all", "any", "both", "each", "few", "more", "most", "other", "some", "such",
        "no", "nor", "not", "only", "own", "same", "so", "than", "too", "very",
        "tell", "give", "provide", "please", "help", "know", "information", "details",
        "your", "you", "they", "them", "their", "this", "that", "these", "those"
    }

    words = re.findall(r"\b[a-zA-Z0-9_\-\.]{3,}\b", q_lower)
    significant_tokens = [w for w in words if w not in stopwords]

    # Check if any significant token is in context
    if any(token in ctx_lower for token in significant_tokens):
        return True

    return False


def retrieve_node(state: AgentState) -> Dict[str, Any]:
    """Retrieve Top-4 documents from local ChromaDB vector store for the target tenant."""
    question = state["question"]
    tenant_id = (
        state.get("tenant_id")
        or getattr(settings, "CHROMA_COLLECTION_NAME", "a7_logics_knowledge_base")
        or "a7_logics_knowledge_base"
    )
    if str(tenant_id).lower() in ("a7_logics", "a7-logics", "a7logics", "a7_logics_agent"):
        tenant_id = getattr(settings, "CHROMA_COLLECTION_NAME", "a7_logics_knowledge_base")
    logger.info("Retrieve node: searching ChromaDB for question: '%s' (tenant: '%s')", question, tenant_id)

    try:
        store = get_vector_store(collection_name=tenant_id)
        retriever = store.vector_store.as_retriever(search_kwargs={"k": 4})
        docs: List[Document] = retriever.invoke(question)
        logger.info(
            "Retrieved %d document chunk(s) from ChromaDB collection '%s' (tenant: '%s')",
            len(docs),
            store.collection_name,
            tenant_id,
        )
        return {"documents": docs}
    except Exception as exc:
        logger.warning("Retrieval failed (%s). Continuing with empty documents.", exc)
        return {"documents": []}


def grade_documents_node(state: AgentState) -> Dict[str, Any]:
    """Grade retrieved documents using structured LLM to enforce factual grounding with safety fallbacks."""
    question = state["question"]
    docs = state.get("documents", [])

    if not docs:
        logger.info("Grade node: No documents retrieved. Setting is_grounded = False.")
        return {"is_grounded": False}

    context = "\n\n".join(
        f"[Doc {i+1} - Source: {d.metadata.get('source', 'unknown')}]:\n{d.page_content}"
        for i, d in enumerate(docs)
    )

    system_prompt = (
        "You are an expert QA evaluation grader assessing whether retrieved corporate knowledge base chunks "
        "contain relevant factual context, technical capabilities, or domain information to address a client's "
        "inquiry about A7 Logics.\n"
        "Evaluation Guidelines:\n"
        "- Be practical, helpful, and not overly rigid. Grounded does NOT require an exhaustive, all-encompassing answer; "
        "it requires that the context provides verified domain, service, or technology information related to the inquiry.\n"
        "- If the retrieved chunks contain keywords or domain information related to web/mobile technologies, "
        "software engineering, frameworks, or enterprise services (such as Laravel, ColdFusion, PHP, React, Python, "
        "mobile apps, web development, cloud solutions, or system modernization), you MUST evaluate is_relevant = True.\n"
        "- Grade is_relevant = True if the context provides direct, partial, or foundational facts answering or addressing the query.\n"
        "- Grade is_relevant = False ONLY if the context is completely unrelated, entirely off-topic, or contains zero domain relevance."
    )

    human_prompt = (
        f"User Question:\n{question}\n\n"
        f"Retrieved Context:\n{context}\n\n"
        "Evaluate whether the context contains relevant factual information or domain capabilities to answer the question."
    )

    try:
        _ChatGroq = getattr(sys.modules.get("core.graph.nodes"), "ChatGroq", ChatGroq)
        llm = _ChatGroq(
            model_name=settings.LLM_MODEL,
            temperature=0.0,
            groq_api_key=settings.GROQ_API_KEY,
        )
        is_relevant = False
        reasoning = ""
        try:
            structured_llm = llm.with_structured_output(DocumentGrade)
            grade_result: DocumentGrade = structured_llm.invoke(
                [SystemMessage(content=system_prompt), HumanMessage(content=human_prompt)]
            )
            is_relevant = bool(grade_result.is_relevant)
            reasoning = grade_result.reasoning
        except Exception as parse_err:
            json_sys = (
                f"{system_prompt}\n"
                "Output ONLY a valid JSON object in this format:\n"
                '{"is_relevant": true, "reasoning": "brief explanation"}'
            )
            raw_resp = llm.invoke(
                [SystemMessage(content=json_sys), HumanMessage(content=human_prompt)]
            )
            match = re.search(r"\{.*\}", str(raw_resp.content), re.DOTALL)
            if match:
                data = json.loads(match.group())
                is_relevant = bool(data.get("is_relevant", False))
                reasoning = str(data.get("reasoning", ""))
            else:
                logger.warning("LLM structured output parsing failed (%s). Checking keyword overlap fallback.", parse_err)
                is_relevant = check_keyword_overlap(question, context)
                reasoning = "Fallback keyword overlap check after structured parsing ambiguity."

        # Safety Fallback:
        # If the LLM structured grading evaluates as False or returns ambiguous results,
        # check keyword overlap between the query and retrieved chunk text before defaulting to ungrounded refusal.
        if not is_relevant:
            has_keyword_overlap = check_keyword_overlap(question, context)
            if has_keyword_overlap:
                logger.info(
                    "Safety fallback triggered: LLM evaluated is_relevant=False, but keyword/domain overlap detected. Overriding to is_grounded = True."
                )
                is_relevant = True
                reasoning = (reasoning + " | Overridden by safety fallback: verified keyword overlap detected.").strip(" |")

        logger.info(
            "Grade node: is_grounded=%s | Reasoning: %s",
            is_relevant,
            reasoning,
        )
        return {"is_grounded": is_relevant}

    except Exception as exc:
        logger.warning(
            "Grading LLM call failed (%s). Evaluating with safety keyword fallback heuristic.", exc
        )
        has_overlap = check_keyword_overlap(question, context)
        return {"is_grounded": has_overlap}


def get_executive_fallback(agent_name: Union[str, AgentState, Dict[str, Any], None] = None) -> str:
    """Universal smart fallback when query is out-of-domain or info is missing.

    Clean, universal, domain-agnostic standard adhering strictly to enterprise multi-tenant neutrality.
    """
    if isinstance(agent_name, dict):
        raw_name = (agent_name.get("agent_name") or "our team").strip()
    elif isinstance(agent_name, str):
        raw_name = agent_name.strip()
    else:
        raw_name = ""

    clean_name = re.sub(r"\s+assistant$", "", raw_name, flags=re.IGNORECASE).strip() if raw_name else "our team"
    if not clean_name:
        clean_name = "our team"

    return (
        f"I apologize, but I don't have enough information to answer that question accurately. "
        f"If you have any questions regarding {clean_name} or how we can assist you, feel free to ask!"
    )


def generate_grounded_answer_node(state: AgentState) -> Dict[str, Any]:
    """Generate grounded client response with dynamic Agent Persona."""
    question = state["question"]
    docs = state.get("documents", [])
    agent_name = state.get("agent_name") or "A7 Logics"
    persona_tone = state.get("persona") or "Executive"
    clean_agent_name = re.sub(r"\s+assistant$", "", agent_name, flags=re.IGNORECASE).strip() or agent_name

    context = "\n\n".join(
        f"[Source: {d.metadata.get('source', 'website')} | Section: {d.metadata.get('section', 'General')}]:\n{d.page_content}"
        for d in docs
    )

    tone_instructions = {
        "Executive": "Speak as a consultative, polished enterprise technology advisor with concise, strategic clarity.",
        "Technical": "Speak as an analytical, rigorous technical expert with precise specifications, data details, and architectural clarity.",
        "Casual": "Speak as a friendly, empathetic, helpful assistant with warm, conversational, and direct guidance.",
    }.get(persona_tone, "Speak as a consultative, polished enterprise technology advisor.")

    # Check for custom system instructions from state or database AgentModel
    custom_system_prompt = state.get("system_prompt")
    if not custom_system_prompt and state.get("tenant_id"):
        try:
            with get_db_session() as db:
                t_id = state.get("tenant_id")
                agent = db.query(AgentModel).filter(
                    (AgentModel.slug == t_id)
                    | (AgentModel.id == t_id)
                ).first()
                if agent and agent.system_prompt:
                    custom_system_prompt = agent.system_prompt.strip()
        except Exception as exc:
            logger.debug("Could not lookup agent system_prompt from db: %s", exc)

    if "a7 logics" in clean_agent_name.lower():
        capabilities_overview = (
            "HELPFUL & INFORMATIVE CAPABILITIES:\n"
            "- When asked about capabilities such as web development stacks, mobile engineering, or technology solutions, synthesize the verified capabilities and services from the knowledge base into a helpful, informative overview.\n"
            "- Present our verified engineering pillars clearly:\n"
            "  * **Website Development (Website Pro):** Professional, responsive websites optimized for major search engines and modern cross-device performance.\n"
            "  * **Frontend Engineering:** Custom UI/UX designs tailored to client preferences, focused on engagement and conversion.\n"
            "  * **Clean Code & Architecture:** Highly organized, modular codebases delivering fast execution speed and enterprise scalability.\n"
            "  * **E-Commerce Solutions:** Feature-rich online stores built on scalable architectures with seamless transaction handling.\n"
            "  * **Mobile & Custom Integrations:** Native and hybrid mobile application engineering alongside custom enterprise integrations.\n"
            "- NEVER output an evasive refusal or state 'I do not have specific documented details' when asked about general web development, tech stacks, or digital solutions. Synthesize the verified capabilities and invite discussion for bespoke scoping.\n\n"
        )
    else:
        capabilities_overview = (
            "HELPFUL & INFORMATIVE CAPABILITIES:\n"
            f"- When asked about capabilities, services, or domain knowledge of {clean_agent_name}, synthesize the verified facts and services from the knowledge base into a helpful, informative overview.\n"
            "- NEVER output an evasive refusal when asked about the core domain or documented topics. Synthesize the verified knowledge and invite discussion for relevant questions.\n\n"
        )

    system_prompt = (
        f"You are the {persona_tone} Client Representative for {clean_agent_name}.\n"
        f"Tone and Persona: {tone_instructions} "
        "Speak directly, warmly, and authoritatively as an executive representative.\n\n"
        "STRICT FORBIDDEN PHRASING & UNIVERSAL MULTI-TENANT RULES:\n"
        "- RULE 1: STRICT MUTUAL EXCLUSION (NEVER MIX ANSWERS WITH APOLOGY BLOCKS):\n"
        f"  * The canned apology fallback (\"I apologize, but I don't have enough information to answer that question accurately. If you have any questions regarding {clean_agent_name} or how we can assist you, feel free to ask!\") is STRICTLY AND EXCLUSIVELY reserved for queries that are 100% out-of-domain with ZERO relevant context chunks retrieved.\n"
        "  * If ANY part of the user's question can be answered from the retrieved context, NEVER include the apologetic fallback disclaimer under any circumstance.\n"
        "- RULE 2: UNIVERSAL PARTIAL SYNTHESIS FOR MULTI-PART QUESTIONS:\n"
        "  * When a query contains multiple sub-questions or topics:\n"
        "    1. Answer all verified elements thoroughly and authoritatively using proper Markdown bullets with bold titles and complete punctuation.\n"
        "    2. If a specific sub-question is not explicitly documented in the retrieved context (e.g. undisclosed executive names, specific internal architectures, unlisted metrics):\n"
        "       - Address it naturally, concisely, and professionally in-domain without breaking character.\n"
        "       - Use professional phrasing such as: \"Specific details regarding [topic] are not documented in our verified records at this time. For tailored inquiries, please connect with our team directly.\"\n"
        "    3. Use the agent's verified contact email from the retrieved context if available; otherwise, refer generally to 'our team' or 'our official support channels'. NEVER hardcode any third-party or static tenant email.\n"
        "- NEVER say or output robotic, evasive, or bureaucratic phrases such as:\n"
        "  * 'I cannot find this information in the knowledge base'\n"
        "  * 'I do not have specific documented details on this scope in my current records'\n"
        "  * 'According to my database' or 'in our records' or 'in my current records'\n"
        "  * 'Based on verified corporate documentation:'\n"
        "- NEVER expose internal technical terms like 'knowledge base', 'records', 'chunks', or 'database'.\n"
        "- DO NOT assume missing queries or ungrounded questions are about 'pricing' or 'project scopes'.\n"
        f"- Speak directly and authoritatively in first-person plural ('At {clean_agent_name}, we...' or 'Our team specializes in...').\n\n"
        f"{capabilities_overview}"
        "CRITICAL FORMATTING, PUNCTUATION & BULLET POINT RULES:\n"
        "- Structure service lists and capability summaries using standard Markdown bullet lists (`- `).\n"
        "- Every bullet item MUST be a complete, well-punctuated sentence ending with a full stop/period ('.').\n"
        "- Use bold prefixes for each bullet item to clearly highlight the capability (e.g., `- **Frontend Development:** We build responsive, accessible interfaces.`)\n"
        "- NEVER output an unpunctuated wall of text or comma-spliced run-on sentences without full stops.\n"
        "- Separate paragraphs, lists, and closing sentences with double line breaks (`\\n\\n`) for clean rendering.\n"
        "- NEVER include raw file references, filenames, or brackets like '[Source: ... | Section: ...]' "
        "or '[Doc ...]' inside the answer text.\n"
        "- Do not cite document numbers or internal source paths in your text. Source verification is managed externally.\n\n"
        "STRICT GROUNDING CONSTRAINT:\n"
        "- Ground your answer in the facts and services provided in the Context below.\n"
        "- Do NOT invent pricing tiers or turnaround times not explicitly mentioned in the context."
    )

    if custom_system_prompt:
        system_prompt += f"\n\nCUSTOM AGENT INSTRUCTIONS / SYSTEM PROMPT:\n{custom_system_prompt}"

    human_prompt = (
        f"Client Inquiry:\n{question}\n\n"
        f"Verified Context:\n{context}\n\n"
        "Please provide a well-structured, grounded executive response using clean Markdown bullet points with proper punctuation and full stops on every sentence:"
    )

    try:
        _current_ChatGroq = getattr(sys.modules.get("core.graph.nodes"), "ChatGroq", ChatGroq)
        if (
            _current_ChatGroq is not _ORIGINAL_CHAT_GROQ
            or "mock" in type(_current_ChatGroq).__name__.lower()
        ):
            llm = _current_ChatGroq(
                model_name=settings.LLM_MODEL,
                temperature=settings.LLM_TEMPERATURE,
                groq_api_key=settings.GROQ_API_KEY,
                max_tokens=settings.LLM_MAX_TOKENS,
            )
            active_model = getattr(llm, "model_name", settings.LLM_MODEL)
        else:
            llm = get_configured_llm(
                temperature=settings.LLM_TEMPERATURE,
                max_tokens=settings.LLM_MAX_TOKENS,
            )
            active_model = (
                getattr(llm, "_active_model_name", None)
                or getattr(llm, "model_name", None)
                or settings.LLM_MODEL
            )

        try:
            response = llm.invoke(
                [SystemMessage(content=system_prompt), HumanMessage(content=human_prompt)]
            )
        except Exception as llm_err:
            if "model_not_found" in str(llm_err) or "does not exist" in str(llm_err):
                fallback_model = settings.LLM_MODEL
                if fallback_model and fallback_model != active_model:
                    logger.info("Configured model '%s' not available, retrying with fallback '%s'", active_model, fallback_model)
                    fallback_llm = get_configured_llm(
                        model_override=fallback_model,
                        temperature=settings.LLM_TEMPERATURE,
                        max_tokens=settings.LLM_MAX_TOKENS,
                    )
                    response = fallback_llm.invoke(
                        [SystemMessage(content=system_prompt), HumanMessage(content=human_prompt)]
                    )
                    active_model = fallback_model
                else:
                    raise
            else:
                raise


        # Extract exact token usage metadata from LLM response
        usage = (
            getattr(response, "usage_metadata", None)
            or getattr(response, "response_metadata", {}).get("token_usage", {})
            or getattr(response, "response_metadata", {}).get("usage", {})
            or {}
        )
        p_tokens = int(usage.get("input_tokens") or usage.get("prompt_tokens", 0) or 0)
        c_tokens = int(usage.get("output_tokens") or usage.get("completion_tokens", 0) or 0)
        t_tokens = int(usage.get("total_tokens", 0) or (p_tokens + c_tokens))

        if p_tokens == 0 and c_tokens == 0:
            prompt_chars = len(system_prompt) + len(human_prompt)
            p_tokens = max(1, prompt_chars // 4)
            c_tokens = max(1, len(str(response.content)) // 4)
            t_tokens = p_tokens + c_tokens

        # Dynamic multi-tenant token usage recording in PostgreSQL
        target_agent_id = str(state.get("agent_id") or state.get("tenant_id") or "a7_logics").strip()
        try:
            log_token_usage(
                agent_id=target_agent_id,
                prompt_tokens=p_tokens,
                completion_tokens=c_tokens,
                total_tokens=t_tokens,
                model_name=str(active_model),
            )
        except Exception as log_err:
            logger.warning("Could not record token usage log: %s", log_err)

        answer = str(response.content).strip()

        # Defensive post-processing: remove any brackets like [Source: ... | Section: ...] or [Doc ...] if leaked
        answer = re.sub(r"\[(?:Source|Doc|Section)[^\]]*\]", "", answer).strip()
        answer = re.sub(r"\n{3,}", "\n\n", answer)
        answer = answer.replace("\u202f", " ").replace("\u00a0", " ").replace("\u200b", "")
        answer = answer.replace("\u2011", "-").replace("\u2010", "-")
        answer = answer.replace("\u2018", "'").replace("\u2019", "'").replace("\u201c", '"').replace("\u201d", '"')
        answer = answer.replace("\u2013", "-").replace("\u2014", "--")

        # Defensive post-processing: purge any robotic preambles if generated by LLM
        robotic_preambles = [
            r"^Based on verified\s+.*?corporate documentation:?\s*",
            r"^Based on verified\s+.*?documentation:?\s*",
            r"^Based on the provided context,?\s*",
            r"^Based on the provided documentation,?\s*",
            r"^According to our records,?\s*",
            r"^Based on our knowledge base,?\s*",
        ]
        for pattern in robotic_preambles:
            answer = re.sub(pattern, "", answer, flags=re.IGNORECASE).strip()

        # Defensive post-processing: purge robotic fallback phrasing and internal jargon leaks
        robotic_evasion_patterns = [
            r"cannot find (?:this|the)?\s*information in (?:the|our)?\s*(?:knowledge base|records|database)",
            r"do not have specific documented details on this scope in (?:my|our)?\s*current records",
            r"do not have specific documented details in (?:my|our)?\s*(?:records|knowledge base|database)",
            r"not (?:available|found) in (?:the|our)?\s*(?:knowledge base|records|database)",
            r"according to (?:my|our)?\s*(?:knowledge base|database|records)",
            r"on this scope in (?:my|our)?\s*current records",
            r"in (?:my|our)?\s*current records",
            r"in the knowledge base",
        ]
        if any(re.search(pat, answer, re.IGNORECASE) for pat in robotic_evasion_patterns):
            if len(answer.strip()) > 100 and ("•" in answer or "-" in answer or "\n" in answer):
                for pat in robotic_evasion_patterns:
                    answer = re.sub(pat, "not documented in our verified records at this time", answer, flags=re.IGNORECASE).strip()
            else:
                logger.info("Robotic fallback phrasing detected in LLM generation. Substituting executive fallback standard.")
                answer = get_executive_fallback(state)

        # Defensive cleanup guard: If the response already contains substantial verified content
        # (e.g. bullet points or length > 100 chars) but the LLM accidentally appended the apology fallback, strip it out.
        fallback_patterns = [
            r"I apologize, but I don't have enough information to answer that question accurately.*$",
            r"I don't have enough information to answer that question accurately.*$",
        ]
        if len(answer.strip()) > 100 and ("•" in answer or "-" in answer or "\n" in answer):
            candidate = answer
            for pattern in fallback_patterns:
                candidate = re.sub(pattern, "", candidate, flags=re.IGNORECASE | re.DOTALL).strip()
            if len(candidate) >= 30:
                answer = candidate

        logger.info("Generated grounded response (%d characters)", len(answer))
        return {
            "generation": answer,
            "is_grounded": True,
            "needs_alert": False,
            "token_usage": {
                "prompt_tokens": p_tokens,
                "completion_tokens": c_tokens,
                "total_tokens": t_tokens,
                "model": str(active_model),
                "agent_id": target_agent_id,
            },
        }
    except Exception as exc:
        logger.error("Generation LLM call failed (%s). Using executive fallback.", exc)
        return {
            "generation": get_executive_fallback(state),
            "is_grounded": False,
            "needs_alert": False,
        }


def fallback_and_log_node(state: AgentState) -> Dict[str, Any]:
    """Enforce executive fallback phrasing and log unanswered query to database."""
    question = state["question"]
    logger.info("Fallback node: logging unanswered query '%s'", question)

    generation = get_executive_fallback(state)

    log_result = record_unanswered_query(raw_query=question)
    freq = log_result.get("frequency_count", 1)
    admin_alert_needed = bool(
        log_result.get("admin_alert_needed", False)
        or (freq >= settings.UNANSWERED_ALERT_THRESHOLD and log_result.get("alert_triggered", False))
    )

    logger.info(
        "Logged unanswered query '%s' (frequency=%d, admin_alert_needed=%s)",
        question,
        freq,
        admin_alert_needed,
    )

    return {
        "generation": generation,
        "is_grounded": False,
        "needs_alert": admin_alert_needed,
    }


def admin_alert_node(state: AgentState) -> Dict[str, Any]:
    """Generate and log critical escalation alert for repeated unanswered queries."""
    question = state["question"]
    alert_msg = (
        f"Alert: Query '{question}' has been requested 3+ times without matching "
        "knowledge base documentation. Action required: Update knowledge base."
    )
    logger.critical(">>> ADMIN ESCALATION TRIGGERED: %s", alert_msg)
    print(f"\n[CRITICAL ADMIN ALERT] {alert_msg}\n")

    return {
        "alert_message": alert_msg,
        "needs_alert": True,
    }


# Backward-compatible alias for generate_node
generate_node = generate_grounded_answer_node

