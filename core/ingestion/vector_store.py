"""Vector storage and indexing pipeline using ChromaDB and OpenAI Embeddings.

Handles:
- Document chunking via RecursiveCharacterTextSplitter.
- Embedding generation with OpenAI text-embedding-3-small.
- Local persistent storage in ChromaDB (collection: a7_logics_knowledge_base).
- Deterministic deduplication to prevent indexing duplicate records across runs.
"""

import hashlib
import logging
import re
from typing import Any, Dict, List, Optional, Tuple
from langchain_chroma import Chroma
from langchain_core.documents import Document
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter

from config.settings import settings
from .loader import load_local_documents
from .scraper import scrape_a7logics_website

logger = logging.getLogger(__name__)


def generate_chunk_id(doc: Document) -> str:
    """Generate a deterministic, content-addressable ID for a document chunk.

    Combines the source identifier, optional section/page, and SHA-256 hash of the content.
    This ensures identical content from the same source always yields the exact same ID,
    regardless of list order or batch index.
    """
    source_raw = str(doc.metadata.get("source", "unknown"))
    source_clean = re.sub(r"[^a-zA-Z0-9_\-\.]", "_", source_raw)
    page = str(doc.metadata.get("page", ""))
    section = str(doc.metadata.get("section", ""))
    content_norm = doc.page_content.strip()

    # Create composite content key
    key_components = [source_clean]
    if page:
        key_components.append(f"p{page}")
    if section:
        section_clean = re.sub(r"[^a-zA-Z0-9_\-\.]", "_", section)
        key_components.append(f"sec_{section_clean}")

    content_hash = hashlib.sha256(content_norm.encode("utf-8")).hexdigest()[:24]
    key_components.append(content_hash)
    return "_".join(key_components)


def split_documents(
    docs: List[Document],
    chunk_size: Optional[int] = None,
    chunk_overlap: Optional[int] = None,
) -> List[Document]:
    """Split documents using RecursiveCharacterTextSplitter."""
    c_size = chunk_size or settings.CHUNK_SIZE
    c_overlap = chunk_overlap or settings.CHUNK_OVERLAP

    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=c_size,
        chunk_overlap=c_overlap,
        separators=["\n\n", "\n", ". ", " ", ""],
        length_function=len,
    )
    chunks = text_splitter.split_documents(docs)
    logger.info(
        "Split %d documents into %d chunks (chunk_size=%d, chunk_overlap=%d)",
        len(docs),
        len(chunks),
        c_size,
        c_overlap,
    )
    return chunks


def normalize_collection_name(name: Optional[str]) -> str:
    """Normalize and enforce ChromaDB collection naming rules.

    ChromaDB requirements:
    - 3-63 characters in length
    - Starts and ends with an alphanumeric character ([a-z0-9])
    - Contains only lowercase alphanumeric characters, underscores, and hyphens
    - Fallback default: settings.CHROMA_COLLECTION_NAME
    """
    if not name or not name.strip():
        return settings.CHROMA_COLLECTION_NAME

    # 1. Clean invalid characters and convert to lowercase
    cleaned = re.sub(r"[^a-zA-Z0-9_\-]", "_", name.strip()).lower()
    # 2. Collapse consecutive underscores and hyphens
    cleaned = re.sub(r"_+", "_", cleaned)
    cleaned = re.sub(r"-+", "-", cleaned)
    # 3. Enforce starting and ending with alphanumeric
    cleaned = re.sub(r"^[^a-z0-9]+|[^a-z0-9]+$", "", cleaned)

    if not cleaned or cleaned in ("a7_logics", "a7-logics", "a7logics", "a7_logics_agent"):
        return settings.CHROMA_COLLECTION_NAME

    # 4. Enforce minimum length of 3 chars
    if len(cleaned) < 3:
        cleaned = f"{cleaned}_kb"

    # 5. Enforce maximum length of 63 chars
    if len(cleaned) > 63:
        cleaned = cleaned[:63].rstrip("_-")

    return cleaned


class A7LogicsVectorStore:
    """ChromaDB Vector Store manager with deduplication, incremental indexing, and multi-tenant isolation."""

    def __init__(
        self,
        persist_directory: Optional[str] = None,
        collection_name: Optional[str] = None,
    ):
        self.persist_directory = str(
            persist_directory or settings.CHROMA_PERSIST_DIRECTORY
        )
        self.collection_name = normalize_collection_name(
            collection_name or settings.CHROMA_COLLECTION_NAME
        )
        self._embeddings: Optional[HuggingFaceEmbeddings] = None
        self._vector_store: Optional[Chroma] = None

    @property
    def embeddings(self) -> HuggingFaceEmbeddings:
        """Lazy-loaded HuggingFace Embeddings instance (sentence-transformers/all-MiniLM-L6-v2)."""
        if self._embeddings is None:
            try:
                logger.info(
                    "Loading HuggingFace embeddings model: '%s'...", settings.EMBEDDING_MODEL
                )
                try:
                    # Attempt instant local cache load without querying Hugging Face Hub
                    self._embeddings = HuggingFaceEmbeddings(
                        model_name=settings.EMBEDDING_MODEL,
                        model_kwargs={"device": "cpu", "local_files_only": True},
                        encode_kwargs={"normalize_embeddings": True},
                    )
                except Exception:
                    # Fallback to standard download if model is not yet in local cache
                    self._embeddings = HuggingFaceEmbeddings(
                        model_name=settings.EMBEDDING_MODEL,
                        model_kwargs={"device": "cpu"},
                        encode_kwargs={"normalize_embeddings": True},
                    )
            except BaseException as exc:
                logger.warning(
                    "Could not initialize HuggingFace embeddings (%s). Using fallback embeddings.", exc
                )
                from langchain_core.embeddings import FakeEmbeddings
                self._embeddings = FakeEmbeddings(size=384)
        return self._embeddings

    @property
    def vector_store(self) -> Chroma:
        """Lazy-loaded Chroma vector store bound to the tenant collection."""
        if self._vector_store is None:
            logger.info(
                "Initializing ChromaDB vector store at '%s' (collection: '%s')",
                self.persist_directory,
                self.collection_name,
            )
            self._vector_store = Chroma(
                collection_name=self.collection_name,
                embedding_function=self.embeddings,
                persist_directory=self.persist_directory,
            )
        return self._vector_store

    def get_existing_ids(self) -> set:
        """Fetch all currently indexed vector IDs from the Chroma collection."""
        try:
            # Direct collection access via underlying chroma client
            collection = self.vector_store._collection
            existing = collection.get(include=[])
            return set(existing.get("ids", []))
        except Exception as exc:
            logger.warning("Could not fetch existing IDs from collection '%s': %s", self.collection_name, exc)
            return set()

    def add_documents_deduplicated(
        self, chunks: List[Document]
    ) -> Tuple[int, int]:
        """Add chunks to ChromaDB incrementally, skipping identical records.

        Returns:
            Tuple[int, int]: (new_chunks_indexed, skipped_duplicate_chunks)
        """
        if not chunks:
            logger.info("No chunks provided to index for collection '%s'.", self.collection_name)
            return 0, 0

        existing_ids = self.get_existing_ids()
        logger.info("Collection '%s' has %d existing record(s)", self.collection_name, len(existing_ids))

        new_docs: List[Document] = []
        new_ids: List[str] = []
        skipped_count = 0

        for chunk in chunks:
            chunk_id = generate_chunk_id(chunk)
            if chunk_id in existing_ids:
                skipped_count += 1
                logger.debug("Skipping duplicate chunk ID: %s", chunk_id)
            else:
                new_docs.append(chunk)
                new_ids.append(chunk_id)
                # Keep track within current batch to prevent intra-batch duplicates
                existing_ids.add(chunk_id)

        if new_docs:
            logger.info("Indexing %d new chunk(s) into ChromaDB collection '%s'...", len(new_docs), self.collection_name)
            self.vector_store.add_documents(documents=new_docs, ids=new_ids)
            logger.info("Successfully indexed %d new chunk(s) into '%s'", len(new_docs), self.collection_name)
        else:
            logger.info("All %d chunk(s) already exist in collection '%s'.", len(chunks), self.collection_name)

        return len(new_docs), skipped_count


def get_vector_store(collection_name: Optional[str] = None) -> A7LogicsVectorStore:
    """Factory helper to obtain an A7LogicsVectorStore instance for a specific tenant collection."""
    normalized_name = normalize_collection_name(collection_name)
    return A7LogicsVectorStore(collection_name=normalized_name)


def list_collections(persist_directory: Optional[str] = None) -> List[Dict[str, Any]]:
    """List all active vector collections and their chunk counts in ChromaDB."""
    try:
        store = get_vector_store()
        client = store.vector_store._client
        raw_collections = client.list_collections()
        results: List[Dict[str, Any]] = []
        for col in raw_collections:
            name = getattr(col, "name", str(col))
            try:
                count = col.count()
            except Exception:
                count = 0
            results.append({"name": name, "count": count})
        return results
    except Exception as exc:
        logger.warning("Failed to list ChromaDB collections: %s", exc)
        return []


def delete_collection(collection_name: str) -> bool:
    """Safely drop a ChromaDB vector collection if it exists and is not the protected default."""
    try:
        norm = normalize_collection_name(collection_name)
        if norm == "a7_logics_knowledge_base":
            logger.warning("Attempted to delete protected core collection '%s', ignoring.", norm)
            return False
        store = get_vector_store()
        client = store.vector_store._client
        client.delete_collection(name=norm)
        logger.info("Successfully dropped ChromaDB collection '%s'", norm)
        return True
    except Exception as exc:
        logger.warning("Failed to delete ChromaDB collection '%s': %s", collection_name, exc)
        return False



def index_all_sources(
    website_url: Optional[str] = None,
    collection_name: str = "a7_logics_knowledge_base",
    local_data_dir: Optional[str] = None,
    scrape_web: bool = True,
    load_docs: bool = True,
    force_reindex: bool = False,
) -> Dict[str, Any]:
    """Ingest website scraping and/or local documents into an isolated tenant collection.

    Args:
        website_url: Target website URL to crawl using the hybrid scraper.
        collection_name: Target tenant collection name.
        local_data_dir: Optional path to directory containing local files (*.pdf, *.docx, *.xlsx).
        scrape_web: Whether to scrape the website.
        load_docs: Whether to load local files.
        force_reindex: Whether to purge and re-embed all documents for this tenant.

    Returns:
        Dict[str, Any]: Ingestion statistics summary.
    """
    norm_collection = normalize_collection_name(collection_name)
    logger.info(
        "Starting ingestion for tenant collection: '%s' (force_reindex=%s)...",
        norm_collection,
        force_reindex,
    )
    all_raw_documents: List[Document] = []

    # 1. Scrape Website
    target_url = website_url or settings.WEBSITE_URL
    if scrape_web and target_url:
        logger.info("Step 1: Scraping website at %s for tenant '%s'", target_url, norm_collection)
        web_docs = scrape_a7logics_website(target_url)
        all_raw_documents.extend(web_docs)
        logger.info("Retrieved %d document(s) from website", len(web_docs))

    # 2. Ingest Local Documents
    # If local_data_dir is explicitly given, ingest from it; otherwise only ingest default ./data if not a tenant-specific URL crawl
    if local_data_dir:
        logger.info("Step 2: Ingesting tenant files from %s", local_data_dir)
        local_docs = load_local_documents(local_data_dir)
        all_raw_documents.extend(local_docs)
        logger.info("Retrieved %d document(s) from local data dir", len(local_docs))
    elif load_docs and not website_url:
        logger.info("Step 2: Ingesting default corporate files from %s", settings.DATA_DIR)
        local_docs = load_local_documents(settings.DATA_DIR)
        all_raw_documents.extend(local_docs)
        logger.info("Retrieved %d document(s) from default corporate data dir", len(local_docs))

    store = get_vector_store(collection_name=norm_collection)

    # Optional force-purge existing vectors for this tenant
    if force_reindex:
        try:
            existing_ids = store.get_existing_ids()
            if existing_ids:
                logger.info(
                    "Force reindex: purging %d existing chunk(s) from collection '%s'",
                    len(existing_ids),
                    norm_collection,
                )
                store.vector_store.delete(ids=list(existing_ids))
        except Exception as exc:
            logger.warning("Could not purge collection '%s' for reindexing: %s", norm_collection, exc)

    if not all_raw_documents:
        logger.warning("No documents found for collection '%s'.", norm_collection)
        return {
            "tenant_id": norm_collection,
            "collection_name": norm_collection,
            "total_documents": 0,
            "total_chunks": 0,
            "indexed_chunks": 0,
            "skipped_duplicates": 0,
        }

    # 3. Split Documents
    logger.info("Step 3: Chunking documents for '%s'...", norm_collection)
    chunks = split_documents(all_raw_documents)

    # 4. Incremental Vector Indexing into Tenant's Collection
    logger.info("Step 4: Vectorizing and storing chunks into ChromaDB collection '%s'...", norm_collection)
    new_indexed, skipped = store.add_documents_deduplicated(chunks)

    stats = {
        "tenant_id": norm_collection,
        "collection_name": norm_collection,
        "total_documents": len(all_raw_documents),
        "total_chunks": len(chunks),
        "indexed_chunks": new_indexed,
        "skipped_duplicates": skipped,
    }
    logger.info("Ingestion completed successfully for tenant '%s': %s", norm_collection, stats)
    return stats
