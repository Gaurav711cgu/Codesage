# CodeSageZ — PRD v2.0
### Full Assessment + Bug Fixes + Upgrades + Frontend Design System
### Team: DEBUG THUGS | July 2026

---

## 0. Brutal Assessment First

Before the PRD: what's actually broken and what's actually good.

### What's real and working
- Architecture is genuinely solid for a student project. FastAPI + AsyncPG + ChromaDB + tree-sitter pipeline is not vibecoded. The 7-stage ingestion pipeline with SSE progress streaming is production-pattern.
- Graph-augmented retrieval (seed + 1-hop expansion + score fusion) is the actual differentiator. This is real ML systems thinking.
- `embed_texts()` has proper batching (100/batch) + exponential backoff. That's not default behavior.
- Graceful JSON extraction fallback in `_extract_json()` is correct defensive coding.
- The test files exist and have real content. Most student projects have zero tests.

### What's broken
1. **500 crash on `/api/v1/repo/query` — ROOT CAUSE IDENTIFIED**: `query_collection()` is called with `query_text=query_text` (plain string), but ChromaDB's `HttpClient` in remote mode **cannot embed text server-side** — it has no embedding function configured. It needs `query_embeddings` (a pre-computed vector). The retrieval service calls `embed_query()` but **only in `retrieve_graph_augmented`** — `retrieve_naive` passes `query_text` raw to ChromaDB. Fix: always embed first, always pass `query_embeddings`.

2. **Eval results are all 0.0**: Every single score is zero. `naive_answer: ""` — the backend was returning empty strings during the eval run, confirming the 500 crash was happening during eval too. This means all benchmark numbers in the README/PRD are fabricated at this point.

3. **`gemini-embedding-2` model name**: The correct API identifier is `models/text-embedding-004` (stable) or `models/gemini-embedding-exp-03-07` (experimental). `models/gemini-embedding-2` does not exist in the public API — this is likely what's causing the embedding failures that cascade into 500s.

4. **`google.generativeai` SDK is deprecated**: As you noted, migration to `google.genai` is needed. The current `genai.embed_content()` call signature also differs between old and new SDK.

5. **Frontend is functional but visually generic**: Dark background, Inter font, card grid, zero personality. Standard shadcn-style template. The Architecture and Benchmarks pages are particularly thin — just rendering JSON/text with no visual hierarchy.

6. **`backend_crash.log` is empty**: You have a crash log file that captured nothing. Logging setup is not properly routing to file.

7. **`OLLAMA_ENABLED=false` hardcoded in docker-compose**: The Ollama / local model path is partially wired but non-functional. `debug_code` still hardcodes `model_used = "gemini-2.0-flash"` instead of reading `body.use_local_model`.

### What needs APIs from you (list at end of PRD)

---

## 1. Bug Fixes (Ship-Blocking — Do These First)

### Fix 1 — Embedding model name (CRITICAL)

**File**: `backend/app/services/gemini.py`

**Problem**: `models/gemini-embedding-2` returns 404. The correct model is `models/text-embedding-004` (768-dim, stable, free tier).

```python
# BEFORE (broken)
result = genai.embed_content(
    model="models/gemini-embedding-2",
    ...
    output_dimensionality=768,
)

# AFTER (fixed)
result = genai.embed_content(
    model="models/text-embedding-004",
    ...
)
# text-embedding-004 outputs 768 dims by default, no need for output_dimensionality param
# Remove output_dimensionality — it's not a valid param for text-embedding-004
```

Same fix applies to `embed_query()`. Remove `output_dimensionality=768` from both calls.

---

### Fix 2 — ChromaDB query must use pre-embedded vectors (CRITICAL — the 500 crash)

**File**: `backend/app/services/retrieval.py`

**Problem**: `retrieve_naive()` passes `query_text=query_text` to `query_collection()`. ChromaDB's remote `HttpClient` has no embedding function — it can't embed server-side. Needs a pre-computed vector.

```python
# BEFORE (crashes with 500)
def retrieve_naive(repo_id, query_text, n_results=TOP_SEEDS):
    result = chromadb_client.query_collection(
        repo_id, "_functions", query_text=query_text, n_results=n_results
    )

# AFTER (fixed)
def retrieve_naive(repo_id, query_text, n_results=TOP_SEEDS):
    t0 = time.perf_counter()
    query_vec = embed_query(query_text)          # embed first
    result = chromadb_client.query_collection(
        repo_id, "_functions", query_embedding=query_vec, n_results=n_results
    )
    ...
```

Also fix `query_collection()` in `chromadb_client.py` — the parameter is `query_embedding` (singular), not `query_embeddings` (plural) for the public API:

```python
# chromadb_client.py
def query_collection(..., query_embedding=None, query_text=None, ...):
    if query_embedding is not None:
        kwargs["query_embeddings"] = [query_embedding]   # ChromaDB API wraps in list
    elif query_text is not None:
        kwargs["query_texts"] = [query_text]
```

And `retrieve_graph_augmented` already calls `embed_query` — but it passes `query_text=query_text` to `query_collection` too (same bug). Fix both:

```python
# retrieve_graph_augmented — line ~87
seed_result = chromadb_client.query_collection(
    repo_id, "_functions", query_embedding=embed_query(query_text), n_results=TOP_SEEDS
)
```

---

### Fix 3 — SDK migration to google-genai (HIGH)

**File**: `backend/app/services/gemini.py`, `backend/requirements.txt`

The `google-generativeai` package is deprecated. Migration to `google-genai`:

```
# requirements.txt — REPLACE
# google-generativeai==0.8.3   ← remove
google-genai==1.16.0            ← add
```

```python
# gemini.py — new import pattern
from google import genai
from google.genai import types

client = genai.Client(api_key=settings.gemini_api_key)

# Text generation
def stream_llm(prompt: str) -> Generator[str, None, None]:
    response = client.models.generate_content_stream(
        model="gemini-2.5-flash",
        contents=prompt,
        config=types.GenerateContentConfig(
            temperature=0.2,
            top_p=0.95,
            max_output_tokens=2048,
            system_instruction=(
                "You are a precise software engineering assistant specialising in "
                "code analysis and debugging. Reference specific function names, "
                "file paths, and line numbers when available. Be concise and accurate."
            ),
        ),
    )
    for chunk in response:
        if chunk.text:
            yield chunk.text

def call_llm(prompt: str) -> str:
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
    )
    return response.text

# Embeddings
def embed_texts(texts: list[str], task_type: str = "retrieval_document", max_retries: int = 5) -> list[list[float]]:
    all_embeddings = []
    for batch_start in range(0, len(texts), 100):
        batch = texts[batch_start:batch_start + 100]
        for attempt in range(max_retries):
            try:
                result = client.models.embed_content(
                    model="models/text-embedding-004",
                    contents=batch,
                    config=types.EmbedContentConfig(task_type=task_type),
                )
                embeddings = [e.values for e in result.embeddings]
                all_embeddings.extend(embeddings)
                break
            except Exception as exc:
                if attempt == max_retries - 1:
                    raise
                wait = min(65, 4 ** attempt + 5)
                logger.warning("Embedding retry %d/%d in %ds: %s", attempt+1, max_retries, wait, exc)
                time.sleep(wait)
    return all_embeddings

def embed_query(query: str) -> list[float]:
    result = client.models.embed_content(
        model="models/text-embedding-004",
        contents=query,
        config=types.EmbedContentConfig(task_type="retrieval_query"),
    )
    return result.embeddings[0].values
```

---

### Fix 4 — Logging not routing to file

**File**: `backend/app/main.py`

```python
# Add to lifespan or top of main.py
import logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(name)s %(levelname)s %(message)s",
    handlers=[
        logging.StreamHandler(),                           # stdout (Docker picks this up)
        logging.FileHandler("/tmp/codesagez/backend.log"), # file (persists in volume)
    ]
)
```

---

### Fix 5 — `debug_code` hardcoded model name

**File**: `backend/app/api/v1/code.py`

```python
# BEFORE
model_used = "gemini-2.0-flash"

# AFTER
model_used = settings.ollama_model if body.use_local_model else "gemini-2.5-flash"
```

---

## 2. Upgrade Roadmap

### Upgrade A — Multi-language ingestion (Python only → Python + JS/TS)

Current: tree-sitter only parses Python. This kills the project for JS/TS repos.

Add to `ingestion.py`:
```python
# New language registry
import tree_sitter_javascript as tsjs
import tree_sitter_typescript as tsts

LANGUAGE_PARSERS = {
    ".py":  Language(tspython.language()),
    ".js":  Language(tsjs.language()),
    ".ts":  Language(tsts.language_typescript()),
    ".tsx": Language(tsts.language_tsx()),
}

FILE_EXTENSIONS = set(LANGUAGE_PARSERS.keys())
```

Add to `requirements.txt`:
```
tree-sitter-javascript==0.23.1
tree-sitter-typescript==0.23.2
```

---

### Upgrade B — Streaming LLM in Playground (code/review, code/debug)

Currently `/api/v1/code/review` and `/api/v1/code/debug` block until Gemini returns the full response. For large code files this is 5–10 seconds of dead silence.

Convert both to SSE streaming. Pattern already exists in `/api/v1/repo/query`. Reuse it.

New endpoint signature:
```
POST /api/v1/code/review/stream   → SSE: token events + done event with structured result
POST /api/v1/code/debug/stream    → SSE: token events + done event with structured result
```

Keep existing non-streaming endpoints for the benchmark runner.

---

### Upgrade C — Re-run eval and get real numbers

The `rag_eval_results.json` has all zeros. After fixing bugs 1–3, re-run:

```bash
python benchmarks/setup_and_ingest.py
python benchmarks/run_internal_eval.py
```

Record the actual scores. Whatever they are — put those in the README. A real 40% pass rate is infinitely more credible than 0% (broken) or suspiciously high numbers. The graph vs naive delta is the actual research claim — that's what matters.

---

### Upgrade D — Health endpoint with component status

`GET /health` currently just returns `{"status": "ok"}`. Extend it:

```python
@app.get("/health")
async def health():
    checks = {}
    
    # ChromaDB ping
    try:
        chromadb_client.get_client().heartbeat()
        checks["chromadb"] = "ok"
    except Exception as e:
        checks["chromadb"] = f"error: {e}"
    
    # Gemini API key presence
    checks["gemini_api_key"] = "set" if settings.gemini_api_key else "missing"
    
    # DB ping
    try:
        async with AsyncSessionLocal() as db:
            await db.execute(text("SELECT 1"))
        checks["database"] = "ok"
    except Exception as e:
        checks["database"] = f"error: {e}"
    
    status = "ok" if all(v == "ok" or v == "set" for v in checks.values()) else "degraded"
    return {"status": status, "checks": checks}
```

---

### Upgrade E — Repo size guard before cloning

Currently a 500MB repo will OOM the container before the size check in ingestion.

Add a GitHub API check before `GitRepo.clone_from()`:

```python
async def _check_repo_size(github_url: str) -> None:
    """Raise if repo > MAX_REPO_SIZE_KB using GitHub API (no auth needed for public repos)."""
    # Extract owner/repo from URL
    parts = github_url.rstrip("/").split("/")
    owner, repo = parts[-2], parts[-1]
    
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"https://api.github.com/repos/{owner}/{repo}",
            headers={"Accept": "application/vnd.github.v3+json"},
            timeout=10,
        )
        if resp.status_code == 200:
            size_kb = resp.json().get("size", 0)
            if size_kb > settings.max_repo_size_kb:
                raise ValueError(f"Repo is {size_kb}KB, limit is {settings.max_repo_size_kb}KB")
        elif resp.status_code == 404:
            raise ValueError("Repository not found or is private")
```

This needs `GITHUB_TOKEN` in `.env` for private repos or rate limit headroom. Add to config as optional.

---

## 3. Engineering Review (gstack-eng-review)

### Architecture: CONCERNS

```
Request → FastAPI → retrieval_svc.retrieve() → [embed_query → chromadb → graph_svc]
                                             ↓
                                        stream_llm()
                                             ↓
                                     SSE → Frontend
```

Issues:
- `embed_query()` is called synchronously inside `asyncio.to_thread()` wrapping `retrieval_svc.retrieve()`. This is correct — blocking I/O in thread pool. But `stream_llm()` is also synchronous (generator) and is called directly in the async `_stream()` coroutine without `to_thread()`. This blocks the event loop during Gemini streaming. Fix: wrap `stream_llm` in `asyncio.to_thread` or use the async streaming API.
- ChromaDB `_client` is a global singleton. If ChromaDB restarts, the singleton holds a dead connection. Add a `get_client()` retry-on-failure wrapper.
- No request ID propagation. Impossible to correlate a frontend SSE session with a backend log line.

### Data Model: SOLID

State machine for `Repo.status` is clean. `Task` progress model is correct.

One gap: no `updated_at` on `Repo` — can't tell when a repo's status last changed without reading task table.

### API Design: CONCERNS

- `POST /api/v1/repo/query` is SSE but returns `StreamingResponse`. FastAPI's `@limiter.limit("30/minute")` + `StreamingResponse` interaction is buggy in some versions of slowapi — rate limit applies to the *open* SSE connection, not per-query. Test this.
- No pagination on `GET /api/v1/repos` — if user indexes 100 repos, this returns all 100. Add `?limit=20&offset=0`.
- `DELETE /api/v1/repo/{repo_id}` is a hard delete with no soft-delete or confirmation mechanism. One typo deletes everything.

### Error Handling: NEEDS REWORK

- `_stream()` in `query_repo` has no try/except. If `retrieval_svc.retrieve()` raises (e.g., ChromaDB down), the SSE stream silently closes. The frontend gets an `onclose` event with no error payload.
  
  Fix:
  ```python
  async def _stream():
      try:
          chunks, latency = await asyncio.to_thread(...)
          yield _sse_event("retrieval_done", {...})
          ...
      except Exception as exc:
          logger.error("Query stream failed: %s", exc, exc_info=True)
          yield _sse_event("error", {"code": "RETRIEVAL_FAILED", "message": str(exc)})
  ```

- `graph_svc.expand_one_hop()` catches exceptions and falls back to naive — good. But the fallback calls `retrieve_naive()` which has the same `query_text` bug. After Fix 2, verify the fallback path works.

### Security: CONCERNS

- No auth on any endpoint. Any client can ingest any GitHub repo, query any indexed repo, delete any repo. For a portfolio project this is fine — but add a note in README: "No auth — do not deploy publicly with sensitive repos."
- `github_url` validation regex: `/^https:\/\/github\.com\/[\w.\-]+\/[\w.\-]+\/?$/`. This allows `.` and `-` in repo names which is correct. But it doesn't prevent someone passing a GitHub URL with subpath like `github.com/owner/repo/tree/main` — add `rstrip("/")` + split validation.
- `CORS allow_origins=["*"]` in production: CORS is set from `settings.frontend_url` in `main.py`, so this is fine as long as `FRONTEND_URL` is set correctly in prod.

### Performance: SOLID

The expensive operation (`time_of_closest_approach` equivalent here is graph expansion) is O(degree × n_results). With `TOP_SEEDS=5` and typical call graphs having 10–20 edges per node, this is ~100–200 ChromaDB `get()` calls per query. Each is a network round-trip to ChromaDB. Batch them:

```python
# Instead of: get_documents_by_ids() called once per node in expand_one_hop
# Collect ALL neighbour IDs first, then ONE batch get()
neighbour_ids = list(graph_svc.expand_one_hop(G, seed_ids))
if neighbour_ids:
    get_result = chromadb_client.get_documents_by_ids(repo_id, "_functions", neighbour_ids)
```

Looking at the code — this is already batched correctly. Good.

### Observability: NEEDS REWORK

- `backend_crash.log` is empty because logging is not configured to write to file. Fix 4 addresses this.
- No structured logging. All log lines are `f-strings` — impossible to query in any log aggregator. Change to `logger.info("query_started", extra={"repo_id": str(repo_id), "query": query[:50]})`.
- No latency metrics exported anywhere. The `latency_ms` field in SSE response is good for frontend display but doesn't help you find slow queries.

### Test Coverage: CONCERNS

Tests exist (`test_api.py`, `test_ingestion.py`, `test_retrieval.py`) — good. But:
- `test_retrieval.py` mocks ChromaDB. After bug Fix 2, update mocks to expect `query_embeddings` not `query_texts`.
- No test for the SSE streaming paths (ingest progress, query stream). These are the most complex code paths and have zero test coverage.
- No test for `_extract_json()` with malformed Gemini responses — this is a critical path that's been handled gracefully but never tested.

### Deployment: SOLID

Docker setup is clean. Volume for ChromaDB persistence is correct. One issue: `chromadb_url=http://chromadb:8000` (internal Docker network) but the external mapping is `8001:8000`. So `CHROMADB_URL` in `.env` should be `http://localhost:8001` for local dev outside Docker. The `docker-compose.yml` sets it correctly for container-to-container. Document this clearly.

---

**Engineering Verdict: YELLOW**

Ship blockers:
1. Fix embedding model name (`text-embedding-004`)
2. Fix ChromaDB query to use `query_embeddings` not `query_texts`
3. Migrate to `google-genai` SDK

Should fix before showing to anyone:
4. Wrap `_stream()` in try/except with error SSE event
5. Wrap `stream_llm()` in `asyncio.to_thread()`
6. Re-run eval to get real numbers

---

## 4. Frontend Design System

### Current State Assessment

**What exists**: Dark bg (`hsl(224 71% 4%)`), Inter font, card grid on homepage, minimal nav. The pages work but have zero personality. The Benchmarks page is a table. Architecture page is prose. Repos page is functional but looks like a CRUD demo. Playground has Monaco editor which is the only distinctive element.

**What "not vibecoded" means here**: Not removing the dark theme — that's appropriate for a dev tool. Fixing the typography, spacing, hierarchy, and adding one signature element that makes it look like someone designed it instead of prompted it.

---

### Design Direction

```
Design direction: Terminal Intelligence — developer tooling that takes itself seriously
Rationale: CodeSageZ is a code analysis platform. Its users are engineers. 
           The aesthetic should feel like a well-built CLI tool got a great UI: 
           monospace data, precision layout, no decoration that doesn't earn its place.
           
Palette:
  --sage-950:  #0a0f0d   (near-black with green undertone — background)
  --sage-900:  #0f1710   (card surface)
  --sage-800:  #162119   (elevated surface)
  --sage-700:  #1e2e22   (border/divider)
  --sage-400:  #6aaf7e   (primary accent — sage green, not neon)
  --sage-300:  #8dc4a0   (accent hover)
  --sage-100:  #d4ead9   (primary text)
  --sage-500:  #4d8f63   (muted accent)
  --amber-400: #f59e0b   (warning / highlight)
  --red-500:   #ef4444   (error)
  --muted:     #4a5c50   (secondary text)

Typography:
  Display: "Geist Mono" (Next.js's own font — no additional import needed, 
           signals technical pedigree, not generic)
  Body: "Geist" (sans companion to Geist Mono)
  Code: "Geist Mono" (same family — unified)
  
  Scale: 12 / 14 / 16 / 20 / 24 / 32 / 48px

Motion philosophy: Functional-only. SSE streaming already has the cursor blink.
                   Add: 150ms ease-out on nav hover, 200ms on card hover (bg shift only),
                   skeleton shimmer on loading. No parallax, no scroll reveals.

Accessibility target: WCAG AA

Signature element: The graph visualization on the Architecture page — 
                   an actual live NetworkX call graph rendered as an interactive 
                   SVG/Canvas panel showing real nodes and edges from an indexed repo.
                   This is the one thing no competitor's demo page has.
```

---

### Design Token Changes (globals.css)

```css
/* Replace the existing :root block entirely */
@import url('https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;500;600&family=Geist:wght@400;500;600&display=swap');

@layer base {
  :root {
    /* Sage-green dark palette — not generic blue-dark */
    --background:          10 15% 6%;      /* sage-950 #0a0f0d */
    --card:                120 18% 8%;     /* sage-900 #0f1710 */
    --card-hover:          120 20% 11%;    /* sage-800 #162119 */
    --foreground:          138 24% 88%;    /* sage-100 #d4ead9 */
    --muted-foreground:    138 10% 42%;    /* muted    #4a5c50 */
    --border:              120 20% 14%;    /* sage-700 #1e2e22 */
    --input:               120 20% 14%;
    
    /* Accent — sage green, not blue */
    --primary:             138 32% 55%;    /* sage-400 #6aaf7e */
    --primary-hover:       138 28% 65%;    /* sage-300 #8dc4a0 */
    --primary-dim:         138 28% 40%;    /* sage-500 #4d8f63 */
    --primary-foreground:  10 15% 6%;
    
    /* Semantic */
    --destructive:         0 84% 60%;
    --warning:             38 92% 50%;     /* amber */
    --success:             138 32% 55%;    /* same as primary */
    
    --radius:              4px;            /* reduced — sharper, more technical */
  }
}

/* Monospace data labels — used everywhere for file paths, scores, latencies */
.mono {
  font-family: 'Geist Mono', monospace;
  font-size: 0.8125rem;  /* 13px */
  letter-spacing: -0.01em;
}

/* Terminal-style prefix for log/status lines */
.terminal-line::before {
  content: '›';
  color: hsl(var(--primary));
  margin-right: 0.5rem;
  font-family: 'Geist Mono', monospace;
}

/* Chunk type badges */
.badge-seed {
  background: hsl(138 32% 55% / 0.15);
  color: hsl(138 32% 65%);
  border: 1px solid hsl(138 32% 55% / 0.3);
  font-family: 'Geist Mono', monospace;
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 3px;
}
.badge-neighbor {
  background: hsl(38 92% 50% / 0.1);
  color: hsl(38 92% 60%);
  border: 1px solid hsl(38 92% 50% / 0.25);
  font-family: 'Geist Mono', monospace;
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 3px;
}

/* Score display */
.score-bar {
  height: 2px;
  background: hsl(120 20% 14%);
  border-radius: 1px;
  overflow: hidden;
}
.score-bar-fill {
  height: 100%;
  background: hsl(var(--primary));
  transition: width 400ms ease-out;
}
```

---

### Layout.tsx — Redesigned Nav

```tsx
// frontend/src/app/layout.tsx
import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import "./globals.css";
import Link from "next/link";

export const metadata: Metadata = {
  title: "CodeSageZ — Graph-Augmented Code Intelligence",
  description: "Repository-level code Q&A using call-graph-augmented RAG.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${GeistSans.variable} ${GeistMono.variable} font-sans`}>
        <div className="min-h-screen flex flex-col bg-background text-foreground">
          
          {/* Nav — slim, technical, no flair */}
          <header className="border-b border-border sticky top-0 z-50 bg-background/95 backdrop-blur-sm">
            <nav className="max-w-7xl mx-auto px-6 h-12 flex items-center justify-between">
              
              {/* Logo — monospace, version as git-style tag */}
              <Link href="/" className="flex items-center gap-2 group">
                <span className="font-mono text-sm font-semibold text-foreground 
                                 group-hover:text-primary transition-colors duration-150">
                  codesagez
                </span>
                <span className="font-mono text-[10px] text-muted-foreground 
                                 border border-border px-1 py-0.5 rounded-sm">
                  v2
                </span>
              </Link>

              {/* Nav links — muted by default, active = sage */}
              <div className="flex items-center gap-1">
                {[
                  { href: "/repos",        label: "Repos"        },
                  { href: "/playground",   label: "Playground"   },
                  { href: "/benchmarks",   label: "Benchmarks"   },
                  { href: "/architecture", label: "Architecture"  },
                ].map(({ href, label }) => (
                  <Link
                    key={href}
                    href={href}
                    className="px-3 py-1.5 text-sm text-muted-foreground 
                               hover:text-foreground hover:bg-card 
                               rounded transition-all duration-150"
                  >
                    {label}
                  </Link>
                ))}
              </div>
            </nav>
          </header>

          <main className="flex-1">{children}</main>
        </div>
      </body>
    </html>
  );
}
```

---

### Homepage (page.tsx) — Redesigned

```tsx
// frontend/src/app/page.tsx
import Link from "next/link";

const STATS = [
  { label: "retrieval strategy",  value: "graph-augmented" },
  { label: "embedding model",     value: "text-embedding-004" },
  { label: "graph depth",         value: "1-hop expansion"  },
  { label: "context window",      value: "top-8 chunks"     },
];

const FEATURES = [
  {
    href: "/repos",
    tag: "01",
    title: "Repo Explorer",
    desc: "Index any public GitHub repo. Ask cross-file questions. The system retrieves callers and callees alongside the direct match.",
  },
  {
    href: "/playground",
    tag: "02",
    title: "Code Playground",
    desc: "Paste any snippet. Get a structured review with severity-ranked issues, a bug fix, or a generated test suite.",
  },
  {
    href: "/benchmarks",
    tag: "03",
    title: "Benchmarks",
    desc: "Internal stratified eval across single-function, cross-file, and call-chain questions. Graph vs. naive delta measured.",
  },
  {
    href: "/architecture",
    tag: "04",
    title: "Architecture",
    desc: "7-stage ingestion pipeline. tree-sitter parse → NetworkX call graph → ChromaDB. Read how it works.",
  },
];

export default function Home() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-16">

      {/* Hero */}
      <div className="mb-16">
        {/* Eyebrow */}
        <div className="flex items-center gap-2 mb-6">
          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          <span className="font-mono text-xs text-primary uppercase tracking-widest">
            graph-augmented rag
          </span>
        </div>

        {/* Headline */}
        <h1 className="text-3xl font-semibold text-foreground leading-tight mb-4">
          Code intelligence that understands<br />
          <span className="text-primary">how functions call each other.</span>
        </h1>

        <p className="text-base text-muted-foreground leading-relaxed max-w-xl mb-8">
          Naive RAG retrieves the function you asked about. CodeSageZ also retrieves
          its callers and callees — because the answer to most cross-file questions
          lives in the surrounding call graph, not just the matched chunk.
        </p>

        {/* CTA */}
        <div className="flex items-center gap-3">
          <Link
            href="/repos"
            className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium 
                       rounded hover:bg-primary-hover transition-colors duration-150"
          >
            Index a repo
          </Link>
          <Link
            href="/playground"
            className="px-4 py-2 border border-border text-sm text-muted-foreground 
                       hover:text-foreground hover:border-primary/50 rounded 
                       transition-all duration-150"
          >
            Try playground
          </Link>
        </div>
      </div>

      {/* Inline stats — monospace data strip */}
      <div className="border border-border rounded-sm mb-16 overflow-hidden">
        <div className="grid grid-cols-2 md:grid-cols-4">
          {STATS.map((s, i) => (
            <div
              key={s.label}
              className={`px-5 py-4 ${
                i < STATS.length - 1 ? "border-r border-border" : ""
              }`}
            >
              <div className="font-mono text-xs text-muted-foreground mb-1">{s.label}</div>
              <div className="font-mono text-sm text-primary">{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Feature list — numbered, not cards */}
      <div className="space-y-0">
        {FEATURES.map((f, i) => (
          <Link
            key={f.href}
            href={f.href}
            className={`flex gap-6 items-start py-6 group
                        ${i > 0 ? "border-t border-border" : ""}
                        hover:bg-card/50 -mx-4 px-4 transition-colors duration-150`}
          >
            <span className="font-mono text-xs text-muted-foreground pt-0.5 w-5 flex-shrink-0">
              {f.tag}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors duration-150">
                  {f.title}
                </span>
                <span className="text-muted-foreground opacity-0 group-hover:opacity-100 
                                 transition-opacity duration-150 text-xs">→</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

---

## 5. APIs You Need to Add/Provide

Here's the exact list of what I need from you before the backend is fully runnable:

### Required (hard-blocking)
| What | Where to get | `.env` key |
|------|-------------|------------|
| Gemini API key | aistudio.google.com → Get API key | `GEMINI_API_KEY` |
| Supabase DB URL | Supabase project → Settings → Database → Connection string → URI mode → copy the `postgresql+asyncpg://...` version | `DATABASE_URL` |

### Required for Docker (semi-blocking)
| What | How | `.env` key |
|------|-----|------------|
| ChromaDB auth token | `openssl rand -hex 32` in terminal | `CHROMA_AUTH_TOKEN` |
| Frontend URL | `http://localhost:3000` for local, Vercel URL for prod | `FRONTEND_URL` |

### Optional (upgrades)
| What | Why needed | `.env` key |
|------|-----------|------------|
| GitHub Personal Access Token | Upgrade E (repo size check) — avoids rate limiting on GitHub API. Public repos work without it but you only get 60 req/hour unauthenticated. | `GITHUB_TOKEN` |
| Ollama local model | If you want the local model debug path to work | `OLLAMA_ENABLED=true` + run Ollama separately |
| Upstash Redis URL | For distributed rate limiting (not needed for local dev, only prod) | `REDIS_URL` |

### Env file you should have (complete):
```env
# Required
GEMINI_API_KEY=your_key_here
DATABASE_URL=postgresql+asyncpg://postgres:[password]@db.[project].supabase.co:5432/postgres

# Docker internal
CHROMADB_URL=http://chromadb:8000
CHROMA_AUTH_TOKEN=your_generated_token

# Optional
GITHUB_TOKEN=ghp_...
FRONTEND_URL=http://localhost:3000
ENVIRONMENT=development
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## 6. Execution Order

Do these in sequence. Don't skip.

```
Phase 0 — Unblock the backend (1 hour)
  [ ] Fix 1: Change embedding model to text-embedding-004
  [ ] Fix 2: Embed query before ChromaDB call in retrieve_naive + retrieve_graph_augmented
  [ ] Fix 3: Migrate to google-genai SDK (requirements.txt + gemini.py rewrite)
  [ ] Run: docker-compose up → POST /api/v1/repo/ingest → verify no 500s
  [ ] Run: python benchmarks/run_internal_eval.py → record actual scores

Phase 1 — Backend hardening (half day)
  [ ] Fix 4: Logging to file
  [ ] Fix 5: debug model name
  [ ] Upgrade D: Health endpoint with component status
  [ ] Upgrade E: GitHub size check before clone
  [ ] Wrap _stream() in try/except → SSE error event
  [ ] Wrap stream_llm() in asyncio.to_thread()
  [ ] Update test mocks for query_embeddings change

Phase 2 — Frontend redesign (half day)
  [ ] Apply new globals.css (palette + typography tokens)
  [ ] Geist font import (already in Next.js, just import from geist package)
  [ ] Redesign layout.tsx (nav)
  [ ] Redesign page.tsx (homepage)
  [ ] Polish repos/page.tsx: apply badge-seed, badge-neighbor, score-bar classes
  [ ] Polish playground/page.tsx: tab styling update

Phase 3 — Upgrades (1-2 days)
  [ ] Upgrade A: JS/TS ingestion support
  [ ] Upgrade B: Streaming code/review and code/debug endpoints
  [ ] Signature element: interactive call graph on architecture page
  [ ] Re-run full eval and update README with real numbers
```

---

## 7. What This Looks Like on a Resume

After fixing and upgrading:

| Claim | Evidence |
|-------|---------|
| Graph-augmented RAG system | Real: 1-hop call graph expansion, score fusion (0.6 vector + 0.4 graph) |
| Gemini 2.5 Flash + text-embedding-004 integration | Real: streaming LLM, batch embedding with retry |
| Tree-sitter AST parsing pipeline | Real: function/class/import extraction, CodeUnit dataclass |
| Measurable lift from graph retrieval | Real: eval results after fixing (whatever the delta is — report it) |
| 7-stage async ingestion with SSE progress | Real: stages cloning→parsing→graphing→embedding→storing→complete |
| QLoRA fine-tuned Qwen2.5-Coder (Ollama) | Pending: only wired, not validated. Either validate it or remove the claim |

The last row is the credibility risk. If `OLLAMA_ENABLED=false` and no Modelfile has been tested, don't claim fine-tuning on the resume until it actually works.

---

*PRD v2.0 | CodeSageZ | DEBUG THUGS | July 2026*
