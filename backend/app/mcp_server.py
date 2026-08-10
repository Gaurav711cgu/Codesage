"""
CodeSageZ MCP (Model Context Protocol) Server.
Exposes graph-augmented RAG tools for integration with Claude Code, Cursor, and MCP clients.
"""
import logging

from fastapi import FastAPI
from pydantic import BaseModel, Field

from app.services.retrieval import retrieve

logger = logging.getLogger(__name__)

mcp_app = FastAPI(
    title="CodeSageZ MCP Server",
    description="Model Context Protocol server for CodeSageZ Graph-Augmented RAG",
    version="1.0.0",
)


class RetrieveRequest(BaseModel):
    repo_id: str = Field(..., description="Ingested repository UUID or name")
    query: str = Field(..., description="Natural language query or code symbol name")
    mode: str = Field(default="graph", description="Retrieval mode: 'graph' (default) or 'naive'")


class RetrieveResponse(BaseModel):
    chunks: list[dict]
    latency_ms: int
    mode: str
    recall_estimate: float | None = None


@mcp_app.get("/health")
async def mcp_health():
    return {"status": "ok", "service": "codesagez-mcp"}


@mcp_app.get("/tools")
async def list_mcp_tools():
    """List available MCP tools for agents."""
    return {
        "tools": [
            {
                "name": "retrieve_code_context",
                "description": "Retrieves relevant code chunks using Graph-Augmented RAG (1-hop topological call-graph expansion).",
                "parameters": RetrieveRequest.model_json_schema(),
            }
        ]
    }


@mcp_app.post("/tools/retrieve_code_context")
async def retrieve_code_context(req: RetrieveRequest) -> RetrieveResponse:
    """
    MCP Tool: retrieve_code_context

    Retrieves relevant code chunks for a given query using graph-augmented RAG.
    Graph expansion surfaces callee/caller context that pure vector search misses.
    """
    import asyncio
    chunks, latency = await asyncio.to_thread(retrieve, req.repo_id, req.query, req.mode)
    chunk_dicts = [c.model_dump() for c in chunks]

    # Load empirical recall estimate from evaluation results if available
    recall_est = None
    try:
        from pathlib import Path
        import json
        bench_path = Path(__file__).resolve().parents[2] / "benchmarks" / "results" / "graph_edge_eval_results.json"
        if bench_path.exists():
            data = json.loads(bench_path.read_text())
            metric_key = "graph_recall_at_8" if req.mode == "graph" else "naive_recall_at_8"
            if metric_key in data:
                recall_est = data[metric_key] / 100.0 if data[metric_key] > 1.0 else data[metric_key]
    except Exception:
        pass

    return RetrieveResponse(
        chunks=chunk_dicts,
        latency_ms=latency,
        mode=req.mode,
        recall_estimate=recall_est,
    )
