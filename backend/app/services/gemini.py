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


def call_llm(prompt: str) -> str:
    """Single-shot Gemini call, returns full response text."""
    response = client.models.generate_content(
        model="gemini-2.0-flash",
        contents=prompt,
    )
    return response.text


# ─── Embeddings (Gemini) ───────────────────────────────────────────────────

def embed_texts(
    texts: list[str],
    task_type: str = "retrieval_document",
    max_retries: int = 5,
) -> list[list[float]]:
    """
    Embed a list of texts using Google Gemini gemini-embedding-001.
    Batches dynamically to stay under TPM (20k tokens) and RPM (15 RPM) limits.
    Returns a flat list of embedding vectors.
    """
    all_embeddings: list[list[float]] = []

    # Group texts into batches to stay under:
    # 1. Max 20 items per batch
    # 2. Max 12,000 estimated tokens (char count / 3)
    batches: list[list[str]] = []
    current_batch: list[str] = []
    current_batch_tokens = 0

    for text in texts:
        text_tokens = len(text) // 3
        # Truncate extremely large files to prevent exceeding TPM alone
        if text_tokens > 10000:
            text = text[:30000]
            text_tokens = len(text) // 3

        if len(current_batch) >= 20 or (current_batch_tokens + text_tokens) > 12000:
            if current_batch:
                batches.append(current_batch)
            current_batch = [text]
            current_batch_tokens = text_tokens
        else:
            current_batch.append(text)
            current_batch_tokens += text_tokens

    if current_batch:
        batches.append(current_batch)

    logger.info("Generated %d batches for %d texts", len(batches), len(texts))

    for batch_idx, batch in enumerate(batches):
        for attempt in range(max_retries * 2):  # up to 10 retries
            try:
                res = client.models.embed_content(
                    model="gemini-embedding-001",
                    contents=batch,
                )
                embeddings = [e.values for e in res.embeddings]
                all_embeddings.extend(embeddings)
                # Sleep to respect rate limits (15 RPM)
                time.sleep(5.0)
                break
            except Exception as exc:
                if attempt == (max_retries * 2) - 1:
                    logger.error(
                        "Gemini Embedding batch %d failed after %d retries: %s",
                        batch_idx,
                        max_retries * 2,
                        exc,
                    )
                    raise
                
                wait = 6 + (2 ** attempt)
                logger.warning(
                    "Gemini Embedding failed for batch %d/%d (attempt %d/%d), retrying in %ds…: %s",
                    batch_idx + 1,
                    len(batches),
                    attempt + 1,
                    max_retries * 2,
                    wait,
                    exc
                )
                time.sleep(wait)

    return all_embeddings


def embed_query(query: str) -> list[float]:
    """Embed a single query string using Google Gemini gemini-embedding-001."""
    res = client.models.embed_content(
        model="gemini-embedding-001",
        contents=[query],
    )
    return res.embeddings[0].values
