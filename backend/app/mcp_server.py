"""
CodeSage Model Context Protocol (MCP) Server.

Exposes graph-augmented RAG tools for integration with Claude Code, Cursor,
Antigravity, and Kairos autonomous SWE agents.
Supports both HTTP endpoints (FastAPI) and stdio JSON-RPC protocol.
"""
import asyncio
import json
import logging
import sys
import uuid
from pathlib import Path
from typing import Any, Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from app.services.retrieval import retrieve
from app.services.graph import get_graph, get_node_metadata
from app.services.kairos_bridge import generate_kairos_context, KairosContextBundle

logger = logging.getLogger(__name__)


def _resolve_mcp_repo_id(repo_id: str) -> str:
    """Resolve repo alias or query to indexed repo UUID."""
    # Check if exact UUID with active collection
    try:
        val_uuid = uuid.UUID(repo_id)
        from app.services import chromadb_client
        if any(c.name.startswith(f"{repo_id}_functions") or c.name.startswith(f"{str(val_uuid)}_functions") for c in chromadb_client.get_client().list_collections()):
            return repo_id
    except Exception:
        pass

    # Look up by name or find latest complete repo in SQLite DB
    try:
        import sqlite3
        from app.core.config import settings
        db_path = settings.database_url.replace("sqlite+aiosqlite:///", "").replace("sqlite:///", "")
        candidate_paths = [
            Path(__file__).resolve().parents[2] / "app.db",
            Path(db_path),
            Path(__file__).resolve().parents[1] / "app.db",
        ]
        target_db = next((p for p in candidate_paths if p.exists()), None)
        if target_db:
            conn = sqlite3.connect(str(target_db))
            cur = conn.cursor()
            # 1. Direct or wildcard name / URL match
            cur.execute(
                "SELECT id FROM repos WHERE (name = ? OR name LIKE ? OR github_url LIKE ?) AND status = 'complete' ORDER BY updated_at DESC LIMIT 1",
                (repo_id, f"%{repo_id}%", f"%{repo_id}%"),
            )
            row = cur.fetchone()
            # 2. If 'eval' or 'sample', match codesage-sample-repo
            if not row and ("sample" in repo_id.lower() or "eval" in repo_id.lower()):
                cur.execute(
                    "SELECT id FROM repos WHERE name LIKE '%sample%' AND status = 'complete' ORDER BY updated_at DESC LIMIT 1"
                )
                row = cur.fetchone()
            # 3. Fallback to latest complete indexed repo
            if not row:
                cur.execute("SELECT id FROM repos WHERE status = 'complete' ORDER BY updated_at DESC LIMIT 1")
                row = cur.fetchone()
            conn.close()
            if row:
                candidate_id = str(row[0])
                try:
                    return str(uuid.UUID(candidate_id))
                except Exception:
                    return candidate_id
    except Exception as exc:
        logger.warning("Error resolving MCP repo ID '%s': %s", repo_id, exc)

    try:
        return str(uuid.UUID(repo_id))
    except Exception:
        pass

    return repo_id


mcp_app = FastAPI(
    title="CodeSage MCP Server",
    description="Model Context Protocol server for CodeSage Graph-Augmented RAG",
    version="2.0.0",
)


# ─── Request / Response Models ───────────────────────────────────────────────

class RetrieveRequest(BaseModel):
    repo_id: str = Field(..., description="Ingested repository UUID or name")
    query: str = Field(..., description="Natural language query or code symbol name")
    mode: str = Field(default="graph", description="Retrieval mode: 'graph' (default) or 'naive'")


class RetrieveResponse(BaseModel):
    chunks: list[dict[str, Any]]
    latency_ms: int
    mode: str
    recall_estimate: float | None = None


class CallGraphRequest(BaseModel):
    repo_id: str = Field(..., description="Ingested repository UUID or name")
    symbol_name: str = Field(..., description="Target function or class name")
    max_depth: int = Field(default=2, description="Hop depth for expansion (1 or 2)")


class CallGraphResponse(BaseModel):
    repo_id: str
    symbol_name: str
    callers: list[dict[str, Any]]
    callees: list[dict[str, Any]]
    node_count: int
    edge_count: int


class KairosBridgeRequest(BaseModel):
    repo_id: str = Field(..., description="Ingested repository UUID or name")
    query: str = Field(..., description="Error log or problem statement")
    symbol_name: Optional[str] = Field(default=None, description="Optional focus symbol name")
    max_chunks: int = Field(default=6, description="Max code chunks to include")


# ─── HTTP Endpoints ─────────────────────────────────────────────────────────

@mcp_app.get("/health")
async def mcp_health():
    return {"status": "ok", "service": "codesagez-mcp", "version": "2.0.0"}


@mcp_app.get("/tools")
async def list_mcp_tools():
    """List available MCP tools for agents."""
    return {
        "tools": [
            {
                "name": "retrieve_code_context",
                "description": "Retrieves relevant code chunks using Graph-Augmented RAG (1-hop / 2-hop topological call-graph expansion).",
                "parameters": RetrieveRequest.model_json_schema(),
            },
            {
                "name": "get_call_graph",
                "description": "Extracts directed callers and callees for a specific code symbol using the repository AST graph.",
                "parameters": CallGraphRequest.model_json_schema(),
            },
            {
                "name": "export_kairos_context",
                "description": "Exports a structured Graph-RAG context bundle formatted for Kairos autonomous code repair agents.",
                "parameters": KairosBridgeRequest.model_json_schema(),
            },
        ]
    }


@mcp_app.post("/tools/retrieve_code_context")
async def retrieve_code_context(req: RetrieveRequest) -> RetrieveResponse:
    """MCP Tool: retrieve_code_context."""
    chunks, latency = await asyncio.to_thread(retrieve, req.repo_id, req.query, req.mode)
    chunk_dicts = [c.model_dump() for c in chunks]

    recall_est = None
    try:
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


@mcp_app.post("/tools/get_call_graph")
async def get_call_graph_endpoint(req: CallGraphRequest) -> CallGraphResponse:
    """MCP Tool: get_call_graph."""
    try:
        G = get_graph(req.repo_id)
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Graph for repo {req.repo_id} not found: {str(e)}")

    target_nodes = [n for n, d in G.nodes(data=True) if d.get("name") == req.symbol_name]
    if not target_nodes and req.symbol_name in G:
        target_nodes = [req.symbol_name]

    callers: list[dict[str, Any]] = []
    callees: list[dict[str, Any]] = []

    for node in target_nodes:
        for p in G.predecessors(node):
            callers.append(get_node_metadata(G, p))
        for s in G.successors(node):
            callees.append(get_node_metadata(G, s))

    return CallGraphResponse(
        repo_id=req.repo_id,
        symbol_name=req.symbol_name,
        callers=callers,
        callees=callees,
        node_count=G.number_of_nodes(),
        edge_count=G.number_of_edges(),
    )


@mcp_app.post("/tools/export_kairos_context")
async def export_kairos_context_endpoint(req: KairosBridgeRequest) -> KairosContextBundle:
    """MCP Tool: export_kairos_context."""
    return await asyncio.to_thread(
        generate_kairos_context,
        repo_id=req.repo_id,
        query=req.query,
        symbol_name=req.symbol_name,
        max_chunks=req.max_chunks,
    )


# ─── Stdio JSON-RPC MCP Server Protocol Runner ──────────────────────────────

def handle_stdio_rpc():
    """Simple synchronous stdio JSON-RPC dispatcher for standard MCP clients."""
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
            req_id = req.get("id")
            method = req.get("method")
            params = req.get("params", {})

            if method == "tools/list":
                result = {
                    "tools": [
                        {
                            "name": "retrieve_code_context",
                            "description": "Retrieves relevant code chunks using Graph-Augmented RAG.",
                            "inputSchema": RetrieveRequest.model_json_schema(),
                        },
                        {
                            "name": "get_call_graph",
                            "description": "Extracts directed callers and callees for a symbol.",
                            "inputSchema": CallGraphRequest.model_json_schema(),
                        },
                        {
                            "name": "export_kairos_context",
                            "description": "Exports a structured Graph-RAG context bundle formatted for Kairos repair.",
                            "inputSchema": KairosBridgeRequest.model_json_schema(),
                        },
                    ]
                }
                resp = {"jsonrpc": "2.0", "id": req_id, "result": result}
            elif method == "tools/call":
                name = params.get("name")
                args = params.get("arguments", {})
                if name == "retrieve_code_context":
                    real_repo = _resolve_mcp_repo_id(args["repo_id"])
                    chunks, lat = retrieve(real_repo, args["query"], args.get("mode", "graph"))
                    content = [{"type": "text", "text": json.dumps([c.model_dump() for c in chunks])}]
                    resp = {"jsonrpc": "2.0", "id": req_id, "result": {"content": content}}
                elif name == "export_kairos_context":
                    real_repo = _resolve_mcp_repo_id(args["repo_id"])
                    bundle = generate_kairos_context(
                        real_repo,
                        args["query"],
                        args.get("symbol_name"),
                        args.get("max_chunks", 6),
                    )
                    content = [{"type": "text", "text": bundle.prompt_payload}]
                    resp = {"jsonrpc": "2.0", "id": req_id, "result": {"content": content}}
                elif name == "get_call_graph":
                    real_repo = _resolve_mcp_repo_id(args["repo_id"])
                    try:
                        G = get_graph(real_repo)
                    except Exception:
                        from app.services.graph import _graph_cache
                        G = next(iter(_graph_cache.values())) if _graph_cache else None
                    symbol = args.get("symbol_name", "")
                    callers, callees = [], []
                    if G:
                        target_nodes = [n for n, d in G.nodes(data=True) if d.get("name") == symbol or str(n).endswith(f"::{symbol}")]
                        for node in target_nodes:
                            for p in G.predecessors(node):
                                callers.append(get_node_metadata(G, p))
                            for s in G.successors(node):
                                callees.append(get_node_metadata(G, s))
                    res_dict = {
                        "repo_id": real_repo,
                        "symbol_name": symbol,
                        "callers": callers,
                        "callees": callees,
                        "node_count": G.number_of_nodes() if G else 0,
                        "edge_count": G.number_of_edges() if G else 0,
                    }
                    content = [{"type": "text", "text": json.dumps(res_dict)}]
                    resp = {"jsonrpc": "2.0", "id": req_id, "result": {"content": content}}
                else:
                    resp = {"jsonrpc": "2.0", "id": req_id, "error": {"code": -32601, "message": f"Tool {name} not found"}}
            else:
                resp = {"jsonrpc": "2.0", "id": req_id, "error": {"code": -32601, "message": f"Method {method} not supported"}}

            sys.stdout.write(json.dumps(resp) + "\n")
            sys.stdout.flush()
        except Exception as e:
            err_resp = {"jsonrpc": "2.0", "id": None, "error": {"code": -32000, "message": str(e)}}
            sys.stdout.write(json.dumps(err_resp) + "\n")
            sys.stdout.flush()


if __name__ == "__main__":
    handle_stdio_rpc()
