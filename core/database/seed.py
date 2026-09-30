"""Database schema migration and default agent seeding for A7 Logics Multi-Agent platform."""

import logging
from config.settings import settings
from core.database.connection import Base, engine, get_db_session
from core.database.models import (
    AgentModel,
    AppSettingModel,
    KnowledgeSourceModel,
    TokenUsageLogModel,
    UnansweredLog,
)

logger = logging.getLogger(__name__)


def seed_database() -> None:
    """Ensure all SQLAlchemy tables exist and default agents are seeded."""
    try:
        # Create all tables if not exist
        Base.metadata.create_all(bind=engine)

        # Check and add system_prompt and welcome_message columns to agents table if missing
        with engine.connect() as conn:
            from sqlalchemy import text
            try:
                if engine.url.drivername.startswith("sqlite"):
                    cursor = conn.execute(text("PRAGMA table_info(agents)"))
                    cols = [row[1] for row in cursor.fetchall()]
                    if "system_prompt" not in cols:
                        conn.execute(text("ALTER TABLE agents ADD COLUMN system_prompt TEXT"))
                        conn.commit()
                        logger.info("Migrated SQLite schema: added 'system_prompt' column to 'agents' table.")
                    if "welcome_message" not in cols:
                        conn.execute(text("ALTER TABLE agents ADD COLUMN welcome_message TEXT"))
                        conn.commit()
                        logger.info("Migrated SQLite schema: added 'welcome_message' column to 'agents' table.")
                else:
                    conn.execute(text("ALTER TABLE agents ADD COLUMN IF NOT EXISTS system_prompt TEXT"))
                    conn.execute(text("ALTER TABLE agents ADD COLUMN IF NOT EXISTS welcome_message TEXT"))
                    conn.commit()
                    logger.info("Migrated PostgreSQL schema: verified/added 'system_prompt' & 'welcome_message' columns to 'agents' table.")

                # Check and add agent_name and agent_id columns to unanswered_logs table if missing
                if engine.url.drivername.startswith("sqlite"):
                    cursor = conn.execute(text("PRAGMA table_info(unanswered_logs)"))
                    cols = [row[1] for row in cursor.fetchall()]
                    if "agent_name" not in cols:
                        conn.execute(text("ALTER TABLE unanswered_logs ADD COLUMN agent_name VARCHAR(128) DEFAULT 'General Agent'"))
                        conn.commit()
                        logger.info("Migrated SQLite schema: added 'agent_name' column to 'unanswered_logs' table.")
                    if "agent_id" not in cols:
                        conn.execute(text("ALTER TABLE unanswered_logs ADD COLUMN agent_id VARCHAR(64)"))
                        conn.commit()
                        logger.info("Migrated SQLite schema: added 'agent_id' column to 'unanswered_logs' table.")
                else:
                    conn.execute(text("ALTER TABLE unanswered_logs ADD COLUMN IF NOT EXISTS agent_name VARCHAR(128) DEFAULT 'General Agent'"))
                    conn.execute(text("ALTER TABLE unanswered_logs ADD COLUMN IF NOT EXISTS agent_id VARCHAR(64)"))
                    conn.commit()
                    logger.info("Migrated PostgreSQL schema: verified/added 'agent_name' & 'agent_id' columns to 'unanswered_logs' table.")
            except Exception as e:
                logger.debug("Column migration notice: %s", e)

        with get_db_session() as session:
            # 1. Seed A7 Logics Core Assistant
            a7_agent = session.query(AgentModel).filter(AgentModel.slug == "a7_logics").first()
            if not a7_agent:
                a7_agent = AgentModel(
                    id="a7_logics",
                    slug="a7_logics",
                    name="A7 Logics Assistant",
                    description="Executive Client Representative for A7 Logics services, pricing, and tech stacks.",
                    persona="Executive",
                    status="Ready",
                    target_url="https://a7logics.com/",
                    system_prompt="You are the Executive Client Representative for A7 Logics. Speak concisely with strategic clarity.",
                )
                session.add(a7_agent)
                session.flush()

                # Add default knowledge source
                src = KnowledgeSourceModel(
                    id="src_a7_services_docx",
                    agent_id=a7_agent.id,
                    source_type="docx",
                    source_name="sample_services.docx",
                    raw_content="A7 Logics core digital agency services, technical stacks (ColdFusion, Laravel, React, Python), and development process.",
                    chunk_count=21,
                )
                session.add(src)
                logger.info("Seeded default 'a7_logics' agent in database.")

            # 2. Seed Fintech Risk Advisor
            fintech = session.query(AgentModel).filter(AgentModel.slug == "fintech_risk_advisor").first()
            if not fintech:
                fintech = AgentModel(
                    id="fintech_risk_advisor",
                    slug="fintech_risk_advisor",
                    name="Fintech Risk Advisor",
                    description="Specialized compliance, credit risk assessment, and quantitative portfolio advisory bot.",
                    persona="Technical",
                    status="Ready",
                    target_url="https://sec.gov/edgar/financial-guidelines",
                )
                session.add(fintech)
                session.flush()

                src = KnowledgeSourceModel(
                    id="src_fintech_policies",
                    agent_id=fintech.id,
                    source_type="txt",
                    source_name="Fintech_Risk_Policies.txt",
                    raw_content="Fintech Risk Policy: Tier 1 capital ratios must exceed 10.5% under stress tests. Automated circuit breakers trigger when volatility exceeds 35%.",
                    chunk_count=1,
                )
                session.add(src)
                logger.info("Seeded 'fintech_risk_advisor' agent in database.")

            # 3. Seed E-Commerce Support
            ecom = session.query(AgentModel).filter(AgentModel.slug == "ecommerce_support").first()
            if not ecom:
                ecom = AgentModel(
                    id="ecommerce_support",
                    slug="ecommerce_support",
                    name="E-Commerce Support",
                    description="Customer inquiry, product recommendation, and order tracking multi-channel support agent.",
                    persona="Casual",
                    status="Draft",
                    target_url="",
                )
                session.add(ecom)
                logger.info("Seeded 'ecommerce_support' agent in database.")

            # 4. Seed default global application settings
            default_settings = {
                "active_provider": "groq",
                "active_model": "llama-3.3-70b-versatile",
                "token_monthly_quota": "1000000",
            }
            for setting_key, setting_value in default_settings.items():
                existing_setting = (
                    session.query(AppSettingModel)
                    .filter(AppSettingModel.key == setting_key)
                    .first()
                )
                if not existing_setting:
                    session.add(AppSettingModel(key=setting_key, value=setting_value))
                    logger.info("Seeded default app setting '%s' = '%s'", setting_key, setting_value)

    except Exception as exc:
        logger.exception("Database seeding encountered an issue: %s", exc)
