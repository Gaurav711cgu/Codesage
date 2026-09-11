# CodeSageZ — CLAUDE.md

## Commands
- **Test:** `backend/venv/bin/python -m pytest backend/tests/ -q`
- **Lint:** `backend/venv/bin/python -m ruff check backend/app/`
- **Run backend:** `uvicorn app.main:app --reload --app-dir backend`
- **Docker:** `docker-compose up`

## Architecture
- **Stack:** FastAPI → ChromaDB → NetworkX call graph → Gemini 2.0 Flash
- **Hot path:** `async_retrieve()` [SingleFlight] → `_raw_retrieve()` [Cache] → `retrieve_graph_augmented()` [chroma_breaker]
- **Embeddings:** Tier 1 = Gemini `gemini-embedding-001` (3072-dim) | Tier 2 = Lexical hash fallback (384-dim)
- **Key metric:** 53.3% Recall@8 graph vs 0% naive on direct callee edges (FastAPI, HTTPX, Celery)

## Interview Numbers
- Recall@8 (graph): 53.3% vs 0% naive
- QLoRA CodeBLEU: 70.02 (+9.38 over base)
- Test count: 64 passing
