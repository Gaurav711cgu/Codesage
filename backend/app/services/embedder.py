"""
Unified embedding service for CodeSageZ.
Supports:
  - voyage: voyage-code-3 (1024-dim, code-optimized)
  - openai: text-embedding-3-small (1536-dim)
  - gemini: text-embedding-004 (768-dim)
  - local: local_hash_embed (384-dim, fallback, zero cost, zero external deps)

Set EMBEDDING_PROVIDER in environment to switch ("voyage" | "openai" | "gemini" | "local").
"""
import hashlib
import logging
import math
import os
import re
from typing import Literal

from app.core.config import settings
from app.core.resilience import embedding_breaker, execute_with_resilience_sync

logger = logging.getLogger(__name__)

EmbeddingProvider = Literal["voyage", "openai", "gemini", "local"]


def _get_provider() -> EmbeddingProvider:
    provider_env = os.getenv("EMBEDDING_PROVIDER", "").lower().strip()
    if provider_env in ("voyage", "openai", "gemini", "local"):
        return provider_env  # type: ignore[return-value]
    if settings.gemini_api_key:
        return "gemini"
    return "local"


_default_dense_fn = None


def get_default_dense_embedder():
    """Lazily load the ChromaDB default ONNX all-MiniLM-L6-v2 embedding function."""
    global _default_dense_fn
    if _default_dense_fn is None:
        try:
            import chromadb.utils.embedding_functions as ef
            _default_dense_fn = ef.DefaultEmbeddingFunction()
        except Exception as exc:
            logger.warning("Failed to initialize Chroma default ONNX dense embedder: %s", exc)
            _default_dense_fn = None
    return _default_dense_fn


def local_dense_embed(texts: list[str]) -> list[list[float]]:
    """
    Generate authentic 384-dimensional dense semantic embeddings using the local ONNX
    all-MiniLM-L6-v2 model (via ChromaDB built-in engine).
    Requires zero external API keys or network requests.
    Falls back gracefully to local_hash_embed if ONNX runtime is unavailable.
    """
    fn = get_default_dense_embedder()
    if fn is not None:
        try:
            raw_embeddings = fn(texts)
            normalized = []
            for vec in raw_embeddings:
                norm = math.sqrt(sum(float(x) * float(x) for x in vec))
                normalized.append([float(x / norm) for x in vec] if norm > 0.0 else [float(x) for x in vec])
            return normalized
        except Exception as exc:
            logger.warning("Local dense embedding batch failed: %s; falling back to feature hash", exc)
    return [local_hash_embed(t) for t in texts]


def local_hash_embed(text: str, dimension: int = 384) -> list[float]:
    """
    Generate a normalized Lexical Bag-of-Words Feature Hash vector (the Hashing Trick).
    
    NOTE: This is a fast, zero-dependency lexical token-matching baseline (similar to
    MinHash/FeatureHasher), NOT a learned semantic transformer model. For true semantic
    similarity across synonyms (e.g. 'async function' vs 'speedy coroutine'), configure
    local_dense_embed (local ONNX MiniLM), EMBEDDING_PROVIDER="gemini", or "voyage".
    """
    words = re.findall(r'[a-zA-Z_0-9]+', text.lower())
    vector = [0.0] * dimension
    if not words:
        return vector
    for word in words:
        h = int(hashlib.md5(word.encode("utf-8")).hexdigest(), 16)
        vector[h % dimension] += 1.0
    norm = math.sqrt(sum(x * x for x in vector))
    return [x / norm for x in vector] if norm > 0.0 else vector


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Embed a list of text strings using the configured provider."""
    provider = _get_provider()
    if not texts:
        return []

    if provider == "voyage":
        import voyageai
        api_key = os.getenv("VOYAGE_API_KEY")
        if not api_key:
            raise RuntimeError("VOYAGE_API_KEY is not configured")
        client = voyageai.Client(api_key=api_key)
        result = client.embed(texts, model="voyage-code-3", input_type="document")
        return result.embeddings

    elif provider == "openai":
        from openai import OpenAI
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise RuntimeError("OPENAI_API_KEY is not configured")
        client = OpenAI(api_key=api_key)
        response = client.embeddings.create(input=texts, model="text-embedding-3-small")
        return [item.embedding for item in response.data]

    elif provider == "gemini":
        from google import genai
        if not settings.gemini_api_key:
            raise RuntimeError("GEMINI_API_KEY is not configured")

        def _do_gemini_texts():
            client = genai.Client(api_key=settings.gemini_api_key)
            response = client.models.embed_content(
                model="gemini-embedding-001",
                contents=texts,
            )
            if hasattr(response, "embeddings") and response.embeddings:
                return [e.values for e in response.embeddings]
            raise RuntimeError("Gemini embed_content returned no embeddings")

        try:
            return execute_with_resilience_sync(_do_gemini_texts, breaker=embedding_breaker, max_retries=3)
        except Exception as exc:
            logger.warning("Gemini embedding failed via resilience engine: %s. Falling back to local hashing.", exc)
            return [local_hash_embed(t) for t in texts]

    elif provider == "local":
        return local_dense_embed(texts)

    logger.info("No external embedding provider configured. Using local ONNX dense embeddings (all-MiniLM-L6-v2, 384-dim).")
    return local_dense_embed(texts)


def embed_query(query: str) -> list[float]:
    """Embed a single query string using the configured provider."""
    provider = _get_provider()

    if provider == "voyage":
        import voyageai
        api_key = os.getenv("VOYAGE_API_KEY")
        if not api_key:
            raise RuntimeError("VOYAGE_API_KEY is not configured")
        client = voyageai.Client(api_key=api_key)
        result = client.embed([query], model="voyage-code-3", input_type="query")
        return result.embeddings[0]

    elif provider == "openai":
        from openai import OpenAI
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise RuntimeError("OPENAI_API_KEY is not configured")
        client = OpenAI(api_key=api_key)
        response = client.embeddings.create(input=[query], model="text-embedding-3-small")
        return response.data[0].embedding

    elif provider == "gemini":
        from google import genai
        if not settings.gemini_api_key:
            raise RuntimeError("GEMINI_API_KEY is not configured")

        def _do_gemini_query():
            client = genai.Client(api_key=settings.gemini_api_key)
            response = client.models.embed_content(
                model="gemini-embedding-001",
                contents=query,
            )
            if hasattr(response, "embeddings") and response.embeddings:
                return response.embeddings[0].values
            if hasattr(response, "embedding") and response.embedding:
                return response.embedding.values
            raise RuntimeError("Gemini embed_content returned no embedding for query")

        try:
            return execute_with_resilience_sync(_do_gemini_query, breaker=embedding_breaker, max_retries=3)
        except Exception as exc:
            logger.warning("Gemini query embedding failed via resilience engine: %s. Falling back to local dense embed.", exc)
            return local_dense_embed([query])[0]

    elif provider == "local":
        return local_dense_embed([query])[0]

    logger.info("No external embedding provider configured; using local ONNX dense embedding for query.")
    return local_dense_embed([query])[0]
