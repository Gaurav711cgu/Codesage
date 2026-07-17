"""
ChromaDB operations — all collection management and document storage/retrieval.
"""
import logging
from typing import Any
from urllib.parse import urlparse

import chromadb
from chromadb.config import Settings as ChromaSettings

from app.core.config import settings

logger = logging.getLogger(__name__)

# ─── Client singleton ─────────────────────────────────────────────────────────

def _make_client() -> Any:
    chroma_settings = ChromaSettings(
        anonymized_telemetry=False,
    )
    if settings.chromadb_url:
        parsed = urlparse(settings.chromadb_url)
        if not parsed.hostname:
            raise ValueError("CHROMADB_URL must be a valid HTTP(S) URL")
        headers = (
            {"Authorization": f"Bearer {settings.chroma_auth_token}"}
            if settings.chroma_auth_token
            else None
        )
        return chromadb.HttpClient(
            host=parsed.hostname,
            port=parsed.port or (443 if parsed.scheme == "https" else 80),
            ssl=parsed.scheme == "https",
            headers=headers,
            settings=chroma_settings,
        )
    return chromadb.PersistentClient(
        path=settings.chroma_persist_directory,
        settings=chroma_settings,
    )


_client: Any | None = None


def get_client() -> Any:
    global _client
    if _client is None:
        _client = _make_client()
    return _client


# ─── Collection helpers ───────────────────────────────────────────────────────

SUFFIXES = ("_functions", "_classes", "_files")


def collection_name(repo_id: str, suffix: str) -> str:
    return f"{repo_id}{suffix}"


def get_or_create_collection(repo_id: str, suffix: str) -> chromadb.Collection:
    name = collection_name(repo_id, suffix)
    return get_client().get_or_create_collection(
        name=name,
        metadata={"hnsw:space": "cosine"},
    )


def delete_repo_collections(repo_id: str) -> None:
    """Delete all three collections for a repo. Silently skips missing ones."""
    client = get_client()
    for suffix in SUFFIXES:
        name = collection_name(repo_id, suffix)
        try:
            client.delete_collection(name)
            logger.info("Deleted collection %s", name)
        except Exception:
            pass  # collection may not exist


# ─── Storage ──────────────────────────────────────────────────────────────────

def upsert_documents(
    repo_id: str,
    suffix: str,
    ids: list[str],
    documents: list[str],
    embeddings: list[list[float]] | None,
    metadatas: list[dict[str, Any]],
) -> None:
    """Upsert a batch of documents into a collection."""
    collection = get_or_create_collection(repo_id, suffix)
    kwargs: dict[str, Any] = {
        "ids": ids,
        "documents": documents,
        "metadatas": metadatas,
    }
    if embeddings is not None:
        kwargs["embeddings"] = embeddings
    
    collection.upsert(**kwargs)


# ─── Retrieval ────────────────────────────────────────────────────────────────

def query_collection(
    repo_id: str,
    suffix: str,
    query_embedding: list[float] | None = None,
    query_text: str | None = None,
    n_results: int = 5,
    where: dict | None = None,
) -> dict[str, Any]:
    """
    Query a collection by embedding vector or text.
    Returns raw ChromaDB result dict with 'ids', 'documents', 'metadatas', 'distances'.
    """
    collection = get_or_create_collection(repo_id, suffix)
    kwargs: dict[str, Any] = {
        "n_results": n_results,
        "include": ["documents", "metadatas", "distances"],
    }
    if query_embedding is not None:
        kwargs["query_embeddings"] = [query_embedding]
    elif query_text is not None:
        kwargs["query_texts"] = [query_text]
        
    if where:
        kwargs["where"] = where
    return collection.query(**kwargs)


def get_documents_by_ids(
    repo_id: str,
    suffix: str,
    ids: list[str],
) -> dict[str, Any]:
    """Fetch specific documents by their IDs (used for graph expansion)."""
    if not ids:
        return {"ids": [[]], "documents": [[]], "metadatas": [[]]}
    collection = get_or_create_collection(repo_id, suffix)
    return collection.get(
        ids=ids,
        include=["documents", "metadatas"],
    )


def get_documents_by_metadata(
    repo_id: str,
    suffix: str,
    where: dict[str, Any],
) -> dict[str, Any]:
    """Fetch exact metadata matches without loading an entire collection."""
    collection = get_or_create_collection(repo_id, suffix)
    return collection.get(where=where, include=["documents", "metadatas"])


def count_documents(repo_id: str, suffix: str) -> int:
    try:
        collection = get_or_create_collection(repo_id, suffix)
        return collection.count()
    except Exception:
        return 0
