# Graph Retrieval Benchmark Methodology

## Scope

`run_graph_edge_eval.py` measures one specific capability: whether graph
augmentation retrieves a function that the parser identified as a direct callee
of a named caller. It does not claim to measure general question-answering
quality or LLM answer correctness.

## Dataset

The benchmark is generated at run time from the actual call graphs created by
the ingestion pipeline for three public repositories: FastAPI, HTTPX, and
Celery. It selects up to 40 parsed caller-to-callee edges per repository using
a stable SHA-256 ordering of edge IDs, rather than source-file order. The
ground truth is the target node of each stored graph edge; no mock documents,
hand-written answers, or synthetic code are used.

## Procedure

For every selected edge `caller -> callee`, the runner queries both retrieval
modes by naming the caller in a direct-callee question. A hit is recorded
when the parsed callee symbol appears in the first eight returned chunks.

The runner reports direct-callee Recall@8, 95% Wilson confidence intervals,
p50/p95 retrieval latency, and raw per-edge outcomes. Results are written to
`benchmarks/results/graph_edge_eval_results.json`.

## Reproduce

```bash
python benchmarks/setup_and_ingest.py
python benchmarks/run_graph_edge_eval.py
```

The benchmark is meaningful only when all three repositories have completed
indexing in `backend/app.db` and their Chroma collections are present.

## Valid Claim

The valid portfolio claim is: "Graph-augmented retrieval improved direct-callee
Recall@8 by X percentage points on parsed call-graph edges from FastAPI, HTTPX,
and Celery." Do not generalize this result to end-to-end Q&A accuracy without a
separate answer-quality benchmark and an independently validated judge.
