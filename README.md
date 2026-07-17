# CodeSageZ v2

Graph-augmented retrieval for repository-level code understanding. CodeSageZ
parses a repository into a structural call graph, retrieves relevant symbols,
and expands context through real caller/callee relationships.

## Measured Result

On 120 real parsed caller-to-callee edges from FastAPI, HTTPX, and Celery,
graph-augmented retrieval achieved **53.3% direct-callee Recall@8** versus
**0.0%** for vector-only retrieval (**+53.3 percentage points**, 95% Wilson CI
44.4-62.0%). Graph expansion added 1 ms at p50 latency (3 ms vs 2 ms).

The benchmark derives ground truth from the indexed repositories' parsed graph;
it uses no mock code, synthetic documents, or LLM judge scores. See
[`benchmarks/methodology.md`](benchmarks/methodology.md) and the committed raw
results in `benchmarks/results/graph_edge_eval_results.json`.

## Quick start (local, under 10 minutes)

### Prerequisites

- Docker + Docker Compose
- A [Gemini API key](https://aistudio.google.com/app/apikey) (free tier)
- Optional: a [Supabase](https://supabase.com) project for hosted PostgreSQL

### 1. Clone and configure

```bash
git clone https://github.com/gauravkumarnayak/codesagez
cd codesagez
cp .env.example .env
# Fill in GEMINI_API_KEY. SQLite and the embedded Chroma store are local-only.
```

### 2. Run database migrations

```bash
cd backend
pip install alembic asyncpg aiosqlite
alembic -c migrations/alembic.ini upgrade head
cd ..
```

### 3. Start backend + ChromaDB

```bash
docker compose up --build
```

Backend available at `http://localhost:8000`  
Docs at `http://localhost:8000/docs`

### 4. Start frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend at `http://localhost:3000`

### 5. Verify

```bash
curl http://localhost:8000/health
# {"status":"ok","version":"2.0.0"}
```

---

## Project structure

```
codesagez/
├── backend/          FastAPI backend (Python 3.11)
│   ├── app/
│   │   ├── api/v1/   repo, code, benchmarks endpoints
│   │   ├── core/     config, database
│   │   ├── models/   SQLAlchemy ORM + Pydantic schemas
│   │   └── services/ gemini, ingestion, retrieval, graph, chromadb, ollama
│   ├── migrations/   Alembic
│   └── tests/        pytest suite
├── frontend/         Next.js 14 (TypeScript, Tailwind, shadcn/ui)
│   └── src/
│       ├── app/      playground, repos, benchmarks, architecture pages
│       ├── components/
│       └── lib/      api.ts, sse.ts
├── training/         QLoRA fine-tuning pipeline
│   ├── dataset_prep.py
│   ├── finetune.py
│   ├── eval_codebleu.py
│   ├── eval_humaneval.py
│   ├── eval_repobench.py
│   └── Modelfile
└── benchmarks/       Reproducible real-repository evaluation
    ├── methodology.md
    ├── setup_and_ingest.py
    └── run_graph_edge_eval.py
```

---

## The two technical contributions

### 1. Graph-augmented RAG

At ingestion time, Tree-sitter parses Python files and builds a NetworkX call
graph. At query time, the top-5 vector seeds are expanded by one hop (callers
+ callees) and re-scored with:

```
seed score     = 0.6 × vector_sim + 0.4 × 1.0
neighbour score = 0.6 × 0.0       + 0.4 × 0.5
```

The benchmark pipeline compares this with vector-only retrieval on real parsed
call-graph edges and stores raw per-edge outputs under `benchmarks/results/`.
Only the committed graph-edge result should be quoted in resumes or interviews.

### Experimental: QLoRA bug-fix fine-tuning

Qwen2.5-Coder-1.5B-Instruct fine-tuned on 8K CommitPack Python bug-fix
commits via Unsloth QLoRA. The pipeline is included for experimentation, but no
fine-tuning result is published in this portfolio until a held-out evaluation
has been completed and committed.

---

## Running fine-tuning (Colab A100)

```bash
# 1. Prepare dataset
pip install datasets difflib
python training/dataset_prep.py

# 2. Run baseline evals first (commit results before training)
pip install codebleu human-eval transformers torch
python training/eval_humaneval.py \
    --model "Qwen/Qwen2.5-Coder-1.5B-Instruct" \
    --output training/results/base_humaneval.json
python training/eval_codebleu.py \
    --model "Qwen/Qwen2.5-Coder-1.5B-Instruct" \
    --test_data training/data/test.jsonl \
    --output training/results/base_codeblu.json

# 3. Fine-tune (requires Colab A100)
pip install unsloth trl
python training/finetune.py

# 4. Post-training evals
python training/eval_humaneval.py \
    --model "./checkpoints/best_checkpoint" \
    --output training/results/finetuned_humaneval.json
python training/eval_codebleu.py \
    --model "./checkpoints/best_checkpoint" \
    --test_data training/data/test.jsonl \
    --output training/results/finetuned_codeblu.json

# 5. Export to GGUF and create Ollama model
python training/finetune.py --export
ollama create codesagez-coder -f training/Modelfile
```

---

## Running benchmarks

```bash
# Real structural retrieval benchmark (requires FastAPI, HTTPX, and Celery to
# be indexed locally; see benchmarks/setup_and_ingest.py)
python benchmarks/run_graph_edge_eval.py
```

---

## Production deployment

**Backend → Railway**
1. New project → Deploy from GitHub → select `backend/` directory
2. Set `ENVIRONMENT=production`, a persistent PostgreSQL `DATABASE_URL`, and
   the deployed Vercel URL as `FRONTEND_URL`.
3. Add a persistent ChromaDB service and set `CHROMADB_URL`. Do not use the
   embedded local Chroma store or SQLite in production.
4. Set `REDIS_URL` when running more than one backend replica so rate limits are shared.

**Frontend → Vercel**
1. `vercel deploy` from `frontend/`
2. Set `NEXT_PUBLIC_API_URL` to your Railway backend URL

---

## Running backend tests

```bash
cd backend
pip install -r requirements.txt
pytest
```

---

## Interview answers

**Why is there no fine-tuning result on the project page?**
The fine-tuning pipeline exists, but the evaluation run has not been completed.
Publishing blank or unverified numbers would weaken the project. The shipped
claim is the reproducible Graph RAG measurement instead.

**Why CodeBLEU not HumanEval as primary metric?**  
CommitPack trains the model to fix bugs in existing code. HumanEval tests
completion from scratch. These are different distributions — evaluating a
bug-fix model on HumanEval is a methodology error. CodeBLEU on the held-out
CommitPack test set measures whether the model learned the actual training task.

**How is this different from Microsoft's GraphRAG?**  
GraphRAG constructs a community-level knowledge graph from documents using LLM
extraction. This system uses the structural call graph that already exists in
source code — no LLM extraction needed. The graph is a fact about the code, not
an inference from it.

**Why 1-hop expansion?**  
One hop is the intentionally narrow structural expansion measured by the
direct-callee benchmark. A deeper-hop claim is not made until it has its own
reproducible ablation.
