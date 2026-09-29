# A7 Logics Enterprise AI Chatbot - Milestone 1: Multi-Source Ingestion Pipeline & Local Vector Storage (ChromaDB)

This repository contains the document ingestion pipeline and local vector storage infrastructure for the A7 Logics Enterprise AI Chatbot.

---

## Architecture Overview

```
.
├── app/                         # Milestone 4: Streamlit UI
│   ├── __init__.py
│   └── streamlit_app.py         # Dual-mode Client Chat & Admin Knowledge Center
├── config/
│   ├── __init__.py
│   └── settings.py              # Centralized environment configuration
├── data/                        # Local document store (*.pdf, *.docx, *.xlsx)
│   ├── sample_overview.pdf
│   ├── sample_pricing.xlsx
│   └── sample_services.docx
├── database/                    # Milestone 2: Database & frequency tracking
│   ├── __init__.py
│   ├── connection.py            # Connection pooling with automatic SQLite fallback
│   ├── models.py                # UnansweredLog schema (id, query, count, alert, status)
│   └── tracker.py               # record_unanswered_query & get_active_alerts service
├── graph/                       # Milestone 3: LangGraph Agentic RAG workflow
│   ├── __init__.py
│   ├── nodes.py                 # Retrieval, LLM grading, grounded answer, fallback, alert
│   ├── state.py                 # AgentState definition
│   └── workflow.py              # StateGraph, conditional edges, & run_a7_agent
├── ingestion/                   # Milestone 1: Ingestion pipeline
│   ├── __init__.py
│   ├── web_scraper.py           # Targeted web crawler for https://a7logics.com/
│   ├── doc_loader.py            # Unified PDF, Word (.docx), & Excel (.xlsx) parser
│   └── vector_store.py          # Chunking, OpenAI embeddings, ChromaDB, & deduplication
├── tests/
│   ├── test_graph.py            # Milestone 3 test suite (grounding, fallback, escalation)
│   ├── test_ingestion.py        # Milestone 1 test suite (scraping, loaders, deduplication)
│   └── test_tracker.py          # Milestone 2 test suite (alert threshold & frequency tracking)
├── .env.example                 # Environment template
├── .env                         # Active environment configuration
├── chat_demo.py                 # Interactive CLI chat console
├── generate_sample_data.py      # Sample data generation script
├── init_db.py                   # Milestone 2: Database initialization & table creator
├── pytest.ini                   # Pytest configuration
├── requirements.txt             # Project dependencies
└── run_ingestion.py             # Standalone CLI execution script
```

---

## 1. Setup & Installation

### Step 1: Initialize Virtual Environment
```bash
py -m venv .venv
# On Windows PowerShell:
.\.venv\Scripts\Activate.ps1
# On CMD:
.\.venv\Scripts\activate.bat
```

### Step 2: Install Dependencies
```bash
pip install -r requirements.txt
```

### Step 3: Configure Environment Variables
Copy `.env.example` to `.env` (if not already created) and provide your Groq API key (free from [console.groq.com](https://console.groq.com/keys)):
```ini
# Groq API Configuration (Fast Inference - Free Tier)
GROQ_API_KEY=gsk_...

# Model Architecture (Free Open Stack)
LLM_MODEL=llama-3.3-70b-versatile
LLM_TEMPERATURE=0.0
EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2

# Vector Storage (ChromaDB)
CHROMA_PERSIST_DIRECTORY=./chroma_db
CHROMA_COLLECTION_NAME=a7_logics_knowledge_base

# Text Splitting Configuration
CHUNK_SIZE=800
CHUNK_OVERLAP=150

# Target Sources
WEBSITE_URL=https://a7logics.com/
DATA_DIR=./data
```

---

## 2. Ingestion Pipeline Usage

### Full Vector Ingestion (Local HuggingFace Embeddings - No Paid API Key Needed!)
To crawl `https://a7logics.com/`, parse local `./data/` documents, chunk text, and persist embeddings into ChromaDB using local CPU sentence-transformers:
```bash
python run_ingestion.py
```

### Dry-Run Verification
To verify web scraping, local file parsing (PDF, DOCX, XLSX), and chunking without writing to ChromaDB:
```bash
python run_ingestion.py --dry-run
```

### Additional CLI Flags
- `--skip-web`: Ingest only local `./data/` documents.
- `--skip-local`: Ingest only website content.
- `-v`, `--verbose`: Enable debug-level logging.

---

## 3. Key Pipeline Capabilities

1. **Targeted Web Scraper (`ingestion/web_scraper.py`)**:
   - Fetches and parses content from `https://a7logics.com/`.
   - Cleans HTML boilerplate (navigation headers, footers, forms, scripts, styles, modals).
   - Extracts structured sections: Services, Development Process, Testimonials/Case Studies, Features, Technologies, and Company Overview.
   - Attaches uniform metadata: `{"source": "website", "url": "https://a7logics.com/", "section": ...}`.

2. **Unified Local Document Loader (`ingestion/doc_loader.py`)**:
   - **PDF**: Ingests pages via `PyPDFLoader` with page-level metadata.
   - **Word (`.docx`)**: Ingests full text via `Docx2txtLoader`.
   - **Excel (`.xlsx`)**: Iterates sheets and formats tabular rows into semantic text blocks via `openpyxl`.
   - Attaches uniform metadata: `{"source": filename, "type": file_extension}`.

3. **Persistent ChromaDB Vector Store with Deduplication (`ingestion/vector_store.py`)**:
   - Chunks text using `RecursiveCharacterTextSplitter(chunk_size=800, chunk_overlap=150)`.
   - Embeds with `text-embedding-3-small`.
   - Persists to local directory `./chroma_db/` under collection `a7_logics_knowledge_base`.
   - Generates deterministic content-addressable IDs: ensures identical records are skipped on subsequent runs to prevent duplication and save API credits.

---

## 4. Milestone 2: Unanswered Query Tracking & Database Layer

### Initialize Database Tables
To create or verify the database tables (with automatic connection test and fallback):
```bash
python init_db.py
```
- If PostgreSQL at `DATABASE_URL` is available, tables are created there.
- If PostgreSQL is offline/unreachable, it automatically connects to SQLite at `./a7_local.db`.

### Python Tracking API Usage
```python
from database.tracker import record_unanswered_query, get_active_alerts

# Record an unanswered query
result = record_unanswered_query("Can you integrate with SAP ERP?")
print(result)
# Output:
# {
#     "id": 1,
#     "user_query": "Can you integrate with SAP ERP?",
#     "normalized_query": "can you integrate with sap erp",
#     "frequency_count": 1,
#     "alert_triggered": False,
#     "admin_alert_needed": False,
#     "status": "pending"
# }

# Calling it a 3rd time flips alert_triggered and admin_alert_needed
result3 = record_unanswered_query("can you integrate with SAP ERP???")
# result3["alert_triggered"] == True
# result3["admin_alert_needed"] == True

# Retrieve active unresolved alerts (frequency >= 3)
alerts = get_active_alerts()
for alert in alerts:
    print(f"Alert: '{alert['user_query']}' asked {alert['frequency_count']} times!")
```

---

## 5. Milestone 3: LangGraph Agentic RAG Workflow

The chatbot employs a deterministic LangGraph workflow to guarantee strict grounding in verified company documentation and automatically escalate missing information to administrators.

### Workflow Routing Flow
1. **User Inquiry** enters `retrieve_node` (Top-4 semantic chunks fetched from ChromaDB).
2. **`grade_documents_node`**: Evaluates chunks with structured Pydantic schema (`DocumentGrade(is_relevant, reasoning)`).
3. **Grounding Decision**:
   - If `is_grounded == True`: Routes to `generate_grounded_answer_node`. Adopts the A7 Logics Executive Client Representative persona and answers ONLY using facts in context.
   - If `is_grounded == False`: Routes to `fallback_and_log_node`. Sets exact fallback sentence:
     > `"I am sorry, but I cannot find this information in the A7 Logics knowledge base."`
     and logs query to `unanswered_logs`.
4. **Escalation Decision**:
   - If query frequency hits 3 strikes (`needs_alert == True`): Routes to `admin_alert_node` to trigger critical alert payload.

### Programmatic Python Invocation
```python
from graph.workflow import run_a7_agent

# Run query through compiled graph
response = run_a7_agent("What web development technologies does A7 Logics use?")

print("Answer:", response["generation"])
print("Grounded:", response["is_grounded"])
print("Needs Alert:", response["needs_alert"])
```

### Interactive CLI Chat Console
To converse directly with the compiled workflow in your terminal:
```bash
python chat_demo.py
```

---
 
 ## 6. Milestone 4: Streamlit Executive Dual-Mode Web Interface

The system features an executive-ready, branded Streamlit testing interface with dual modes:
1. **Client Chat Demo**:
   - Message history preserved in session state with streaming executive responses.
   - Strict factual grounding enforcement with exact refusal message if info is missing.
   - Visual grounding badges (`🟢 Grounded in Knowledge Base` or `🟡 Refusal Triggered & Logged to DB`).
   - Collapsible inspection of retrieved ChromaDB chunks and metadata sources.
   - Quick inquiry chips for common enterprise client questions.
2. **Admin Knowledge Center**:
   - Live knowledge base metrics: ChromaDB chunk count, collection name, and active database engine.
   - **Real-Time Admin Alert Banner**: High-priority alert banner automatically triggered when unanswered query frequency >= 3.
   - **Unanswered Query Intelligence Dataframe**: Tabular inspection of `unanswered_logs` with frequency counts, timestamps, alert states, and filter controls.
   - **Manual Ingestion Trigger**: One-click re-indexing of `https://a7logics.com/` and `./data/` without restarting the server.

### Launching the Streamlit Application
```bash
streamlit run app/streamlit_app.py
```
Open your browser at `http://localhost:8501`.

---

## 7. Running Automated Tests
 
 Run the full pytest suite (covering Milestones 1, 2, 3, and the Groq/HuggingFace stack):
 ```bash
 pytest -v
 ```
 All 17 automated tests verify:
 - Ingestion settings and web scraping structure.
 - HuggingFace local embedding initialization and output dimension (384 dims).
 - Local document loaders (PDF, DOCX, XLSX).
 - Text chunking and deterministic deduplication.
 - Unanswered query normalization.
 - 3-strikes frequency alert threshold trigger (`alert_triggered = True`).
 - Active alert list filtering and sorting.
 - Empty query validation.
 - Strict fallback sentence exact string matching.
 - Empty document grading behavior (`is_grounded = False`).
 - Grounded workflow execution routing to answer generation.
 - 3-strikes escalation routing to `admin_alert_node`.
 - ChatGroq structured grading schema integration with Pydantic (`DocumentGrade`).

---

## 8. Milestone 5: Modular Project Architecture & Production REST API

Decoupled architecture:
- **Core Engine (`core/`)**: Dedicated package housing LangGraph nodes (`nodes.py`), state definitions (`state.py`), and StateGraph workflow orchestration (`workflow.py`).
- **Modular FastAPI Service (`backend/`)**: Modular architecture using `APIRouter` with endpoints segregated under `backend/api/v1/endpoints/` and CORS accepting requests across production domains (`allow_origins=["*"]`).
- **Production REST API Contract (`/api/v1`)**:
  * `POST /api/v1/chat`: Lightweight, client-facing contract stripping all internal grounding metadata:
    - Request: `{"message": str, "session_id": Optional[str]}`
    - Response: `{"answer": str, "session_id": str, "timestamp": "ISO-8601"}`
  * `GET /api/v1/admin/alerts`: Queries unresolved queries and escalations from `unanswered_logs`.
  * `GET /health` & `GET /api/v1/health`: Operational readiness metrics.
- **Frontend API Service (`frontend/src/services/api.ts`)**: Centralized, typed API client functions (`sendChatMessage`, `fetchAdminAlerts`, `checkSystemHealth`) consuming `NEXT_PUBLIC_API_URL`.

### Run Instructions

#### 1. Start the FastAPI Backend
```bash
# From workspace root with .venv active
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```
Interactive OpenAPI Swagger Docs: `http://localhost:8000/docs`.

#### 2. Start the Next.js Frontend
```bash
# Navigate to frontend/ and run dev server
cd frontend
npm run dev
```
Client Application: `http://localhost:3000`.
