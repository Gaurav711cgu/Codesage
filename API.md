# CodeSageZ API Reference

The CodeSageZ API is a RESTful interface built with FastAPI. It provides endpoints for repository ingestion, graph-augmented retrieval, and model benchmarking.

## Base URL

In development: `http://localhost:8000/api/v1`

---

## Authentication

Authentication is handled via Bearer token (API Key).

**Header:**
`Authorization: Bearer <YOUR_API_KEY>`

*Note: In development, the default bypass is often enabled unless strict mode is configured in `.env`.*

---

## 1. Repositories

### `POST /repos/`
Ingest and analyze a new GitHub repository.

**Request Body:**
```json
{
  "url": "https://github.com/example/repo",
  "branch": "main",
  "name": "example-repo"
}
```

**Response:**
```json
{
  "repo_id": "uuid-string",
  "status": "processing",
  "message": "Repository ingestion started."
}
```
*Note: This triggers an asynchronous background task that handles cloning, AST parsing, Graph construction, and Vector embedding.*

---

### `GET /repos/`
List all ingested repositories.

**Response:**
```json
[
  {
    "id": "uuid-string",
    "name": "example-repo",
    "url": "https://github.com/example/repo",
    "status": "completed",
    "created_at": "2026-09-12T10:00:00Z"
  }
]
```

---

## 2. Code Query & Retrieval

### `POST /code/query`
Ask a natural language question about an ingested repository. The system uses Hybrid Graph-RAG to synthesize an answer.

**Request Body:**
```json
{
  "repo_id": "uuid-string",
  "query": "How does the authentication middleware work?",
  "use_graph": true
}
```

**Response:**
```json
{
  "answer": "The authentication middleware uses a JWT validation strategy located in `core/auth.py`...",
  "context_nodes": [
    {
      "type": "function",
      "name": "verify_token",
      "file": "core/auth.py"
    }
  ],
  "latency_ms": 142
}
```

---

## 3. Benchmarks

### `POST /benchmarks/run`
Trigger a CodeBLEU and semantic similarity benchmark suite on the retrieval engine.

**Request Body:**
```json
{
  "dataset_path": "./data/eval_dataset.jsonl",
  "model": "gemini-1.5-pro"
}
```

**Response:**
```json
{
  "benchmark_id": "uuid-string",
  "status": "running"
}
```

### `GET /benchmarks/{benchmark_id}`
Retrieve the results of a benchmark run.

**Response:**
```json
{
  "benchmark_id": "uuid-string",
  "status": "completed",
  "results": {
    "codebleu_score": 0.89,
    "semantic_similarity": 0.92,
    "avg_latency_ms": 250
  }
}
```

---

## Error Handling

The API uses standard HTTP status codes:
- `200 OK`: Success
- `202 Accepted`: Asynchronous task started
- `400 Bad Request`: Invalid input or configuration
- `401 Unauthorized`: Invalid or missing API key
- `404 Not Found`: Resource (e.g., repo_id) does not exist
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server-side processing failure

Errors return a standardized JSON format:
```json
{
  "detail": "Descriptive error message"
}
```
