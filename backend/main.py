"""A7 Logics Enterprise AI Agent - Production Modular FastAPI Service.

Features:
- Modular APIRouter hierarchy (v1 endpoints under /api/v1).
- Production CORS middleware accepting requests from all configured origins (allow_origins=["*"]).
- Clean, decoupled LangGraph core workflow integration.
- Health inspection and lifecycle telemetry.
"""

from contextlib import asynccontextmanager
from datetime import datetime, timezone
import logging
from pathlib import Path
import sys
from typing import Any, Dict

# Ensure project root is in sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.api.v1.api import api_router
from config.settings import settings
from core.database.connection import db_manager
from core.ingestion.vector_store import get_vector_store

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("a7_fastapi_backend")

# Suppress verbose HTTP request and caching noise from third-party libraries
for _noisy_logger in (
    "httpx",
    "httpcore",
    "huggingface_hub",
    "sentence_transformers",
    "urllib3",
    "chromadb",
):
    logging.getLogger(_noisy_logger).setLevel(logging.WARNING)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle manager for startup and shutdown procedures."""
    logger.info("A7 Logics Production FastAPI Service starting up...")
    logger.info("Active LLM Model: %s", settings.LLM_MODEL)
    try:
        from core.database.seed import seed_database
        seed_database()
        logger.info("Database schema and default agents verified/seeded.")
    except Exception as exc:
        logger.warning("Database seed check during startup: %s", exc)

    try:
        store = get_vector_store()
        doc_count = len(store.get_existing_ids())
        logger.info("ChromaDB vector collection verified (%d chunks indexed).", doc_count)
    except Exception as exc:
        logger.warning("Vector store check during startup: %s", exc)
    yield
    logger.info("A7 Logics FastAPI Backend shutting down.")


app = FastAPI(
    title="A7 Logics Enterprise AI API",
    description="Production REST API powering A7 Logics Client Chat and Administrative Intelligence.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# Enable CORS middleware to accept requests from all production origins or configured domains
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API Routers
# Primary v1 production routes: /api/v1/chat, /api/v1/admin/alerts
app.include_router(api_router, prefix="/api/v1")
# Backward compatibility alias: /api/chat, /api/admin/alerts
app.include_router(api_router, prefix="/api")


@app.get("/", tags=["Health"])
@app.get("/health", tags=["Health"])
@app.get("/api/v1/health", tags=["Health"])
@app.get("/api/health", tags=["Health"])
def health_check() -> Dict[str, Any]:
    """Verify backend operational status, vector store, and database availability."""
    chunk_count = 0
    try:
        store = get_vector_store()
        chunk_count = len(store.get_existing_ids())
    except Exception as exc:
        logger.warning("Health check chunk count exception: %s", exc)

    return {
        "status": "healthy",
        "service": "A7 Logics Enterprise AI API",
        "version": "1.0.0",
        "database": "SQLite Fallback" if db_manager.is_sqlite() else "PostgreSQL",
        "indexed_chunks": chunk_count,
        "llm_model": settings.LLM_MODEL,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
