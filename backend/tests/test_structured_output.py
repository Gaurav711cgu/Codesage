"""
Tests for Structured JSON Output Engine with Strict Pydantic Validation & Auto-Correction.
"""
import json
import pytest
from pydantic import BaseModel, Field

from app.models.schemas import CodeIssue, CodeReviewResponse
from app.services.structured_output import (
    ASTRefactoringSuggestion,
    SchemaValidationError,
    call_llm_structured,
    extract_json_payload,
)


class SampleModel(BaseModel):
    name: str
    count: int
    tags: list[str] = Field(default_factory=list)


def test_extract_json_from_markdown_fences():
    text = """
    Here is your requested output:
    ```json
    {
      "name": "sample_service",
      "count": 42,
      "tags": ["core", "backend"]
    }
    ```
    Hope this helps!
    """
    data = extract_json_payload(text)
    assert isinstance(data, dict)
    assert data["name"] == "sample_service"
    assert data["count"] == 42


def test_extract_json_from_raw_braces():
    text = 'Some chatter {"name": "bare", "count": 10} trailing notes.'
    data = extract_json_payload(text)
    assert isinstance(data, dict)
    assert data["name"] == "bare"
    assert data["count"] == 10


def test_call_llm_structured_success_first_attempt():
    def mock_llm_caller(prompt: str) -> str:
        return json.dumps({"name": "fastapi_app", "count": 5, "tags": ["api"]})

    result = call_llm_structured(
        "Generate app metadata",
        SampleModel,
        llm_caller=mock_llm_caller,
    )
    assert isinstance(result, SampleModel)
    assert result.name == "fastapi_app"
    assert result.count == 5


def test_call_llm_structured_auto_repair_on_validation_error():
    call_count = 0

    def mock_llm_caller(prompt: str) -> str:
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            # First attempt returns invalid schema (count is non-numeric string, missing tags)
            return '{"name": "broken_call", "count": "not_a_number"}'
        # Second attempt (after corrective repair prompt) returns valid JSON
        assert "Validation errors encountered:" in prompt
        return '{"name": "repaired_call", "count": 12, "tags": ["repaired"]}'

    result = call_llm_structured(
        "Generate app metadata",
        SampleModel,
        max_retries=3,
        llm_caller=mock_llm_caller,
    )
    assert call_count == 2
    assert result.name == "repaired_call"
    assert result.count == 12
    assert result.tags == ["repaired"]


def test_call_llm_structured_max_retries_exceeded_raises():
    def mock_failing_llm(prompt: str) -> str:
        return "I refuse to provide valid json."

    with pytest.raises(SchemaValidationError) as excinfo:
        call_llm_structured(
            "Generate app metadata",
            SampleModel,
            max_retries=2,
            llm_caller=mock_failing_llm,
        )
    assert "Failed to produce valid SampleModel after 2 attempts" in str(excinfo.value)


def test_ast_refactoring_suggestion_model_validation():
    suggestion = ASTRefactoringSuggestion(
        rule_id="REFACTOR_EXTRACT_METHOD",
        file="app/services/ingestion.py",
        target_symbol="run_ingestion",
        refactoring_type="extract_function",
        description="Decompose 200-line monolithic function into separate stage handlers.",
        suggested_diff="--- a/ingestion.py\n+++ b/ingestion.py\n@@ -1,5 +1,5 @@",
        safety_verdict="safe",
    )
    assert suggestion.refactoring_type == "extract_function"
    assert suggestion.safety_verdict == "safe"
