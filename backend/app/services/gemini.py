"""
Single point of contact for all Google AI calls.
No other module imports google.genai directly.
"""
import logging
from typing import Generator

from google import genai
from google.genai import types

from app.core.config import settings

logger = logging.getLogger(__name__)

_client: genai.Client | None = None


def _generation_unavailable() -> str:
    return "Generation is unavailable because the configured LLM provider could not be reached."


def _get_client() -> genai.Client:
    """Create the Gemini client only when an LLM call actually needs it."""
    global _client
    if not settings.gemini_api_key:
        raise RuntimeError("GEMINI_API_KEY is not configured")
    if _client is None:
        _client = genai.Client(api_key=settings.gemini_api_key)
    return _client


# ─── Text generation ──────────────────────────────────────────────────────────

def stream_llm(prompt: str) -> Generator[str, None, None]:
    """Stream tokens from Gemini Flash, with local fallback if API fails."""
    try:
        response = _get_client().models.generate_content_stream(
            model="gemini-2.0-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.2,
                top_p=0.95,
                max_output_tokens=2048,
                system_instruction=(
                    "You are a precise software engineering assistant specialising in "
                    "code analysis and debugging. Reference specific function names, "
                    "file paths, and line numbers when available. Be concise and accurate."
                ),
            ),
        )
        for chunk in response:
            if chunk.text:
                yield chunk.text
    except Exception as exc:
        logger.warning("Gemini generation failed: %s", exc)
        yield _generation_unavailable()


def call_llm(prompt: str) -> str:
    """Single-shot Gemini call, with local fallback if API fails."""
    try:
        response = _get_client().models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt,
        )
        return response.text
    except Exception as exc:
        logger.warning("Gemini generation failed: %s", exc)
        return _generation_unavailable()



# ─── Embeddings ─────────────────────────────────────────────────────────────

import hashlib
import math
import re

def local_hash_embed(text: str, dimension: int = 384) -> list[float]:
    """
    Generate a stable, normalized bag-of-words hash vector for a text.
    Runs locally in microseconds, zero dependencies, zero rate limits.
    """
    words = re.findall(r'[a-zA-Z_0-9]+', text.lower())
    vector = [0.0] * dimension
    if not words:
        return [0.0] * dimension
    for word in words:
        h = int(hashlib.md5(word.encode('utf-8')).hexdigest(), 16)
        index = h % dimension
        vector[index] += 1.0
    norm = math.sqrt(sum(x * x for x in vector))
    if norm > 0.0:
        vector = [x / norm for x in vector]
    return vector


def embed_texts(
    texts: list[str],
    task_type: str = "retrieval_document",
    max_retries: int = 5,
) -> list[list[float]]:
    """
    Embed a list of texts using the local hash embedding function.
    """
    logger.info("Using local hashing embedding function to embed %d texts", len(texts))
    return [local_hash_embed(t) for t in texts]


def embed_query(query: str) -> list[float]:
    """Embed a single query string using local hash embedding."""
    return local_hash_embed(query)
