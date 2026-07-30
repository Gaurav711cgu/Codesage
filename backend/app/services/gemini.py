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

from app.services.embedder import embed_query, embed_texts, local_hash_embed  # noqa: F401

