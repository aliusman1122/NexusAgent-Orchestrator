"""Database initialization script for A7 Logics Enterprise AI Chatbot.

Creates all defined database tables (e.g. unanswered_logs) using SQLAlchemy metadata.
Verifies engine connectivity and prints table schema status.
"""

import logging
import sys
from sqlalchemy import inspect

from config.settings import settings
from core.database.connection import Base, db_manager, engine
import core.database.models  # Ensure all model tables are registered with Base.metadata


def init_database() -> bool:
    """Initialize all tables in active database."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
    )
    logger = logging.getLogger("init_db")

    print("=" * 65)
    print("   A7 LOGICS AI CHATBOT - DATABASE INITIALIZATION (MILESTONE 2)")
    print("=" * 65)
    print(f"Active DB Engine:    {engine.url.drivername}")
    print(f"Active DB Target:    {db_manager.get_url()}")
    print(f"Running on Fallback: {db_manager.is_sqlite()}")
    print("-" * 65)

    try:
        logger.info("Creating database tables if not already present...")
        Base.metadata.create_all(bind=engine)

        inspector = inspect(engine)
        table_names = inspector.get_table_names()
        logger.info("Successfully inspected tables in database: %s", table_names)

        print("\nCreated / Verified Tables:")
        for table in table_names:
            columns = inspector.get_columns(table)
            col_summary = ", ".join(f"{c['name']} ({c['type']})" for c in columns)
            print(f" -> Table '{table}': {col_summary}")

        print("\n" + "=" * 65)
        print(" SUCCESS: Database initialized and ready for query tracking!")
        print("=" * 65 + "\n")
        return True

    except Exception as exc:
        logger.exception("Failed to initialize database tables: %s", exc)
        print(f"\nERROR: Database initialization failed: {exc}", file=sys.stderr)
        return False


if __name__ == "__main__":
    success = init_database()
    sys.exit(0 if success else 1)
