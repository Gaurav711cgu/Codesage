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

logger = logging.getLogger(__name__)

EmbeddingProvider = Literal["voyage", "openai", "gemini", "local"]


def _get_provider() -> EmbeddingProvider:
    provider_env = os.getenv("EMBEDDING_PROVIDER", "").lower().strip()
    if provider_env in ("voyage", "openai", "gemini", "local"):
        return provider_env  # type: ignore[return-value]
    if settings.gemini_api_key:
        return "gemini"
    return "local"


def local_hash_embed(text: str, dimension: int = 384) -> list[float]:
    """
    Generate a stable, normalized bag-of-words hash vector for a text.
    Runs locally in microseconds, zero external dependencies.
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
        try:
            import voyageai
            client = voyageai.Client(api_key=os.getenv("VOYAGE_API_KEY"))
            result = client.embed(texts, model="voyage-code-3", input_type="document")
            return result.embeddings
        except Exception as exc:
            logger.warning("Voyage embedding failed (%s), falling back to local hash: %s", exc, provider)

    elif provider == "openai":
        try:
            from openai import OpenAI
            client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
            response = client.embeddings.create(input=texts, model="text-embedding-3-small")
            return [item.embedding for item in response.data]
        except Exception as exc:
            logger.warning("OpenAI embedding failed (%s), falling back to local hash: %s", exc, provider)

    elif provider == "gemini":
        try:
            from google import genai
            if settings.gemini_api_key:
                client = genai.Client(api_key=settings.gemini_api_key)
                response = client.models.embed_content(
                    model="text-embedding-004",
                    contents=texts,
                )
                if hasattr(response, "embeddings") and response.embeddings:
                    return [e.values for e in response.embeddings]
        except Exception as exc:
            logger.warning("Gemini embedding failed (%s), falling back to local hash: %s", exc, provider)

    logger.debug("Using local hash embeddings for %d texts", len(texts))
    return [local_hash_embed(t) for t in texts]


def embed_query(query: str) -> list[float]:
    """Embed a single query string using the configured provider."""
    provider = _get_provider()

    if provider == "voyage":
        try:
            import voyageai
            client = voyageai.Client(api_key=os.getenv("VOYAGE_API_KEY"))
            result = client.embed([query], model="voyage-code-3", input_type="query")
            return result.embeddings[0]
        except Exception as exc:
            logger.warning("Voyage query embedding failed (%s), falling back to local hash", exc)

    elif provider == "openai":
        try:
            from openai import OpenAI
            client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
            response = client.embeddings.create(input=[query], model="text-embedding-3-small")
            return response.data[0].embedding
        except Exception as exc:
            logger.warning("OpenAI query embedding failed (%s), falling back to local hash", exc)

    elif provider == "gemini":
        try:
            from google import genai
            if settings.gemini_api_key:
                client = genai.Client(api_key=settings.gemini_api_key)
                response = client.models.embed_content(
                    model="text-embedding-004",
                    contents=query,
                )
                if hasattr(response, "embedding") and response.embedding:
                    return response.embedding.values
                if hasattr(response, "embeddings") and response.embeddings:
                    return response.embeddings[0].values
        except Exception as exc:
            logger.warning("Gemini query embedding failed (%s), falling back to local hash", exc)

    return local_hash_embed(query)
