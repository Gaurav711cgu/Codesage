<div align="center">
  
  <h1>CodeSageZ</h1>
  <p><strong>Graph-Augmented Code Intelligence & Repository-Level RAG Engine</strong></p>

  <p>
    <a href="https://github.com/Gaurav711cgu/Codesage/actions"><img src="https://img.shields.io/github/actions/workflow/status/Gaurav711cgu/Codesage/ci.yml?branch=main&style=for-the-badge&logo=githubactions&logoColor=white&color=0A0A0B" alt="Build Status"></a>
    <a href="https://python.org"><img src="https://img.shields.io/badge/Python-3.11-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python"></a>
    <a href="https://nextjs.org"><img src="https://img.shields.io/badge/Next.js-14-000000?style=for-the-badge&logo=nextdotjs&logoColor=white" alt="Next.js"></a>
    <a href="https://fastapi.tiangolo.com"><img src="https://img.shields.io/badge/FastAPI-0.111-009688?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI"></a>
    <a href="https://docker.com"><img src="https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker"></a>
  </p>

  <p>
    <a href="https://postgresql.org"><img src="https://img.shields.io/badge/PostgreSQL-16-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL"></a>
    <a href="https://trychroma.com"><img src="https://img.shields.io/badge/ChromaDB-Vector_DB-FF4D4D?style=for-the-badge&logo=database&logoColor=white" alt="ChromaDB"></a>
    <a href="https://ai.google.dev"><img src="https://img.shields.io/badge/Google_Gemini-1.5_Flash-4285F4?style=for-the-badge&logo=googlegemini&logoColor=white" alt="Google Gemini"></a>
    <a href="https://pytorch.org"><img src="https://img.shields.io/badge/PyTorch-2.1-EE4C2C?style=for-the-badge&logo=pytorch&logoColor=white" alt="PyTorch"></a>
    <a href="https://huggingface.co"><img src="https://img.shields.io/badge/Hugging_Face-Qwen2.5-FFD21E?style=for-the-badge&logo=huggingface&logoColor=black" alt="Hugging Face"></a>
  </p>
</div>

---

## Overview

**CodeSageZ** is a production-grade code intelligence engine designed for repository-level comprehension, structural call-graph analysis, and precise context augmentation. By pairing deterministic AST call graphs with dense vector retrieval, CodeSageZ eliminates the context blind spots inherent in traditional naive vector-only RAG systems.

Standard vector search retrieves code chunks solely by semantic similarity, frequently omitting structural dependencies such as caller functions, helper utilities, or class definitions located across different files. CodeSageZ constructs an in-memory structural dependency graph using Tree-sitter AST parsing, retrieves semantic seed vectors, and performs graph topology traversal to inject verified direct callers and callees into the model's prompt context.

---

## Empirical Benchmark Results

Evaluation performed across **120 real caller-to-callee edges** extracted directly from parsed production repositories (FastAPI, HTTPX, and Celery). Ground truth is derived exclusively from static AST analysis rather than synthetic LLM generation.

| Metric | Vector-Only RAG | Graph-Augmented RAG (CodeSageZ) | Delta | Confidence Interval |
| :--- | :---: | :---: | :---: | :---: |
| **Direct-Callee Recall@8** | `0.0%` | **`53.3%`** | **`+53.3 pp`** | 95% Wilson CI (44.4% – 62.0%) |
| **p50 Search Latency** | `2.0 ms` | **`3.0 ms`** | `+1.0 ms` | Negligible overhead |
| **p95 Search Latency** | `4.2 ms` | **`5.8 ms`** | `+1.6 ms` | Sub-10ms bound |

> **Note on Methodology:** Ground truth is strictly established from AST-verified structural caller/callee relationships within indexed codebases. No mock data, synthetic text, or LLM-as-a-judge metrics are used. Raw results are committed under `benchmarks/results/graph_edge_eval_results.json`.

---

## Architecture & Data Flow

CodeSageZ is built with a decoupled monorepo architecture, enforcing clean separation between structural parsing, vector storage, graph indexing, relational state management, and the user interface.

```mermaid
graph TD
    User([Client / User]) -->|HTTP / SSE| Frontend[Next.js 14 Web App]
    Frontend -->|REST API| Backend[FastAPI Core Engine]
    
    subgraph Ingestion & Analysis Pipeline
        Backend -->|AST Parsing| TreeSitter[Tree-sitter Parser]
        TreeSitter -->|Dependency Graph| CallGraph[NetworkX Structural Graph]
        Backend -->|Chunk & Embed| Embedder[Google Gemini / Voyage AI]
    end
    
    subgraph Data Layer
        Embedder -->|Dense Vectors| ChromaDB[(ChromaDB Vector Store)]
        CallGraph -->|Graph Nodes & Edges| Postgres[(PostgreSQL Relational DB)]
    end
    
    subgraph Context Augmentation & Generation
        Backend -->|Hybrid Graph RAG| RAGEngine[Graph RAG Scorer]
        ChromaDB -->|Top-K Seeds| RAGEngine
        Postgres -->|1-Hop Neighborhood| RAGEngine
        RAGEngine -->|Augmented Prompt| GeminiAPI[Google Gemini 1.5 Flash]
    end
```

---

## Directory Structure

```text
Codesage/
├── backend/                  FastAPI core backend (Python 3.11)
│   ├── app/
│   │   ├── api/v1/          REST router modules (repos, code, benchmarks)
│   │   ├── core/            Application config, database session, rate limiting
│   │   ├── models/          SQLAlchemy ORM models & Pydantic validation schemas
│   │   └── services/        Ingestion, AST Graph, ChromaDB, and Gemini integrations
│   ├── migrations/          Alembic database revision scripts
│   ├── tests/               Pytest test suite with mock coverage
│   └── Dockerfile           Multi-stage production container
├── frontend/                 Next.js 14 web client (TypeScript, Tailwind CSS, shadcn/ui)
│   ├── src/
│   │   ├── app/             App router pages (repos, playground, architecture)
│   │   ├── components/      UI components and navigation
│   │   └── lib/             API clients and Server-Sent Events (SSE) stream logic
│   └── Dockerfile           Standalone Node.js container
├── training/                 QLoRA fine-tuning pipeline
│   ├── dataset_prep.py      CommitPack Python dataset filter and formatter
│   ├── finetune.py          Unsloth QLoRA 4-bit fine-tuning script
│   ├── eval_codebleu.py     CodeBLEU metric evaluation engine
│   └── eval_humaneval.py    HumanEval Pass@1 evaluation suite
├── benchmarks/               Reproducible real-repository evaluation scripts
│   ├── setup_and_ingest.py  Repository indexer for evaluation datasets
│   └── run_graph_edge_eval.py Benchmark execution loop and metric calculator
├── docker-compose.yml        Multi-container orchestration setup
└── README.md
```

---

## Technical Deep Dive

### 1. AST Call Graph Construction
During repository ingestion, CodeSageZ uses **Tree-sitter** to build a comprehensive Abstract Syntax Tree of every source file. Functions, method definitions, imports, and function calls are extracted into a directed graph $G = (V, E)$, where each vertex $v \in V$ represents a code symbol (function/class) and each directed edge $(u, v) \in E$ denotes that function $u$ calls function $v$.

### 2. Hybrid Scoring Algorithm
At query time, vector retrieval yields a candidate set of seed nodes $S \subset V$ using cosine similarity. The candidate set is expanded by taking the 1-hop topological neighborhood $N(S) = \{ v \in V \mid \exists u \in S \text{ s.t. } (u,v) \in E \lor (v,u) \in E \}$.

Each node $i \in S \cup N(S)$ is assigned a composite score defined by:

$$\text{Score}(i) = \alpha \cdot \text{Sim}_{\text{vec}}(q, i) + \beta \cdot \text{Proximity}(i, S)$$

Where:
- $\alpha = 0.6$ (Vector weight)
- $\beta = 0.4$ (Graph proximity weight)
- $\text{Proximity}(i, S) = 1.0$ if $i \in S$, else $0.5$ if $i \in N(S)$

This scoring mechanism guarantees that structurally connected helper functions are prioritized for LLM context inclusion even when their raw keyword or embedding similarity to the query is low.

---

## Quick Start (Local Deployment)

### Prerequisites
- **Docker** and **Docker Compose**
- A **[Google AI Studio API Key](https://aistudio.google.com/app/apikey)**

### 1. Clone & Configure
```bash
git clone https://github.com/Gaurav711cgu/Codesage.git
cd Codesage
cp .env.example .env
```
Edit `.env` and insert your API key:
```env
GEMINI_API_KEY=your_actual_gemini_api_key_here
```

### 2. Launch Services via Docker Compose
```bash
docker compose up --build
```

### 3. Access Service Endpoints
- **Web Application Client:** `http://localhost:3000`
- **FastAPI Core Service:** `http://localhost:8000`
- **Interactive OpenAPI Documentation:** `http://localhost:8000/docs`

---

## API Reference Summary

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/health` | Service health status check |
| `POST` | `/api/v1/repos/ingest` | Trigger repository cloning, AST graph parsing, and embedding vectorization |
| `GET` | `/api/v1/repos` | List all ingested codebases and metadata |
| `POST` | `/api/v1/query` | Execute hybrid Graph-Augmented RAG search and context generation |
| `GET` | `/api/v1/benchmarks/results` | Retrieve committed benchmark execution metrics |

---

## Continuous Integration & Quality Assurance

CodeSageZ maintains strict test coverage and linting via automated GitHub Actions workflows.

```bash
# Execute Pytest suite locally
cd backend
pip install -r requirements.txt
pytest tests/ -v
```

```bash
# Execute Frontend build check
cd frontend
npm install
npm run build
```

---

## License

This project is open-source under the [MIT License](LICENSE).
