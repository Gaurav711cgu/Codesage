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


# ─── Embeddings (Voyage AI) ───────────────────────────────────────────────────

import httpx

def embed_texts(
    texts: list[str],
    task_type: str = "retrieval_document",
    max_retries: int = 5,
) -> list[list[float]]:
    """
    Embed a list of texts using Voyage AI voyage-code-2.
    Batches in groups of 100. Retries with exponential backoff.
    Returns a flat list of 1024-dim embedding vectors, one per input text.
    """
    if not settings.voyage_api_key:
        raise ValueError("VOYAGE_API_KEY is missing from environment variables.")

    input_type = "document" if "document" in task_type else "query"
    url = "https://api.voyageai.com/v1/embeddings"
    headers = {
        "Authorization": f"Bearer {settings.voyage_api_key}",
        "Content-Type": "application/json"
    }
    
    all_embeddings: list[list[float]] = []

    for batch_start in range(0, len(texts), 100):
        batch = texts[batch_start : batch_start + 100]
        for attempt in range(max_retries):
            try:
                resp = httpx.post(url, headers=headers, json={
                    "input": batch,
                    "model": "voyage-code-2",
                    "input_type": input_type
                }, timeout=60.0)
                resp.raise_for_status()
                data = resp.json()["data"]
                # Ensure they are in original order by sorting by index
                data.sort(key=lambda x: x["index"])
                embeddings = [item["embedding"] for item in data]
                all_embeddings.extend(embeddings)
                break
            except Exception as exc:
                if attempt == max_retries - 1:
                    logger.error(
                        "Voyage Embedding batch %d failed after %d retries: %s",
                        batch_start // 100,
                        max_retries,
                        exc,
                    )
                    raise
                wait = 2 ** attempt
                logger.warning(
                    "Voyage Embedding failed (attempt %d/%d), retrying in %ds…",
                    attempt + 1,
                    max_retries,
                    wait,
                )
                time.sleep(wait)

    return all_embeddings


def embed_query(query: str) -> list[float]:
    """Embed a single query string using Voyage AI."""
    if not settings.voyage_api_key:
        raise ValueError("VOYAGE_API_KEY is missing from environment variables.")
        
    url = "https://api.voyageai.com/v1/embeddings"
    headers = {
        "Authorization": f"Bearer {settings.voyage_api_key}",
        "Content-Type": "application/json"
    }
    resp = httpx.post(url, headers=headers, json={
        "input": [query],
        "model": "voyage-code-2",
        "input_type": "query"
    }, timeout=30.0)
    resp.raise_for_status()
    return resp.json()["data"][0]["embedding"]
