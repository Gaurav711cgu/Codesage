# CodeSage Architecture Specification

## 1. System Overview

CodeSage is a repository intelligence and Graph-Augmented Retrieval (Graph-RAG) engine designed to eliminate context starvation in Autonomous Software Engineering (SWE) agents. While naive vector search retrieves chunks based on natural language embedding similarity, it routinely misses structural dependencies—callees, caller hierarchies, interface implementations, and type definitions.

CodeSage couples Tree-sitter abstract syntax tree (AST) parsing with NetworkX topological call-graph traversals, guaranteeing that when a symbol is retrieved, its 1-hop and 2-hop execution dependencies are pulled into context deterministically.

```
                              ┌─────────────────────────────────────────┐
                              │          Codebase Repository            │
                              └────────────────────┬────────────────────┘
                                                   │
                      ┌────────────────────────────┴────────────────────────────┐
                      ▼                                                         ▼
       ┌─────────────────────────────┐                           ┌─────────────────────────────┐
       │   Tree-sitter AST Parser    │                           │    Dense Embeddings Engine   │
       │  (Function/Class/Call Nodes)│                           │   (ONNX MiniLM / ChromaDB)  │
       └──────────────┬──────────────┘                           └──────────────┬──────────────┘
                      ▼                                                         ▼
       ┌─────────────────────────────┐                           ┌─────────────────────────────┐
       │ NetworkX Directed Call Graph│                           │    ChromaDB Vector Store    │
       │ (1-hop / 2-hop Traversals)  │                           │    (Semantic Entry Seeds)   │
       └──────────────┬──────────────┘                           └──────────────┬──────────────┘
                      │                                                         │
                      └────────────────────────────┬────────────────────────────┘
                                                   ▼
                                 ┌───────────────────────────────────┐
                                 │     Hybrid Graph-RAG Pipeline     │
                                 │  (Seed Vector + Graph Traversal)  │
                                 └─────────────────┬─────────────────┘
                                                   ▼
                      ┌────────────────────────────────────────────────────────┐
                      │             Fault-Tolerant Delivery Layer              │
                      │  - SingleFlight Request Coalescing                     │
                      │  - Circuit Breaker (CLOSED / OPEN / HALF-OPEN)         │
                      │  - Redis Jittered TTL Expiration Cache                 │
                      └────────────────────────────┬───────────────────────────┘
                                                   ▼
                      ┌────────────────────────────────────────────────────────┐
                      │              Model Context Protocol (MCP)              │
                      │       Standard JSON-RPC Server & Kairos Bridge         │
                      └────────────────────────────────────────────────────────┘
```

---

## 2. Ingestion & Graph Construction Pipeline

### Stage 1: File Discovery & AST Chunking
- Scans target repository paths filtering via `.gitignore` and language extensions (`.py`, `.ts`, `.tsx`, `.js`, `.go`).
- Invokes `tree-sitter` language grammars to parse each source file into an Abstract Syntax Tree.
- Extracts definitions:
  - `FunctionDefinition`: Name, signature, docstring, start/end line, enclosing scope.
  - `ClassDefinition`: Name, base classes, methods, class docstring.
  - `CallExpression`: Callee identifier, argument names, call site line.

### Stage 2: Dual Storage Indexing
- **Dense Vector Embedding (ChromaDB):**
  - Chunks are vectorized using local ONNX `all-MiniLM-L6-v2` or configured embedding models.
  - Metadata includes `repo_id`, `file_path`, `symbol_name`, `start_line`, and `end_line`.
- **Directed Graph Persistence (NetworkX):**
  - Graph nodes represent defined symbols with attributes `{file, line, type}`.
  - Directed edges `(u, v)` represent caller $\to$ callee relationships.
  - Resolved intra-file and cross-file imports link callers to their target definitions.

---

## 3. Retrieval Architecture: 2-Hop Graph-RAG

Naive flat vector retrieval fails on code because caller functions and their helper callees reside in disparate semantic embedding clusters. For example, `authenticate_request()` vectorizes close to security and authorization words, whereas `decode_jwt_token()` vectorizes with bitwise and crypto utilities.

### Graph-RAG Algorithmic Flow
1. **Semantic Seeding:** ChromaDB queries retrieve top-$K$ candidate seed chunks matching natural language intent ($K=4$).
2. **Topological 1-Hop Expansion:** For each seed chunk, identify all outgoing edges (direct callees) and incoming edges (direct callers).
3. **2-Hop Pruned Neighbor Traversal:** Follow call chains up to 2 hops, filtering out high-degree utility nodes (e.g. `logger.info`, `str()`) to prevent context bloating.
4. **Context Deduplication & Ranking:** Merge semantic seeds with graph-discovered symbols, prioritizing structural dependencies that share execution paths with the seed.

### Empirical Validation
Across 120 ground-truth parsed edges in production repositories (`fastapi`, `celery`, `httpx`):
- **Naive Vector Recall@8:** `0.0%` [95% CI: 0.0%, 3.1%]
- **CodeSage Graph-RAG Recall@8:** `50.8%` [95% CI: 42.0%, 59.6%]
- **Net Lift:** `+50.8 percentage points` (p < 0.001) with only 1ms p50 latency overhead (4ms vs 3ms).

---

## 4. Systems Reliability & Fault Tolerance

To withstand high concurrency and bursty agent traffic:
1. **SingleFlight Coalescing:** Synchronizes concurrent identical queries, ensuring only one vector query or graph traversal runs while remaining callers await the shared result.
2. **Circuit Breaker:** 3-state state machine guarding upstream LLM APIs. Trips after consecutive timeouts, immediately serving cached or fallback responses without blocking threads.
3. **Redis Jittered Cache:** Caches hot retrieval results with a random TTL jitter ($\pm 10\%$) to prevent cache stampedes.

---

## 5. Model Context Protocol (MCP) & Kairos Integration

CodeSage exposes its Graph-RAG capabilities as a standard Model Context Protocol server. This allows AI coding agents (Claude Code, Cursor, Antigravity) to mount CodeSage directly.

### Exposed Tools
- `retrieve_code_context(repo_id, query, mode)`: Retrieve 2-hop graph-augmented context.
- `get_call_graph(repo_id, symbol_name)`: Inspect caller and callee subgraphs.
- `parse_ast_symbols(file_path, code)`: Extract definitions and calls from a file.
- `export_kairos_context(repo_id, error_symbol, file_path)`: Produces a structured context slice formatted directly for the Kairos 14B QLoRA code repair model.
