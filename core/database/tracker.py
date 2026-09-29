"""Tracker service for capturing unanswered client queries and managing alert thresholds.

Normalizes raw query strings, monitors frequency of repeated unanswered questions,
and flags high-frequency queries (frequency >= 3) to trigger administrative alerts.
"""

from datetime import datetime, timezone
import logging
import re
from typing import Any, Dict, List, Optional
import uuid
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from config.settings import settings
from .connection import get_db_session
from .models import AgentModel, TokenUsageLogModel, UnansweredLog

logger = logging.getLogger(__name__)


def log_token_usage(
    agent_id: str,
    prompt_tokens: int,
    completion_tokens: int,
    total_tokens: Optional[int] = None,
    model_name: Optional[str] = None,
    session: Optional[Session] = None,
) -> Optional[TokenUsageLogModel]:
    """Record token consumption entry attributed directly to the active agent tenant.

    Resolves agent_id / slug to the actual database agent record, avoiding hardcoded fallbacks.
    """
    clean_agent_id = str(agent_id or "").strip()
    if not clean_agent_id:
        logger.warning("[TOKEN TRACKER] Missing agent_id / tenant_id; cannot log token usage.")
        return None

    p_tokens = int(prompt_tokens or 0)
    c_tokens = int(completion_tokens or 0)
    t_tokens = int(total_tokens if total_tokens is not None else (p_tokens + c_tokens))
    active_model = str(model_name or settings.LLM_MODEL)

    def _execute(s: Session) -> Optional[TokenUsageLogModel]:
        # Resolve target agent by id or slug to guarantee correct foreign key
        agent = s.query(AgentModel).filter(
            (AgentModel.id == clean_agent_id) | (AgentModel.slug == clean_agent_id)
        ).first()

        db_agent_id = agent.id if agent else None

        token_entry = TokenUsageLogModel(
            id=str(uuid.uuid4()),
            agent_id=db_agent_id,
            model_name=active_model,
            prompt_tokens=p_tokens,
            completion_tokens=c_tokens,
            total_tokens=t_tokens,
        )
        s.add(token_entry)
        s.flush()

        logger.info(
            f"📊 [TOKEN TRACKER] Agent: {clean_agent_id} | Prompt: {p_tokens} | Completion: {c_tokens} | Total: {t_tokens}"
        )
        return token_entry

    if session is not None:
        return _execute(session)

    with get_db_session() as managed_session:
        entry = _execute(managed_session)
        managed_session.commit()
        return entry


def normalize_query(query: str) -> str:
    """Normalize raw user query for frequency tracking.

    - Strips leading and trailing whitespace.
    - Converts to lowercase.
    - Strips punctuation symbols (question marks, exclamation, quotes, etc.).
    - Collapses multiple whitespace characters into a single space.

    Example:
        '  Do you offer ColdFusion support???  ' -> 'do you offer coldfusion support'
    """
    if not query:
        return ""
    # Lowercase
    cleaned = query.lower().strip()
    # Remove punctuation
    cleaned = re.sub(r"[^\w\s]", " ", cleaned)
    # Collapse multiple spaces
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned


def record_unanswered_query(
    raw_query: str, session: Optional[Session] = None
) -> Dict[str, Any]:
    """Record an unanswered query, increment frequency, and check alert threshold.

    Args:
        raw_query: Verbatim user query string.
        session: Optional SQLAlchemy session (defaults to context-managed session).

    Returns:
        Dict[str, Any]: Tracking record summary including:
            - id: Record ID
            - user_query: Original raw query
            - normalized_query: Normalized comparison key
            - frequency_count: Total times asked
            - alert_triggered: Current alert state
            - admin_alert_needed: True if this specific query reached threshold and triggered a new alert
            - status: Record status ('pending', 'resolved', 'ignored')
    """
    cleaned_query = (raw_query or "").strip()
    normalized = normalize_query(cleaned_query)

    if not normalized:
        logger.warning("Attempted to record empty query string.")
        return {
            "id": None,
            "user_query": cleaned_query,
            "normalized_query": "",
            "frequency_count": 0,
            "alert_triggered": False,
            "admin_alert_needed": False,
            "status": "ignored",
        }

    # Internal worker logic
    def _execute(s: Session) -> Dict[str, Any]:
        # Search for existing record by normalized query
        stmt = (
            select(UnansweredLog)
            .where(UnansweredLog.normalized_query == normalized)
            .order_by(UnansweredLog.id.asc())
        )
        log_entry = s.execute(stmt).scalars().first()

        threshold = settings.UNANSWERED_ALERT_THRESHOLD
        admin_alert_needed = False
        now_utc = datetime.now(timezone.utc)

        if log_entry:
            # Increment frequency count and update timestamp
            log_entry.frequency_count += 1
            log_entry.last_asked_at = now_utc
            # Update verbatim query to most recent phrasing if preferred
            log_entry.user_query = cleaned_query

            # Check threshold trigger: frequency >= 3 and alert not yet triggered
            if log_entry.frequency_count >= threshold and not log_entry.alert_triggered:
                log_entry.alert_triggered = True
                admin_alert_needed = True
                logger.warning(
                    "ALERT TRIGGERED: Query '%s' has reached frequency %d!",
                    normalized,
                    log_entry.frequency_count,
                )
            else:
                logger.info(
                    "Incremented frequency for query '%s' -> %d",
                    normalized,
                    log_entry.frequency_count,
                )
        else:
            # Create new log entry
            log_entry = UnansweredLog(
                user_query=cleaned_query,
                normalized_query=normalized,
                frequency_count=1,
                first_asked_at=now_utc,
                last_asked_at=now_utc,
                alert_triggered=False,
                status="pending",
            )
            s.add(log_entry)
            logger.info("Recorded new unanswered query: '%s'", normalized)

        s.flush()

        return {
            "id": log_entry.id,
            "user_query": log_entry.user_query,
            "normalized_query": log_entry.normalized_query,
            "frequency_count": log_entry.frequency_count,
            "alert_triggered": log_entry.alert_triggered,
            "admin_alert_needed": admin_alert_needed,
            "status": log_entry.status,
            "first_asked_at": (
                log_entry.first_asked_at.isoformat()
                if log_entry.first_asked_at
                else None
            ),
            "last_asked_at": (
                log_entry.last_asked_at.isoformat()
                if log_entry.last_asked_at
                else None
            ),
        }

    if session is not None:
        return _execute(session)

    with get_db_session() as managed_session:
        return _execute(managed_session)


def get_active_alerts(
    min_frequency: Optional[int] = None,
    session: Optional[Session] = None,
) -> List[Dict[str, Any]]:
    """Retrieve all unanswered queries meeting or exceeding the alert frequency threshold.

    Args:
        min_frequency: Minimum threshold (defaults to settings.UNANSWERED_ALERT_THRESHOLD, 3).
        session: Optional SQLAlchemy session.

    Returns:
        List[Dict[str, Any]]: List of matching unanswered query dictionaries.
    """
    threshold = (
        min_frequency
        if min_frequency is not None
        else settings.UNANSWERED_ALERT_THRESHOLD
    )

    def _execute(s: Session) -> List[Dict[str, Any]]:
        stmt = (
            select(UnansweredLog)
            .where(
                UnansweredLog.frequency_count >= threshold,
                UnansweredLog.status == "pending",
            )
            .order_by(
                desc(UnansweredLog.frequency_count),
                desc(UnansweredLog.last_asked_at),
            )
        )
        records = s.execute(stmt).scalars().all()
        return [record.to_dict() for record in records]

    if session is not None:
        return _execute(session)

    with get_db_session() as managed_session:
        return _execute(managed_session)
