import json
import pytest
from app.prompts.code_prompts import CODE_DEBUG_PROMPT_V1, TEST_GEN_PROMPT_V1

def test_code_debug_prompt_v1_structure():
    """
    Validates that the debugging prompt formats correctly and requests
    the exact required JSON keys for the frontend to render the debug UI.
    """
    formatted = CODE_DEBUG_PROMPT_V1.format(
        language="python",
        error="IndexError: list index out of range",
        code="def get_last(items):\n    return items[len(items)]"
    )
    
    assert "Analyze this python bug" in formatted
    assert "IndexError: list index out of range" in formatted
    assert "def get_last(items)" in formatted
    
    # Ensure the prompt explicitly asks for all required schema keys
    assert "probable_cause" in formatted
    assert "root_location" in formatted
    assert "execution_path" in formatted
    assert "confidence" in formatted

def test_test_gen_prompt_v1_structure():
    """
    Validates that the test generation prompt requests the exact JSON 
    structure expected by the test cases parser.
    """
    formatted = TEST_GEN_PROMPT_V1.format(
        language="typescript",
        framework="jest",
        code="function add(a, b) { return a + b; }"
    )
    
    assert "Generate jest test cases for the following typescript code" in formatted
    assert "test_code" in formatted
    assert "test_count" in formatted
    assert "cases" in formatted
    assert "happy_path|edge_case|error_case" in formatted
