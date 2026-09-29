"""Ingestion package for A7 Logics Enterprise AI Chatbot."""

from .scraper import scrape_a7logics_website, A7LogicsWebScraper
from .loader import load_local_documents, LocalDocLoader
from .vector_store import (
    get_vector_store,
    split_documents,
    index_all_sources,
    A7LogicsVectorStore,
    generate_chunk_id,
    normalize_collection_name,
    list_collections,
)

__all__ = [
    "scrape_a7logics_website",
    "A7LogicsWebScraper",
    "load_local_documents",
    "LocalDocLoader",
    "get_vector_store",
    "split_documents",
    "index_all_sources",
    "A7LogicsVectorStore",
    "generate_chunk_id",
    "normalize_collection_name",
    "list_collections",
]
