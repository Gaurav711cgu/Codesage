"""
Single point of contact for all Google AI calls.
No other module imports google.genai directly.
"""
import logging
import time
from typing import Generator

from google import genai
from google.genai import types

from app.core.config import settings

logger = logging.getLogger(__name__)

client = genai.Client(api_key=settings.gemini_api_key)


# ─── Text generation ──────────────────────────────────────────────────────────

def stream_llm(prompt: str) -> Generator[str, None, None]:
    """Stream tokens from Gemini Flash."""
    response = client.models.generate_content_stream(
        model="gemini-2.5-flash",
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


def call_llm(prompt: str) -> str:
    """Single-shot Gemini call, returns full response text."""
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
    )
    return response.text


# ─── Embeddings ───────────────────────────────────────────────────────────────

def embed_texts(
    texts: list[str],
    task_type: str = "retrieval_document",
    max_retries: int = 5,
) -> list[list[float]]:
    """
    Embed a list of texts using text-embedding-004.
    Batches in groups of 100 (API limit). Retries with exponential backoff.
    Returns a flat list of 768-dim embedding vectors, one per input text.
    """
    all_embeddings: list[list[float]] = []

    for batch_start in range(0, len(texts), 100):
        batch = texts[batch_start : batch_start + 100]
        for attempt in range(max_retries):
            try:
                result = client.models.embed_content(
                    model="models/text-embedding-004",
                    contents=batch,
                    config=types.EmbedContentConfig(task_type=task_type),
                )
                embeddings = [e.values for e in result.embeddings]
                all_embeddings.extend(embeddings)
                break
            except Exception as exc:
                if attempt == max_retries - 1:
                    logger.error(
                        "Embedding batch %d failed after %d retries: %s",
                        batch_start // 100,
                        max_retries,
                        exc,
                    )
                    raise
                # Wait longer to handle the 100 requests per minute free tier limit
                wait = min(65, 4 ** attempt + 5)
                logger.warning(
                    "Embedding rate-limited (attempt %d/%d), retrying in %ds…",
                    attempt + 1,
                    max_retries,
                    wait,
                )
                time.sleep(wait)

    return all_embeddings


def embed_query(query: str) -> list[float]:
    """Embed a single query string with the retrieval_query task type."""
    result = client.models.embed_content(
        model="models/text-embedding-004",
        contents=query,
        config=types.EmbedContentConfig(task_type="retrieval_query"),
    )
    return result.embeddings[0].values
