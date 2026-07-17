import uuid
from datetime import datetime
from typing import Any, Literal
from pydantic import BaseModel, Field, HttpUrl, field_validator


# ─── Generic response envelope ───────────────────────────────────────────────

class ErrorDetail(BaseModel):
    code: str
    message: str


class ApiResponse(BaseModel):
    data: Any = None
    error: ErrorDetail | None = None


# ─── Repo / Ingestion ─────────────────────────────────────────────────────────

class IngestRequest(BaseModel):
    github_url: str
    name: str | None = None

    @field_validator("github_url")
    @classmethod
    def validate_github_url(cls, v: str) -> str:
        import re
        pattern = r"^https://github\.com/[\w.\-]+/[\w.\-]+/?$"
        if not re.match(pattern, v):
            raise ValueError("URL must match https://github.com/owner/repo")
        return v.rstrip("/")


class IngestResponse(BaseModel):
    task_id: uuid.UUID
    repo_id: uuid.UUID
    status: str


class TaskStatusResponse(BaseModel):
    stage: str
    current: int
    total: int
    status: Literal["running", "complete", "failed"]


class RepoStats(BaseModel):
    files: int = 0
    functions: int = 0
    classes: int = 0
    edges: int = 0


class RepoSummary(BaseModel):
    id: uuid.UUID
    name: str
    github_url: str
    status: str
    stats: RepoStats | None = None
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Query ────────────────────────────────────────────────────────────────────

class QueryRequest(BaseModel):
    repo_id: uuid.UUID
    query: str
    retrieval_mode: Literal["naive", "graph"] = "graph"


class RetrievedChunk(BaseModel):
    name: str
    file: str
    lines: list[int]
    type: Literal["seed", "neighbor"]
    score: float
    content: str = Field(default="", exclude=True)


class RetrievalDoneEvent(BaseModel):
    chunks: list[RetrievedChunk]
    latency_ms: int


# ─── Code endpoints ───────────────────────────────────────────────────────────

class CodeReviewRequest(BaseModel):
    code: str
    language: Literal["python", "javascript", "typescript"] = "python"

    @field_validator("code")
    @classmethod
    def check_length(cls, v: str) -> str:
        if len(v) > 10000:
            raise ValueError("Code exceeds 10,000 character limit")
        return v


class CodeIssue(BaseModel):
    severity: Literal["critical", "high", "medium", "low", "info"]
    line: int | None = None
    description: str
    suggestion: str


class CodeReviewResponse(BaseModel):
    overall_score: int
    issues: list[CodeIssue]
    strengths: list[str]
    summary: str


class DebugRequest(BaseModel):
    code: str
    error: str
    language: Literal["python", "javascript", "typescript"] = "python"
    use_local_model: bool = False


class DebugResponse(BaseModel):
    probable_cause: str
    root_location: str | None = None
    execution_path: list[str]
    fix: str
    confidence: Literal["high", "medium", "low"]
    model_used: str


class TestGenRequest(BaseModel):
    code: str
    language: Literal["python", "javascript", "typescript"] = "python"
    framework: Literal["pytest", "unittest"] = "pytest"


class TestCase(BaseModel):
    type: Literal["happy_path", "edge_case", "error_case"]
    name: str


class TestGenResponse(BaseModel):
    test_code: str
    test_count: int
    cases: list[TestCase]


# ─── Messages ─────────────────────────────────────────────────────────────────

class MessageCreate(BaseModel):
    repo_id: uuid.UUID | None = None
    session_id: str
    role: Literal["user", "assistant"]
    content: str
    retrieval_mode: Literal["naive", "graph"] | None = None
    retrieval_meta: dict | None = None
    model_used: str | None = None
