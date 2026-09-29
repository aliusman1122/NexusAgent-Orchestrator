"""Chat endpoint for A7 Logics Enterprise AI Agent."""

from datetime import datetime, timezone
import logging
from typing import Optional
import uuid
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from core.database.tracker import log_token_usage
from core.graph.workflow import run_a7_agent

logger = logging.getLogger(__name__)

router = APIRouter()


class ChatRequest(BaseModel):
    """Client inquiry request model."""

    message: str = Field(
        ...,
        min_length=1,
        description="The customer inquiry or question for A7 Logics.",
        examples=["What web development stacks does A7 Logics use?"],
    )
    session_id: Optional[str] = Field(
        default=None,
        description="Optional client session identifier for tracking conversation turns.",
    )
    tenant_id: Optional[str] = Field(
        default="a7_logics",
        description="Optional tenant identifier for isolated multi-tenant knowledge retrieval.",
    )
    agent_id: Optional[str] = Field(
        default=None,
        description="Optional agent UUID / ID for exact token tracking.",
    )
    agent_name: Optional[str] = Field(
        default=None,
        description="Optional display name of active bot agent (e.g. 'Real Estate Advisor').",
    )
    persona: Optional[str] = Field(
        default=None,
        description="Optional persona tone for the agent (Executive, Technical, Casual).",
    )
    system_prompt: Optional[str] = Field(
        default=None,
        description="Optional custom agent instructions / system prompt override.",
    )


class ChatResponse(BaseModel):
    """Clean, production-grade lightweight response model."""

    answer: str = Field(
        ...,
        description="Grounded response or standardized executive refusal message.",
    )
    session_id: str = Field(
        ...,
        description="Session identifier (echoed from request or newly generated).",
    )
    timestamp: str = Field(
        ...,
        description="ISO-8601 UTC timestamp of response generation.",
    )


@router.post(
    "/chat",
    response_model=ChatResponse,
    summary="Submit client message and receive executive response",
    description="Processes message through compiled LangGraph workflow. Internal flags (is_grounded, needs_alert, sources) are stripped.",
)
def chat_endpoint(request: ChatRequest) -> ChatResponse:
    """Process customer inquiry through LangGraph workflow with factual grounding."""
    clean_message = request.message.strip()
    if not clean_message:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Message cannot be empty or whitespace only.",
        )

    # Resolve active agent tenant identifier (never default to a7_logics if agent_id or tenant_id is specified)
    active_tenant = str(request.agent_id or request.tenant_id or "a7_logics").strip()
    session_id = request.session_id or f"sess_{uuid.uuid4().hex[:12]}"
    now_utc = datetime.now(timezone.utc).isoformat()

    try:
        logger.info(
            "Executing chat query for session [%s] (tenant: '%s', agent: '%s', persona: '%s'): '%s'",
            session_id,
            active_tenant,
            request.agent_name,
            request.persona,
            clean_message,
        )
        result = run_a7_agent(
            clean_message,
            tenant_id=active_tenant,
            agent_id=active_tenant,
            agent_name=request.agent_name,
            persona=request.persona,
            system_prompt=request.system_prompt,
        )
        answer = result.get("generation", "")

        token_usage = result.get("token_usage")
        if token_usage:
            prompt_tokens = token_usage.get("prompt_tokens", 0)
            completion_tokens = token_usage.get("completion_tokens", 0)
            total_tokens = token_usage.get("total_tokens", prompt_tokens + completion_tokens)
            logger.info(
                f"📊 [TOKEN TRACKER] Agent: {active_tenant} | Prompt: {prompt_tokens} | Completion: {completion_tokens} | Total: {total_tokens}"
            )
        else:
            # For greetings or conversational turns that bypassed QA node, track estimated tokens
            prompt_tokens = max(1, len(clean_message) // 4)
            completion_tokens = max(1, len(answer) // 4)
            total_tokens = prompt_tokens + completion_tokens
            try:
                log_token_usage(
                    agent_id=active_tenant,
                    prompt_tokens=prompt_tokens,
                    completion_tokens=completion_tokens,
                    total_tokens=total_tokens,
                )
            except Exception as log_err:
                logger.warning("Could not record token usage log: %s", log_err)
            logger.info(
                f"📊 [TOKEN TRACKER] Agent: {active_tenant} | Prompt: {prompt_tokens} | Completion: {completion_tokens} | Total: {total_tokens}"
            )

        return ChatResponse(
            answer=answer,
            session_id=session_id,
            timestamp=now_utc,
        )

    except Exception as exc:
        logger.exception("Error executing A7 agent core workflow: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Agent workflow error: {str(exc)}",
        )
