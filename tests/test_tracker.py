"""Unit tests for unanswered queries tracker and alert trigger mechanisms (Milestone 2)."""

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from core.database.connection import Base
from core.database.models import UnansweredLog
from core.database.tracker import (
    get_active_alerts,
    normalize_query,
    record_unanswered_query,
)


@pytest.fixture
def test_db_session():
    """Create an isolated in-memory SQLite database session for unit testing."""
    test_engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=test_engine)
    TestingSessionLocal = sessionmaker(
        autocommit=False, autoflush=False, bind=test_engine
    )
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


def test_normalize_query():
    """Verify query normalization lowercases, strips punctuation and collapses whitespace."""
    raw = "   What are your ColdFusion rates???  "
    expected = "what are your coldfusion rates"
    assert normalize_query(raw) == expected

    raw2 = "Do you build Flutter apps?!?"
    assert normalize_query(raw2) == "do you build flutter apps"


def test_unanswered_query_three_strikes_alert(test_db_session):
    """Verify that calling record_unanswered_query 3 times sets alert_triggered=True."""
    query = "Can you integrate with SAP Business One ERP?"

    # 1st time: new record created, count = 1, alert = False
    res1 = record_unanswered_query(query, session=test_db_session)
    assert res1["frequency_count"] == 1
    assert res1["alert_triggered"] is False
    assert res1["admin_alert_needed"] is False
    assert res1["status"] == "pending"

    # 2nd time: identical query with trailing question marks and lowercase
    res2 = record_unanswered_query(
        "can you integrate with SAP business one erp???", session=test_db_session
    )
    assert res2["frequency_count"] == 2
    assert res2["alert_triggered"] is False
    assert res2["admin_alert_needed"] is False

    # 3rd time: threshold reached! alert_triggered becomes True and admin_alert_needed = True
    res3 = record_unanswered_query(
        "  CAN YOU INTEGRATE WITH SAP BUSINESS ONE ERP  ", session=test_db_session
    )
    assert res3["frequency_count"] == 3
    assert res3["alert_triggered"] is True
    assert res3["admin_alert_needed"] is True

    # 4th time: count increments to 4, alert remains True, but admin_alert_needed is False (no alert spam)
    res4 = record_unanswered_query(query, session=test_db_session)
    assert res4["frequency_count"] == 4
    assert res4["alert_triggered"] is True
    assert res4["admin_alert_needed"] is False

    # Verify database state directly
    saved_record = (
        test_db_session.query(UnansweredLog)
        .filter_by(normalized_query=normalize_query(query))
        .first()
    )
    assert saved_record is not None
    assert saved_record.frequency_count == 4
    assert saved_record.alert_triggered is True


def test_get_active_alerts(test_db_session):
    """Verify get_active_alerts retrieves queries meeting threshold."""
    # Query 1: Asked 3 times
    q1 = "Do you have SOC2 certification?"
    for _ in range(3):
        record_unanswered_query(q1, session=test_db_session)

    # Query 2: Asked only 2 times (below threshold)
    q2 = "What is your hourly rate for PHP?"
    for _ in range(2):
        record_unanswered_query(q2, session=test_db_session)

    # Query 3: Asked 5 times
    q3 = "Do you offer ISO 27001 compliance?"
    for _ in range(5):
        record_unanswered_query(q3, session=test_db_session)

    active_alerts = get_active_alerts(min_frequency=3, session=test_db_session)
    alert_queries = [alert["normalized_query"] for alert in active_alerts]

    assert len(active_alerts) == 2
    assert normalize_query(q3) in alert_queries
    assert normalize_query(q1) in alert_queries
    assert normalize_query(q2) not in alert_queries
    # Highest frequency should be ordered first
    assert active_alerts[0]["normalized_query"] == normalize_query(q3)
    assert active_alerts[0]["frequency_count"] == 5


def test_empty_query_handling(test_db_session):
    """Verify empty or whitespace-only queries do not create invalid records."""
    res = record_unanswered_query("   ", session=test_db_session)
    assert res["id"] is None
    assert res["frequency_count"] == 0
    assert res["status"] == "ignored"
