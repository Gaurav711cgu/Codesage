"""
Structured JSON Output Engine with Strict Pydantic Validation & Automatic Self-Correction.

Guarantees schema compliance by:
1. Injecting strict Pydantic JSON schemas into system instructions.
2. Parsing and strictly validating model output against Pydantic models.
3. Automatically executing iterative error-correction loops with specific schema violation feedback on failures.
"""
from __future__ import annotations

import json
import logging
import re
from typing import Any, Callable, Literal, Optional, Type, TypeVar
from pydantic import BaseModel, Field, ValidationError

from app.services.gemini import call_llm

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)


class SchemaValidationError(Exception):
    """Raised when an LLM fails to produce schema-valid JSON after max retry attempts."""
    def __init__(self, message: str, raw_output: str = "", errors: Optional[list] = None) -> None:
        super().__init__(message)
        self.raw_output = raw_output
        self.errors = errors or []


# ─── Additional Pydantic Schemas for Code Intelligence ───────────────────────

class ASTRefactoringSuggestion(BaseModel):
    """Structured AST refactoring recommendation."""
    rule_id: str = Field(description="Unique identifier for refactoring rule, e.g. REFACTOR_EXTRACT_METHOD")
    file: str = Field(description="Target file relative path")
    target_symbol: str = Field(description="Class or function being refactored")
    refactoring_type: Literal[
        "extract_function",
        "simplify_boolean",
        "decompose_conditional",
        "rename_symbol",
        "remove_dead_code",
    ]
    description: str = Field(description="Technical rationale for the refactoring")
    suggested_diff: str = Field(description="Unified diff format patch")
    safety_verdict: Literal["safe", "review_required", "unsafe"] = Field(
        description="Automated safety classification"
    )


class ASTNodeSummary(BaseModel):
    """Structured AST node analysis."""
    node_name: str
    node_type: str
    complexity_score: int = Field(ge=1, le=100)
    dependencies: list[str] = Field(default_factory=list)
    summary: str


# ─── JSON Extraction ─────────────────────────────────────────────────────────

def extract_json_payload(text: str) -> dict[str, Any] | list[Any]:
    """
    Extract a valid JSON object or array from LLM responses that may be wrapped
    in markdown code fences, thought traces, or surrounding text.
    """
    # 1. Check for standard markdown fences ```json ... ``` or ``` ... ```
    fence_pattern = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
    if fence_pattern:
        candidate = fence_pattern.group(1).strip()
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            pass

    # 2. Match outermost JSON object {...}
    brace_match = re.search(r"\{[\s\S]*\}", text)
    if brace_match:
        try:
            return json.loads(brace_match.group(0))
        except json.JSONDecodeError:
            pass

    # 3. Match outermost JSON array [...]
    bracket_match = re.search(r"\[[\s\S]*\]", text)
    if bracket_match:
        try:
            return json.loads(bracket_match.group(0))
        except json.JSONDecodeError:
            pass

    raise ValueError(f"No valid JSON object or array found in text: {text[:200]}")


# ─── Structured Output Engine with Auto-Correction ──────────────────────────

def call_llm_structured(
    prompt: str,
    response_model: Type[T],
    max_retries: int = 3,
    llm_caller: Callable[[str], str] = call_llm,
) -> T:
    """
    Execute an LLM call enforcing strict Pydantic response_model schema compliance.
    If parsing or schema validation fails, automatically sends a corrective repair prompt
    detailing the exact validation violations up to max_retries times.
    """
    schema_json = json.dumps(response_model.model_json_schema(), indent=2)
    augmented_prompt = (
        f"{prompt}\n\n"
        f"CRITICAL REQUIREMENT: Output MUST be valid JSON adhering strictly to this JSON Schema:\n"
        f"```json\n{schema_json}\n```\n"
        f"Output ONLY the JSON object. Do not include introductory or concluding conversational prose."
    )

    current_prompt = augmented_prompt
    last_error: Optional[Exception] = None
    last_raw: str = ""

    for attempt in range(1, max_retries + 1):
        try:
            raw_output = llm_caller(current_prompt)
            last_raw = raw_output

            # Extract JSON and validate against Pydantic model
            parsed_data = extract_json_payload(raw_output)
            validated_model = response_model.model_validate(parsed_data)
            logger.info("Structured JSON output validated on attempt %d for %s", attempt, response_model.__name__)
            return validated_model

        except (json.JSONDecodeError, ValueError, ValidationError) as exc:
            last_error = exc
            logger.warning(
                "Structured output validation failed on attempt %d/%d for %s: %s",
                attempt,
                max_retries,
                response_model.__name__,
                exc,
            )

            if attempt < max_retries:
                error_details = str(exc)
                if isinstance(exc, ValidationError):
                    error_details = json.dumps(exc.errors(), indent=2)

                # Formulate corrective self-repair prompt
                current_prompt = (
                    f"Your previous JSON response violated the required schema for {response_model.__name__}.\n\n"
                    f"Validation errors encountered:\n{error_details}\n\n"
                    f"Previous invalid output:\n```\n{last_raw[:1500]}\n```\n\n"
                    f"Target JSON Schema:\n```json\n{schema_json}\n```\n\n"
                    f"Please correct all reported violations and return ONLY valid JSON matching the schema."
                )

    raise SchemaValidationError(
        f"Failed to produce valid {response_model.__name__} after {max_retries} attempts: {last_error}",
        raw_output=last_raw,
    )
