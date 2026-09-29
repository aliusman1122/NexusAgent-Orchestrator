"""Graph state definition for the A7 Logics Enterprise AI Chatbot workflow."""

from typing import List, Optional, TypedDict
from langchain_core.documents import Document


class AgentState(TypedDict):
    """Represents the complete state of the A7 Logics RAG workflow."""

    question: str
    documents: List[Document]
    generation: str
    is_grounded: bool
    needs_alert: bool
    alert_message: Optional[str]
    tenant_id: Optional[str]
    agent_id: Optional[str]
    agent_name: Optional[str]
    persona: Optional[str]
    system_prompt: Optional[str]
    token_usage: Optional[dict]
