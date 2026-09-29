"""Dynamic LLM Factory for A7 Logics Enterprise AI Agent.

Resolves active provider, model, and credentials from PostgreSQL `app_settings`
with fallback to environment variables.
Supports Groq, OpenRouter, and direct OpenAI.
"""

import logging
import os
from typing import Any, Dict, Optional, Tuple
from langchain_groq import ChatGroq
from langchain_openai import ChatOpenAI

from config.settings import settings
from core.database.connection import get_db_session
from core.database.models import AppSettingModel

logger = logging.getLogger(__name__)


def get_stored_app_settings() -> Dict[str, str]:
    """Retrieve all current app_settings key-value pairs from database."""
    try:
        with get_db_session() as session:
            rows = session.query(AppSettingModel).all()
            return {row.key: row.value for row in rows}
    except Exception as exc:
        logger.warning("Could not load app_settings from DB (%s), using env fallbacks.", exc)
        return {}


def get_configured_llm_info() -> Tuple[str, str]:
    """Return (active_provider, active_model) as configured."""
    db_settings = get_stored_app_settings()
    active_provider = (db_settings.get("active_provider") or "groq").strip().lower()
    active_model = (
        db_settings.get("active_model")
        or settings.LLM_MODEL
        or "llama-3.3-70b-versatile"
    ).strip()

    if active_provider == "openai":
        active_provider = "openrouter"

    if active_provider == "groq" and (
        active_model.startswith("anthropic/")
        or active_model.startswith("google/")
        or active_model.startswith("deepseek/")
        or active_model.startswith("meta-llama/")
        or active_model.startswith("x-ai/")
        or active_model.startswith("mistralai/")
        or active_model.startswith("openai/")
        or active_model.startswith("openrouter/")
        or "/" in active_model
        or ":" in active_model
    ):
        active_provider = "openrouter"

    return active_provider, active_model


def get_configured_llm(
    temperature: Optional[float] = None,
    max_tokens: Optional[int] = None,
    provider_override: Optional[str] = None,
    model_override: Optional[str] = None,
) -> Any:
    """Instantiate and return the currently configured LLM instance.

    Reads active_provider, active_model, and API keys from app_settings with
    environment variable fallbacks. Supports Groq LPUs and OpenRouter Unified.
    """
    db_settings = get_stored_app_settings()

    active_provider = (
        provider_override
        or db_settings.get("active_provider")
        or "groq"
    ).strip().lower()

    if active_provider == "openai":
        active_provider = "openrouter"

    active_model = (
        model_override
        or db_settings.get("active_model")
        or settings.LLM_MODEL
        or "llama-3.3-70b-versatile"
    ).strip()

    temp = settings.LLM_TEMPERATURE if temperature is None else temperature
    tokens = settings.LLM_MAX_TOKENS if max_tokens is None else max_tokens

    groq_api_key = (
        db_settings.get("groq_api_key")
        or settings.GROQ_API_KEY
        or os.getenv("GROQ_API_KEY", "")
    ).strip()
    openrouter_api_key = (
        db_settings.get("openrouter_api_key")
        or os.getenv("OPENROUTER_API_KEY", "")
    ).strip()

    # Known native Groq model families hosted on Groq LPUs
    groq_native_prefixes = (
        "openai/gpt-oss",
        "qwen/",
        "meta-llama/llama-prompt-guard",
        "whisper-",
        "canopylabs/",
        "allam-",
        "llama",
    )

    # Infer or fallback provider
    if active_provider == "openrouter":
        if not openrouter_api_key and groq_api_key:
            logger.warning("OpenRouter API key missing, falling back to Groq.")
            active_provider = "groq"
    elif active_provider == "groq":
        # Only switch to OpenRouter if model is explicitly an external provider AND openrouter_api_key exists
        if (
            not any(active_model.startswith(p) for p in groq_native_prefixes)
            and (
                active_model.startswith("anthropic/")
                or active_model.startswith("google/")
                or active_model.startswith("deepseek/")
                or active_model.startswith("x-ai/")
                or active_model.startswith("mistralai/")
                or active_model.startswith("openrouter/")
            )
            and openrouter_api_key
        ):
            active_provider = "openrouter"

    if active_provider == "groq":
        clean_model = active_model.replace("groq/", "")
        llm = ChatGroq(
            model_name=clean_model,
            groq_api_key=groq_api_key or "missing_groq_key",
            temperature=temp,
            max_tokens=tokens,
        )
        object.__setattr__(llm, "_active_model_name", clean_model)
        object.__setattr__(llm, "_active_provider_name", "groq")
        logger.debug("Initialized Groq LLM: model=%s", clean_model)
        return llm

    elif active_provider == "openrouter":
        clean_model = active_model
        openrouter_api_key = (
            db_settings.get("openrouter_api_key")
            or os.getenv("OPENROUTER_API_KEY", "")
        ).strip()
        llm = ChatOpenAI(
            model=clean_model,
            api_key=openrouter_api_key or "missing_openrouter_key",
            base_url="https://openrouter.ai/api/v1",
            temperature=temp,
            max_tokens=tokens,
        )
        object.__setattr__(llm, "_active_model_name", clean_model)
        object.__setattr__(llm, "_active_provider_name", "openrouter")
        logger.debug("Initialized OpenRouter LLM: model=%s", clean_model)
        return llm

    else:
        logger.warning("Unrecognized provider '%s', falling back to Groq.", active_provider)
        clean_model = active_model.replace("groq/", "")
        groq_api_key = (
            db_settings.get("groq_api_key")
            or settings.GROQ_API_KEY
            or os.getenv("GROQ_API_KEY", "")
        ).strip()
        llm = ChatGroq(
            model_name=clean_model,
            groq_api_key=groq_api_key or "missing_groq_key",
            temperature=temp,
            max_tokens=tokens,
        )
        object.__setattr__(llm, "_active_model_name", clean_model)
        object.__setattr__(llm, "_active_provider_name", "groq")
        return llm
