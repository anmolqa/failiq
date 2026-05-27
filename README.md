# FailIQ

> AI-powered test failure investigation platform.

FailIQ takes raw CI/test log files, extracts meaningful failure signals, redacts secrets/PII, and uses a large language model to produce a structured Root Cause Analysis — complete with failure clusters, bug classification, suggested fixes, and historical pattern matching via a persistent RAG knowledge base.

---

## Demo

> **Sample log:** [`sample_logs/ecommerce_checkout_failure.log`](sample_logs/ecommerce_checkout_failure.log)
> **Sample RCA output:** [`sample_output/example_rca.md`](sample_output/example_rca.md) · [`example_rca.json`](sample_output/example_rca.json)

### Analyze Tab
![FailIQ Analyze Tab](docs/screenshot_analyze.png)

### Knowledge Base Tab
![FailIQ Knowledge Base](docs/screenshot_knowledge.png)

---

## What It Does

When a CI job fails, engineers spend 15–45 minutes manually reading through thousands of log lines. FailIQ automates this in ~30 seconds:

1. **Upload** a CI/test log file (`.txt`, `.log`)
2. **Parse** — 5,000+ lines reduced to ~50 high-signal lines using rule-based heuristics (see [Parser Design](#parser-design))
3. **Redact** — secrets, API keys, emails, and IPs are stripped before any data leaves your machine
4. **Retrieve** — top-5 most relevant chunks pulled from the knowledge base using semantic search
5. **Analyze** — Gemini 2.5 Flash produces a structured RCA with failure clusters, bug classification, and suggested fixes
6. **Learn** — ingest past RCA reports, Jira tickets, or custom notes so future analyses reference known patterns

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
cp backend/.env.example backend/.env
# Edit backend/.env and set GEMINI_API_KEY=...

./start.sh
```

Open **http://localhost:3000** · Stop with `Ctrl+C`

---

## Parser Design

The parser is the most critical component — LLM quality is bounded by input quality.

**Heuristics applied (in order):**

| Tier | Pattern | Example |
|---|---|---|
| 1 | Pytest summary markers | `=== 10 failed, 155 passed ===` |
| 2 | Test failure headers | `_____ test_function_name _____` |
| 3 | Assertion errors | `E AssertionError: assert 0 == 2` |
| 4 | Python tracebacks | `Traceback (most recent call last)` |
| 5 | Infrastructure errors | `ERROR`, `500 Internal Server Error`, `Timeout` |

**Result on real logs:** 5,135 raw lines → 47 extracted lines (**99.1% noise reduction**)

**Secret redaction (applied after extraction, before LLM):**
- API keys, tokens, passwords (`key=`, `token=`, `secret=`)
- AWS access keys (`AKIA...`)
- GitHub/GitLab tokens (`ghp_`, `glpat-`)
- Email addresses
- IPv4 addresses
- Private key blocks (`-----BEGIN PRIVATE KEY-----`)

---

## Evaluation

### Benchmark: GitLab Job 64091591 (`alert_rule_v2`)

| Metric | Value |
|---|---|
| Total tests | 165 |
| Failures identified | 10 / 10 (**100% recall**) |
| Failure clusters formed | 5 (correct) |
| Bug classification accuracy | 4/5 clusters correct (**80%**) |
| Non-blocking noise correctly separated | ✅ Yes |
| Overall RCA accuracy | **~90%** |
| Time to analysis | ~30 seconds |
| Estimated manual time | 30–45 minutes |
| **Time saved** | **~97%** |

### Parser performance

| Metric | Value |
|---|---|
| Raw log lines | 5,135 |
| Lines after parsing | 47 |
| Noise reduction | 99.1% |
| Secrets redacted | 2 (email + password in az login command) |

*Accuracy improves as the knowledge base grows with past RCAs and Jira tickets.*

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
│   │   │   ├── parser.py     # Log noise filter + ANSI stripper + secret redaction
│   │   │   ├── ai_services.py# Gemini 2.5 Flash RCA
│   │   │   ├── embedder.py   # ChromaDB + gemini-embedding-001
│   │   │   └── chunker.py    # PDF/TXT/JSON/MD chunking
│   │   └── prompts/
│   │       └── rca_prompt.txt# Structured RCA prompt with RAG context slot
│   └── Dockerfile
├── frontend/                 # Next.js 16 + Tailwind (TypeScript)
│   ├── app/
│   │   ├── page.tsx          # Two-tab UI: Analyze + Knowledge Base
│   │   ├── layout.tsx        # Root layout
│   │   └── globals.css       # Dark theme + markdown output styles
│   └── Dockerfile
├── sample_logs/              # Example CI log for testing
├── sample_output/            # Example RCA output (markdown + JSON)
├── docker-compose.yml        # One-command startup
├── start.sh                  # Local dev startup script
└── requirements.txt          # Pinned Python dependencies
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
| `POST` | `/analyze` | Upload a log file → returns structured RCA + metadata |
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

## Security

- **Secrets never leave your machine unredacted** — the parser strips API keys, tokens, emails, and IPs before sending any data to Gemini
- **API key is server-side only** — `GEMINI_API_KEY` lives in `backend/.env`, never exposed to the browser
- **Local by default** — runs on `localhost`, not accessible from the internet unless explicitly deployed
- **`.gitignore` enforced** — `.env` files, `node_modules/`, `.venv/`, and the ChromaDB store are all excluded from git

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

### Evaluation & Metrics
- **RCA accuracy tracking** — thumbs up/down feedback per analysis, stored and aggregated
- **Parser benchmarking** — measure noise reduction ratio and signal recall across log types
- **A/B prompt testing** — compare RCA quality across prompt versions on the same log set

### Platform & Scale
- **Multi-user / auth** — login support so multiple teams share one instance with isolated knowledge bases
- **RCA history** — browse and search all past analyses with timestamps and job metadata
- **Multi-file upload** — analyze parallel CI job logs together for a combined RCA
- **Streaming responses** — stream Gemini output token-by-token for faster perceived response time
- **Managed vector DB** — swap ChromaDB for Qdrant/Pinecone to support horizontal backend scaling

---

## License

MIT
