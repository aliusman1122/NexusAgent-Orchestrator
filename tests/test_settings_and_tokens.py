"""Unit and integration tests for Global Admin Settings and Exact Token Usage Tracking."""

import uuid
from fastapi.testclient import TestClient
import pytest
from backend.main import app
from core.database.connection import get_db_session
from core.database.models import AgentModel, AppSettingModel, TokenUsageLogModel
from core.llm_factory import get_configured_llm, get_stored_app_settings

client = TestClient(app)


def test_get_admin_settings():
    """Verify GET /api/v1/admin/settings returns active configuration keys for Groq and OpenRouter."""
    res = client.get("/api/v1/admin/settings")
    assert res.status_code == 200
    data = res.json()
    assert "active_provider" in data
    assert "active_model" in data
    assert "token_monthly_quota" in data
    assert "groq_api_key" in data
    assert "openrouter_api_key" in data


def test_update_admin_settings():
    """Verify POST /api/v1/admin/settings updates and persists settings in database."""
    payload = {
        "active_provider": "openrouter",
        "active_model": "anthropic/claude-3.5-sonnet",
        "token_monthly_quota": "2500000",
        "openrouter_api_key": "sk-or-test-mock-key-12345",
    }
    res = client.post("/api/v1/admin/settings", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert data["settings"]["active_provider"] == "openrouter"
    assert data["settings"]["active_model"] == "anthropic/claude-3.5-sonnet"
    assert data["settings"]["token_monthly_quota"] == "2500000"
    assert data["settings"]["openrouter_api_key"] == "sk-or-test-mock-key-12345"

    # Verify directly in DB
    with get_db_session() as db:
        row = db.query(AppSettingModel).filter(AppSettingModel.key == "active_model").first()
        assert row is not None
        assert row.value == "anthropic/claude-3.5-sonnet"

    # Reset back to default
    client.post(
        "/api/v1/admin/settings",
        json={
            "active_provider": "groq",
            "active_model": "llama-3.3-70b-versatile",
            "token_monthly_quota": "1000000",
        },
    )


def test_get_available_models():
    """Verify GET /api/v1/admin/settings/models returns combined Groq and live OpenRouter models."""
    res = client.get("/api/v1/admin/settings/models?refresh=true")
    assert res.status_code == 200
    models = res.json()
    assert isinstance(models, list)
    assert len(models) >= 2

    model_ids = [m["id"] for m in models]
    assert "groq/llama-3.3-70b-versatile" in model_ids

    # Verify OpenRouter models are returned and properly categorized
    or_models = [m for m in models if m["provider"] == "openrouter"]
    assert len(or_models) > 0
    or_ids = [m["id"] for m in or_models]
    # Check popular model presence
    assert any("gpt-4o" in mid or "claude" in mid for mid in or_ids)


def test_token_analytics_endpoint():
    """Verify GET /api/v1/admin/analytics/tokens returns exact computed metrics and breakdowns."""
    test_agent_slug = f"test_token_agent_{uuid.uuid4().hex[:6]}"
    try:
        with get_db_session() as db:
            agent = AgentModel(
                id=test_agent_slug,
                slug=test_agent_slug,
                name="Token Test Bot",
                status="Ready",
            )
            db.add(agent)
            db.flush()

            # Insert known token usage records across different models & providers
            log1 = TokenUsageLogModel(
                id=str(uuid.uuid4()),
                agent_id=agent.id,
                model_name="llama-3.3-70b-versatile",
                prompt_tokens=150,
                completion_tokens=50,
                total_tokens=200,
            )
            log2 = TokenUsageLogModel(
                id=str(uuid.uuid4()),
                agent_id=agent.id,
                model_name="llama-3.3-70b-versatile",
                prompt_tokens=300,
                completion_tokens=100,
                total_tokens=400,
            )
            log3 = TokenUsageLogModel(
                id=str(uuid.uuid4()),
                agent_id=agent.id,
                model_name="anthropic/claude-3.5-sonnet",
                prompt_tokens=200,
                completion_tokens=100,
                total_tokens=300,
            )
            db.add_all([log1, log2, log3])
            db.commit()

        res = client.get("/api/v1/admin/analytics/tokens")
        assert res.status_code == 200
        data = res.json()

        assert data["total_consumed"] >= 900
        assert data["monthly_quota"] >= 1000000
        assert data["remaining_tokens"] == data["monthly_quota"] - data["total_consumed"]
        assert "prompt_tokens" in data
        assert "completion_tokens" in data

        # Check breakdown for our test agent
        agent_breakdown = next(
            (a for a in data["agents_breakdown"] if a["agent_id"] == test_agent_slug),
            None,
        )
        assert agent_breakdown is not None
        assert agent_breakdown["total_tokens"] == 900
        assert agent_breakdown["queries_count"] == 3
        assert agent_breakdown["agent_name"] == "Token Test Bot"

        # Check by_model breakdown
        assert "by_model" in data
        assert isinstance(data["by_model"], list)
        assert len(data["by_model"]) >= 2
        model_names = [m["model"] for m in data["by_model"]]
        assert "llama-3.3-70b-versatile" in model_names
        assert "anthropic/claude-3.5-sonnet" in model_names
        for m in data["by_model"]:
            assert "tokens" in m and isinstance(m["tokens"], int)
            assert "percentage" in m and isinstance(m["percentage"], (int, float))

        # Check by_provider breakdown: streamlined into groq and openrouter
        assert "by_provider" in data
        assert "groq" in data["by_provider"]
        assert "openrouter" in data["by_provider"]
        assert data["by_provider"]["groq"] >= 600
        assert data["by_provider"]["openrouter"] >= 300
    finally:
        with get_db_session() as db:
            db.query(TokenUsageLogModel).filter(TokenUsageLogModel.agent_id == test_agent_slug).delete(synchronize_session=False)
            db.query(AgentModel).filter(AgentModel.id == test_agent_slug).delete(synchronize_session=False)
            db.commit()


def test_custom_model_manual_entry():
    """Verify custom manual model entry (e.g. meta-llama/llama-3.1-8b-instruct:free or x-ai/grok-2)."""
    custom_model_id = "meta-llama/llama-3.1-8b-instruct:free"
    payload = {
        "active_provider": "openrouter",
        "active_model": custom_model_id,
        "token_monthly_quota": "2000000",
    }
    # Update with custom model string
    res = client.post("/api/v1/admin/settings", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert data["settings"]["active_model"] == custom_model_id

    # Verify GET returns custom model string without rejection or modification
    get_res = client.get("/api/v1/admin/settings")
    assert get_res.status_code == 200
    assert get_res.json()["active_model"] == custom_model_id

    # Verify dynamic LLM factory initializes with this custom model ID via OpenRouter
    custom_llm = get_configured_llm()
    assert getattr(custom_llm, "model_name", None) == custom_model_id

    # Reset back to default
    client.post(
        "/api/v1/admin/settings",
        json={
            "active_provider": "groq",
            "active_model": "llama-3.3-70b-versatile",
            "token_monthly_quota": "1000000",
        },
    )


def test_dynamic_llm_factory():
    """Verify LLM factory dynamically initializes appropriate provider client."""
    # Test Groq
    groq_llm = get_configured_llm(provider_override="groq", model_override="llama-3.3-70b-versatile")
    assert groq_llm is not None

    # Test OpenRouter
    or_llm = get_configured_llm(
        provider_override="openrouter",
        model_override="anthropic/claude-3.5-sonnet",
    )
    assert or_llm is not None
    assert getattr(or_llm, "model_name", None) == "anthropic/claude-3.5-sonnet"

    # Test GPT-4o routed via OpenRouter
    openai_via_or_llm = get_configured_llm(
        provider_override="openrouter",
        model_override="openai/gpt-4o",
    )
    assert openai_via_or_llm is not None
    assert getattr(openai_via_or_llm, "model_name", None) == "openai/gpt-4o"


