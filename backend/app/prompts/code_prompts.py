"""
Centralized prompt registry for LLMOps and versioning.
Decouples prompt engineering from business logic.
"""

CODE_REVIEW_PROMPT_V1 = """Perform a code review of the following {language} code.

Return your analysis as a single JSON object with this exact structure:
{{
  "overall_score": <integer 0-100>,
  "issues": [
    {{
      "severity": "<critical|high|medium|low|info>",
      "line": <integer or null>,
      "description": "<concise description of the issue>",
      "suggestion": "<specific actionable suggestion>"
    }}
  ],
  "strengths": ["<strength 1>", "<strength 2>"],
  "summary": "<2-3 sentence overall summary>"
}}

Rules:
- overall_score reflects overall quality (100 = perfect, 0 = unrunnable)
- List at most 10 issues, sorted by severity descending
- List at most 5 strengths
- Return only the JSON object, no markdown fences, no other text

Code to review:
```{language}
{code}
```"""

CODE_DEBUG_FIX_PROMPT_V1 = """### Task: Fix the bug described by the error message.

### Error:
{error}

### Buggy {language} code:
```{language}
{code}
```

### Fixed code:
```{language}
"""

CODE_DEBUG_PROMPT_V1 = """Analyze this {language} bug and return a JSON object:
{{
  "probable_cause": "<1-2 sentence root cause explanation>",
  "root_location": "<file:line or function name if determinable, else null>",
  "execution_path": ["<step 1>", "<step 2>", "..."],
  "confidence": "<high|medium|low>"
}}

Error: {error}

Code:
```{language}
{code}
```

Return only the JSON object."""

TEST_GEN_PROMPT_V1 = """Generate {framework} test cases for the following {language} code.
Ensure edge cases are covered.

Framework note: Use pytest with plain assert statements if framework is pytest, else use unittest.TestCase with self.assert* methods.

Rules:
- Do NOT invent imports that are not in the original code or standard library
- Cover: happy path, edge cases, and error/exception cases
- Each test function name must start with test_

Return a JSON object with this exact structure:
{{
  "test_code": "<complete test file as a string>",
  "test_count": <integer>,
  "cases": [
    {{"type": "<happy_path|edge_case|error_case>", "name": "<test_function_name>"}}
  ]
}}

Return only the JSON object, no markdown fences.

Code to test:
```{language}
{code}
```"""
