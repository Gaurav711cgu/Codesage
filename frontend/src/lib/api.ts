/**
 * Typed API client — ALL backend calls go through here.
 * No component imports fetch directly.
 */

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ApiError {
  code: string;
  message: string;
}

export interface ApiResponse<T> {
  data: T | null;
  error: ApiError | null;
}

export interface IngestResponse {
  task_id: string;
  repo_id: string;
  status: string;
}

export interface TaskStatus {
  stage: string;
  current: number;
  total: number;
  status: "running" | "complete" | "failed";
}

export interface RepoStats {
  files: number;
  functions: number;
  classes: number;
  edges: number;
}

export interface Repo {
  id: string;
  name: string;
  github_url: string;
  status: string;
  stats: RepoStats | null;
  created_at: string;
}

export interface RetrievedChunk {
  name: string;
  file: string;
  lines: [number, number];
  type: "seed" | "neighbor";
  score: number;
}

export interface CodeIssue {
  severity: "critical" | "high" | "medium" | "low" | "info";
  line: number | null;
  description: string;
  suggestion: string;
}

export interface CodeReviewResult {
  overall_score: number;
  issues: CodeIssue[];
  strengths: string[];
  summary: string;
}

export interface DebugResult {
  probable_cause: string;
  root_location: string | null;
  execution_path: string[];
  fix: string;
  confidence: "high" | "medium" | "low";
  model_used: string;
}

export interface TestGenResult {
  test_code: string;
  test_count: number;
  cases: { type: string; name: string }[];
}

export interface BenchmarkData {
  fine_tuning: {
    model: string;
    training_samples: number;
    epochs: number | null;
    primary_metric: {
      name: string;
      base: number | null;
      finetuned: number | null;
      delta: number | null;
    };
    secondary_metric: {
      name: string;
      base: number | null;
      finetuned: number | null;
      delta: number | null;
      interpretation: string | null;
    };
    eval_date: string | null;
  };
  rag: {
    repobench: {
      naive_recall_at_10: number | null;
      graph_recall_at_10: number | null;
      delta: number | null;
    };
    internal: {
      single_function: CategoryResult;
      cross_file: CategoryResult;
      call_chain: CategoryResult;
    };
    eval_date: string | null;
  };
  ingestion: {
    avg_seconds_50k_loc: number | null;
    p95_seconds_50k_loc: number | null;
    test_repos: string[];
  };
  retrieval_latency: {
    naive_p50_ms: number | null;
    naive_p95_ms: number | null;
    graph_p50_ms: number | null;
    graph_p95_ms: number | null;
    measurement_queries: number;
  };
}

export interface CategoryResult {
  naive: number | null;
  graph: number | null;
  naive_ci: string | null;
  graph_ci: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function apiFetch<T>(
  path: string,
  init?: RequestInit
): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...init,
    });
    const json = await res.json();
    if (!res.ok && !json.error) {
      return {
        data: null,
        error: { code: String(res.status), message: res.statusText },
      };
    }
    return json as ApiResponse<T>;
  } catch (err: any) {
    return {
      data: null,
      error: { code: "NETWORK_ERROR", message: err.message },
    };
  }
}

// ─── Endpoints ────────────────────────────────────────────────────────────────

export const api = {
  /** Start ingestion of a GitHub repo */
  ingestRepo: (github_url: string, name?: string) =>
    apiFetch<IngestResponse>("/api/v1/repo/ingest", {
      method: "POST",
      body: JSON.stringify({ github_url, name }),
    }),

  /** Poll ingestion task status (SSE reconnect fallback) */
  getTaskStatus: (task_id: string) =>
    apiFetch<TaskStatus>(`/api/v1/repo/ingest/${task_id}/status`),

  /** List all indexed repos */
  listRepos: () => apiFetch<Repo[]>("/api/v1/repos"),

  /** Delete a repo */
  deleteRepo: (repo_id: string) =>
    fetch(`${BASE}/api/v1/repo/${repo_id}`, { method: "DELETE" }),

  /** Code review */
  reviewCode: (code: string, language = "python") =>
    apiFetch<CodeReviewResult>("/api/v1/code/review", {
      method: "POST",
      body: JSON.stringify({ code, language }),
    }),

  /** Debug code */
  debugCode: (
    code: string,
    error: string,
    language = "python",
    use_local_model = false
  ) =>
    apiFetch<DebugResult>("/api/v1/code/debug", {
      method: "POST",
      body: JSON.stringify({ code, error, language, use_local_model }),
    }),

  /** Generate tests */
  generateTests: (code: string, language = "python", framework = "pytest") =>
    apiFetch<TestGenResult>("/api/v1/code/tests", {
      method: "POST",
      body: JSON.stringify({ code, language, framework }),
    }),

  /** Get benchmark data */
  getBenchmarks: () => apiFetch<BenchmarkData>("/api/v1/benchmarks"),

  /** SSE progress URL (used by EventSource / subscribeToIngestion) */
  ingestProgressUrl: (task_id: string) =>
    `${BASE}/api/v1/repo/ingest/${task_id}/progress`,

  /** SSE query URL base (POST body handled separately via fetch streaming) */
  queryUrl: () => `${BASE}/api/v1/repo/query`,
};
