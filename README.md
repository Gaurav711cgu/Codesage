# CodeSageZ

The ultimate AI developer platform for architectural intelligence. CodeSageZ parses massive codebases into semantic AST knowledge graphs, enabling deep structural question-answering with Zero-Trust local execution and sub-50ms distributed caching.

## Key Features

- **Semantic Code Graph**: Uses `tree-sitter` and `NetworkX` to parse code into abstract syntax trees and track class/function relationships.
- **Zero-Trust Architecture**: Supports completely local LLM inference via Ollama to prevent IP leakage.
- **Hybrid RAG**: Combines dense vector search (ChromaDB) for semantic matches with graph traversal (NetworkX) for structural logic.
- **Sub-50ms Caching**: Redis-backed distributed cache for AST parses, embeddings, and query results.
- **Production-Ready**: Idempotent APIs, circuit breakers, and comprehensive rate limiting built-in.

---

## Tech Stack

- **Backend**: FastAPI (Python 3.11+), Pydantic V2
- **Frontend**: Next.js 14, React Three Fiber, GSAP, TailwindCSS v3
- **Databases**: 
  - Relational: SQLite (or PostgreSQL via SQLAlchemy)
  - Vector: ChromaDB
  - Graph: NetworkX (in-memory) / Redis (caching)
- **AI / LLMs**: Google Gemini API (default), Ollama (local)
- **AST Parsing**: Tree-sitter

---

## Prerequisites

- Python 3.11+
- Node.js 20+
- Docker (for ChromaDB / Redis / local deployments)
- `make` (optional, for convenience)

---

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/Codesage.git
cd Codesage
```

### 2. Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

**Environment Variables:**
Copy the example environment file:
```bash
cp .env.example .env
```
Ensure you add your `GEMINI_API_KEY` to the `.env` file.

**Start the Backend Services:**
We provide a `docker-compose.yml` to easily spin up ChromaDB and the backend.
```bash
docker-compose up -d
```
Alternatively, for pure local development (if ChromaDB is running separately):
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to view the 3D dashboard.

---

## Architecture

### Directory Structure

```
├── backend/
│   ├── app/
│   │   ├── api/          # FastAPI Routers
│   │   ├── core/         # Config, Database, Auth, Rate Limiter
│   │   ├── models/       # SQLAlchemy models and Pydantic schemas
│   │   └── services/     # Core Business Logic (Ingestion, Retrieval, LLM, Graph)
│   ├── tests/            # Pytest suite
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── app/          # Next.js App Router pages
│   │   ├── components/   # React components (ThreeBackground, BentoFeatures)
│   │   └── lib/          # Utilities
│   └── package.json
└── docker-compose.yml
```

### Data Flow (Ingestion to Query)

1. **Ingestion**: A repository is provided to `POST /api/v1/repos`. The `IngestionService` clones it to `/tmp`.
2. **Parsing**: `Tree-sitter` extracts classes, methods, and docstrings.
3. **Graph Construction**: Nodes and edges are inserted into `NetworkX`.
4. **Embedding**: Snippets are chunked, embedded via Gemini (or local models), and stored in `ChromaDB`.
5. **Retrieval**: When a query hits `POST /api/v1/code/query`, the `RetrievalService` queries ChromaDB for semantic matches.
6. **Graph Traversal**: The system uses NetworkX to fetch structural dependencies (caller/callee) of the semantic matches.
7. **Synthesis**: The expanded context is fed to the LLM for a highly accurate architectural answer.

---

## Testing

```bash
cd backend
source venv/bin/activate
pytest tests/ -v
```

---

## Deployment

### Docker (Recommended)

The easiest way to deploy is using the provided Docker configuration.

```bash
docker-compose build
docker-compose up -d
```

### Vercel (Frontend)

The Next.js frontend is optimized for Vercel deployment:
1. Connect your repository to Vercel.
2. Set the `NEXT_PUBLIC_API_URL` environment variable to your production backend URL.
3. Deploy!

