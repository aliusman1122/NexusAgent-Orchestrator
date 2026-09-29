"""Application settings and configuration management for A7 Logics AI Chatbot.

Loads environment variables from .env and exposes strongly typed settings.
"""

from pathlib import Path
import os
from dotenv import load_dotenv

# Base workspace directory
BASE_DIR = Path(__file__).resolve().parent.parent

# Load .env from workspace root
load_dotenv(dotenv_path=BASE_DIR / ".env")

# Ensure ChromaDB uses stable SegmentAPI instead of experimental Rust bindings on Windows
os.environ.setdefault("CHROMA_API_IMPL", "chromadb.api.segment.SegmentAPI")
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
os.environ.setdefault("HF_HUB_DISABLE_TELEMETRY", "1")
os.environ.setdefault("TRANSFORMERS_NO_ADVISORY_WARNINGS", "1")


class Settings:
    """Application configuration settings."""

    # Project directories
    BASE_DIR: Path = BASE_DIR
    DATA_DIR: Path = Path(os.getenv("DATA_DIR", BASE_DIR / "data"))
    CHROMA_PERSIST_DIRECTORY: Path = Path(
        os.getenv("CHROMA_PERSIST_DIRECTORY", BASE_DIR / "chroma_db")
    )

    # ChromaDB Collection
    CHROMA_COLLECTION_NAME: str = os.getenv(
        "CHROMA_COLLECTION_NAME", "a7_logics_knowledge_base"
    )

    # Groq API Configuration (Fast inference - Free tier)
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "").strip()
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "").strip()

    # Embedding & LLM Models (Free Open Stack)
    EMBEDDING_MODEL: str = os.getenv(
        "EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2"
    )
    LLM_MODEL: str = os.getenv("LLM_MODEL", "llama-3.3-70b-versatile")
    LLM_TEMPERATURE: float = float(os.getenv("LLM_TEMPERATURE", "0.0"))
    LLM_MAX_TOKENS: int = int(os.getenv("LLM_MAX_TOKENS", "1500"))

    # Strict Grounding Fallback Response
    FALLBACK_RESPONSE: str = (
        "I apologize, but I don't have enough information to answer that question accurately. "
        "If you have any questions regarding our team or how we can assist you, feel free to ask!"
    )

    # Document Chunking
    CHUNK_SIZE: int = int(os.getenv("CHUNK_SIZE", "800"))
    CHUNK_OVERLAP: int = int(os.getenv("CHUNK_OVERLAP", "150"))

    # Website Ingestion
    WEBSITE_URL: str = os.getenv("WEBSITE_URL", "https://a7logics.com/")

    # Database Configuration (PostgreSQL with SQLite Fallback)
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", "postgresql://user:password@localhost:5432/a7logics_db"
    )
    FALLBACK_DB_URL: str = os.getenv(
        "FALLBACK_DB_URL", f"sqlite:///{BASE_DIR / 'a7_local.db'}"
    )
    UNANSWERED_ALERT_THRESHOLD: int = int(
        os.getenv("UNANSWERED_ALERT_THRESHOLD", "3")
    )

    def ensure_directories(self) -> None:
        """Ensure necessary directories exist."""
        self.DATA_DIR.mkdir(parents=True, exist_ok=True)
        self.CHROMA_PERSIST_DIRECTORY.mkdir(parents=True, exist_ok=True)

    def validate_groq_key(self, raise_error: bool = False) -> bool:
        """Validate if Groq API Key is provided.

        Args:
            raise_error: Whether to raise ValueError if missing.

        Returns:
            bool: True if key is set and non-empty.
        """
        is_valid = bool(self.GROQ_API_KEY and not self.GROQ_API_KEY.startswith("your_"))
        if not is_valid and raise_error:
            raise ValueError(
                "GROQ_API_KEY is not configured. Please set a valid key in your .env file."
            )
        return is_valid

    def validate_openai_key(self, raise_error: bool = False) -> bool:
        """Backwards compatibility alias for API key validation."""
        return self.validate_groq_key(raise_error=raise_error)


# Global settings singleton
settings = Settings()
settings.ensure_directories()
