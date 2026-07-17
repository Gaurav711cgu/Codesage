"""
API-level tests using httpx AsyncClient and a test database.
External services (Gemini, ChromaDB, Ollama) are mocked.
"""
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.main import app
from app.core.database import Base, get_db
from app.models.repo import Repo, Task


# ─── In-memory SQLite for tests ───────────────────────────────────────────────

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(TEST_DATABASE_URL, echo=False)
TestSessionLocal = async_sessionmaker(test_engine, class_=AsyncSession,
                                      expire_on_commit=False)


async def override_get_db():
    async with TestSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


@pytest_asyncio.fixture(autouse=True)
async def setup_db():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    app.dependency_overrides[get_db] = override_get_db
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


# ─── Health check ─────────────────────────────────────────────────────────────


@pytest.mark.asyncio
@patch("app.main.chromadb_client")
@patch("app.main.AsyncSessionLocal")
async def test_health(mock_session, mock_chroma, client):
    # Mock ChromaDB client heartbeat
    mock_client = MagicMock()
    mock_client.heartbeat.return_value = 12345
    mock_chroma.get_client.return_value = mock_client

    # Mock DB connection
    mock_db = MagicMock()
    mock_db.execute = AsyncMock()
    mock_session.return_value.__aenter__.return_value = mock_db

    resp = await client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert "version" in body


@pytest.mark.asyncio
async def test_benchmarks_serves_real_graph_edge_measurement(client):
    resp = await client.get("/api/v1/benchmarks")
    assert resp.status_code == 200
    graph_edge = resp.json()["data"]["rag"]["graph_edge"]
    assert graph_edge["edges"] and graph_edge["edges"] > 0
    assert 0 <= graph_edge["naive"] <= 100
    assert 0 <= graph_edge["graph"] <= 100



# ─── POST /api/v1/repo/ingest ─────────────────────────────────────────────────


@pytest.mark.asyncio
@patch("app.api.v1.repo.run_ingestion", new_callable=AsyncMock)
@patch("app.api.v1.repo.asyncio.ensure_future")
async def test_ingest_creates_repo(mock_future, mock_ingest, client):
    mock_future.return_value = MagicMock()

    resp = await client.post("/api/v1/repo/ingest", json={
        "github_url": "https://github.com/encode/httpx",
        "name": "httpx",
    })
    assert resp.status_code == 202
    body = resp.json()
    assert body["error"] is None
    assert "task_id" in body["data"]
    assert "repo_id" in body["data"]
    assert body["data"]["status"] == "queued"


@pytest.mark.asyncio
async def test_ingest_rejects_duplicate(client):
    # Seed a repo directly
    async with TestSessionLocal() as db:
        repo = Repo(
            github_url="https://github.com/encode/httpx",
            name="httpx",
            status="complete",
        )
        db.add(repo)
        await db.commit()

    with patch("app.api.v1.repo.run_ingestion", new_callable=AsyncMock):
        resp = await client.post("/api/v1/repo/ingest", json={
            "github_url": "https://github.com/encode/httpx",
        })
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_ingest_rejects_invalid_url(client):
    resp = await client.post("/api/v1/repo/ingest", json={
        "github_url": "https://gitlab.com/some/repo",
    })
    assert resp.status_code == 422  # Pydantic validation error


# ─── GET /api/v1/repos ────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_list_repos_empty(client):
    resp = await client.get("/api/v1/repos")
    assert resp.status_code == 200
    assert resp.json()["data"] == []


@pytest.mark.asyncio
async def test_list_repos_returns_entries(client):
    async with TestSessionLocal() as db:
        db.add(Repo(github_url="https://github.com/a/b", name="b", status="complete"))
        db.add(Repo(github_url="https://github.com/c/d", name="d", status="queued"))
        await db.commit()

    resp = await client.get("/api/v1/repos")
    assert resp.status_code == 200
    assert len(resp.json()["data"]) == 2


# ─── DELETE /api/v1/repo/{repo_id} ────────────────────────────────────────────


@pytest.mark.asyncio
@patch("app.api.v1.repo.chromadb_client.delete_repo_collections")
@patch("app.api.v1.repo.graph_svc.invalidate_graph")
async def test_delete_repo(mock_invalidate, mock_delete, client):
    async with TestSessionLocal() as db:
        repo = Repo(
            github_url="https://github.com/x/y", name="y", status="complete"
        )
        db.add(repo)
        await db.commit()
        await db.refresh(repo)
        repo_id = repo.id

    resp = await client.delete(f"/api/v1/repo/{repo_id}")
    assert resp.status_code == 204
    mock_delete.assert_called_once()
    mock_invalidate.assert_called_once()


@pytest.mark.asyncio
async def test_delete_nonexistent_repo(client):
    resp = await client.delete(f"/api/v1/repo/{uuid.uuid4()}")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_repo_in_progress(client):
    async with TestSessionLocal() as db:
        repo = Repo(
            github_url="https://github.com/z/w", name="w", status="cloning"
        )
        db.add(repo)
        await db.commit()
        await db.refresh(repo)
        repo_id = repo.id

    resp = await client.delete(f"/api/v1/repo/{repo_id}")
    assert resp.status_code == 409


# ─── POST /api/v1/code/review ─────────────────────────────────────────────────


@pytest.mark.asyncio
@patch("app.api.v1.code.call_llm")
async def test_code_review_returns_structured(mock_llm, client):
    import json
    mock_llm.return_value = json.dumps({
        "overall_score": 85,
        "issues": [
            {"severity": "medium", "line": 3,
             "description": "No type hint", "suggestion": "Add type hints"}
        ],
        "strengths": ["Clean logic"],
        "summary": "Good code overall.",
    })

    resp = await client.post("/api/v1/code/review", json={
        "code": "def add(a, b):\n    return a + b\n",
        "language": "python",
    })
    assert resp.status_code == 200
    body = resp.json()
    assert body["error"] is None
    assert body["data"]["overall_score"] == 85
    assert len(body["data"]["issues"]) == 1


@pytest.mark.asyncio
async def test_code_review_rejects_long_input(client):
    resp = await client.post("/api/v1/code/review", json={
        "code": "x" * 10001,
        "language": "python",
    })
    assert resp.status_code == 422


# ─── POST /api/v1/code/debug ──────────────────────────────────────────────────


@pytest.mark.asyncio
@patch("app.api.v1.code.call_llm")
async def test_debug_returns_fix(mock_llm, client):
    import json
    mock_llm.return_value = json.dumps({
        "probable_cause": "NoneType has no attribute 'split'",
        "root_location": "main.py:5",
        "execution_path": ["main()", "process(data)"],
        "confidence": "high",
    })

    resp = await client.post("/api/v1/code/debug", json={
        "code": "def foo(x):\n    return x.split()\n",
        "error": "AttributeError: 'NoneType' object has no attribute 'split'",
        "language": "python",
        "use_local_model": False,
    })
    assert resp.status_code == 200
    body = resp.json()
    assert body["error"] is None
    assert body["data"]["confidence"] == "high"
    assert "model_used" in body["data"]


# ─── POST /api/v1/code/tests ─────────────────────────────────────────────────


@pytest.mark.asyncio
@patch("app.api.v1.code.call_llm")
async def test_generate_tests(mock_llm, client):
    import json
    mock_llm.return_value = json.dumps({
        "test_code": "def test_add():\n    assert add(1, 2) == 3\n",
        "test_count": 1,
        "cases": [{"type": "happy_path", "name": "test_add"}],
    })

    resp = await client.post("/api/v1/code/tests", json={
        "code": "def add(a, b):\n    return a + b\n",
        "language": "python",
        "framework": "pytest",
    })
    assert resp.status_code == 200
    body = resp.json()
    assert body["error"] is None
    assert body["data"]["test_count"] == 1
    assert len(body["data"]["cases"]) == 1
