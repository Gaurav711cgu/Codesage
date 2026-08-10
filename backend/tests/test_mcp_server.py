"""
Integration tests for CodeSageZ Model Context Protocol (MCP) server.
"""
import pytest
from fastapi.testclient import TestClient
from app.mcp_server import mcp_app

client = TestClient(mcp_app)


def test_mcp_health():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "codesagez-mcp"


def test_mcp_list_tools():
    response = client.get("/tools")
    assert response.status_code == 200
    data = response.json()
    assert "tools" in data
    assert len(data["tools"]) >= 1
    tool_names = [t["name"] for t in data["tools"]]
    assert "retrieve_code_context" in tool_names
