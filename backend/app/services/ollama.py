"""
Ollama client for the fine-tuned codesagez-coder model.
Falls back to Gemini transparently when Ollama is not running or disabled.
"""
import logging

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

_OLLAMA_GENERATE_URL = "{base}/api/generate"
_TIMEOUT = httpx.Timeout(120.0, connect=5.0)


def _is_ollama_available() -> bool:
    """Quick liveness check — tries the Ollama /api/tags endpoint."""
    if not settings.ollama_enabled:
        return False
    try:
        resp = httpx.get(
            f"{settings.ollama_url}/api/tags", timeout=httpx.Timeout(3.0)
        )
        return resp.status_code == 200
    except Exception:
        return False


def generate_with_local_model(prompt: str) -> tuple[str, str]:
    """
    Generate text using the fine-tuned Ollama model.

    Returns:
        (response_text, model_name_used)
        Falls back to Gemini if Ollama is unavailable.
    """
    if not _is_ollama_available():
        logger.info("Ollama unavailable — falling back to Gemini for generation")
        from app.services.gemini import call_llm  # lazy import avoids circular
        return call_llm(prompt), "gemini-2.0-flash"

    url = _OLLAMA_GENERATE_URL.format(base=settings.ollama_url)
    payload = {
        "model": settings.ollama_model,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": 0.2,
            "top_p": 0.95,
            "num_predict": 512,
        },
    }
    try:
        resp = httpx.post(url, json=payload, timeout=_TIMEOUT)
        resp.raise_for_status()
        return resp.json()["response"], settings.ollama_model
    except Exception as exc:
        logger.warning(
            "Ollama request failed (%s) — falling back to Gemini", exc
        )
        from app.services.gemini import call_llm
        return call_llm(prompt), "gemini-2.0-flash"


def is_available() -> bool:
    """Public accessor so API routes can check Ollama status."""
    return _is_ollama_available()
