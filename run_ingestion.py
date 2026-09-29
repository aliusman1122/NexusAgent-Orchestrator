"""Standalone ingestion runner script for A7 Logics Enterprise AI Chatbot.

Executes the multi-source ingestion pipeline:
1. Scrapes and parses textual content from https://a7logics.com/
2. Loads local documents from ./data/ (*.pdf, *.docx, *.xlsx)
3. Chunks text using RecursiveCharacterTextSplitter (chunk_size=800, overlap=150)
4. Persists embeddings to ChromaDB with deterministic deduplication
5. Prints comprehensive metrics and indexing summary
"""

import argparse
import logging
import sys
from datetime import datetime
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from config.settings import settings
from core.ingestion.loader import LocalDocLoader
from core.ingestion.vector_store import (
    A7LogicsVectorStore,
    index_all_sources,
    split_documents,
)
from core.ingestion.scraper import A7LogicsWebScraper


def setup_logging(verbose: bool = False) -> None:
    """Configure structured logging output."""
    level = logging.DEBUG if verbose else logging.INFO
    format_str = "%(asctime)s [%(levelname)s] %(name)s: %(message)s"
    date_format = "%Y-%m-%d %H:%M:%S"
    logging.basicConfig(level=level, format=format_str, datefmt=date_format)


def print_banner() -> None:
    """Print welcoming header banner."""
    print("=" * 70)
    print("   A7 LOGICS ENTERPRISE AI CHATBOT - INGESTION PIPELINE (MILESTONE 1)")
    print("=" * 70)
    print(f"Timestamp:       {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Target Website:  {settings.WEBSITE_URL}")
    print(f"Local Data Dir:  {settings.DATA_DIR.resolve()}")
    print(f"Chroma DB Path:  {settings.CHROMA_PERSIST_DIRECTORY.resolve()}")
    print(f"Collection Name: {settings.CHROMA_COLLECTION_NAME}")
    print(f"Chunk Config:    size={settings.CHUNK_SIZE}, overlap={settings.CHUNK_OVERLAP}")
    print(f"Embedding Model: {settings.EMBEDDING_MODEL}")
    print("-" * 70)


def run_dry_run() -> None:
    """Run extraction and chunking without calling OpenAI or ChromaDB."""
    print("\n[DRY RUN MODE] Testing scraping, document loading, and chunking...\n")

    # 1. Test Scraper
    scraper = A7LogicsWebScraper()
    web_docs = scraper.scrape()
    print(f"-> Web Scraper extracted: {len(web_docs)} Document(s)")
    for idx, doc in enumerate(web_docs, 1):
        section = doc.metadata.get("section", "General")
        preview = doc.page_content.replace("\n", " ")[:90]
        print(f"   [{idx}] Section '{section}': {preview}...")

    # 2. Test Local Doc Loader
    doc_loader = LocalDocLoader()
    local_docs = doc_loader.load_all()
    print(f"\n-> Local Doc Loader extracted: {len(local_docs)} Document(s)")
    for idx, doc in enumerate(local_docs, 1):
        source = doc.metadata.get("source", "file")
        doc_type = doc.metadata.get("type", "unknown")
        preview = doc.page_content.replace("\n", " ")[:90]
        print(f"   [{idx}] File '{source}' ({doc_type}): {preview}...")

    # 3. Test Text Splitter
    all_docs = web_docs + local_docs
    chunks = split_documents(all_docs)
    print(f"\n-> Text Splitter created: {len(chunks)} Chunk(s) from {len(all_docs)} Document(s)")

    print("\n" + "=" * 70)
    print(" DRY RUN COMPLETED SUCCESSFULLY: All parsers and splitters functional!")
    print("=" * 70)


def main() -> int:
    """Main execution entry point."""
    parser = argparse.ArgumentParser(
        description="A7 Logics Multi-Source Ingestion Pipeline"
    )
    parser.add_argument(
        "--skip-web", action="store_true", help="Skip website scraping"
    )
    parser.add_argument(
        "--skip-local", action="store_true", help="Skip local document ingestion"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Run document parsing and chunking without persisting embeddings to ChromaDB",
    )
    parser.add_argument(
        "-v", "--verbose", action="store_true", help="Enable verbose debug logging"
    )
    args = parser.parse_args()

    setup_logging(args.verbose)
    print_banner()

    # Dry-run execution
    if args.dry_run:
        run_dry_run()
        return 0

    try:
        stats = index_all_sources(
            scrape_web=not args.skip_web,
            load_docs=not args.skip_local,
        )

        print("\n" + "=" * 70)
        print("              INGESTION PIPELINE EXECUTION SUMMARY")
        print("=" * 70)
        print(f"Total Source Documents Parsed: {stats['total_documents']}")
        print(f"Total Text Chunks Generated:    {stats['total_chunks']}")
        print(f"New Chunks Indexed to Chroma:  {stats['indexed_chunks']}")
        print(f"Duplicate Chunks Skipped:      {stats['skipped_duplicates']}")
        print("-" * 70)

        # Inspect Chroma collection count
        store = A7LogicsVectorStore()
        existing_count = len(store.get_existing_ids())
        print(f"Total Active Chunks in Chroma: {existing_count}")
        print("=" * 70)
        print(" SUCCESS: Milestone 1 knowledge base is up to date!\n")
        return 0

    except Exception as exc:
        logging.exception("Ingestion failed: %s", exc)
        print(f"\nERROR: Ingestion pipeline failed with error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
