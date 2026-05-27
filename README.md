# FailIQ

> AI-powered test failure investigation platform.

FailIQ takes raw CI/test log files, extracts meaningful failure signals, and uses a large language model to produce a structured Root Cause Analysis — complete with failure clusters, bug classification, suggested fixes, and historical pattern matching via a persistent RAG knowledge base.

---

## What It Does

When a CI job fails, engineers spend significant time manually reading through thousands of log lines to understand what went wrong. FailIQ automates this:

1. **Upload** a CI/test log file (`.txt`, `.log`)
2. **Parse** — noise is filtered out; meaningful signals (assertion errors, test names, HTTP failures, tracebacks) are extracted and ANSI codes are stripped
3. **Retrieve** — relevant historical context is pulled from the knowledge base using semantic search (Gemini embeddings + ChromaDB)
4. **Analyze** — Gemini 2.5 Flash produces a structured RCA:
   - Failure summary (total passed/failed)
   - Failure clusters grouped by root cause
   - Classification: Product Bug / Infra Issue / Test Issue
   - Setup/environment issues (non-blocking, clearly separated)
   - Suggested fixes per cluster with historical references
   - Confidence score
5. **Learn** — ingest past RCA reports, Jira tickets, or custom notes into the knowledge base so future analyses reference known patterns

---

## Quick Start

### Option 1: Docker (recommended — one command, zero setup)

```bash
# 1. Configure your API key
cp backend/.env.example backend/.env
# Edit backend/.env and set:
#   GEMINI_API_KEY=your-key-here
# Get a free key at: https://aistudio.google.com/app/apikey

# 2. Start everything
docker-compose up --build

# Subsequent runs (no rebuild needed):
docker-compose up
```

Open **http://localhost:3000**

To stop: `docker-compose down`  
To stop and delete the knowledge base volume: `docker-compose down -v`

### Option 2: Local script (no Docker required)

```bash
# 1. Configure your API key
cp backend/.env.example backend/.env
# Edit backend/.env and set GEMINI_API_KEY=...

# 2. Run (auto-installs Python venv + npm deps)
./start.sh
```

Open **http://localhost:3000**

To stop: `Ctrl+C`

---

## Architecture

```
failiq/
├── backend/                  # FastAPI (Python 3.12)
│   ├── app/
│   │   ├── main.py           # FastAPI app + CORS
│   │   ├── routes/
│   │   │   ├── analyze.py    # POST /analyze
│   │   │   └── ingest.py     # POST /ingest, GET/DELETE /knowledge
│   │   ├── services/
│   │   │   ├── parser.py     # Log noise filter + ANSI stripper
│   │   │   ├── ai_services.py# Gemini 2.5 Flash RCA
│   │   │   ├── embedder.py   # ChromaDB + gemini-embedding-001
│   │   │   └── chunker.py    # PDF/TXT/JSON/MD chunking
│   │   └── prompts/
│   │       └── rca_prompt.txt# Structured RCA prompt with RAG context slot
│   └── Dockerfile
├── frontend/                 # Next.js 16 + Tailwind (TypeScript)
│   ├── app/
│   │   ├── page.tsx          # Two-tab UI: Analyze + Knowledge Base
│   │   ├── layout.tsx        # Root layout (no external font deps)
│   │   └── globals.css       # Dark theme + markdown output styles
│   └── Dockerfile
├── docker-compose.yml        # One-command startup
├── start.sh                  # Local dev startup script
├── requirements.txt          # Pinned Python dependencies
└── README.md
```

**AI Stack:**
| Component | Model | Notes |
|---|---|---|
| LLM | `gemini-2.5-flash` | Free tier, structured RCA output |
| Embeddings | `gemini-embedding-001` | Free tier, 3072-dim vectors |
| Vector store | ChromaDB | Local file-persisted, survives restarts |

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/analyze` | Upload a log file → returns structured RCA JSON |
| `POST` | `/ingest` | Upload a document → chunks, embeds, stores in knowledge base |
| `GET` | `/knowledge` | List all ingested documents |
| `DELETE` | `/knowledge/{doc_id}` | Remove a document from the knowledge base |
| `GET` | `/` | Health check |

---

## Knowledge Base

The knowledge base persists across restarts:

- **Docker:** stored in a named volume (`chroma_data`) — survives `docker-compose down`, deleted only by `docker-compose down -v`
- **Local:** stored at `backend/app/db/chroma/` — excluded from git via `.gitignore`

Supported ingest formats: `.txt`, `.pdf`, `.json` (Jira exports), `.md`, `.log`

---

## Environment Variables

| Variable | File | Description |
|---|---|---|
| `GEMINI_API_KEY` | `backend/.env` | Google Gemini API key — [get one free](https://aistudio.google.com/app/apikey) |
| `NEXT_PUBLIC_BACKEND_URL` | `frontend/.env.local` | Backend URL (default: `http://127.0.0.1:8000` for local, `http://localhost:8000` for Docker) |

---

## Future Scope

### CI/CD Integration
- **GitLab/GitHub webhook** — automatically trigger analysis when a pipeline fails, without manual log upload
- **Direct job URL input** — paste a GitLab job URL and FailIQ fetches and analyzes the log automatically
- **CI badge** — embed a FailIQ analysis link directly in pipeline failure notifications

### Alerting & Notifications
- **Slack alerts** — post RCA summaries to a Slack channel when critical failures are detected (Product Bug, Confidence ≥ 4)
- **PagerDuty / OpsGenie integration** — escalate high-confidence product bugs automatically
- **Email digest** — daily summary of failure trends across all analyzed runs

### Intelligence & Learning
- **Failure trend detection** — track which tests fail repeatedly and surface "flaky test" vs "regression" classification over time
- **Auto-ingest RCA feedback** — after each analysis, automatically save the RCA back to the knowledge base so the system learns from every run
- **Jira ticket auto-creation** — one-click create a Jira issue from the RCA with pre-filled summary, description, labels, and assignee
- **Duplicate detection** — identify if a failure matches an already-open Jira ticket and link them

### Platform & Scale
- **Multi-user / auth** — login support so multiple teams share one instance with isolated knowledge bases
- **RCA history** — browse and search all past analyses with timestamps and job metadata
- **Multi-file upload** — analyze parallel CI job logs together for a combined RCA
- **Streaming responses** — stream Gemini output token-by-token for faster perceived response time
- **Managed vector DB** — swap ChromaDB for Qdrant/Pinecone to support horizontal backend scaling

---

## License

MIT
