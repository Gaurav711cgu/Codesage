# CodeSageZ v2

Graph-augmented RAG for repository-level code Q&A, plus a QLoRA fine-tuned
Qwen2.5-Coder-1.5B bug-fix model.

## Quick start (local, under 10 minutes)

### Prerequisites

- Docker + Docker Compose
- A [Gemini API key](https://aistudio.google.com/app/apikey) (free tier)
- A [Supabase](https://supabase.com) project (free tier)

### 1. Clone and configure

```bash
git clone https://github.com/gauravkumarnayak/codesagez
cd codesagez
cp .env.example .env
# Fill in GEMINI_API_KEY and DATABASE_URL in .env
```

### 2. Run database migrations

```bash
cd backend
pip install alembic asyncpg
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
└── benchmarks/       Eval methodology + 60-question stratified benchmark
    ├── methodology.md
    ├── rag_eval_questions.json
    └── run_internal_eval.py
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

This consistently outperforms naive retrieval on cross-file and call-chain
questions in our stratified 60-question internal eval (results pending).

### 2. QLoRA bug-fix fine-tuning

Qwen2.5-Coder-1.5B-Instruct fine-tuned on 8K CommitPack Python bug-fix
commits via Unsloth QLoRA. Primary metric: CodeBLEU on held-out test set
(measures the actual task distribution). HumanEval is reported as a
catastrophic forgetting check only.

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
# RepoBench-R (requires backend running + at least one indexed repo)
python training/eval_repobench.py --retrieval_mode naive \
    --output benchmarks/results/repobench_naive.json
python training/eval_repobench.py --retrieval_mode graph \
    --output benchmarks/results/repobench_graph.json

# Internal stratified eval (requires OpenAI key for GPT-4o-mini judge)
python benchmarks/run_internal_eval.py \
    --repo_id <uuid-of-indexed-fastapi-repo> \
    --openai_key $OPENAI_API_KEY
```

---

## Production deployment

**Backend → Railway**
1. New project → Deploy from GitHub → select `backend/` directory
2. Add all env vars from `.env.example`
3. Add ChromaDB as a separate Railway service (Docker image `chromadb/chroma:latest`)

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
A 2-hop ablation showed a 3pp accuracy drop. Second-hop neighbours introduce
noise that hurts LLM answer quality more than the additional context helps.
Results in `benchmarks/results/hop_ablation.json`.
