"""
Code endpoints:
  POST /api/v1/code/review   — structured review with issues + score
  POST /api/v1/code/debug    — bug explanation + fix (local model or Gemini)
  POST /api/v1/code/tests    — generate pytest / unittest test suite
"""
import asyncio
import json
import logging
import re

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse

from app.models.schemas import (
    ApiResponse,
    CodeIssue,
    CodeReviewRequest,
    CodeReviewResponse,
    DebugRequest,
    DebugResponse,
    TestCase,
    TestGenRequest,
    TestGenResponse,
)
from app.services.gemini import call_llm, stream_llm
from app.services.structured_output import call_llm_structured
from app.core.prompt_defense import prompt_defense
from app.services import ollama as ollama_svc
from app.core.rate_limit import limiter
from app.core.config import settings

logger = logging.getLogger(__name__)
router = APIRouter(tags=["code"])


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _err(code: str, message: str, status: int = 400):
    raise HTTPException(
        status_code=status,
        detail={"data": None, "error": {"code": code, "message": message}},
    )


def _extract_json(text: str) -> dict:
    """
    Attempt to extract a JSON object from a Gemini response that may include
    markdown fences or surrounding prose.
    """
    # Try stripping markdown fences first
    fence_match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if fence_match:
        return json.loads(fence_match.group(1))
    # Fallback: find outermost { ... }
    brace_match = re.search(r"\{.*\}", text, re.DOTALL)
    if brace_match:
        return json.loads(brace_match.group(0))
    raise ValueError(f"No JSON object found in response: {text[:200]}")


# ─── POST /api/v1/code/review ────────────────────────────────────────────────


from app.prompts.code_prompts import CODE_REVIEW_PROMPT_V1

@router.post("/code/review", response_model=ApiResponse)
@limiter.limit("20/minute")
async def review_code(request: Request, body: CodeReviewRequest):
    assessment = prompt_defense.detect_adversarial_patterns(body.code)
    sanitized_code = prompt_defense.sanitize_delimiters(body.code)
    prompt = CODE_REVIEW_PROMPT_V1.format(language=body.language, code=sanitized_code)

    try:
        response = await asyncio.to_thread(call_llm_structured, prompt, CodeReviewResponse)
    except Exception as exc:
        logger.warning("Structured review validation failed, using fallback parsing: %s", exc)
        raw = await asyncio.to_thread(call_llm, prompt)
        try:
            parsed = _extract_json(raw)
            issues = [CodeIssue(**i) for i in parsed.get("issues", [])]
            response = CodeReviewResponse(
                overall_score=int(parsed.get("overall_score", 50)),
                issues=issues,
                strengths=parsed.get("strengths", []),
                summary=parsed.get("summary", ""),
            )
        except Exception:
            response = CodeReviewResponse(
                overall_score=50,
                issues=[],
                strengths=[],
                summary=raw[:1000],
            )

    if not assessment.is_safe:
        response.issues.insert(
            0,
            CodeIssue(
                severity="critical",
                description=f"Potential prompt injection detected: {', '.join(assessment.detected_patterns)}",
                suggestion="Sanitize untrusted docstrings and comments before passing to LLM context.",
            ),
        )

    return {"data": response.model_dump(), "error": None}


@router.post("/code/review/stream")
@limiter.limit("20/minute")
async def review_code_stream(request: Request, body: CodeReviewRequest):
    prompt = f"""Perform a code review of the following {body.language} code.
Provide your analysis in Markdown format, highlighting any issues with their severity, and suggesting improvements.

Code to review:
```{body.language}
{body.code}
```"""
    return StreamingResponse(stream_llm(prompt), media_type="text/event-stream")


# ─── POST /api/v1/code/debug ─────────────────────────────────────────────────


from app.prompts.code_prompts import CODE_DEBUG_PROMPT_V1, CODE_DEBUG_FIX_PROMPT_V1

@router.post("/code/debug", response_model=ApiResponse)
@limiter.limit("20/minute")
async def debug_code(request: Request, body: DebugRequest):
    if len(body.code) > 10000:
        _err("CODE_TOO_LONG", "Code exceeds 10,000 character limit")

    fix_prompt = CODE_DEBUG_FIX_PROMPT_V1.format(
        language=body.language, code=body.code, error=body.error
    )
    explanation_prompt = CODE_DEBUG_PROMPT_V1.format(
        language=body.language, code=body.code, error=body.error
    )

    # Get fix from local model or Gemini
    if body.use_local_model:
        fix_text, _ = await asyncio.to_thread(ollama_svc.generate_with_local_model, fix_prompt)
    else:
        fix_text = await asyncio.to_thread(call_llm, fix_prompt)
        
    model_used = settings.ollama_model if body.use_local_model else "gemini-2.0-flash"

    # Always use Gemini for the structured explanation
    explanation_raw = await asyncio.to_thread(call_llm, explanation_prompt)
    try:
        parsed = _extract_json(explanation_raw)
    except Exception:
        parsed = {
            "probable_cause": explanation_raw[:500],
            "root_location": None,
            "execution_path": [],
            "confidence": "low",
        }

    response = DebugResponse(
        probable_cause=parsed.get("probable_cause", ""),
        root_location=parsed.get("root_location"),
        execution_path=parsed.get("execution_path", []),
        fix=fix_text.strip(),
        confidence=parsed.get("confidence", "medium"),  # type: ignore[arg-type]
        model_used=model_used,
    )
    return {"data": response.model_dump(), "error": None}


@router.post("/code/debug/stream")
@limiter.limit("20/minute")
async def debug_code_stream(request: Request, body: DebugRequest):
    if len(body.code) > 10000:
        _err("CODE_TOO_LONG", "Code exceeds 10,000 character limit")

    prompt = f"""Analyze this {body.language} bug and provide a fix in Markdown format.

Error: {body.error}

Code:
```{body.language}
{body.code}
```"""
    if body.use_local_model:
        # Local model single-shot response streamed as a single SSE event
        fix_text, _ = ollama_svc.generate_with_local_model(prompt)
        async def single_shot_stream():
            yield fix_text
        return StreamingResponse(single_shot_stream(), media_type="text/event-stream")
    else:
        return StreamingResponse(stream_llm(prompt), media_type="text/event-stream")


# ─── POST /api/v1/code/tests ─────────────────────────────────────────────────


from app.prompts.code_prompts import TEST_GEN_PROMPT_V1

@router.post("/code/tests", response_model=ApiResponse)
@limiter.limit("20/minute")
async def generate_tests(request: Request, body: TestGenRequest):
    if len(body.code) > 10000:
        _err("CODE_TOO_LONG", "Code exceeds 10,000 character limit")

    sanitized_code = prompt_defense.sanitize_delimiters(body.code)
    prompt = TEST_GEN_PROMPT_V1.format(
        language=body.language,
        framework=body.framework,
        code=sanitized_code,
    )

    try:
        response = await asyncio.to_thread(call_llm_structured, prompt, TestGenResponse)
    except Exception as exc:
        logger.warning("Structured test gen validation failed, using fallback parsing: %s", exc)
        raw = await asyncio.to_thread(call_llm, prompt)
        try:
            parsed = _extract_json(raw)
            cases = [TestCase(**c) for c in parsed.get("cases", [])]
            response = TestGenResponse(
                test_code=parsed.get("test_code", ""),
                test_count=int(parsed.get("test_count", len(cases))),
                cases=cases,
            )
        except Exception:
            response = TestGenResponse(
                test_code=raw,
                test_count=0,
                cases=[],
            )

    return {"data": response.model_dump(), "error": None}
