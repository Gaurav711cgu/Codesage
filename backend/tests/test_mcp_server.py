"""
Integration tests for CodeSage Model Context Protocol (MCP) server.
"""
import io
import json
import sys
from unittest.mock import patch
import networkx as nx
import pytest
from fastapi.testclient import TestClient

from app.mcp_server import mcp_app, handle_stdio_rpc
from app.services.graph import cache_graph
from app.models.schemas import RetrievedChunk

client = TestClient(mcp_app)


def test_mcp_health():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "codesagez-mcp"
    assert data["version"] == "2.0.0"


def test_mcp_list_tools():
    response = client.get("/tools")
    assert response.status_code == 200
    data = response.json()
    assert "tools" in data
    assert len(data["tools"]) >= 3
    tool_names = [t["name"] for t in data["tools"]]
    assert "retrieve_code_context" in tool_names
    assert "get_call_graph" in tool_names
    assert "export_kairos_context" in tool_names


def test_mcp_get_call_graph_endpoint():
    # Setup test graph
    G = nx.DiGraph()
    G.add_node("auth::login", name="login", file="auth.py", start_line=10, end_line=25)
    G.add_node("crypto::verify", name="verify", file="crypto.py", start_line=5, end_line=15)
    G.add_edge("auth::login", "crypto::verify")
    cache_graph("test_mcp_repo", G)

    response = client.post(
        "/tools/get_call_graph",
        json={"repo_id": "test_mcp_repo", "symbol_name": "login"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["repo_id"] == "test_mcp_repo"
    assert data["symbol_name"] == "login"
    assert len(data["callees"]) == 1
    assert data["callees"][0]["name"] == "verify"


def test_mcp_export_kairos_context_endpoint():
    dummy_chunk = RetrievedChunk(
        name="login",
        file="app/auth.py",
        lines=[10, 20],
        type="seed",
        score=0.95,
        content="def login():\n    pass",
    )
    with patch("app.mcp_server.retrieve", return_value=([dummy_chunk], 5)):
        response = client.post(
            "/tools/export_kairos_context",
            json={
                "repo_id": "test_repo",
                "query": "AttributeError: user token missing",
                "max_chunks": 3,
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["repo_id"] == "test_repo"
        assert "CodeSage AST & Graph-RAG Context Slice" in data["prompt_payload"]
        assert "Ranked Code Chunks" in data["prompt_payload"]


def test_mcp_stdio_jsonrpc_list_tools():
    rpc_request = json.dumps({"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}) + "\n"
    stdin_mock = io.StringIO(rpc_request)
    stdout_mock = io.StringIO()

    with patch("sys.stdin", stdin_mock), patch("sys.stdout", stdout_mock):
        handle_stdio_rpc()

    output = stdout_mock.getvalue().strip()
    assert output
    resp = json.loads(output)
    assert resp["id"] == 1
    assert "tools" in resp["result"]
    tool_names = [t["name"] for t in resp["result"]["tools"]]
    assert "export_kairos_context" in tool_names
