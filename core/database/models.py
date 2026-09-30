"""SQLAlchemy models for A7 Logics Enterprise AI Chatbot.

Defines:
- unanswered_logs: Tracking unanswered customer queries and triggering alerts.
- agents: AgentModel for persistent multi-tenant agent profiles.
- knowledge_sources: KnowledgeSourceModel for tracking ingested documents/URLs per agent.
"""

from datetime import datetime, timezone
from typing import Any, Dict
import uuid
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import relationship

from .connection import Base


class UnansweredLog(Base):
    """Logs client queries that could not be answered by the knowledge base."""

    __tablename__ = "unanswered_logs"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    user_query = Column(Text, nullable=False)
    normalized_query = Column(Text, nullable=False, index=True)
    frequency_count = Column(Integer, default=1, nullable=False)
    first_asked_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    last_asked_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    alert_triggered = Column(Boolean, default=False, nullable=False)
    status = Column(
        String(20),
        default="pending",
        nullable=False,
    )  # 'pending', 'resolved', 'ignored'
    agent_name = Column(String(128), default="General Agent", nullable=True)
    agent_id = Column(String(64), nullable=True)

    def to_dict(self) -> Dict[str, Any]:
        """Convert model instance to serializable dictionary."""
        return {
            "id": self.id,
            "user_query": self.user_query,
            "normalized_query": self.normalized_query,
            "frequency_count": self.frequency_count,
            "first_asked_at": (
                self.first_asked_at.isoformat() if self.first_asked_at else None
            ),
            "last_asked_at": (
                self.last_asked_at.isoformat() if self.last_asked_at else None
            ),
            "alert_triggered": self.alert_triggered,
            "status": self.status,
            "agent_name": self.agent_name or "General Agent",
            "agent_id": self.agent_id,
        }

    def __repr__(self) -> str:
        return (
            f"<UnansweredLog(id={self.id}, query='{self.user_query[:30]}...', "
            f"freq={self.frequency_count}, alert={self.alert_triggered}, status='{self.status}')>"
        )


class AgentModel(Base):
    """Database entity representing an AI Agent tenant."""

    __tablename__ = "agents"

    id = Column(String(64), primary_key=True, default=lambda: str(uuid.uuid4()))
    slug = Column(String(64), unique=True, index=True, nullable=False)
    name = Column(String(128), nullable=False)
    description = Column(Text, nullable=True)
    persona = Column(String(64), default="Executive", nullable=False)
    status = Column(String(32), default="Draft", nullable=False)  # 'Draft', 'Indexing', 'Ready'
    target_url = Column(String(512), nullable=True)
    system_prompt = Column(Text, nullable=True)
    welcome_message = Column(Text, nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )

    sources = relationship(
        "KnowledgeSourceModel",
        back_populates="agent",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    def to_dict(self) -> Dict[str, Any]:
        """Convert agent model to serializable dictionary for API responses."""
        docs = [s.to_dict() for s in self.sources] if self.sources else []
        total_chunks = sum(s.chunk_count for s in self.sources) if self.sources else 0
        return {
            "id": self.id,
            "slug": self.slug,
            "name": self.name,
            "description": self.description or "",
            "persona": self.persona,
            "tone": self.persona,
            "status": self.status,
            "target_url": self.target_url or "",
            "targetUrl": self.target_url or "",
            "system_prompt": self.system_prompt or "",
            "systemPrompt": self.system_prompt or "",
            "welcome_message": self.welcome_message or "",
            "welcomeMessage": self.welcome_message or "",
            "chunks_count": total_chunks,
            "chunksCount": total_chunks,
            "avatarIcon": (
                "shield"
                if "risk" in self.slug or "fintech" in self.slug
                else ("shopping-bag" if "commerce" in self.slug else "cpu")
            ),
            "scraperConfig": {
                "url": self.target_url or "",
                "crawlType": "single",
            },
            "documents": docs,
            "sources": docs,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None,
        }

    def __repr__(self) -> str:
        return f"<AgentModel(id='{self.id}', slug='{self.slug}', name='{self.name}', status='{self.status}')>"


class KnowledgeSourceModel(Base):
    """Database entity representing an ingested document or web source for an agent."""

    __tablename__ = "knowledge_sources"

    id = Column(String(64), primary_key=True, default=lambda: str(uuid.uuid4()))
    agent_id = Column(
        String(64),
        ForeignKey("agents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    source_type = Column(String(50), nullable=False)  # "web_text", "pdf", "docx", "xlsx", "txt"
    source_name = Column(String(255), nullable=False)  # URL or filename
    raw_content = Column(Text, nullable=True)
    chunk_count = Column(Integer, default=0, nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )

    agent = relationship("AgentModel", back_populates="sources")

    def to_dict(self) -> Dict[str, Any]:
        """Convert source model to serializable dictionary."""
        return {
            "id": self.id,
            "agent_id": self.agent_id,
            "source_type": self.source_type,
            "type": self.source_type,
            "source_name": self.source_name,
            "name": self.source_name,
            "chunk_count": self.chunk_count,
            "chunks_count": self.chunk_count,
            "size": f"{self.chunk_count} chunks",
            "raw_content": self.raw_content,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "uploadedAt": self.created_at.isoformat() if self.created_at else None,
        }

    def __repr__(self) -> str:
        return f"<KnowledgeSourceModel(id='{self.id}', agent_id='{self.agent_id}', name='{self.source_name}')>"


class AppSettingModel(Base):
    """Database entity representing a persistent application configuration setting."""

    __tablename__ = "app_settings"

    key = Column(String(128), primary_key=True, index=True)
    value = Column(Text, nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )

    def to_dict(self) -> Dict[str, Any]:
        """Convert model instance to serializable dictionary."""
        return {
            "key": self.key,
            "value": self.value,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    def __repr__(self) -> str:
        return f"<AppSettingModel(key='{self.key}', value='{self.value[:30]}...')>"


class TokenUsageLogModel(Base):
    """Database entity recording exact LLM token consumption per agent invocation."""

    __tablename__ = "token_usage_logs"

    id = Column(String(64), primary_key=True, default=lambda: str(uuid.uuid4()))
    agent_id = Column(
        String(64),
        ForeignKey("agents.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    model_name = Column(String(128), nullable=False)
    prompt_tokens = Column(Integer, nullable=False, default=0)
    completion_tokens = Column(Integer, nullable=False, default=0)
    total_tokens = Column(Integer, nullable=False, default=0)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )

    agent = relationship("AgentModel", backref="token_usage_logs")

    def to_dict(self) -> Dict[str, Any]:
        """Convert token log instance to serializable dictionary."""
        return {
            "id": self.id,
            "agent_id": self.agent_id,
            "model_name": self.model_name,
            "prompt_tokens": self.prompt_tokens,
            "completion_tokens": self.completion_tokens,
            "total_tokens": self.total_tokens,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

    def __repr__(self) -> str:
        return (
            f"<TokenUsageLogModel(id='{self.id}', agent_id='{self.agent_id}', "
            f"model='{self.model_name}', prompt={self.prompt_tokens}, completion={self.completion_tokens}, total={self.total_tokens})>"
        )

