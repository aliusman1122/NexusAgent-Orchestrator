"""Automated test suite for modular FastAPI backend v1 endpoints."""

from fastapi.testclient import TestClient
import pytest
from backend.main import app

client = TestClient(app)


def test_health_endpoints():
    """Verify health endpoints return 200 and operational health metadata."""
    for path in ("/health", "/api/v1/health", "/api/health"):
        response = client.get(path)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "A7 Logics" in data["service"]
        assert "database" in data
        assert "indexed_chunks" in data


def test_chat_v1_contract():
    """Verify POST /api/v1/chat satisfies production contract with stripped internal flags."""
    payload = {"message": "Hello!", "session_id": "test-sess-prod-1"}
    response = client.post("/api/v1/chat", json=payload)
    assert response.status_code == 200
    data = response.json()

    # Required contract fields
    assert "answer" in data
    assert isinstance(data["answer"], str)
    assert "A7 Logics" in data["answer"]
    assert data["session_id"] == "test-sess-prod-1"
    assert "timestamp" in data

    # Internal flags must be stripped
    assert "is_grounded" not in data
    assert "needs_alert" not in data
    assert "sources" not in data


def test_chat_empty_message_validation():
    """Verify POST /api/v1/chat rejects blank or whitespace-only messages."""
    response = client.post("/api/v1/chat", json={"message": "   "})
    assert response.status_code in (400, 422)


def test_admin_alerts_v1_endpoint():
    """Verify GET /api/v1/admin/alerts returns structured unresolved alerts schema."""
    response = client.get("/api/v1/admin/alerts")
    assert response.status_code == 200
    data = response.json()

    assert "count" in data
    assert "escalated_count" in data
    assert "threshold" in data
    assert "alerts" in data
    assert isinstance(data["alerts"], list)


def test_chat_v1_multi_tenant_contract():
    """Verify POST /api/v1/chat accepts tenant_id parameter for isolated routing."""
    payload = {
        "message": "Hello!",
        "session_id": "test-sess-multi-1",
        "tenant_id": "stripe_corp",
    }
    response = client.post("/api/v1/chat", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "answer" in data
    assert data["session_id"] == "test-sess-multi-1"


def test_admin_ingest_background_endpoint():
    """Verify POST /api/v1/admin/ingest returns 202 Accepted and schedules background task."""
    from unittest.mock import patch

    payload = {
        "tenant_id": "stripe_corp",
        "website_url": "https://stripe.com",
        "force_reindex": False,
    }
    with patch("backend.api.v1.endpoints.admin.index_all_sources") as mock_ingest:
        response = client.post("/api/v1/admin/ingest", json=payload)
        assert response.status_code == 202
        data = response.json()
        assert data["status"] == "accepted"
        assert "stripe_corp" in data["message"]
        assert data["tenant_id"] == "stripe_corp"
        assert "stripe.com" in data["target_url"]
        mock_ingest.assert_called_once()


def test_admin_collections_endpoint():
    """Verify GET /api/v1/admin/collections returns active collection names and chunk counts."""
    response = client.get("/api/v1/admin/collections")
    assert response.status_code == 200
    data = response.json()
    assert "count" in data
    assert "collections" in data
    assert isinstance(data["collections"], list)
    if data["count"] > 0:
        first = data["collections"][0]
        assert "name" in first
        assert "chunks" in first


def test_admin_agent_multipart_ingest_endpoint(tmp_path):
    """Verify POST /api/v1/admin/agents/{tenant_id}/ingest parses uploaded files and returns real chunk stats."""
    from unittest.mock import patch, MagicMock

    with patch("backend.api.v1.endpoints.admin.get_vector_store") as mock_get_store, \
         patch("backend.api.v1.endpoints.admin.LocalDocLoader") as mock_loader_cls, \
         patch("backend.api.v1.endpoints.admin.split_documents") as mock_split:

        mock_store = MagicMock()
        mock_store.get_existing_ids.return_value = {"id1", "id2", "id3"}
        mock_store.add_documents_deduplicated.return_value = (3, 0)
        mock_get_store.return_value = mock_store

        mock_loader = MagicMock()
        mock_doc = MagicMock()
        mock_doc.metadata = {}
        mock_loader.load_file.return_value = [mock_doc]
        mock_loader_cls.return_value = mock_loader

        mock_split.return_value = [MagicMock(), MagicMock(), MagicMock()]

        # Create dummy file bytes for upload
        dummy_file = ("sample_doc.docx", b"Mock docx binary data for ingestion", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")

        response = client.post(
            "/api/v1/admin/agents/fintech_risk_advisor/ingest",
            data={
                "website_url": "https://example.com/docs",
                "crawl_mode": "single",
                "agent_name": "Fintech Risk Advisor",
                "persona": "Technical",
            },
            files={"files": dummy_file},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert data["tenant_id"] == "fintech_risk_advisor"
        assert data["chunks_indexed"] == 3
        assert data["files_processed"] == 1
        assert "example.com" in data["url_scraped"]


def test_admin_scrape_preview_endpoint():
    """Verify POST /api/v1/admin/scrape-preview fetches text without indexing."""
    from unittest.mock import patch, MagicMock

    with patch("backend.api.v1.endpoints.admin.A7LogicsWebScraper") as mock_scraper_cls:
        mock_scraper = MagicMock()
        mock_scraper.fetch_html.return_value = "<html><head><title>Acme Corp Overview</title></head><body><p>Acme Corp builds cloud robots.</p></body></html>"
        mock_doc = MagicMock()
        mock_doc.page_content = "Acme Corp builds cloud robots."
        mock_scraper.scrape.return_value = [mock_doc]
        mock_scraper_cls.return_value = mock_scraper

        response = client.post(
            "/api/v1/admin/scrape-preview",
            json={"website_url": "https://acme.example.com", "crawl_mode": "single"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert "Acme Corp Overview" in data["extracted_title"]
        assert "Acme Corp builds cloud robots." in data["extracted_text"]
        assert data["estimated_chunks"] >= 1


def test_admin_provider_limits_endpoint():
    """Verify GET /api/v1/admin/provider-limits returns live provider quota telemetry."""
    response = client.get("/api/v1/admin/provider-limits")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "timestamp" in data
    assert "groq" in data
    assert "openrouter" in data
    assert "configured" in data["groq"]
    assert "status" in data["groq"]
    assert "configured" in data["openrouter"]
    assert "status" in data["openrouter"]


def test_admin_ingest_content_incremental_endpoint():
    """Verify POST /api/v1/admin/agents/{tenant_id}/ingest-content appends approved content."""
    from unittest.mock import patch, MagicMock

    with patch("backend.api.v1.endpoints.admin.get_vector_store") as mock_get_store:
        mock_store = MagicMock()
        mock_store.get_existing_ids.return_value = {"c1", "c2", "c3", "c4"}
        mock_store.add_documents_deduplicated.return_value = (2, 0)
        mock_get_store.return_value = mock_store

        payload = {
            "source_type": "web_text",
            "source_name": "https://acme.example.com/about",
            "content": "Acme Corp was founded in 2020 and specializes in autonomous logistics.",
            "agent_name": "Acme Bot",
            "persona": "Executive",
        }
        response = client.post(
            "/api/v1/admin/agents/acme_corp/ingest-content",
            json=payload,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert data["tenant_id"] == "acme_corp"
        assert data["chunks_added"] == 2
        assert data["total_chunks"] == 4


def test_admin_sources_get_and_delete_endpoints():
    """Verify GET and DELETE /api/v1/admin/agents/{tenant_id}/sources manage individual sources."""
    from unittest.mock import patch, MagicMock

    with patch("backend.api.v1.endpoints.admin.get_vector_store") as mock_get_store:
        mock_store = MagicMock()
        mock_col = MagicMock()
        mock_col.get.return_value = {
            "ids": ["id_1", "id_2", "id_3"],
            "metadatas": [
                {"source_name": "doc_a.pdf", "source_type": "pdf"},
                {"source_name": "doc_a.pdf", "source_type": "pdf"},
                {"source_name": "https://example.com", "source_type": "web_text"},
            ],
        }
        mock_col.count.return_value = 1
        mock_store.vector_store._collection = mock_col
        mock_get_store.return_value = mock_store

        # Test GET sources
        get_res = client.get("/api/v1/admin/agents/tenant_test/sources")
        assert get_res.status_code == 200
        sources_data = get_res.json()
        assert len(sources_data["sources"]) == 2
        assert sources_data["sources"][0]["source_name"] == "doc_a.pdf"
        assert sources_data["sources"][0]["chunks_count"] == 2

        # Test DELETE source
        del_res = client.delete("/api/v1/admin/agents/tenant_test/sources?source_name=doc_a.pdf")
        assert del_res.status_code == 200
        del_data = del_res.json()
        assert del_data["status"] == "success"
        assert del_data["deleted"] is True
        assert del_data["remaining_chunks"] == 1


def test_chat_v1_dynamic_agent_name_and_persona():
    """Verify POST /api/v1/chat adopts custom agent_name and persona tone."""
    payload = {
        "message": "Hello who are you?",
        "session_id": "test-dynamic-agent-1",
        "tenant_id": "real_estate_advisor",
        "agent_name": "Real Estate Advisor",
        "persona": "Casual",
    }
    response = client.post("/api/v1/chat", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "answer" in data
    # Answer should reflect Real Estate Advisor persona
    assert "Real Estate Advisor" in data["answer"]


def test_admin_agents_crud_endpoints():
    """Verify GET, POST, GET by slug, and DELETE /api/v1/admin/agents endpoints."""
    # 1. GET all agents
    res = client.get("/api/v1/admin/agents")
    assert res.status_code == 200
    agents = res.json()
    assert isinstance(agents, list)
    slugs = [a["slug"] for a in agents]
    assert "a7_logics" in slugs

    # 2. POST create new agent
    test_slug = "healthcare_triage_bot"
    payload = {
        "name": "Healthcare Triage Bot",
        "slug": test_slug,
        "description": "Patient intake and triage guidance.",
        "persona": "Executive",
        "target_url": "https://health.example.com",
    }
    create_res = client.post("/api/v1/admin/agents", json=payload)
    assert create_res.status_code == 201
    created = create_res.json()
    assert created["slug"] == test_slug
    assert created["name"] == "Healthcare Triage Bot"
    assert created["status"] == "Draft"

    # 3. GET agent by slug
    get_res = client.get(f"/api/v1/admin/agents/{test_slug}")
    assert get_res.status_code == 200
    agent_detail = get_res.json()
    assert agent_detail["slug"] == test_slug
    assert agent_detail["name"] == "Healthcare Triage Bot"
    assert "documents" in agent_detail or "sources" in agent_detail

    # 4. DELETE agent
    del_res = client.delete(f"/api/v1/admin/agents/{test_slug}")
    assert del_res.status_code == 200
    del_data = del_res.json()
    assert del_data["status"] == "success"

    # 5. Verify 404 after deletion
    after_del = client.get(f"/api/v1/admin/agents/{test_slug}")
    assert after_del.status_code == 404


def test_delete_source_dual_chroma_and_postgresql_sync():
    """Verify DELETE /api/v1/admin/agents/{tenant_id}/sources synchronizes PostgreSQL and ChromaDB."""
    from core.database.connection import get_db_session
    from core.database.models import AgentModel, KnowledgeSourceModel

    test_agent_slug = "sync_delete_test_agent"
    source_filename = "test_policy_document.pdf"

    with get_db_session() as db:
        # Clean up any existing
        existing = db.query(AgentModel).filter(AgentModel.slug == test_agent_slug).first()
        if existing:
            db.delete(existing)
            db.commit()

        # Create test agent
        agent = AgentModel(
            slug=test_agent_slug,
            name="Sync Delete Test Agent",
            persona="Technical",
            status="Ready",
        )
        db.add(agent)
        db.flush()

        # Add source in PostgreSQL
        src = KnowledgeSourceModel(
            agent_id=agent.id,
            source_type="pdf",
            source_name=source_filename,
            raw_content="This is test policy content for PostgreSQL dual delete verification.",
            chunk_count=5,
        )
        db.add(src)
        db.commit()

    # 1. Verify GET /sources returns the PostgreSQL source
    get_res = client.get(f"/api/v1/admin/agents/{test_agent_slug}/sources")
    assert get_res.status_code == 200
    sources_data = get_res.json()
    assert len(sources_data["sources"]) == 1
    assert sources_data["sources"][0]["source_name"] == source_filename
    assert sources_data["sources"][0]["chunks_count"] == 5

    # 2. DELETE source via API (query param)
    del_res = client.delete(f"/api/v1/admin/agents/{test_agent_slug}/sources?source_name={source_filename}")
    assert del_res.status_code == 200
    del_data = del_res.json()
    assert del_data["status"] == "success"
    assert del_data["deleted"] is True

    # 3. Verify PostgreSQL knowledge_sources table no longer contains the row
    with get_db_session() as db:
        agent = db.query(AgentModel).filter(AgentModel.slug == test_agent_slug).first()
        assert agent is not None
        remaining_db_sources = db.query(KnowledgeSourceModel).filter(KnowledgeSourceModel.agent_id == agent.id).all()
        assert len(remaining_db_sources) == 0

    # 4. Verify GET /sources immediately reflects 0 sources
    after_get = client.get(f"/api/v1/admin/agents/{test_agent_slug}/sources")
    assert after_get.status_code == 200
    after_sources = after_get.json()
    assert len(after_sources["sources"]) == 0
    assert after_sources["total_chunks"] == 0

    # 5. Test Body-based deletion: add second source and delete via JSON body
    with get_db_session() as db:
        agent = db.query(AgentModel).filter(AgentModel.slug == test_agent_slug).first()
        src2 = KnowledgeSourceModel(
            agent_id=agent.id,
            source_type="docx",
            source_name="body_deleted_policy.docx",
            raw_content="Content to be deleted via json body.",
            chunk_count=2,
        )
        db.add(src2)
        db.commit()

    del_body_res = client.request(
        "DELETE",
        f"/api/v1/admin/agents/{test_agent_slug}/sources",
        json={"source_name": "body_deleted_policy.docx"},
    )
    assert del_body_res.status_code == 200
    del_body_data = del_body_res.json()
    assert del_body_data["status"] == "success"
    assert del_body_data["deleted"] is True

    # Clean up test agent
    with get_db_session() as db:
        agent = db.query(AgentModel).filter(AgentModel.slug == test_agent_slug).first()
        if agent:
            db.delete(agent)
            db.commit()


def test_direct_note_ingest_and_update_reindex():
    """Test raw_note ingestion and subsequent update with ChromaDB re-indexing."""
    from core.database.connection import get_db_session
    from core.database.models import AgentModel, KnowledgeSourceModel
    from core.ingestion.vector_store import delete_collection

    test_agent_slug = "test_note_agent"
    delete_collection(test_agent_slug)

    with get_db_session() as db:
        agent = db.query(AgentModel).filter(AgentModel.slug == test_agent_slug).first()
        if agent:
            db.delete(agent)
            db.commit()

        agent = AgentModel(
            slug=test_agent_slug,
            name="Test Note Agent",
            description="Agent for testing direct notes and edit re-indexing",
            persona="Technical Support",
            status="Draft",
        )
        db.add(agent)
        db.commit()
        db.refresh(agent)

    # 1. Ingest raw_note via POST /api/v1/admin/agents/{tenant_id}/ingest-content
    note_payload = {
        "source_type": "raw_note",
        "source_name": "Office Hours & Escalation Policy",
        "content": "Standard office hours are Monday through Friday, 9:00 AM to 6:00 PM EST. For critical P1 incidents, escalate immediately via the emergency pager.",
    }
    ingest_res = client.post(
        f"/api/v1/admin/agents/{test_agent_slug}/ingest-content",
        json=note_payload,
    )
    assert ingest_res.status_code == 200
    ingest_data = ingest_res.json()
    assert ingest_data["status"] == "success"
    assert ingest_data["source_name"] == "Office Hours & Escalation Policy"
    assert ingest_data["source_type"] == "raw_note"
    assert ingest_data["chunks_added"] >= 1

    # 2. Verify stored in DB and GET /api/v1/admin/agents/{tenant_id}/sources returns raw_content
    sources_res = client.get(f"/api/v1/admin/agents/{test_agent_slug}/sources")
    assert sources_res.status_code == 200
    sources_data = sources_res.json()
    assert sources_data["total_chunks"] >= 1
    found_src = next((s for s in sources_data["sources"] if s["source_name"] == "Office Hours & Escalation Policy"), None)
    assert found_src is not None
    assert found_src["id"] is not None
    assert found_src["raw_content"] == note_payload["content"]
    assert found_src["source_type"] == "raw_note"

    source_id = found_src["id"]

    # 3. Update the source via PUT /api/v1/admin/agents/{tenant_id}/sources/{source_id}
    updated_content = "UPDATED POLICY: Office hours are now 24/7 round the clock for all enterprise tier clients. Escalation triggers within 15 minutes of P1 alert."
    update_res = client.put(
        f"/api/v1/admin/agents/{test_agent_slug}/sources/{source_id}",
        json={"updated_content": updated_content},
    )
    assert update_res.status_code == 200
    update_data = update_res.json()
    assert update_data["id"] == source_id
    assert update_data["raw_content"] == updated_content
    assert update_data["chunks_count"] >= 1

    # Verify PostgreSQL has updated raw_content
    with get_db_session() as db:
        src_row = db.query(KnowledgeSourceModel).filter(KnowledgeSourceModel.id == source_id).first()
        assert src_row is not None
        assert src_row.raw_content == updated_content

    # Clean up
    delete_collection(test_agent_slug)
    with get_db_session() as db:
        agent = db.query(AgentModel).filter(AgentModel.slug == test_agent_slug).first()
        if agent:
            db.delete(agent)
            db.commit()


def test_custom_system_prompt_persistence_and_generation():
    """Test custom system prompt persistence in PostgreSQL, API retrieval, and LangGraph generate node."""
    from core.database.connection import get_db_session
    from core.database.models import AgentModel
    from core.graph.nodes import generate_grounded_answer_node, generate_node
    from langchain_core.documents import Document

    test_slug = "custom_prompt_agent"
    custom_instructions = "CUSTOM DIRECTIVE: Always emphasize 99.99% SLA and ISO-27001 compliance."

    # 1. Create or clean test agent
    with get_db_session() as db:
        agent = db.query(AgentModel).filter(AgentModel.slug == test_slug).first()
        if agent:
            db.delete(agent)
            db.commit()

        agent = AgentModel(
            slug=test_slug,
            name="Prompt Test Agent",
            description="Agent testing custom system instructions",
            persona="Technical",
            status="Ready",
            system_prompt=custom_instructions,
        )
        db.add(agent)
        db.commit()

    # 2. Verify GET /api/v1/admin/agents/{slug} returns system_prompt
    res = client.get(f"/api/v1/admin/agents/{test_slug}")
    assert res.status_code == 200
    agent_data = res.json()
    assert agent_data["system_prompt"] == custom_instructions
    assert agent_data["systemPrompt"] == custom_instructions

    # 3. Verify PUT /api/v1/admin/agents/{slug} updates system_prompt
    new_instructions = "UPDATED DIRECTIVE: Answer strictly in bullet points and highlight zero-trust architecture."
    put_res = client.put(
        f"/api/v1/admin/agents/{test_slug}",
        json={"system_prompt": new_instructions},
    )
    assert put_res.status_code == 200
    put_data = put_res.json()
    assert put_data["system_prompt"] == new_instructions

    # 4. Verify DB has new instructions
    with get_db_session() as db:
        agent = db.query(AgentModel).filter(AgentModel.slug == test_slug).first()
        assert agent is not None
        assert agent.system_prompt == new_instructions

    # 5. Verify generate_node alias exists and generate_grounded_answer_node pulls system_prompt
    assert generate_node == generate_grounded_answer_node

    # Clean up test agent
    with get_db_session() as db:
        agent = db.query(AgentModel).filter(AgentModel.slug == test_slug).first()
        if agent:
            db.delete(agent)
            db.commit()




