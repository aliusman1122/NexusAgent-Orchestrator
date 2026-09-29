"""Database connection management with connection pooling and seamless SQLite fallback.

Configures a robust SQLAlchemy engine reading from settings.DATABASE_URL (PostgreSQL).
If PostgreSQL is unreachable or unconfigured locally, automatically and seamlessly
falls back to local SQLite (settings.FALLBACK_DB_URL).
"""

import logging
from contextlib import contextmanager
from typing import Generator
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, declarative_base, sessionmaker

from config.settings import settings

logger = logging.getLogger(__name__)

Base = declarative_base()


class DatabaseManager:
    """Manages database engine, connection pooling, and session lifecycles."""

    def __init__(self):
        self._engine: Engine = self._create_engine_with_fallback()
        self._session_factory = sessionmaker(
            autocommit=False,
            autoflush=False,
            bind=self._engine,
        )

    def _create_engine_with_fallback(self) -> Engine:
        """Attempt primary database connection; fall back to SQLite if unavailable."""
        primary_url = settings.DATABASE_URL
        fallback_url = settings.FALLBACK_DB_URL

        # If primary URL is already sqlite, directly create it
        if primary_url.startswith("sqlite"):
            logger.info("Using SQLite database engine at %s", primary_url)
            return create_engine(
                primary_url,
                connect_args={"check_same_thread": False},
            )

        # Attempt PostgreSQL connection
        try:
            logger.info("Attempting connection to PostgreSQL database...")
            pg_engine = create_engine(
                primary_url,
                pool_size=10,
                max_overflow=20,
                pool_pre_ping=True,
                connect_args={"connect_timeout": 3},
            )
            # Test connectivity
            with pg_engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            logger.info("Successfully connected to PostgreSQL database.")
            return pg_engine
        except Exception as exc:
            logger.warning(
                "PostgreSQL connection to '%s' failed (%s). "
                "Falling back to local SQLite at '%s'.",
                primary_url,
                exc,
                fallback_url,
            )
            return create_engine(
                fallback_url,
                connect_args={"check_same_thread": False},
            )

    @property
    def engine(self) -> Engine:
        """Active SQLAlchemy engine."""
        return self._engine

    @property
    def session_factory(self) -> sessionmaker:
        """Thread-safe session factory."""
        return self._session_factory

    def is_sqlite(self) -> bool:
        """Check if currently running on SQLite fallback."""
        return self._engine.url.drivername.startswith("sqlite")

    def get_url(self) -> str:
        """Return sanitized active database URL string."""
        return str(self._engine.url)


# Global DatabaseManager singleton
db_manager = DatabaseManager()
engine = db_manager.engine
SessionLocal = db_manager.session_factory


@contextmanager
def get_db_session() -> Generator[Session, None, None]:
    """Transactional session context manager with automatic commit and rollback."""
    session: Session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
