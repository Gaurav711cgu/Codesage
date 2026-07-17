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
    """Stream tokens from Gemini Flash, with local fallback if API fails."""
    try:
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
    except Exception as exc:
        import re
        logger.warning("Gemini generation failed, using local fallback synthesizer: %s", exc)
        # Parse the prompt to extract context symbols and the question
        context_matches = re.findall(r'\[(?:SEED|NEIGHBOR)\]\s+([a-zA-Z_0-9\.\/]+)\s+\(([^)]+)\)', prompt)
        question_match = re.search(r'=== Question ===\n(.*)', prompt, re.DOTALL)
        question = question_match.group(1).strip() if question_match else ""
        
        fallback_text = f"Local Synthesizer: Retrieved relevant context from repository files.\n"
        if context_matches:
            fallback_text += "Found matching symbols:\n"
            for symbol, file_info in context_matches:
                # Format: symbol could be function/class, file_info contains filepath and line range
                fallback_text += f"- Symbol `{symbol}` in file `{file_info}`\n"
            fallback_text += f"\nThese symbols match the query related to: {question}"
        else:
            fallback_text += f"No matching symbols were retrieved for the question: {question}"
            
        for word in fallback_text.split(" "):
            yield word + " "
            time.sleep(0.01)


def call_llm(prompt: str) -> str:
    """Single-shot Gemini call, with local fallback if API fails."""
    try:
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt,
        )
        return response.text
    except Exception as exc:
        import re
        logger.warning("Gemini generation failed, using local fallback synthesizer: %s", exc)
        context_matches = re.findall(r'\[(?:SEED|NEIGHBOR)\]\s+([a-zA-Z_0-9\.\/]+)\s+\(([^)]+)\)', prompt)
        question_match = re.search(r'=== Question ===\n(.*)', prompt, re.DOTALL)
        question = question_match.group(1).strip() if question_match else ""
        
        fallback_text = f"Local Synthesizer: Retrieved relevant context from repository files.\n"
        if context_matches:
            fallback_text += "Found matching symbols:\n"
            for symbol, file_info in context_matches:
                fallback_text += f"- Symbol `{symbol}` in file `{file_info}`\n"
            fallback_text += f"\nThese symbols match the query related to: {question}"
        else:
            fallback_text += f"No matching symbols were retrieved for the question: {question}"
        return fallback_text



# ─── Embeddings (Gemini) ───────────────────────────────────────────────────

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


    # --- Gemini Fallback ---
    logger.info("Using Gemini fallback to embed %d texts", len(texts))
    all_embeddings = []

    # Group texts into batches to stay under limits
    batches: list[list[str]] = []
    current_batch: list[str] = []
    current_batch_tokens = 0

    for text in texts:
        text_tokens = len(text) // 3
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

    for batch_idx, batch in enumerate(batches):
        for attempt in range(max_retries * 2):
            try:
                res = client.models.embed_content(
                    model="gemini-embedding-001",
                    contents=batch,
                )
                embeddings = [e.values for e in res.embeddings]
                all_embeddings.extend(embeddings)
                time.sleep(5.0)
                break
            except Exception as exc:
                if attempt == (max_retries * 2) - 1:
                    logger.error("Gemini fallback embedding failed: %s", exc)
                    raise
                wait = 6 + (2 ** attempt)
                time.sleep(wait)

    return all_embeddings


def embed_query(query: str) -> list[float]:
    """Embed a single query string using local hash embedding."""
    return local_hash_embed(query)



