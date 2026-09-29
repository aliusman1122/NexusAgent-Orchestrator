"""Unit tests for Milestone 3 LangGraph workflow, strict grounding, and admin escalation."""

from contextlib import contextmanager
from unittest.mock import MagicMock, patch
import pytest
from langchain_core.documents import Document
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from config.settings import settings
from core.database.connection import Base
import core.database.tracker as tracker_module
from core.graph.nodes import (
    DocumentGrade,
    admin_alert_node,
    fallback_and_log_node,
    generate_grounded_answer_node,
    grade_documents_node,
    retrieve_node,
)
from core.graph.state import AgentState
from core.graph.workflow import build_a7_graph, run_a7_agent


@pytest.fixture
def mock_db_session(monkeypatch):
    """Provide an isolated in-memory SQLite database for graph logging tests."""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    TestingSession = sessionmaker(bind=engine)

    @contextmanager
    def _get_test_session():
        session = TestingSession()
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    monkeypatch.setattr(tracker_module, "get_db_session", _get_test_session)
    return engine


def test_strict_fallback_sentence_exact_match():
    """Verify that the fallback response matches the required system specification."""
    expected = (
        "I apologize, but I don't have enough information to answer that question accurately. "
        "If you have any questions regarding our team or how we can assist you, feel free to ask!"
    )
    assert settings.FALLBACK_RESPONSE == expected


def test_grade_documents_node_empty():
    """Verify grade_documents_node sets is_grounded=False if documents list is empty."""
    state: AgentState = {
        "question": "What is A7 Logics pricing?",
        "documents": [],
        "generation": "",
        "is_grounded": False,
        "needs_alert": False,
        "alert_message": None,
    }
    result = grade_documents_node(state)
    assert result["is_grounded"] is False


def test_fallback_and_log_node_records_and_enforces_exact_sentence(mock_db_session):
    """Verify fallback_and_log_node sets exact fallback sentence and logs to DB."""
    state: AgentState = {
        "question": "Do you provide on-premise Kubernetes hosting?",
        "documents": [],
        "generation": "",
        "is_grounded": False,
        "needs_alert": False,
        "alert_message": None,
    }
    result = fallback_and_log_node(state)
    assert (
        result["generation"]
        == "I apologize, but I don't have enough information to answer that question accurately. If you have any questions regarding our team or how we can assist you, feel free to ask!"
    )
    assert result["is_grounded"] is False
    assert result["needs_alert"] is False


def test_admin_alert_node_format():
    """Verify admin_alert_node constructs the required critical alert message."""
    query = "Do you support Cobol modernization?"
    state: AgentState = {
        "question": query,
        "documents": [],
        "generation": "",
        "is_grounded": False,
        "needs_alert": True,
        "alert_message": None,
    }
    result = admin_alert_node(state)
    expected_alert = (
        f"Alert: Query '{query}' has been requested 3+ times without matching "
        "knowledge base documentation. Action required: Update knowledge base."
    )
    assert result["alert_message"] == expected_alert
    assert result["needs_alert"] is True


def test_workflow_grounded_path():
    """Verify workflow routes through grounded answer node when documents are relevant."""
    test_doc = Document(
        page_content="A7 Logics offers Custom Web Application and Mobile App Development.",
        metadata={"source": "website", "section": "Services"},
    )

    with patch("core.graph.workflow.retrieve_node") as mock_retrieve, \
         patch("core.graph.workflow.grade_documents_node") as mock_grade, \
         patch("core.graph.workflow.generate_grounded_answer_node") as mock_gen:

        mock_retrieve.return_value = {"documents": [test_doc]}
        mock_grade.return_value = {"is_grounded": True}
        mock_gen.return_value = {
            "generation": "A7 Logics specializes in custom web and mobile app development.",
            "is_grounded": True,
            "needs_alert": False,
        }

        test_app = build_a7_graph()
        initial_state: AgentState = {
            "question": "What services do you provide?",
            "documents": [],
            "generation": "",
            "is_grounded": False,
            "needs_alert": False,
            "alert_message": None,
        }

        output = test_app.invoke(initial_state)

        assert output["is_grounded"] is True
        assert output["needs_alert"] is False
        assert output["alert_message"] is None
        assert "A7 Logics specializes" in output["generation"]
        mock_retrieve.assert_called_once()
        mock_grade.assert_called_once()
        mock_gen.assert_called_once()


def test_workflow_three_strikes_escalation_to_admin_alert(mock_db_session):
    """Verify 3 consecutive ungrounded queries trigger fallback -> admin_alert routing."""
    query = "Does A7 Logics build quantum computing algorithms?"

    with patch("core.graph.workflow.retrieve_node") as mock_retrieve, \
         patch("core.graph.workflow.grade_documents_node") as mock_grade:

        mock_retrieve.return_value = {"documents": []}
        mock_grade.return_value = {"is_grounded": False}

        test_app = build_a7_graph()

        # Run 1: ungrounded, frequency = 1, needs_alert = False
        res1 = test_app.invoke(
            {
                "question": query,
                "documents": [],
                "generation": "",
                "is_grounded": False,
                "needs_alert": False,
                "alert_message": None,
            }
        )
        assert (
            res1["generation"]
            == "I apologize, but I don't have enough information to answer that question accurately. If you have any questions regarding our team or how we can assist you, feel free to ask!"
        )
        assert res1["is_grounded"] is False
        assert res1["needs_alert"] is False
        assert res1["alert_message"] is None

        # Run 2: ungrounded, frequency = 2, needs_alert = False
        res2 = test_app.invoke(
            {
                "question": query,
                "documents": [],
                "generation": "",
                "is_grounded": False,
                "needs_alert": False,
                "alert_message": None,
            }
        )
        assert res2["needs_alert"] is False
        assert res2["alert_message"] is None

        # Run 3: 3rd strike! Reaches threshold, routes through admin_alert_node
        res3 = test_app.invoke(
            {
                "question": query,
                "documents": [],
                "generation": "",
                "is_grounded": False,
                "needs_alert": False,
                "alert_message": None,
            }
        )
        assert (
            res3["generation"]
            == "I apologize, but I don't have enough information to answer that question accurately. If you have any questions regarding our team or how we can assist you, feel free to ask!"
        )
        assert res3["is_grounded"] is False
        assert res3["needs_alert"] is True
        assert res3["alert_message"] is not None
        assert "Alert: Query" in res3["alert_message"]
        assert "has been requested 3+ times" in res3["alert_message"]


def test_chat_groq_structured_grading_integration():
    """Verify that grade_documents_node correctly invokes ChatGroq with structured output."""
    test_doc = Document(
        page_content="A7 Logics offers enterprise ColdFusion modernization and support.",
        metadata={"source": "services.docx", "type": "docx"},
    )
    state: AgentState = {
        "question": "Does A7 Logics support ColdFusion?",
        "documents": [test_doc],
        "generation": "",
        "is_grounded": False,
        "needs_alert": False,
        "alert_message": None,
    }

    mock_grade_instance = DocumentGrade(
        is_relevant=True,
        reasoning="Document explicitly mentions ColdFusion modernization.",
    )

    with patch("core.graph.nodes.ChatGroq") as mock_chat_groq:
        mock_instance = MagicMock()
        mock_structured = MagicMock()
        mock_structured.invoke.return_value = mock_grade_instance
        mock_instance.with_structured_output.return_value = mock_structured
        mock_chat_groq.return_value = mock_instance

        result = grade_documents_node(state)

        assert result["is_grounded"] is True
        mock_chat_groq.assert_called_once()
        mock_instance.with_structured_output.assert_called_once_with(DocumentGrade)


def test_is_greeting_detection():
    """Verify greeting and pleasantry intent detection with typo-tolerance and punctuation stripping."""
    from core.graph.nodes import is_greeting

    # Exact, typos, and variations
    assert is_greeting("hi") is True
    assert is_greeting("hii") is True
    assert is_greeting("hey") is True
    assert is_greeting("heyy") is True
    assert is_greeting("hello") is True
    assert is_greeting("hellow") is True
    assert is_greeting("helo") is True
    assert is_greeting("hlo") is True

    # Punctuation stripping
    assert is_greeting("Hello!") is True
    assert is_greeting("hellow!") is True
    assert is_greeting("hey?") is True
    assert is_greeting("???hi!!!") is True
    assert is_greeting("hey there") is True

    # Time-of-day greetings
    assert is_greeting("good morning") is True
    assert is_greeting("good afternoon") is True
    assert is_greeting("good evening") is True
    assert is_greeting("greetings") is True

    # Cultural pleasantries
    assert is_greeting("salam") is True
    assert is_greeting("assalam o alaikum") is True
    assert is_greeting("aoa") is True
    assert is_greeting("salam!") is True
    assert is_greeting("assalam-o-alaikum") is True

    # Identity and capability queries
    assert is_greeting("who are you") is True
    assert is_greeting("who are you?") is True
    assert is_greeting("what can you do") is True
    assert is_greeting("What can you do?") is True
    assert is_greeting("how can you help me") is True
    assert is_greeting("how can you help me?") is True
    assert is_greeting("introduce yourself") is True
    assert is_greeting("hello, who are you?") is True

    # Actual corporate inquiries (must NEVER be classified as greetings)
    assert is_greeting("What web development technologies do you use?") is False
    assert is_greeting("Tell me about your mobile capabilities") is False
    assert is_greeting("What are your estimated starting rates?") is False
    assert is_greeting("Can you build an SAP integration?") is False


def test_greeting_workflow_bypasses_retrieval_and_db(mock_db_session):
    """Verify greetings route directly to greet_node without calling retrieval or logging to DB."""
    from core.database.models import UnansweredLog

    with patch("core.graph.workflow.retrieve_node") as mock_retrieve:
        test_app = build_a7_graph()

        result = test_app.invoke(
            {
                "question": "Hello! Who are you?",
                "documents": [],
                "generation": "",
                "is_grounded": False,
                "needs_alert": False,
                "alert_message": None,
            }
        )

        expected_greeting = (
            "Hello! I am your A7 Logics Executive Client Representative. "
            "How may I assist you today with our web engineering, mobile development, or enterprise solutions?"
        )
        assert result["generation"] == expected_greeting
        assert result["is_grounded"] is True
        assert result["needs_alert"] is False
        assert result["documents"] == []

        # Ensure retrieve_node was NEVER called
        mock_retrieve.assert_not_called()

        # Ensure database unanswered_logs remains completely empty
        with tracker_module.get_db_session() as session:
            count = session.query(UnansweredLog).count()
            assert count == 0


def test_zero_metadata_bleed_formatting():
    """Verify generate_grounded_answer_node strips raw bracketed metadata and uses max_tokens >= 1024."""
    test_doc = Document(
        page_content="A7 Logics utilizes React, Node.js, and Python for custom web applications.",
        metadata={"source": "sample_overview.pdf", "section": "Services"},
    )
    state: AgentState = {
        "question": "What technologies do you use for web applications?",
        "documents": [test_doc],
        "generation": "",
        "is_grounded": False,
        "needs_alert": False,
        "alert_message": None,
    }

    mock_chat_groq_instance = MagicMock()
    # Simulate LLM response that accidentally leaked metadata brackets
    mock_chat_groq_instance.invoke.return_value = MagicMock(
        content=(
            "- Custom Web Architecture: Engineered with React, Node.js, and Python.\n"
            "[Source: sample_overview.pdf | Section: Services]\n"
            "- High Scalability: Tailored for maximum security and performance."
        )
    )

    with patch("core.graph.nodes.ChatGroq", return_value=mock_chat_groq_instance) as mock_cls:
        res = generate_grounded_answer_node(state)

        # Verify max_tokens passed to ChatGroq is at least 1024
        call_kwargs = mock_cls.call_args[1]
        assert call_kwargs.get("max_tokens", 0) >= 1024

        # Verify bracketed source was scrubbed
        assert "[Source:" not in res["generation"]
        assert "sample_overview.pdf" not in res["generation"]
        assert "React, Node.js, and Python" in res["generation"]


def test_grade_documents_safety_fallback_on_llm_false_when_keywords_present():
    """Verify safety fallback overrides LLM is_relevant=False when retrieved chunks have domain tech keywords."""
    test_doc = Document(
        page_content="Our backend engineering team develops scalable enterprise APIs using Laravel and PHP.",
        metadata={"source": "tech_stack.pdf", "section": "Backend"},
    )
    state: AgentState = {
        "question": "Do you provide development services using Laravel?",
        "documents": [test_doc],
        "generation": "",
        "is_grounded": False,
        "needs_alert": False,
        "alert_message": None,
    }

    # Simulate overly strict LLM evaluation returning is_relevant=False
    mock_grade_false = DocumentGrade(
        is_relevant=False,
        reasoning="Overly strict assessment deemed context general.",
    )

    with patch("core.graph.nodes.ChatGroq") as mock_chat_groq:
        mock_instance = MagicMock()
        mock_structured = MagicMock()
        mock_structured.invoke.return_value = mock_grade_false
        mock_instance.with_structured_output.return_value = mock_structured
        mock_chat_groq.return_value = mock_instance

        result = grade_documents_node(state)

        # Safety fallback must detect 'laravel' keyword overlap and override to True
        assert result["is_grounded"] is True


def test_grade_documents_safety_fallback_on_llm_error():
    """Verify safety fallback uses keyword overlap heuristic when LLM call fails."""
    test_doc = Document(
        page_content="A7 Logics offers enterprise ColdFusion modernization and React mobile development.",
        metadata={"source": "modernization.docx"},
    )
    state: AgentState = {
        "question": "Can you modernize our ColdFusion applications?",
        "documents": [test_doc],
        "generation": "",
        "is_grounded": False,
        "needs_alert": False,
        "alert_message": None,
    }

    with patch("core.graph.nodes.ChatGroq", side_effect=Exception("API connection timeout")):
        result = grade_documents_node(state)
        # Should evaluate to True based on ColdFusion overlap
        assert result["is_grounded"] is True


def test_retrieve_node_fetches_k4_and_tenant():
    """Verify retrieve_node invokes vector store with k=4 and active tenant collection."""
    state: AgentState = {
        "question": "What mobile development technologies do you support?",
        "documents": [],
        "generation": "",
        "is_grounded": False,
        "needs_alert": False,
        "alert_message": None,
        "tenant_id": "a7_logics_knowledge_base",
    }

    mock_doc = Document(page_content="We support Flutter and React Native.", metadata={})
    mock_retriever = MagicMock()
    mock_retriever.invoke.return_value = [mock_doc, mock_doc, mock_doc, mock_doc]

    mock_store = MagicMock()
    mock_store.collection_name = "a7_logics_knowledge_base"
    mock_store.vector_store.as_retriever.return_value = mock_retriever

    with patch("core.graph.nodes.get_vector_store", return_value=mock_store) as mock_get_store:
        result = retrieve_node(state)

        mock_get_store.assert_called_once_with(collection_name="a7_logics_knowledge_base")
        mock_store.vector_store.as_retriever.assert_called_once_with(search_kwargs={"k": 4})
        mock_retriever.invoke.assert_called_once_with("What mobile development technologies do you support?")
        assert len(result["documents"]) == 4
