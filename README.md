# CodeSage

The architectural code intelligence platform for deep codebase comprehension. CodeSage parses massive multi-file codebases into semantic AST knowledge graphs, combining dense vector search with topological call-graph traversals (Graph-RAG) to eliminate context starvation in LLMs.

[![CodeSage CI](https://github.com/Gaurav711cgu/Codesage/actions/workflows/ci.yml/badge.svg)](https://github.com/Gaurav711cgu/Codesage/actions/workflows/ci.yml)
[![Python 3.11](https://img.shields.io/badge/python-3.11-blue.svg)](https://www.python.org/downloads/release/python-3110/)
[![Next.js 14](https://img.shields.io/badge/next.js-14.2.18-black.svg)](https://nextjs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## Verified Resume Bullets (Traced to Repo Benchmarks)

* **Architected Graph-RAG Code Intelligence Engine:** Integrated Tree-sitter AST parsing and NetworkX call graphs into a hybrid retrieval pipeline, boosting direct callee Recall@8 from **0.0% to 50.8% (+50.8pp, 95% CI: [42.0%, 59.6%])** across 120 ground-truth caller-callee edges (FastAPI, HTTPX, Celery) with only **1ms p50 latency overhead (4ms vs 3ms)**.
* **Engineered Resilient FastAPI Backend with Fault Tolerance:** Implemented SingleFlight concurrent request coalescing, distributed Redis TTL jitter caching ($\pm 10\%$), and a 3-state Circuit Breaker pattern with exponential backoff for LLM provider fallbacks, reducing redundant vector search loads during burst traffic.
* **Built Polyglot Full-Stack Platform & Tool Integration:** Developed Next.js 14 App Router frontend featuring interactive 3D WebGL AST visualizations, Model Context Protocol (MCP) server integration, and automated CI pipelines covering backend pytest suites, ML dataset filters, and TypeScript build verification with 100% pass rate.

---

## Empirical Benchmark Results

Evaluated across **120 ground-truth parsed call edges** in production open-source repositories (`celery`, `fastapi`, `httpx`). Evaluation benchmark source: `benchmarks/results/graph_edge_eval_results.json`.

| Retrieval Architecture | Direct Callee Recall@8 | 95% Confidence Interval | p50 Latency | p95 Latency | Memory Overhead |
|:---|:---:|:---:|:---:|:---:|:---:|
| **Naive Flat Vector RAG** (ChromaDB alone) | **0.0%** | [0.0%, 3.1%] | 3 ms | 5 ms | Base |
| **CodeSage Graph-RAG** (AST + Vector) | **50.8%** | **[42.0%, 59.6%]** | **4 ms** | **6 ms** | < 15 MB / repo |
| **Net Improvement** | **+50.8 percentage points** | *Statistically Significant* | *+1 ms overhead* | *+1 ms overhead* | Negligible |

> **Why Flat Vector RAG Fails (0.0% Recall):** Vector embeddings capture semantic similarities (natural language descriptions and docstrings), not functional execution dependencies. When a query asks about `authenticate_request()`, the callee `decode_jwt_token()` resides in a completely different semantic cluster (cryptography/byte operations). CodeSage's 1-hop and 2-hop topological graph traversal bridges this structural gap deterministically.

---

## Key Features

- **Semantic AST Code Graph:** Uses `tree-sitter` and `NetworkX` to parse code into abstract syntax trees and track caller $\to$ callee relationships.
- **Graph-Augmented RAG:** Combines dense vector search (ChromaDB) for semantic entry seeds with 1-hop and 2-hop directed graph traversal for structural context.
- **SingleFlight Coalescing:** Eliminates duplicate in-flight requests for identical queries, protecting vector DB and LLM quotas.
- **Circuit Breaker Protection:** 3-state finite state machine (`CLOSED`, `OPEN`, `HALF_OPEN`) preventing cascading failures on upstream LLM timeouts.
- **Model Context Protocol (MCP) Server:** Native MCP tools exposing repository indexing and architectural Q&A to Claude Code and Cursor.
- **Zero-Trust Local Inference:** Full fallback support for local Ollama models to prevent proprietary code leakage.

---

## Tech Stack

- **Backend:** FastAPI (Python 3.11+), Pydantic V2, SQLAlchemy, NetworkX, Tree-sitter
- **Frontend:** Next.js 14 (App Router), React 18, React Three Fiber, Framer Motion, TailwindCSS
- **Databases & Vector Storage:** 
  - Relational: SQLite / PostgreSQL via SQLAlchemy
  - Vector: ChromaDB (768d / 384d embeddings)
  - Graph: In-memory NetworkX DiGraph with relational edge persistence
  - Cache: Redis with jittered TTL expiration
- **AI / LLMs:** Google Gemini API (default), Ollama (local offline)

---

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/Gaurav711cgu/Codesage.git
cd Codesage
```

### 2. Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

**Environment Configuration:**
```bash
cp .env.example .env
# Set GEMINI_API_KEY in .env
```

**Run Backend:**
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 3. Frontend Setup

```bash
cd frontend
npm install --legacy-peer-deps
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

---

## Testing & Quality Assurance

All test suites run locally and in GitHub Actions CI with 0 failures:

```bash
# Run backend and training test suites (71 tests)
PYTHONPATH=backend:training:. pytest backend/tests training/tests

# Verify frontend types and production build
cd frontend
npm run type-check
npm run build
```

---

## Technical Documentation & Interview Defense

For staff-level technical interview preparation, architecture tradeoffs, cyclic dependency handling, and scaling analysis, see:
* **[INTERVIEW_DEFENSE.md](./INTERVIEW_DEFENSE.md)** — Comprehensive architecture breakdown, failure modes, scaling story, and 10 deep technical Q&As.

---

## License

MIT License. See [LICENSE](./LICENSE) for details.
