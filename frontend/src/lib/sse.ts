/**
 * SSE subscription utilities.
 *
 * Two patterns:
 *   1. subscribeToIngestion — EventSource-based (GET endpoint)
 *   2. streamQuery          — fetch-streaming-based (POST endpoint)
 *
 * Both handle reconnection / error gracefully per PRD §10.
 */

import { api, RetrievedChunk } from "./api";

// ─── Ingestion progress SSE ───────────────────────────────────────────────────

export interface IngestionProgressEvent {
  stage: string;
  current: number;
  total: number;
  message?: string;
}

export interface IngestionCompleteEvent {
  repo_id: string;
  stats: {
    files: number;
    functions: number;
    classes: number;
    edges: number;
  };
}

export interface IngestionHandlers {
  onProgress: (e: IngestionProgressEvent) => void;
  onComplete: (e: IngestionCompleteEvent) => void;
  onError: (msg: string) => void;
}

/**
 * Subscribe to ingestion progress via SSE.
 * Falls back to polling on SSE error (per PRD §10 Fix 4).
 * Returns a cleanup function.
 */
export function subscribeToIngestion(
  task_id: string,
  handlers: IngestionHandlers
): () => void {
  const url = api.ingestProgressUrl(task_id);
  const source = new EventSource(url);
  let pollInterval: ReturnType<typeof setInterval> | null = null;
  let closed = false;

  const startPolling = () => {
    if (pollInterval) return;
    pollInterval = setInterval(async () => {
      try {
        const res = await api.getTaskStatus(task_id);
        if (!res.data) return;
        handlers.onProgress({
          stage: res.data.stage,
          current: res.data.current,
          total: res.data.total,
        });
        if (res.data.status !== "running") {
          if (pollInterval) clearInterval(pollInterval);
          if (res.data.status === "failed") {
            handlers.onError("Ingestion failed");
          }
        }
      } catch {
        // silent — keep polling
      }
    }, 5000);
  };

  source.addEventListener("progress", (e) => {
    try {
      handlers.onProgress(JSON.parse(e.data));
    } catch { /* ignore malformed */ }
  });

  source.addEventListener("complete", (e) => {
    try {
      handlers.onComplete(JSON.parse(e.data));
    } catch { /* ignore malformed */ }
    source.close();
    closed = true;
  });

  source.addEventListener("error", (e) => {
    try {
      const data = JSON.parse((e as MessageEvent).data ?? "{}");
      handlers.onError(data.message ?? "SSE error");
    } catch { /* ignore */ }
    source.close();
    closed = true;
  });

  source.onerror = () => {
    if (!closed) {
      source.close();
      startPolling();
    }
  };

  return () => {
    closed = true;
    source.close();
    if (pollInterval) clearInterval(pollInterval);
  };
}

// ─── Query SSE (POST streaming) ───────────────────────────────────────────────

export interface QueryHandlers {
  onRetrievalDone: (chunks: RetrievedChunk[], latency_ms: number) => void;
  onToken: (text: string) => void;
  onDone: (total_tokens: number, total_latency_ms: number) => void;
  onError: (msg: string) => void;
}

/**
 * Stream a repo query via POST + ReadableStream.
 * Returns a cleanup / abort function.
 */
export function streamQuery(
  repo_id: string,
  query: string,
  retrieval_mode: "naive" | "graph",
  handlers: QueryHandlers
): () => void {
  const controller = new AbortController();

  (async () => {
    try {
      const res = await fetch(api.queryUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo_id, query, retrieval_mode }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        handlers.onError(json?.error?.message ?? `HTTP ${res.status}`);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) { handlers.onError("No response body"); return; }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE lines
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";     // keep incomplete last line

        let currentEvent = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              switch (currentEvent) {
                case "retrieval_done":
                  handlers.onRetrievalDone(data.chunks, data.latency_ms);
                  break;
                case "token":
                  handlers.onToken(data.text);
                  break;
                case "done":
                  handlers.onDone(data.total_tokens, data.total_latency_ms);
                  break;
                case "error":
                  handlers.onError(data.message ?? "Stream error");
                  break;
              }
            } catch { /* ignore malformed JSON */ }
            currentEvent = "";
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError") {
        handlers.onError(err.message);
      }
    }
  })();

  return () => controller.abort();
}
