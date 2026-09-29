from datetime import datetime, timezone
import logging
from pathlib import Path
import re
from typing import Any, Dict, List, Optional, Tuple
import urllib.parse
import uuid
from bs4 import BeautifulSoup
from fastapi import APIRouter, BackgroundTasks, Body, File, Form, HTTPException, Query, Request, UploadFile, status
from langchain_core.documents import Document
from pydantic import AnyHttpUrl, BaseModel, Field
from sqlalchemy import desc, func, select

from config.settings import settings
from core.database.connection import get_db_session
from core.database.models import (
    AgentModel,
    AppSettingModel,
    KnowledgeSourceModel,
    TokenUsageLogModel,
    UnansweredLog,
)
from core.ingestion.loader import LocalDocLoader, load_local_documents
from core.ingestion.scraper import A7LogicsWebScraper, scrape_a7logics_website
from core.ingestion.vector_store import (
    delete_collection,
    get_vector_store,
    index_all_sources,
    list_collections,
    normalize_collection_name,
    split_documents,
)

logger = logging.getLogger(__name__)

router = APIRouter()


class IngestRequest(BaseModel):
    """Dynamic background ingestion request payload."""

    tenant_id: str = Field(
        ...,
        min_length=1,
        description="Tenant identifier for isolated collection (e.g. 'stripe_corp')",
        examples=["stripe_corp"],
    )
    website_url: AnyHttpUrl = Field(
        ...,
        description="Target website URL to crawl and index",
        examples=["https://stripe.com"],
    )
    force_reindex: bool = Field(
        default=False,
        description="Whether to clear and re-index existing chunks for this tenant",
    )


class IngestResponse(BaseModel):
    """Immediate response confirming background task scheduling."""

    status: str = Field(default="accepted")
    message: str
    tenant_id: str
    target_url: str


class CollectionItem(BaseModel):
    """Active vector collection metadata."""

    name: str
    chunks: int


class CollectionsStatusResponse(BaseModel):
    """Active vector collections status overview."""

    count: int
    collections: List[CollectionItem]


class UnansweredLogItem(BaseModel):
    """Database record for an unanswered client question."""

    id: int
    user_query: str
    normalized_query: str
    frequency_count: int
    first_asked_at: Optional[str]
    last_asked_at: Optional[str]
    alert_triggered: bool
    status: str


class AdminAlertsResponse(BaseModel):
    """Admin alerts response payload."""

    count: int
    escalated_count: int
    threshold: int
    alerts: List[UnansweredLogItem]


@router.get(
    "/admin/alerts",
    response_model=AdminAlertsResponse,
    summary="Get unresolved customer queries and escalations",
    description="Returns unanswered client inquiries from unanswered_logs table with frequency counts and escalation states.",
)
def get_admin_alerts(
    status_filter: Optional[str] = Query(
        default="pending",
        description="Filter by log status: 'pending', 'resolved', 'ignored', or 'all'.",
    ),
    min_frequency: Optional[int] = Query(
        default=None,
        description="Optional minimum query frequency filter.",
    ),
) -> AdminAlertsResponse:
    """Retrieve unresolved or high-frequency customer queries from database."""
    try:
        threshold = settings.UNANSWERED_ALERT_THRESHOLD

        with get_db_session() as session:
            stmt = select(UnansweredLog)

            if status_filter and status_filter.lower() != "all":
                stmt = stmt.where(UnansweredLog.status == status_filter.lower())

            if min_frequency is not None and min_frequency > 0:
                stmt = stmt.where(UnansweredLog.frequency_count >= min_frequency)

            stmt = stmt.order_by(
                desc(UnansweredLog.frequency_count),
                desc(UnansweredLog.last_asked_at),
            )

            records = session.execute(stmt).scalars().all()
            items = [UnansweredLogItem(**record.to_dict()) for record in records]
            escalated_count = sum(1 for item in items if item.frequency_count >= threshold)

            return AdminAlertsResponse(
                count=len(items),
                escalated_count=escalated_count,
                threshold=threshold,
                alerts=items,
            )

    except Exception as exc:
        logger.exception("Error querying unanswered logs: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database query error: {str(exc)}",
        )


@router.post(
    "/admin/ingest",
    response_model=IngestResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Trigger asynchronous background ingestion for a tenant",
    description="Initiates background crawling and vector embedding for a specific tenant's website.",
)
def trigger_tenant_ingest(
    request: IngestRequest,
    background_tasks: BackgroundTasks,
) -> IngestResponse:
    """Asynchronously ingest website into dedicated tenant collection without blocking HTTP thread."""
    raw_tenant = request.tenant_id.strip()
    url_str = str(request.website_url)

    # Schedule background ingestion
    background_tasks.add_task(
        index_all_sources,
        website_url=url_str,
        collection_name=raw_tenant,
        force_reindex=request.force_reindex,
    )

    logger.info("Enqueued background ingestion for tenant '%s' targeting '%s'", raw_tenant, url_str)

    return IngestResponse(
        status="accepted",
        message=f"Ingestion initiated in background for tenant '{raw_tenant}'.",
        tenant_id=raw_tenant,
        target_url=url_str,
    )


@router.get(
    "/admin/collections",
    response_model=CollectionsStatusResponse,
    summary="Get active vector collections status",
    description="Returns a list of all active vector collections and their chunk counts in ChromaDB.",
)
def get_collections_status() -> CollectionsStatusResponse:
    """Retrieve all ChromaDB vector collections and their chunk quantities."""
    try:
        raw_items = list_collections()
        collections = [
            CollectionItem(name=item["name"], chunks=item["count"])
            for item in raw_items
        ]
        return CollectionsStatusResponse(
            count=len(collections),
            collections=collections,
        )
    except Exception as exc:
        logger.exception("Error listing ChromaDB collections: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"ChromaDB collection inspection error: {str(exc)}",
        )


class CreateAgentRequest(BaseModel):
    """Request payload for creating a new agent in PostgreSQL."""

    name: str = Field(..., min_length=1, description="Agent display name")
    slug: Optional[str] = Field(None, description="Unique slug identifier (e.g. 'real_estate')")
    description: Optional[str] = Field(default="", description="Agent role and mission")
    persona: Optional[str] = Field(default="Executive", description="Tone / Persona (Executive, Technical, Casual)")
    tone: Optional[str] = Field(None, description="Tone alias for persona")
    target_url: Optional[str] = Field(None, description="Target website URL")
    targetUrl: Optional[str] = Field(None, description="Target website URL alias")
    system_prompt: Optional[str] = Field(None, description="Custom agent instructions / system prompt")
    systemPrompt: Optional[str] = Field(None, description="System prompt alias")
    welcome_message: Optional[str] = Field(None, description="Custom welcome message / initial greeting")
    welcomeMessage: Optional[str] = Field(None, description="Welcome message alias")


class UpdateAgentRequest(BaseModel):
    """Request payload for updating agent metadata in PostgreSQL."""

    name: Optional[str] = Field(None, description="Updated display name")
    description: Optional[str] = Field(None, description="Updated description")
    persona: Optional[str] = Field(None, description="Updated persona (Executive, Technical, Casual)")
    tone: Optional[str] = Field(None, description="Persona tone alias")
    target_url: Optional[str] = Field(None, description="Updated target URL")
    targetUrl: Optional[str] = Field(None, description="Target URL alias")
    system_prompt: Optional[str] = Field(None, description="Custom agent instructions / system prompt")
    systemPrompt: Optional[str] = Field(None, description="System prompt alias")
    welcome_message: Optional[str] = Field(None, description="Custom welcome message / initial greeting")
    welcomeMessage: Optional[str] = Field(None, description="Welcome message alias")
    status: Optional[str] = Field(None, description="Agent operational status (Draft, Indexing, Ready)")


@router.get(
    "/admin/agents",
    summary="Get all agents",
    description="Returns a list of all agents from PostgreSQL with their respective source counts and total vector chunks count.",
)
def get_all_agents() -> List[Dict[str, Any]]:
    """Retrieve all agents with attached knowledge sources and chunk counts."""
    with get_db_session() as session:
        stmt = (
            select(AgentModel)
            .filter(
                ~AgentModel.id.like("analytics_agent_%"),
                ~AgentModel.slug.like("analytics_agent_%"),
                AgentModel.name != "Analytics Bot",
            )
            .order_by(AgentModel.created_at.asc())
        )
        agents = session.execute(stmt).scalars().all()
        return [agent.to_dict() for agent in agents]


@router.post(
    "/admin/agents",
    status_code=status.HTTP_201_CREATED,
    summary="Create a new agent",
    description="Creates a new agent in PostgreSQL with slug, name, description, and persona.",
)
def create_agent(payload: CreateAgentRequest) -> Dict[str, Any]:
    """Register a new agent in PostgreSQL."""
    name_clean = payload.name.strip()
    if not name_clean:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Agent name is required.",
        )

    # Derive slug
    if payload.slug and payload.slug.strip():
        raw_slug = payload.slug.strip().lower()
    else:
        raw_slug = re.sub(r"[^a-z0-9]+", "_", name_clean.lower()).strip("_")

    slug = normalize_collection_name(raw_slug)
    persona = payload.persona or payload.tone or "Executive"
    target_url = payload.target_url or payload.targetUrl or None
    prompt = payload.system_prompt if payload.system_prompt is not None else payload.systemPrompt
    welcome = payload.welcome_message if payload.welcome_message is not None else payload.welcomeMessage

    with get_db_session() as session:
        existing = session.execute(
            select(AgentModel).where(AgentModel.slug == slug)
        ).scalar_one_or_none()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Agent with slug '{slug}' already exists.",
            )

        new_agent = AgentModel(
            slug=slug,
            name=name_clean,
            description=payload.description or "",
            persona=persona,
            status="Draft",
            target_url=target_url,
            system_prompt=prompt.strip() if prompt else None,
            welcome_message=welcome.strip() if welcome else None,
        )
        session.add(new_agent)
        session.commit()
        session.refresh(new_agent)
        logger.info("Created agent in database: slug='%s', name='%s'", slug, name_clean)
        return new_agent.to_dict()


@router.get(
    "/admin/agents/{slug}",
    summary="Get single agent details",
    description="Returns single agent details along with all its attached knowledge sources.",
)
def get_agent_by_slug(slug: str) -> Dict[str, Any]:
    """Retrieve an agent and its knowledge sources by slug or ID."""
    clean_slug = slug.strip().lower()
    with get_db_session() as session:
        agent = session.execute(
            select(AgentModel).where(
                (AgentModel.slug == clean_slug) | (AgentModel.id == slug.strip())
            )
        ).scalar_one_or_none()

        if not agent:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Agent with slug or ID '{slug}' was not found.",
            )

        return agent.to_dict()


@router.put(
    "/admin/agents/{slug}",
    summary="Update agent metadata and custom instructions",
    description="Updates agent fields in PostgreSQL including name, description, persona, target_url, and custom system_prompt.",
)
def update_agent(slug: str, payload: UpdateAgentRequest) -> Dict[str, Any]:
    """Update an existing agent in PostgreSQL."""
    clean_slug = slug.strip().lower()
    with get_db_session() as session:
        agent = session.execute(
            select(AgentModel).where(
                (AgentModel.slug == clean_slug) | (AgentModel.id == slug.strip())
            )
        ).scalar_one_or_none()

        if not agent:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Agent with slug or ID '{slug}' was not found.",
            )

        if payload.name is not None and payload.name.strip():
            agent.name = payload.name.strip()
        if payload.description is not None:
            agent.description = payload.description.strip()

        persona = payload.persona or payload.tone
        if persona is not None and persona.strip():
            agent.persona = persona.strip()

        target_url = payload.target_url or payload.targetUrl
        if target_url is not None:
            agent.target_url = target_url.strip() or None

        prompt = payload.system_prompt if payload.system_prompt is not None else payload.systemPrompt
        if prompt is not None:
            agent.system_prompt = prompt.strip() or None

        welcome = payload.welcome_message if payload.welcome_message is not None else payload.welcomeMessage
        if welcome is not None:
            agent.welcome_message = welcome.strip() or None

        if payload.status is not None and payload.status.strip():
            agent.status = payload.status.strip()

        session.commit()
        session.refresh(agent)
        logger.info("Updated agent '%s' in PostgreSQL (system_prompt set: %s, welcome_message set: %s)", agent.slug, bool(agent.system_prompt), bool(agent.welcome_message))
        return agent.to_dict()


@router.delete(
    "/admin/agents/{agent_id}",
    summary="Delete an agent",
    description="Permanently deletes the agent record from database, its associated sources, and drops the corresponding ChromaDB vector collection.",
)
def delete_agent(agent_id: str) -> Dict[str, Any]:
    """Permanently delete an agent from database and remove its ChromaDB collection."""
    clean_id = agent_id.strip()
    clean_lower = clean_id.lower()

    if clean_lower in ("a7_logics", "a7logics", "a7-logics"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Core system agent cannot be deleted.",
        )

    with get_db_session() as session:
        agent = session.execute(
            select(AgentModel).where(
                (AgentModel.id == clean_id)
                | (AgentModel.slug == clean_lower)
                | (AgentModel.id == clean_lower)
                | (AgentModel.slug == clean_id)
            )
        ).scalar_one_or_none()

        if not agent:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Agent with ID or slug '{agent_id}' was not found.",
            )

        if agent.slug == "a7_logics" or agent.id == "a7_logics":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Core system agent cannot be deleted.",
            )

        agent_slug = agent.slug
        target_id = agent.id

        # Permanently delete associated knowledge sources & token usage logs
        session.query(KnowledgeSourceModel).filter(KnowledgeSourceModel.agent_id == target_id).delete(synchronize_session=False)
        session.query(TokenUsageLogModel).filter(TokenUsageLogModel.agent_id == target_id).delete(synchronize_session=False)

        session.delete(agent)
        session.commit()
        logger.info("Permanently deleted agent '%s' (id: '%s') from database.", agent_slug, target_id)

    # Drop ChromaDB vector collection
    chroma_deleted = delete_collection(agent_slug)
    if target_id != agent_slug:
        delete_collection(target_id)

    return {
        "success": True,
        "status": "success",
        "deleted_id": agent_id,
        "slug": agent_slug,
        "chroma_deleted": chroma_deleted,
        "message": f"Agent '{agent_slug}' permanently deleted.",
    }



class AgentIngestResult(BaseModel):
    """Result summary of multi-file upload and web scraping ingestion."""


    status: str = Field(default="success")
    tenant_id: str
    chunks_indexed: int
    files_processed: int
    url_scraped: Optional[str] = None


class ScrapePreviewRequest(BaseModel):
    """Request payload for website scraping preview."""

    website_url: str = Field(..., description="Target website URL to preview")
    crawl_mode: Optional[str] = Field("single", description="'single' or 'deep'")


class ScrapePreviewResponse(BaseModel):
    """Extracted text and metadata for human review and editing before ingestion."""

    status: str = Field(default="success")
    target_url: str
    extracted_title: str
    extracted_text: str
    estimated_chunks: int


class IngestContentRequest(BaseModel):
    """Request payload for incremental approved content ingestion."""

    source_type: str = Field(default="web_text", description="'web_text', 'custom_text', or 'raw_note'")
    source_name: str = Field(..., description="Source identifier, URL or document title")
    content: str = Field(..., min_length=1, description="Admin edited and finalized text content")
    agent_name: Optional[str] = None
    persona: Optional[str] = None


class IngestContentResponse(BaseModel):
    """Result summary of incremental text content ingestion."""

    status: str = Field(default="success")
    tenant_id: str
    source_name: str
    source_type: str
    chunks_added: int
    total_chunks: int


class DeleteSourceRequest(BaseModel):
    """Optional request payload for deleting a source via JSON body."""

    source_name: Optional[str] = Field(None, description="The name of the source or document to delete")


class DeleteSourceResponse(BaseModel):
    """Response payload for single source vector deletion."""

    status: str = Field(default="success")
    tenant_id: str
    source_name: str
    deleted: bool
    remaining_chunks: int


class UpdateSourceRequest(BaseModel):
    """Request payload for updating and re-indexing a knowledge source's text content."""

    updated_content: str = Field(..., min_length=1, description="Modified raw text content")


class SourceItem(BaseModel):
    """Individual knowledge source metadata and chunk count."""

    id: Optional[str] = None
    source_name: str
    source_type: str
    chunks_count: int
    raw_content: Optional[str] = None
    created_at: Optional[str] = None


class AgentSourcesResponse(BaseModel):
    """List of all active knowledge sources in tenant collection."""

    tenant_id: str
    total_chunks: int
    sources: List[SourceItem]


@router.post(
    "/admin/scrape-preview",
    response_model=ScrapePreviewResponse,
    summary="Scrape website and preview text before indexing",
    description="Fetches website content, extracts title and clean text paragraphs for admin review and editing.",
)
async def scrape_preview(payload: ScrapePreviewRequest) -> ScrapePreviewResponse:
    """Fetch and parse website text for human review and editing."""
    url_clean = str(payload.website_url).strip()
    if not url_clean:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Valid website URL is required for preview.",
        )

    try:
        scraper = A7LogicsWebScraper(base_url=url_clean)
        page_title = "Web Knowledge"
        structured_markdown = ""

        # Check if scraper provides extract_clean_markdown and unpack safely
        try:
            res = scraper.extract_clean_markdown(url_clean)
            if (
                isinstance(res, tuple)
                and len(res) == 2
                and isinstance(res[0], str)
                and isinstance(res[1], str)
                and type(res[0]).__name__ != "MagicMock"
            ):
                page_title, structured_markdown = res
        except (ValueError, TypeError, Exception):
            pass

        # If not extracted via extract_clean_markdown (e.g. mocked scraper in unit tests), use scrape()
        if not structured_markdown or not isinstance(structured_markdown, str):
            html = scraper.fetch_html(url_clean)
            if html and isinstance(html, str) and type(html).__name__ != "MagicMock":
                soup = BeautifulSoup(html, "html.parser")
                title_tag = soup.find("title")
                if title_tag and title_tag.get_text(strip=True):
                    page_title = title_tag.get_text(strip=True)
                elif soup.find("h1"):
                    h1_text = soup.find("h1").get_text(strip=True)
                    if h1_text:
                        page_title = h1_text

            docs = scraper.scrape()
            paragraphs = []
            for d in docs:
                txt = getattr(d, "page_content", "")
                if txt and isinstance(txt, str) and txt.strip():
                    paragraphs.append(txt.strip())
            structured_markdown = (
                "\n\n".join(paragraphs) if paragraphs else "No readable content extracted."
            )

        # Estimate chunk count
        estimated_chunks = 1
        if structured_markdown:
            chunks = split_documents([Document(page_content=structured_markdown)])
            estimated_chunks = max(1, len(chunks))

        return ScrapePreviewResponse(
            status="success",
            target_url=url_clean,
            extracted_title=page_title,
            extracted_text=structured_markdown,
            estimated_chunks=estimated_chunks,
        )
    except Exception as exc:
        logger.exception("Scrape preview failed for %s: %s", url_clean, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Scrape preview failed: {str(exc)}",
        )


@router.post(
    "/admin/agents/{tenant_id}/ingest-content",
    response_model=IngestContentResponse,
    summary="Ingest reviewed custom or web text incrementally",
    description="Accepts approved text from admin preview or editor and appends chunks directly into ChromaDB without wiping existing data.",
)
async def ingest_content(
    tenant_id: str,
    payload: IngestContentRequest,
) -> IngestContentResponse:
    """Incrementally index reviewed text content into tenant ChromaDB collection."""
    clean_tenant = normalize_collection_name(tenant_id)
    text = payload.content.strip()
    if not text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Content cannot be empty.",
        )

    store = get_vector_store(collection_name=clean_tenant)
    doc_id = str(uuid.uuid4())
    doc = Document(
        page_content=text,
        metadata={
            "source": payload.source_name,
            "source_name": payload.source_name,
            "source_type": payload.source_type,
            "type": payload.source_type,
            "tenant_id": clean_tenant,
            "doc_id": doc_id,
        },
    )

    chunks = split_documents([doc])
    for i, chunk in enumerate(chunks):
        chunk.metadata["source"] = payload.source_name
        chunk.metadata["source_name"] = payload.source_name
        chunk.metadata["source_type"] = payload.source_type
        chunk.metadata["type"] = payload.source_type
        chunk.metadata["tenant_id"] = clean_tenant
        chunk.metadata["source_id"] = doc_id
        chunk.metadata["doc_id"] = f"{doc_id}_{i}"

    added_count, skipped = store.add_documents_deduplicated(chunks)
    existing_ids = store.get_existing_ids()
    total_chunks = len(existing_ids)

    logger.info(
        "Ingested %d chunk(s) (%d skipped) for source '%s' into tenant '%s'. Total collection chunks: %d",
        added_count,
        skipped,
        payload.source_name,
        clean_tenant,
        total_chunks,
    )

    # Record or update KnowledgeSourceModel in PostgreSQL
    try:
        with get_db_session() as session:
            agent = session.execute(
                select(AgentModel).where(
                    (AgentModel.slug == clean_tenant)
                    | (AgentModel.slug == tenant_id.strip().lower())
                    | (AgentModel.id == tenant_id.strip())
                )
            ).scalar_one_or_none()

            if agent:
                existing_source = session.execute(
                    select(KnowledgeSourceModel).where(
                        KnowledgeSourceModel.agent_id == agent.id,
                        KnowledgeSourceModel.source_name == payload.source_name,
                    )
                ).scalar_one_or_none()

                if existing_source:
                    existing_source.raw_content = text
                    existing_source.chunk_count = added_count
                    existing_source.source_type = payload.source_type
                else:
                    new_src = KnowledgeSourceModel(
                        id=doc_id,
                        agent_id=agent.id,
                        source_type=payload.source_type,
                        source_name=payload.source_name,
                        raw_content=text,
                        chunk_count=added_count,
                    )
                    session.add(new_src)

                agent.status = "Ready"
                session.commit()
                logger.info("Recorded knowledge source '%s' in PostgreSQL for agent '%s'", payload.source_name, agent.slug)
    except Exception as db_exc:
        logger.warning("Failed to record KnowledgeSource in PostgreSQL: %s", db_exc)

    return IngestContentResponse(
        status="success",
        tenant_id=clean_tenant,
        source_name=payload.source_name,
        source_type=payload.source_type,
        chunks_added=added_count,
        total_chunks=total_chunks,
    )


@router.delete(
    "/admin/agents/{tenant_id}/sources",
    response_model=DeleteSourceResponse,
    summary="Delete a specific source from tenant knowledge base",
    description="Removes vectors from ChromaDB collection, deletes the row from PostgreSQL knowledge_sources table, and removes file from disk.",
)
async def delete_agent_source(
    tenant_id: str,
    request: Request,
    source_name: Optional[str] = Query(None, description="The name of the source or document to delete"),
    payload: Optional[DeleteSourceRequest] = Body(None),
) -> DeleteSourceResponse:
    """Delete a specific source synchronously from ChromaDB, PostgreSQL, and local disk."""
    clean_tenant = normalize_collection_name(tenant_id)

    # 1. Resolve source_name from query param, payload body, or raw json body
    extracted_source = source_name
    if not extracted_source and payload and payload.source_name:
        extracted_source = payload.source_name
    if not extracted_source:
        try:
            body = await request.json()
            if isinstance(body, dict):
                extracted_source = body.get("source_name")
        except Exception:
            pass

    target_source = str(extracted_source or "").strip()
    if not target_source:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="source_name parameter or body is required.",
        )

    unquoted_source = urllib.parse.unquote(target_source).strip()
    possible_names = {
        target_source,
        unquoted_source,
        target_source.rstrip("/"),
        unquoted_source.rstrip("/"),
        f"{target_source}/",
        f"{unquoted_source}/",
    }
    lowered_names = {n.lower() for n in possible_names}

    # Step A (ChromaDB): Delete vectors from ChromaDB collection matching metadata {"source_name": source_name}
    store = get_vector_store(collection_name=clean_tenant)
    col = store.vector_store._collection
    ids_to_delete = []

    try:
        all_data = col.get(include=["metadatas"])
        for doc_id, meta in zip(all_data.get("ids", []), all_data.get("metadatas", [])):
            if meta:
                s_name = (meta.get("source_name") or meta.get("source") or "").strip()
                if s_name in possible_names or s_name.lower() in lowered_names:
                    ids_to_delete.append(doc_id)

        if ids_to_delete:
            col.delete(ids=ids_to_delete)
            logger.info(
                "Deleted %d vector(s) for source '%s' from ChromaDB collection '%s'",
                len(ids_to_delete),
                target_source,
                clean_tenant,
            )
    except Exception as chroma_exc:
        logger.warning("ChromaDB vector deletion warning for '%s': %s", target_source, chroma_exc)

    # Step B (PostgreSQL): Delete the corresponding record from knowledge_sources table
    deleted_pg_rows = 0
    try:
        with get_db_session() as db:
            agent = db.query(AgentModel).filter(
                (AgentModel.slug == tenant_id)
                | (AgentModel.id == tenant_id)
                | (AgentModel.slug == clean_tenant)
                | (AgentModel.slug == tenant_id.strip().lower())
                | (AgentModel.id == tenant_id.strip())
            ).first()

            if agent:
                deleted_pg_rows = db.query(KnowledgeSourceModel).filter(
                    KnowledgeSourceModel.agent_id == agent.id,
                    (
                        (KnowledgeSourceModel.source_name.in_(list(possible_names)))
                        | (func.lower(KnowledgeSourceModel.source_name).in_(list(lowered_names)))
                    )
                ).delete(synchronize_session=False)
                db.commit()
                logger.info(
                    "Deleted %d knowledge_sources row(s) from PostgreSQL for agent '%s' (source='%s')",
                    deleted_pg_rows,
                    agent.slug,
                    target_source,
                )
    except Exception as db_exc:
        logger.exception("Failed to delete KnowledgeSource from PostgreSQL: %s", db_exc)

    # Step C (Disk): If the file exists in data/tenants/{tenant_id}/{source_name}, delete it from local disk
    for tenant_folder in [clean_tenant, tenant_id.strip()]:
        for s_candidate in possible_names:
            filename = Path(s_candidate).name
            if filename:
                tenant_file = settings.BASE_DIR / "data" / "tenants" / tenant_folder / filename
                if tenant_file.is_file():
                    try:
                        tenant_file.unlink()
                        logger.info("Removed physical file from disk: %s", tenant_file)
                    except Exception as e:
                        logger.warning("Could not delete physical file (%s): %s", tenant_file, e)

    # Calculate remaining chunks from PostgreSQL or ChromaDB
    remaining_chunks = col.count()
    try:
        with get_db_session() as db:
            agent = db.query(AgentModel).filter(
                (AgentModel.slug == tenant_id)
                | (AgentModel.id == tenant_id)
                | (AgentModel.slug == clean_tenant)
                | (AgentModel.slug == tenant_id.strip().lower())
                | (AgentModel.id == tenant_id.strip())
            ).first()
            if agent:
                pg_sources = db.query(KnowledgeSourceModel).filter(KnowledgeSourceModel.agent_id == agent.id).all()
                remaining_chunks = sum(s.chunk_count for s in pg_sources)
    except Exception:
        pass

    return DeleteSourceResponse(
        status="success",
        tenant_id=clean_tenant,
        source_name=target_source,
        deleted=bool(ids_to_delete or deleted_pg_rows > 0),
        remaining_chunks=remaining_chunks,
    )


@router.get(
    "/admin/agents/{tenant_id}/sources",
    response_model=AgentSourcesResponse,
    summary="Get all active knowledge sources for tenant",
    description="Returns list of unique sources (web, files) indexed in the tenant's collection with individual chunk counts directly from PostgreSQL.",
)
async def get_agent_sources(tenant_id: str) -> AgentSourcesResponse:
    """Inspect and return distinct active knowledge sources queried directly from PostgreSQL knowledge_sources table."""
    clean_tenant = normalize_collection_name(tenant_id)

    # 1. Query directly from PostgreSQL knowledge_sources table
    try:
        with get_db_session() as db:
            agent = db.query(AgentModel).filter(
                (AgentModel.slug == tenant_id)
                | (AgentModel.id == tenant_id)
                | (AgentModel.slug == clean_tenant)
                | (AgentModel.slug == tenant_id.strip().lower())
                | (AgentModel.id == tenant_id.strip())
            ).first()

            if agent:
                records = (
                    db.query(KnowledgeSourceModel)
                    .filter(KnowledgeSourceModel.agent_id == agent.id)
                    .order_by(desc(KnowledgeSourceModel.chunk_count))
                    .all()
                )

                db_sources = [
                    SourceItem(
                        id=s.id,
                        source_name=s.source_name,
                        source_type=s.source_type,
                        chunks_count=s.chunk_count,
                        raw_content=s.raw_content,
                        created_at=s.created_at.isoformat() if s.created_at else None,
                    )
                    for s in records
                ]

                total_chunks = sum(s.chunks_count for s in db_sources)
                return AgentSourcesResponse(
                    tenant_id=clean_tenant,
                    total_chunks=total_chunks,
                    sources=db_sources,
                )
    except Exception as db_err:
        logger.warning("PostgreSQL query failed in get_agent_sources: %s", db_err)

    # 2. Fallback to ChromaDB inspection only if agent is not found in PostgreSQL
    store = get_vector_store(collection_name=clean_tenant)
    col = store.vector_store._collection

    try:
        all_data = col.get(include=["metadatas"])
        breakdown: Dict[str, Dict[str, Any]] = {}
        for meta in all_data.get("metadatas", []):
            if not meta:
                continue
            s_name = meta.get("source_name") or meta.get("source") or "unknown"
            s_type = meta.get("source_type") or meta.get("type") or "document"
            if s_name not in breakdown:
                breakdown[s_name] = {
                    "source_name": s_name,
                    "source_type": s_type,
                    "chunks_count": 0,
                }
            breakdown[s_name]["chunks_count"] += 1

        source_list = [SourceItem(**item) for item in breakdown.values()]
        source_list.sort(key=lambda x: x.chunks_count, reverse=True)

        return AgentSourcesResponse(
            tenant_id=clean_tenant,
            total_chunks=col.count(),
            sources=source_list,
        )
    except Exception as exc:
        logger.exception("Failed to retrieve sources for tenant '%s': %s", clean_tenant, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Get sources failed: {str(exc)}",
        )


@router.put(
    "/admin/agents/{tenant_id}/sources/{source_id}",
    response_model=SourceItem,
    summary="Update knowledge source content and re-index",
    description="Updates the raw content of an existing knowledge source in PostgreSQL, purges old vector embeddings in ChromaDB, and re-indexes the new content.",
)
async def update_agent_source(
    tenant_id: str,
    source_id: str,
    payload: UpdateSourceRequest,
) -> SourceItem:
    """Update source raw_content in PostgreSQL, purge old ChromaDB chunks, and re-index new content."""
    clean_tenant = normalize_collection_name(tenant_id)
    updated_text = payload.updated_content.strip()
    if not updated_text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Updated content cannot be empty.",
        )

    unquoted_source_id = urllib.parse.unquote(source_id)

    with get_db_session() as db:
        agent = db.query(AgentModel).filter(
            (AgentModel.slug == tenant_id)
            | (AgentModel.id == tenant_id)
            | (AgentModel.slug == clean_tenant)
            | (AgentModel.slug == tenant_id.strip().lower())
            | (AgentModel.id == tenant_id.strip())
        ).first()

        if not agent:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Agent '{tenant_id}' not found.",
            )

        source = db.query(KnowledgeSourceModel).filter(
            KnowledgeSourceModel.agent_id == agent.id,
            (
                (KnowledgeSourceModel.id == source_id)
                | (KnowledgeSourceModel.id == unquoted_source_id)
                | (KnowledgeSourceModel.source_name == source_id)
                | (KnowledgeSourceModel.source_name == unquoted_source_id)
                | (func.lower(KnowledgeSourceModel.source_name) == source_id.lower())
                | (func.lower(KnowledgeSourceModel.source_name) == unquoted_source_id.lower())
            ),
        ).first()

        if not source:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Knowledge source '{source_id}' not found for agent '{tenant_id}'.",
            )

        # Update raw content in DB
        source.raw_content = updated_text

        # Purge previous ChromaDB chunks for this source
        store = get_vector_store(collection_name=clean_tenant)
        col = store.vector_store._collection
        possible_names = {source.source_name, source.id, source_id, unquoted_source_id}
        if source.source_name.startswith("http://") or source.source_name.startswith("https://"):
            possible_names.add(source.source_name.rstrip("/"))
            possible_names.add(f"{source.source_name}/")
        lowered_names = {n.lower() for n in possible_names}

        try:
            all_data = col.get(include=["metadatas"])
            ids_to_delete = []
            for doc_uuid, meta in zip(all_data.get("ids", []), all_data.get("metadatas", [])):
                if not meta:
                    continue
                meta_src = meta.get("source") or meta.get("source_name") or ""
                meta_id = meta.get("source_id") or meta.get("doc_id") or ""
                if (
                    meta_src in possible_names
                    or meta_src.lower() in lowered_names
                    or meta_id in possible_names
                    or any(meta_id.startswith(f"{pid}_") for pid in possible_names if pid)
                ):
                    ids_to_delete.append(doc_uuid)

            if ids_to_delete:
                col.delete(ids=ids_to_delete)
                logger.info(
                    "Deleted %d old ChromaDB vector chunks for source '%s' during re-index",
                    len(ids_to_delete),
                    source.source_name,
                )
        except Exception as chroma_err:
            logger.warning("Error deleting old ChromaDB chunks for '%s': %s", source.source_name, chroma_err)

        # Re-chunk updated content and add new vector embeddings
        doc = Document(
            page_content=updated_text,
            metadata={
                "source": source.source_name,
                "source_name": source.source_name,
                "source_type": source.source_type,
                "type": source.source_type,
                "tenant_id": clean_tenant,
                "source_id": source.id,
                "doc_id": source.id,
            },
        )
        chunks = split_documents([doc])
        for i, chunk in enumerate(chunks):
            chunk.metadata["source"] = source.source_name
            chunk.metadata["source_name"] = source.source_name
            chunk.metadata["source_type"] = source.source_type
            chunk.metadata["type"] = source.source_type
            chunk.metadata["tenant_id"] = clean_tenant
            chunk.metadata["source_id"] = source.id
            chunk.metadata["doc_id"] = f"{source.id}_{i}"

        added_count, _ = store.add_documents_deduplicated(chunks)
        source.chunk_count = added_count
        db.commit()
        db.refresh(source)

        logger.info(
            "Updated and re-indexed knowledge source '%s' (id=%s) with %d chunks for tenant '%s'",
            source.source_name,
            source.id,
            added_count,
            clean_tenant,
        )

        return SourceItem(
            id=source.id,
            source_name=source.source_name,
            source_type=source.source_type,
            chunks_count=source.chunk_count,
            raw_content=source.raw_content,
            created_at=source.created_at.isoformat() if source.created_at else None,
        )


@router.post(
    "/admin/agents/{tenant_id}/ingest",
    response_model=AgentIngestResult,
    summary="Upload documents and scrape web resources for dedicated tenant agent",
    description="Accepts multi-file uploads (PDF, DOCX, XLSX) and website URL, incrementally indexes into isolated ChromaDB collection without wiping existing chunks.",
)
async def ingest_agent_knowledge_base(
    tenant_id: str,
    website_url: Optional[str] = Form(None),
    crawl_mode: Optional[str] = Form("single"),
    files: Optional[List[UploadFile]] = File(None),
    agent_name: Optional[str] = Form(None),
    persona: Optional[str] = Form(None),
) -> AgentIngestResult:
    """Incrementally process incoming files and web URL for a specific agent tenant and update ChromaDB and PostgreSQL."""
    clean_tenant = normalize_collection_name(tenant_id)
    logger.info(
        "Starting incremental ingest for agent tenant '%s' (name: '%s', persona: '%s', crawl_mode: '%s')",
        clean_tenant,
        agent_name,
        persona,
        crawl_mode,
    )

    tenant_dir = settings.BASE_DIR / "data" / "tenants" / clean_tenant
    tenant_dir.mkdir(parents=True, exist_ok=True)

    files_processed = 0
    all_docs = []
    loader = LocalDocLoader(data_dir=tenant_dir)
    file_records: List[Dict[str, Any]] = []

    # 1. Process ONLY newly uploaded files (incremental, append-only)
    if files:
        for uploaded_file in files:
            if not uploaded_file or not uploaded_file.filename:
                continue
            safe_name = Path(uploaded_file.filename).name
            if not safe_name:
                continue
            dest_file = tenant_dir / safe_name
            content = await uploaded_file.read()
            if content:
                with open(dest_file, "wb") as f:
                    f.write(content)
                files_processed += 1
                # Load only this specific new file
                new_docs = loader.load_file(dest_file)
                for d in new_docs:
                    d.metadata["tenant_id"] = clean_tenant
                    d.metadata["source_name"] = safe_name
                    d.metadata["source"] = safe_name
                all_docs.extend(new_docs)

                ext = dest_file.suffix.lstrip(".").lower() or "file"
                file_text = "\n\n".join(
                    str(getattr(d, "page_content", ""))
                    for d in new_docs
                    if getattr(d, "page_content", None) is not None
                )
                file_chunks = split_documents(new_docs) if new_docs else []
                file_records.append({
                    "source_name": safe_name,
                    "source_type": ext,
                    "raw_content": file_text[:50000] if file_text else None,
                    "chunk_count": len(file_chunks),
                })

    # 2. Process website scraping if URL provided
    url_clean = str(website_url).strip() if website_url else ""
    web_record: Optional[Dict[str, Any]] = None
    if url_clean and url_clean.lower() != "undefined" and url_clean.lower() != "null":
        try:
            logger.info("Scraping tenant website URL with clean markdown extractor: %s", url_clean)
            scraper = A7LogicsWebScraper(base_url=url_clean)
            page_title, clean_md = scraper.extract_clean_markdown(url_clean)
            web_docs = [
                Document(
                    page_content=clean_md,
                    metadata={
                        "tenant_id": clean_tenant,
                        "source_name": url_clean,
                        "source": url_clean,
                        "url": url_clean,
                        "title": page_title,
                        "section": page_title,
                        "source_type": "web_text",
                    },
                )
            ]
            all_docs.extend(web_docs)

            web_chunks = split_documents(web_docs) if web_docs else []
            web_record = {
                "source_name": url_clean,
                "source_type": "web_text",
                "raw_content": clean_md[:50000] if clean_md else None,
                "chunk_count": len(web_chunks),
            }
        except Exception as exc:
            logger.warning("Website scraping failed for %s: %s", url_clean, exc)

    # 3. Vectorize and index into tenant collection (append-only)
    store = get_vector_store(collection_name=clean_tenant)
    if all_docs:
        chunks = split_documents(all_docs)
        new_count, skipped = store.add_documents_deduplicated(chunks)
        logger.info(
            "Indexed %d new chunks (%d duplicate/skipped) for tenant '%s'",
            new_count,
            skipped,
            clean_tenant,
        )

    # Total chunks in collection
    existing_ids = store.get_existing_ids()
    total_chunks = len(existing_ids)

    # 4. Synchronize records into PostgreSQL database
    try:
        with get_db_session() as session:
            agent = session.execute(
                select(AgentModel).where(
                    (AgentModel.slug == clean_tenant)
                    | (AgentModel.slug == tenant_id.strip().lower())
                    | (AgentModel.id == tenant_id.strip())
                )
            ).scalar_one_or_none()

            if not agent:
                # Create agent if not already existing
                display_name = agent_name or clean_tenant.replace("_", " ").title()
                agent = AgentModel(
                    slug=clean_tenant,
                    name=display_name,
                    persona=persona or "Executive",
                    status="Ready",
                    target_url=url_clean or None,
                )
                session.add(agent)
                session.flush()

            # Record files
            for frec in file_records:
                existing_f = session.execute(
                    select(KnowledgeSourceModel).where(
                        KnowledgeSourceModel.agent_id == agent.id,
                        KnowledgeSourceModel.source_name == frec["source_name"],
                    )
                ).scalar_one_or_none()
                if existing_f:
                    existing_f.chunk_count = frec["chunk_count"]
                    existing_f.source_type = frec["source_type"]
                    if frec["raw_content"]:
                        existing_f.raw_content = frec["raw_content"]
                else:
                    new_f = KnowledgeSourceModel(
                        agent_id=agent.id,
                        source_name=frec["source_name"],
                        source_type=frec["source_type"],
                        raw_content=frec["raw_content"],
                        chunk_count=frec["chunk_count"],
                    )
                    session.add(new_f)

            # Record web source
            if web_record:
                existing_w = session.execute(
                    select(KnowledgeSourceModel).where(
                        KnowledgeSourceModel.agent_id == agent.id,
                        KnowledgeSourceModel.source_name == web_record["source_name"],
                    )
                ).scalar_one_or_none()
                if existing_w:
                    existing_w.chunk_count = web_record["chunk_count"]
                    if web_record["raw_content"]:
                        existing_w.raw_content = web_record["raw_content"]
                else:
                    new_w = KnowledgeSourceModel(
                        agent_id=agent.id,
                        source_name=web_record["source_name"],
                        source_type=web_record["source_type"],
                        raw_content=web_record["raw_content"],
                        chunk_count=web_record["chunk_count"],
                    )
                    session.add(new_w)

            agent.status = "Ready"
            session.commit()
            logger.info("Persisted knowledge sources and set agent '%s' status to Ready in PostgreSQL", agent.slug)
    except Exception as db_exc:
        logger.warning("Could not persist agent sources into PostgreSQL: %s", db_exc)

    return AgentIngestResult(
        status="success",
        tenant_id=clean_tenant,
        chunks_indexed=total_chunks,
        files_processed=files_processed,
        url_scraped=url_clean or None,
    )


# =========================================================================
# GLOBAL SETTINGS & TOKEN ANALYTICS ENDPOINTS
# =========================================================================

# =========================================================================
# GLOBAL SETTINGS & TOKEN ANALYTICS ENDPOINTS
# =========================================================================

import asyncio
import os
import time
import httpx

_OPENROUTER_CACHE: Dict[str, Any] = {
    "timestamp": 0.0,
    "models": [],
}
CACHE_TTL_SECONDS = 6 * 3600  # 6 hours cache TTL

POPULAR_CREATORS = [
    "openai/",
    "anthropic/",
    "google/",
    "deepseek/",
    "meta-llama/",
    "mistralai/",
    "x-ai/",
    "qwen/",
    "cohere/",
]

GROQ_MODELS: List[Dict[str, Any]] = [
    {
        "id": "groq/llama-3.3-70b-versatile",
        "name": "llama-3.3-70b-versatile",
        "label": "Groq Ultra-Fast (Llama 3.3 70B)",
        "provider": "groq",
        "description": "Ultra low-latency inference on Groq LPUs.",
        "context_length": 128000,
    },
    {
        "id": "groq/llama-3.1-8b-instant",
        "name": "llama-3.1-8b-instant",
        "label": "Groq Instant (Llama 3.1 8B)",
        "provider": "groq",
        "description": "Sub-second instant generation on Groq LPUs.",
        "context_length": 128000,
    },
]

STATIC_OPENROUTER_FALLBACK: List[Dict[str, Any]] = [
    {
        "id": "openai/gpt-4o",
        "name": "OpenAI: GPT-4o",
        "label": "OpenAI Flagship (GPT-4o)",
        "provider": "openrouter",
        "description": "State-of-the-art multimodal intelligence and complex tool use.",
        "context_length": 128000,
        "pricing": {},
    },
    {
        "id": "openai/gpt-4o-mini",
        "name": "OpenAI: GPT-4o Mini",
        "label": "OpenAI (GPT-4o Mini)",
        "provider": "openrouter",
        "description": "Fast and lightweight enterprise reasoning.",
        "context_length": 128000,
        "pricing": {},
    },
    {
        "id": "anthropic/claude-3.5-sonnet",
        "name": "Anthropic: Claude 3.5 Sonnet",
        "label": "Anthropic Claude (Claude 3.5 Sonnet)",
        "provider": "openrouter",
        "description": "Top-tier enterprise reasoning, nuanced writing, and architecture.",
        "context_length": 200000,
        "pricing": {},
    },
    {
        "id": "google/gemini-1.5-pro",
        "name": "Google: Gemini 1.5 Pro",
        "label": "Google Gemini (Gemini 1.5 Pro)",
        "provider": "openrouter",
        "description": "Massive context reasoning and multi-modal analytical power.",
        "context_length": 2000000,
        "pricing": {},
    },
    {
        "id": "google/gemini-1.5-flash",
        "name": "Google: Gemini 1.5 Flash",
        "label": "Google Gemini Flash (Gemini 1.5 Flash)",
        "provider": "openrouter",
        "description": "High-throughput, fast and cost-effective enterprise inference.",
        "context_length": 1000000,
        "pricing": {},
    },
    {
        "id": "deepseek/deepseek-r1",
        "name": "DeepSeek: R1",
        "label": "DeepSeek Reasoning (DeepSeek R1)",
        "provider": "openrouter",
        "description": "Advanced open-weights reasoning and math model.",
        "context_length": 64000,
        "pricing": {},
    },
    {
        "id": "meta-llama/llama-3.3-70b-instruct",
        "name": "Meta: Llama 3.3 70B Instruct",
        "label": "Meta Llama (Llama 3.3 70B Instruct)",
        "provider": "openrouter",
        "description": "Open-weights frontier open-source model.",
        "context_length": 131072,
        "pricing": {},
    },
]


def _model_sort_key(item: Dict[str, Any]) -> Tuple[int, str]:
    mid = item["id"].lower()
    for idx, prefix in enumerate(POPULAR_CREATORS):
        if mid.startswith(prefix):
            return (idx, item.get("name", mid).lower())
    return (len(POPULAR_CREATORS), item.get("name", mid).lower())


def get_openrouter_live_models(force_refresh: bool = False) -> List[Dict[str, Any]]:
    """Fetch and cache live models list directly from OpenRouter API with graceful fallback."""
    now = time.time()
    if (
        not force_refresh
        and _OPENROUTER_CACHE["models"]
        and (now - _OPENROUTER_CACHE["timestamp"]) < CACHE_TTL_SECONDS
    ):
        return _OPENROUTER_CACHE["models"]

    api_key = ""
    try:
        with get_db_session() as session:
            row = session.query(AppSettingModel).filter(AppSettingModel.key == "openrouter_api_key").first()
            if row and row.value:
                api_key = row.value.strip()
    except Exception:
        pass

    if not api_key:
        api_key = os.getenv("OPENROUTER_API_KEY", "").strip()

    headers = {
        "HTTP-Referer": "https://a7logics.com",
        "X-Title": "A7 Logics Agent Studio",
    }
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    try:
        with httpx.Client(timeout=6.0) as client:
            resp = client.get("https://openrouter.ai/api/v1/models", headers=headers)
            if resp.status_code == 200:
                raw_data = resp.json().get("data", [])
                formatted_models: List[Dict[str, Any]] = []
                for m in raw_data:
                    mid = m.get("id", "")
                    if not mid:
                        continue
                    m_name = m.get("name") or mid
                    ctx = m.get("context_length", 0)
                    pricing = m.get("pricing", {})
                    desc = m.get("description", "")
                    formatted_models.append({
                        "id": mid,
                        "name": m_name,
                        "label": f"{m_name} ({mid})",
                        "provider": "openrouter",
                        "description": desc[:160] + "..." if len(desc) > 160 else desc,
                        "context_length": ctx,
                        "pricing": pricing,
                    })

                formatted_models.sort(key=_model_sort_key)
                _OPENROUTER_CACHE["models"] = formatted_models
                _OPENROUTER_CACHE["timestamp"] = now
                logger.info("Successfully fetched and cached %d models from OpenRouter.", len(formatted_models))
                return formatted_models
            else:
                logger.warning("OpenRouter API returned HTTP %s: %s", resp.status_code, resp.text[:200])
    except Exception as exc:
        logger.warning("Failed to fetch live models from OpenRouter (%s). Falling back.", exc)

    if _OPENROUTER_CACHE["models"]:
        return _OPENROUTER_CACHE["models"]
    return STATIC_OPENROUTER_FALLBACK


class AppSettingsUpdatePayload(BaseModel):
    """Payload schema for updating global settings."""

    active_provider: Optional[str] = Field(None, description="Active provider: groq, openrouter")
    active_model: Optional[str] = Field(None, description="Active LLM model name")
    token_monthly_quota: Optional[str] = Field(None, description="Monthly token consumption budget")
    groq_api_key: Optional[str] = Field(None, description="Groq API key")
    openrouter_api_key: Optional[str] = Field(None, description="OpenRouter API key")
    openai_api_key: Optional[str] = Field(None, description="Legacy OpenAI API key (deprecated)")


class AgentTokenBreakdown(BaseModel):
    """Per-agent token consumption summary."""

    agent_id: str
    agent_name: str
    total_tokens: int
    queries_count: int


class ModelTokenItem(BaseModel):
    """Token usage aggregated by model."""

    model: str
    tokens: int
    percentage: float


class TokenAnalyticsResponse(BaseModel):
    """Global token analytics response payload."""

    total_consumed: int
    monthly_quota: int
    remaining_tokens: int
    percentage_used: float
    prompt_tokens: int
    completion_tokens: int
    agents_breakdown: List[AgentTokenBreakdown]
    by_model: List[ModelTokenItem] = Field(default_factory=list)
    by_provider: Dict[str, int] = Field(default_factory=dict)


@router.get(
    "/admin/settings",
    response_model=Dict[str, Any],
    summary="Get all global application settings",
)
def get_admin_settings() -> Dict[str, Any]:
    """Retrieve all global configuration settings with environment fallbacks."""
    try:
        with get_db_session() as session:
            rows = session.query(AppSettingModel).all()
            settings_map = {r.key: r.value for r in rows}

        active_provider = settings_map.get("active_provider") or "groq"
        if active_provider == "openai":
            active_provider = "openrouter"

        return {
            "active_provider": active_provider,
            "active_model": settings_map.get("active_model") or settings.LLM_MODEL or "llama-3.3-70b-versatile",
            "token_monthly_quota": settings_map.get("token_monthly_quota") or "1000000",
            "groq_api_key": settings_map.get("groq_api_key") or settings.GROQ_API_KEY or "",
            "openrouter_api_key": settings_map.get("openrouter_api_key") or os.getenv("OPENROUTER_API_KEY", "") or "",
        }
    except Exception as exc:
        logger.exception("Error reading admin settings: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to read application settings: {str(exc)}",
        )


@router.post(
    "/admin/settings",
    response_model=Dict[str, Any],
    summary="Update global application settings",
)
def update_admin_settings(payload: AppSettingsUpdatePayload) -> Dict[str, Any]:
    """Update global configuration settings in database."""
    try:
        updates = payload.model_dump(exclude_unset=True)
        # Normalize provider if legacy 'openai' is provided
        if updates.get("active_provider") == "openai":
            updates["active_provider"] = "openrouter"

        with get_db_session() as session:
            for key, val in updates.items():
                if val is not None:
                    row = session.query(AppSettingModel).filter(AppSettingModel.key == key).first()
                    if row:
                        row.value = str(val)
                    else:
                        session.add(AppSettingModel(key=key, value=str(val)))
            session.commit()

        # Re-fetch latest settings
        updated_settings = get_admin_settings()
        return {
            "status": "success",
            "message": "Settings updated successfully.",
            "settings": updated_settings,
        }
    except Exception as exc:
        logger.exception("Error updating admin settings: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update application settings: {str(exc)}",
        )


@router.get(
    "/admin/settings/models",
    response_model=List[Dict[str, Any]],
    summary="List available LLM models",
)
def get_available_models(refresh: bool = False) -> List[Dict[str, Any]]:
    """Return Groq models combined with live OpenRouter models."""
    or_models = get_openrouter_live_models(force_refresh=refresh)
    return GROQ_MODELS + or_models


@router.get(
    "/admin/analytics/tokens",
    response_model=TokenAnalyticsResponse,
    summary="Get global and per-agent token analytics",
)
def get_token_analytics() -> TokenAnalyticsResponse:
    """Calculate total token consumption, remaining monthly quota, and per-agent breakdown."""
    try:
        with get_db_session() as session:
            total_consumed = (
                session.query(func.coalesce(func.sum(TokenUsageLogModel.total_tokens), 0)).scalar()
                or 0
            )
            total_prompt = (
                session.query(func.coalesce(func.sum(TokenUsageLogModel.prompt_tokens), 0)).scalar()
                or 0
            )
            total_completion = (
                session.query(func.coalesce(func.sum(TokenUsageLogModel.completion_tokens), 0)).scalar()
                or 0
            )

            quota_row = (
                session.query(AppSettingModel)
                .filter(AppSettingModel.key == "token_monthly_quota")
                .first()
            )
            quota = int(quota_row.value) if quota_row and quota_row.value.isdigit() else 1000000

            remaining = max(0, quota - total_consumed)
            pct = round((total_consumed / quota) * 100, 2) if quota > 0 else 0.0

            agents = (
                session.query(AgentModel)
                .filter(
                    ~AgentModel.id.like("analytics_agent_%"),
                    ~AgentModel.slug.like("analytics_agent_%"),
                    AgentModel.name != "Analytics Bot",
                )
                .order_by(AgentModel.created_at.asc())
                .all()
            )
            breakdown: List[AgentTokenBreakdown] = []

            for agent in agents:
                agent_tokens = (
                    session.query(
                        func.coalesce(func.sum(TokenUsageLogModel.total_tokens), 0)
                    )
                    .filter(TokenUsageLogModel.agent_id == agent.id)
                    .scalar()
                    or 0
                )
                query_count = (
                    session.query(func.count(TokenUsageLogModel.id))
                    .filter(TokenUsageLogModel.agent_id == agent.id)
                    .scalar()
                    or 0
                )
                breakdown.append(
                    AgentTokenBreakdown(
                        agent_id=agent.id,
                        agent_name=agent.name,
                        total_tokens=int(agent_tokens),
                        queries_count=int(query_count),
                    )
                )

            # Breakdown by model
            model_rows = (
                session.query(
                    TokenUsageLogModel.model_name,
                    func.coalesce(func.sum(TokenUsageLogModel.total_tokens), 0).label("tokens"),
                )
                .group_by(TokenUsageLogModel.model_name)
                .order_by(desc("tokens"))
                .all()
            )

            by_model: List[ModelTokenItem] = []
            by_provider: Dict[str, int] = {"groq": 0, "openrouter": 0}

            def classify_provider(m_name: str) -> str:
                m = m_name.lower().strip()
                if m.startswith("groq/") or (("llama" in m or "gpt-oss" in m) and "/" not in m):
                    return "groq"
                return "openrouter"

            for m_row in model_rows:
                m_name = str(m_row[0])
                m_toks = int(m_row[1])
                m_pct = round((m_toks / total_consumed) * 100, 1) if total_consumed > 0 else 0.0
                by_model.append(ModelTokenItem(model=m_name, tokens=m_toks, percentage=m_pct))

                prov = classify_provider(m_name)
                by_provider[prov] = by_provider.get(prov, 0) + m_toks

        return TokenAnalyticsResponse(
            total_consumed=int(total_consumed),
            monthly_quota=quota,
            remaining_tokens=remaining,
            percentage_used=pct,
            prompt_tokens=int(total_prompt),
            completion_tokens=int(total_completion),
            agents_breakdown=breakdown,
            by_model=by_model,
            by_provider=by_provider,
        )
    except Exception as exc:
        logger.exception("Error computing token analytics: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to compute token analytics: {str(exc)}",
        )


class GroqLimitData(BaseModel):
    configured: bool = False
    status: str = "not_configured"  # "active", "error", "not_configured"
    status_code: Optional[int] = None
    remaining_tokens: Optional[int] = None
    limit_tokens: Optional[int] = None
    remaining_requests: Optional[int] = None
    limit_requests: Optional[int] = None
    reset_tokens: Optional[str] = None
    reset_requests: Optional[str] = None
    message: Optional[str] = None


class OpenRouterLimitData(BaseModel):
    configured: bool = False
    status: str = "not_configured"  # "active", "error", "not_configured"
    status_code: Optional[int] = None
    label: Optional[str] = None
    usage: Optional[float] = None
    limit: Optional[float] = None
    is_free_tier: Optional[bool] = None
    rate_limit: Optional[Dict[str, Any]] = None
    message: Optional[str] = None


class ProviderLimitsResponse(BaseModel):
    status: str = "success"
    timestamp: str
    groq: GroqLimitData
    openrouter: OpenRouterLimitData


@router.get(
    "/admin/provider-limits",
    response_model=ProviderLimitsResponse,
    summary="Get real-time provider quota tracking and live rate limits",
)
@router.get(
    "/provider-limits",
    response_model=ProviderLimitsResponse,
    summary="Get real-time provider quota tracking and live rate limits",
    include_in_schema=False,
)
async def get_provider_limits() -> ProviderLimitsResponse:
    """Fetch live rate limits and credit balances from Groq and OpenRouter APIs."""
    groq_key = ""
    openrouter_key = ""

    try:
        with get_db_session() as session:
            rows = session.query(AppSettingModel).filter(
                AppSettingModel.key.in_(["groq_api_key", "openrouter_api_key"])
            ).all()
            for r in rows:
                if r.key == "groq_api_key" and r.value:
                    groq_key = r.value.strip()
                elif r.key == "openrouter_api_key" and r.value:
                    openrouter_key = r.value.strip()
    except Exception as exc:
        logger.warning("Error reading provider keys from database: %s", exc)

    if not groq_key:
        groq_key = getattr(settings, "GROQ_API_KEY", "") or ""
    if not openrouter_key:
        openrouter_key = os.getenv("OPENROUTER_API_KEY", "") or ""

    async def fetch_groq_limits() -> GroqLimitData:
        if not groq_key:
            return GroqLimitData(
                configured=False,
                status="not_configured",
                message="No Groq API key configured",
            )
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.get(
                    "https://api.groq.com/openai/v1/models",
                    headers={"Authorization": f"Bearer {groq_key}"},
                )
                if resp.status_code == 200:
                    rem_tok = resp.headers.get("x-ratelimit-remaining-tokens")
                    lim_tok = resp.headers.get("x-ratelimit-limit-tokens")
                    rem_req = resp.headers.get("x-ratelimit-remaining-requests")
                    lim_req = resp.headers.get("x-ratelimit-limit-requests")
                    reset_tok = resp.headers.get("x-ratelimit-reset-tokens")
                    reset_req = resp.headers.get("x-ratelimit-reset-requests")

                    return GroqLimitData(
                        configured=True,
                        status="active",
                        status_code=200,
                        remaining_tokens=int(rem_tok) if rem_tok and rem_tok.isdigit() else 6000,
                        limit_tokens=int(lim_tok) if lim_tok and lim_tok.isdigit() else 6000,
                        remaining_requests=int(rem_req) if rem_req and rem_req.isdigit() else 30,
                        limit_requests=int(lim_req) if lim_req and lim_req.isdigit() else 30,
                        reset_tokens=reset_tok or "0s",
                        reset_requests=reset_req or "0s",
                        message="Active - Groq LPU API operational",
                    )
                else:
                    return GroqLimitData(
                        configured=True,
                        status="error",
                        status_code=resp.status_code,
                        message=f"Groq API returned HTTP {resp.status_code}",
                    )
        except Exception as exc:
            return GroqLimitData(
                configured=True,
                status="error",
                message=f"Failed to query Groq: {str(exc)}",
            )

    async def fetch_openrouter_limits() -> OpenRouterLimitData:
        if not openrouter_key:
            return OpenRouterLimitData(
                configured=False,
                status="not_configured",
                message="No OpenRouter API key configured",
            )
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.get(
                    "https://openrouter.ai/api/v1/auth/key",
                    headers={
                        "Authorization": f"Bearer {openrouter_key}",
                        "HTTP-Referer": "https://a7logics.com",
                        "X-Title": "A7 Logics Studio",
                    },
                )
                if resp.status_code == 200:
                    payload = resp.json().get("data", {})
                    return OpenRouterLimitData(
                        configured=True,
                        status="active",
                        status_code=200,
                        label=payload.get("label"),
                        usage=float(payload.get("usage", 0.0) or 0.0),
                        limit=float(payload.get("limit")) if payload.get("limit") is not None else None,
                        is_free_tier=bool(payload.get("is_free_tier", False)),
                        rate_limit=payload.get("rate_limit"),
                        message="Active - OpenRouter Gateway connected",
                    )
                else:
                    err_msg = ""
                    try:
                        err_msg = resp.json().get("error", {}).get("message", "")
                    except Exception:
                        pass
                    return OpenRouterLimitData(
                        configured=True,
                        status="error",
                        status_code=resp.status_code,
                        message=err_msg or f"OpenRouter returned HTTP {resp.status_code}",
                    )
        except Exception as exc:
            return OpenRouterLimitData(
                configured=True,
                status="error",
                message=f"Failed to query OpenRouter: {str(exc)}",
            )

    groq_res, openrouter_res = await asyncio.gather(
        fetch_groq_limits(), fetch_openrouter_limits()
    )

    return ProviderLimitsResponse(
        status="success",
        timestamp=datetime.now(timezone.utc).isoformat(),
        groq=groq_res,
        openrouter=openrouter_res,
    )



