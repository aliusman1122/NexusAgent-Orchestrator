"""Workflow compilation and routing for the A7 Logics Enterprise AI Chatbot core graph.

Defines the LangGraph StateGraph, conditional edges for factual grounding and
admin alert escalation, and exposes run_a7_agent(user_query).
"""

import logging
import sys
from typing import Any, Dict, Literal, Optional
from langgraph.graph import END, START, StateGraph

from .nodes import (
    admin_alert_node,
    fallback_and_log_node,
    generate_grounded_answer_node,
    grade_documents_node,
    greet_node,
    intent_router_node,
    is_greeting,
    retrieve_node,
)
from .state import AgentState

logger = logging.getLogger(__name__)


def route_query_intent(state: AgentState) -> Literal["greet_node", "retrieve"]:
    """Conditional routing for greetings and pleasantries vs knowledge retrieval."""
    query = state.get("question", "")
    mod = sys.modules.get("core.graph.workflow")
    check_greeting = getattr(mod, "is_greeting", is_greeting)
    if check_greeting(query):
        logger.info(
            "Routing: Query '%s' recognized as greeting/pleasantry -> proceeding to greet_node",
            query,
        )
        return "greet_node"
    logger.info(
        "Routing: Query '%s' recognized as corporate knowledge inquiry -> proceeding to retrieve",
        query,
    )
    return "retrieve"


def route_after_grading(state: AgentState) -> Literal["generate_grounded_answer", "fallback_and_log"]:
    """Conditional routing based on factual grounding check."""
    if state.get("is_grounded", False):
        logger.info("Routing: Query is grounded -> proceeding to generate_grounded_answer")
        return "generate_grounded_answer"
    logger.info("Routing: Query is NOT grounded -> proceeding to fallback_and_log")
    return "fallback_and_log"


def route_after_fallback(state: AgentState) -> Literal["admin_alert", "__end__"]:
    """Conditional routing based on alert escalation threshold."""
    if state.get("needs_alert", False):
        logger.info("Routing: Alert threshold reached -> proceeding to admin_alert")
        return "admin_alert"
    logger.info("Routing: No alert needed -> proceeding to END")
    return "__end__"


def build_a7_graph():
    """Build and compile the LangGraph workflow using current module attributes."""
    mod = sys.modules.get("core.graph.workflow")
    workflow = StateGraph(AgentState)

    # Add Nodes
    workflow.add_node("intent_router", getattr(mod, "intent_router_node", intent_router_node))
    workflow.add_node("greet_node", getattr(mod, "greet_node", greet_node))
    workflow.add_node("retrieve", getattr(mod, "retrieve_node", retrieve_node))
    workflow.add_node("grade_documents", getattr(mod, "grade_documents_node", grade_documents_node))
    workflow.add_node("generate_grounded_answer", getattr(mod, "generate_grounded_answer_node", generate_grounded_answer_node))
    workflow.add_node("fallback_and_log", getattr(mod, "fallback_and_log_node", fallback_and_log_node))
    workflow.add_node("admin_alert", getattr(mod, "admin_alert_node", admin_alert_node))

    # Edges
    workflow.add_edge(START, "intent_router")
    workflow.add_conditional_edges(
        "intent_router",
        getattr(mod, "route_query_intent", route_query_intent),
        {"greet_node": "greet_node", "retrieve": "retrieve"},
    )
    workflow.add_edge("greet_node", END)
    workflow.add_edge("retrieve", "grade_documents")
    workflow.add_conditional_edges(
        "grade_documents",
        getattr(mod, "route_after_grading", route_after_grading),
        {"generate_grounded_answer": "generate_grounded_answer", "fallback_and_log": "fallback_and_log"},
    )
    workflow.add_edge("generate_grounded_answer", END)
    workflow.add_conditional_edges(
        "fallback_and_log",
        getattr(mod, "route_after_fallback", route_after_fallback),
        {"admin_alert": "admin_alert", "__end__": END},
    )
    workflow.add_edge("admin_alert", END)

    return workflow.compile()


# Compiled application instance
app = build_a7_graph()


def run_a7_agent(
    user_query: str,
    tenant_id: str = "a7_logics_knowledge_base",
    agent_id: Optional[str] = None,
    agent_name: Optional[str] = None,
    persona: Optional[str] = None,
    system_prompt: Optional[str] = None,
) -> Dict[str, Any]:
    """Execute the A7 Logics RAG workflow for a given user query.

    Args:
        user_query: The client inquiry string.
        tenant_id: Target tenant collection identifier.
        agent_id: Optional agent ID for tracking token usage.
        agent_name: Optional display name of active bot agent.
        persona: Optional tone of bot persona (Executive, Technical, Casual).
        system_prompt: Optional custom instructions/prompt for the agent.

    Returns:
        Dict[str, Any]: Final AgentState containing question, generation, grounding, and documents.
    """
    initial_state: AgentState = {
        "question": user_query.strip(),
        "documents": [],
        "generation": "",
        "is_grounded": False,
        "needs_alert": False,
        "alert_message": None,
        "tenant_id": tenant_id,
        "agent_id": agent_id,
        "agent_name": agent_name or "A7 Logics",
        "persona": persona or "Executive",
        "system_prompt": system_prompt,
    }

    logger.info("Executing A7 Logics core graph workflow for: '%s' (tenant='%s', agent='%s', persona='%s')", user_query, tenant_id, initial_state["agent_name"], initial_state["persona"])
    mod = sys.modules.get("core.graph.workflow")
    active_app = getattr(mod, "app", app)
    final_state = active_app.invoke(initial_state)
    logger.info(
        "Workflow complete for '%s' (tenant=%s, is_grounded=%s, needs_alert=%s)",
        user_query,
        final_state.get("tenant_id"),
        final_state.get("is_grounded"),
        final_state.get("needs_alert"),
    )
    return final_state
