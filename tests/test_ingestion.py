"""Unit and integration tests for Milestone 1 ingestion pipeline."""

from pathlib import Path
from unittest.mock import MagicMock, patch
from langchain_core.documents import Document

from config.settings import settings
from core.ingestion.loader import LocalDocLoader
from core.ingestion.vector_store import (
    A7LogicsVectorStore,
    generate_chunk_id,
    split_documents,
)
from core.ingestion.scraper import A7LogicsWebScraper


def test_settings_loaded():
    """Verify settings defaults and environment configuration."""
    assert settings.CHROMA_COLLECTION_NAME == "a7_logics_knowledge_base"
    assert settings.CHUNK_SIZE == 800
    assert settings.CHUNK_OVERLAP == 150
    assert settings.EMBEDDING_MODEL == "sentence-transformers/all-MiniLM-L6-v2"
    assert settings.LLM_MODEL in ("llama-3.3-70b-versatile", "openai/gpt-oss-120b")
    assert settings.WEBSITE_URL == "https://a7logics.com/"
    assert settings.DATA_DIR.exists()


def test_huggingface_embeddings():
    """Verify HuggingFace embeddings model initializes and generates vector arrays."""
    store = A7LogicsVectorStore()
    embeddings_fn = store.embeddings
    sample_text = "A7 Logics custom software solutions and enterprise digital engineering."
    vector = embeddings_fn.embed_query(sample_text)
    assert isinstance(vector, list)
    assert len(vector) == 384  # MiniLM-L6-v2 embedding dimension


def test_web_scraper_structure():
    """Verify web scraper extracts documents with required metadata format."""
    scraper = A7LogicsWebScraper()
    docs = scraper.scrape()
    assert len(docs) >= 1

    for doc in docs:
        assert isinstance(doc, Document)
        assert doc.metadata.get("source") == "website"
        assert doc.metadata.get("url") == "https://a7logics.com/"
        assert len(doc.page_content.strip()) > 0

    # Ensure key sections are represented
    sections = {doc.metadata.get("section") for doc in docs}
    assert "Services" in sections or "Hero Overview" in sections


def test_doc_loader_multi_format():
    """Verify local doc loader parses PDF, DOCX, and XLSX files."""
    loader = LocalDocLoader(data_dir=settings.DATA_DIR)
    docs = loader.load_all()
    assert len(docs) >= 3

    sources = {doc.metadata.get("source") for doc in docs}
    types = {doc.metadata.get("type") for doc in docs}

    assert "sample_services.docx" in sources
    assert "sample_pricing.xlsx" in sources
    assert "sample_overview.pdf" in sources

    assert "docx" in types
    assert "xlsx" in types
    assert "pdf" in types


def test_text_splitter():
    """Verify document chunking respects chunk_size and chunk_overlap."""
    long_content = "A7 Logics provides high-quality software engineering. " * 50
    test_doc = Document(
        page_content=long_content,
        metadata={"source": "test_doc.txt", "type": "txt"},
    )
    chunks = split_documents([test_doc], chunk_size=200, chunk_overlap=50)
    assert len(chunks) > 1
    for chunk in chunks:
        assert len(chunk.page_content) <= 250  # reasonable boundary with separator
        assert chunk.metadata["source"] == "test_doc.txt"


def test_deterministic_deduplication():
    """Verify chunk ID generation and duplicate detection."""
    doc1 = Document(
        page_content="A7 Logics Web Services Overview",
        metadata={"source": "web_services", "page": 1},
    )
    doc2 = Document(
        page_content="A7 Logics Web Services Overview",
        metadata={"source": "web_services", "page": 1},
    )

    # Identical content + source must yield identical IDs
    id1 = generate_chunk_id(doc1)
    id2 = generate_chunk_id(doc2)
    assert id1 == id2

    # Different content must yield different IDs
    doc3 = Document(
        page_content="A7 Logics Mobile Services Overview",
        metadata={"source": "web_services", "page": 1},
    )
    id3 = generate_chunk_id(doc3)
    assert id1 != id3

    # Test deduplication filter
    store = A7LogicsVectorStore()
    mock_collection = MagicMock()
    mock_collection.get.return_value = {"ids": [id1]}

    with patch.object(store, "_vector_store") as mock_vs:
        mock_vs._collection = mock_collection
        mock_vs.add_documents = MagicMock()

        # Adding doc1 (already exists) and doc3 (new)
        new_count, skipped_count = store.add_documents_deduplicated([doc1, doc3])
        assert new_count == 1
        assert skipped_count == 1
        mock_vs.add_documents.assert_called_once()
        args, kwargs = mock_vs.add_documents.call_args
        assert len(kwargs["documents"]) == 1
        assert kwargs["ids"] == [id3]


def test_normalize_collection_name():
    """Verify ChromaDB collection naming conventions and sanitizer."""
    from core.ingestion.vector_store import normalize_collection_name

    # Default fallback
    assert normalize_collection_name(None) == settings.CHROMA_COLLECTION_NAME
    assert normalize_collection_name("") == settings.CHROMA_COLLECTION_NAME
    assert normalize_collection_name("   ") == settings.CHROMA_COLLECTION_NAME

    # a7_logics alias mapped to primary knowledge base
    assert normalize_collection_name("a7_logics") == settings.CHROMA_COLLECTION_NAME
    assert normalize_collection_name("a7-logics") == settings.CHROMA_COLLECTION_NAME

    # Valid names
    assert normalize_collection_name("stripe_corp") == "stripe_corp"
    assert normalize_collection_name("tenant-123") == "tenant-123"

    # Special characters and uppercase sanitized
    assert normalize_collection_name("Stripe, Inc.!!") == "stripe_inc"
    assert normalize_collection_name("@@@my_client###") == "my_client"

    # Short name padded with _kb
    assert normalize_collection_name("a") == "a_kb"
    assert len(normalize_collection_name("a")) >= 3

    # Long name trimmed to <= 63 chars
    long_name = "a" * 80
    normalized_long = normalize_collection_name(long_name)
    assert len(normalized_long) <= 63


def test_multi_tenant_vector_store_factory():
    """Verify get_vector_store factory initializes distinct collection names."""
    from core.ingestion.vector_store import get_vector_store

    store_default = get_vector_store()
    assert store_default.collection_name == settings.CHROMA_COLLECTION_NAME

    store_a7 = get_vector_store(collection_name="a7_logics")
    assert store_a7.collection_name == settings.CHROMA_COLLECTION_NAME

    store_tenant = get_vector_store(collection_name="tenant_alpha")
    assert store_tenant.collection_name == "tenant_alpha"

    store_sanitized = get_vector_store(collection_name="Tenant Beta (Pvt) Ltd!")
    assert store_sanitized.collection_name == "tenant_beta_pvt_ltd"


def test_extract_clean_markdown_with_template():
    """Verify intelligent extraction formats content into executive metadata template."""
    scraper = A7LogicsWebScraper()
    mock_html = """
    <!DOCTYPE html>
    <html>
      <head><title>National University of Sciences - Campus Overview</title></head>
      <body>
        <header><nav class="menu"><a href="/home">Home</a><a href="/login">Login</a></nav></header>
        <main>
          <h1>Campus Overview</h1>
          <p>The university is a premier center of higher learning offering accredited degree programs in engineering, computing, and social sciences.</p>
          <h2>Research Facilities</h2>
          <p>Over 30 state-of-the-art research laboratories provide hands-on experience for graduate scholars.</p>
        </main>
        <footer>
          <div class="footer"><p>Copyright 2026. All rights reserved. Follow us on Facebook.</p></div>
        </footer>
      </body>
    </html>
    """
    title, md_content = scraper.extract_clean_markdown(url="https://example-university.edu/", html=mock_html)
    assert "Campus Overview" in title
    assert "# " in md_content
    assert "- **Source URL:** https://example-university.edu/" in md_content
    assert "- **Scraped Date:**" in md_content
    assert "- **Document Structure:**" in md_content
    assert "## Contact & Business Identifiers" in md_content
    assert "- **Email(s):**" in md_content
    assert "- **Phone(s):**" in md_content
    assert "- **Physical Address / Headquarters:**" in md_content
    # Boilerplate navigation and footers must be excluded
    assert "Login" not in md_content
    assert "Follow us on Facebook" not in md_content
    # Core content must be present
    assert "premier center of higher learning" in md_content
    assert "research laboratories" in md_content


def test_hybrid_agency_landing_page_extraction():
    """Verify Path A preserves header ranks, sequential steps, and prevents word glomming."""
    scraper = A7LogicsWebScraper()
    mock_agency_html = """
    <!DOCTYPE html>
    <html>
      <head><title>A7 Logics - Digital Engineering Agency</title></head>
      <body>
        <div class="top-nav">
          <a href="/1">Link1</a><a href="/2">Link2</a><a href="/3">Link3</a>
        </div>
        <section id="hero">
          <h1>Custom Application <br/>Development</h1>
          <p>We work with the most innovative solutions on the market.</p>
        </section>
        <section id="services">
          <h2>Our Core Services</h2>
          <div class="row">
            <div class="col-md-4 card">
              <h4>Web Application</h4>
              <p>We build scalable enterprise web apps.</p>
            </div>
            <div class="col-md-4 card">
              <h4>Mobile Apps</h4>
              <p>Cutting-edge iOS and Android apps.</p>
            </div>
          </div>
        </section>
        <section id="about-2">
          <h2>Development Process</h2>
          <div class="row item">
            <h4>Planning and Strategy</h4>
            <p>Structure thoughts and outline requirements.</p>
          </div>
          <div class="row item">
            <h4>Research and Analysis</h4>
            <p>Meeting with clients to analyze objectives.</p>
          </div>
        </section>
        <footer>
          <div class="contact-box">
            <p>Contact us at <a href="mailto:contact@a7agency.com">contact@a7agency.com</a> or call +1 (555) 234-5678.</p>
            <address>100 Innovation Way, Suite 400, New York, USA</address>
          </div>
        </footer>
      </body>
    </html>
    """
    title, md_content = scraper.extract_clean_markdown(url="https://a7agency.com/", html=mock_agency_html)
    assert "Digital Engineering Agency" in title
    assert "- **Document Structure:** Agency Landing Page" in md_content
    # Preserves header ranks
    assert "# Custom Application Development" in md_content
    assert "## Our Core Services" in md_content
    assert "### Web Application" in md_content
    assert "We build scalable enterprise web apps." in md_content
    # Preserves sequential workflow steps
    assert "1. **Planning and Strategy**:" in md_content
    assert "2. **Research and Analysis**:" in md_content
    # Harvested contacts from footer
    assert "- **Email(s):** contact@a7agency.com" in md_content
    assert "- **Phone(s):** +1 (555) 234-5678" in md_content
    assert "100 Innovation Way, Suite 400, New York, USA" in md_content

