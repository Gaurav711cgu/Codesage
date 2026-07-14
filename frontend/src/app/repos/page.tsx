"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Trash2, MessageSquare, Loader2, Send, AlertCircle } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { api } from "@/lib/api";
import type { Repo, RetrievedChunk } from "@/lib/api";
import { subscribeToIngestion, streamQuery } from "@/lib/sse";
import type { IngestionProgressEvent, IngestionCompleteEvent } from "@/lib/sse";
import IngestionProgress from "@/components/IngestionProgress";
import RetrievalAccordion from "@/components/RetrievalAccordion";
import StreamingOutput from "@/components/StreamingOutput";
import { cn } from "@/lib/utils";

interface IngestionState {
  taskId: string;
  repoId: string;
  stage: string;
  current: number;
  total: number;
  status: "running" | "complete" | "failed" | "idle";
  message?: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  chunks?: RetrievedChunk[];
  latency_ms?: number;
  streaming?: boolean;
}

const SESSION_ID = uuidv4();

export default function ReposPage() {
  const [githubUrl, setGithubUrl]       = useState("");
  const [urlError, setUrlError]         = useState("");
  const [ingesting, setIngesting]       = useState(false);
  const [ingestionState, setIngestion]  = useState<IngestionState | null>(null);
  const [repos, setRepos]               = useState<Repo[]>([]);
  const [activeRepo, setActiveRepo]     = useState<Repo | null>(null);
  const [retrievalMode, setMode]        = useState<"naive" | "graph">("graph");
  const [messages, setMessages]         = useState<ChatMessage[]>([]);
  const [input, setInput]               = useState("");
  const [querying, setQuerying]         = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const cancelQueryRef = useRef<(() => void) | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadRepos = useCallback(async () => {
    const res = await api.listRepos();
    if (res.data) setRepos(res.data);
  }, []);

  useEffect(() => {
    loadRepos();
  }, [loadRepos]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const validateUrl = (url: string) => {
    const pattern = /^https:\/\/github\.com\/[\w.\-]+\/[\w.\-]+\/?$/;
    return pattern.test(url.trim());
  };

  const handleIngest = async () => {
    const url = githubUrl.trim();
    if (!validateUrl(url)) {
      setUrlError("Must be https://github.com/owner/repo");
      return;
    }
    setUrlError("");
    setIngesting(true);

    const res = await api.ingestRepo(url);
    if (res.error || !res.data) {
      setUrlError(res.error?.message ?? "Ingestion request failed");
      setIngesting(false);
      return;
    }

    const { task_id, repo_id } = res.data;
    setIngestion({
      taskId: task_id, repoId: repo_id,
      stage: "cloning", current: 0, total: 0, status: "running",
    });

    const unsub = subscribeToIngestion(task_id, {
      onProgress: (e: IngestionProgressEvent) => {
        setIngestion((prev) => prev
          ? { ...prev, stage: e.stage, current: e.current, total: e.total, message: e.message }
          : prev);
      },
      onComplete: (_e: IngestionCompleteEvent) => {
        setIngestion((prev) => prev ? { ...prev, status: "complete" } : prev);
        setIngesting(false);
        loadRepos();
        setGithubUrl("");
        setTimeout(() => setIngestion(null), 3000);
      },
      onError: (msg: string) => {
        setIngestion((prev) => prev
          ? { ...prev, status: "failed", message: msg }
          : prev);
        setIngesting(false);
      },
    });

    return () => unsub();
  };

  const handleDelete = async (repoId: string) => {
    await api.deleteRepo(repoId);
    setDeleteConfirm(null);
    if (activeRepo?.id === repoId) {
      setActiveRepo(null);
      setMessages([]);
    }
    loadRepos();
  };

  const handleSend = useCallback(() => {
    if (!input.trim() || querying || !activeRepo) return;
    const userMsg: ChatMessage = {
      id: uuidv4(), role: "user", content: input.trim(),
    };
    const assistantId = uuidv4();
    const assistantMsg: ChatMessage = {
      id: assistantId, role: "assistant", content: "", streaming: true,
    };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput("");
    setQuerying(true);

    const cancel = streamQuery(
      activeRepo.id,
      userMsg.content,
      retrievalMode,
      {
        onRetrievalDone: (chunks, latency_ms) => {
          setMessages((prev) =>
            prev.map((m) => m.id === assistantId
              ? { ...m, chunks, latency_ms }
              : m)
          );
        },
        onToken: (text) => {
          setMessages((prev) =>
            prev.map((m) => m.id === assistantId
              ? { ...m, content: m.content + text }
              : m)
          );
        },
        onDone: () => {
          setMessages((prev) =>
            prev.map((m) => m.id === assistantId
              ? { ...m, streaming: false }
              : m)
          );
          setQuerying(false);
        },
        onError: (err) => {
          setMessages((prev) =>
            prev.map((m) => m.id === assistantId
              ? { ...m, content: `Error: ${err}`, streaming: false }
              : m)
          );
          setQuerying(false);
        },
      }
    );
    cancelQueryRef.current = cancel;
  }, [input, querying, activeRepo, retrievalMode]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Ingest section */}
      <div className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Index Repository
        </h2>
        <div className="flex gap-3">
          <div className="flex-1">
            <input
              type="url"
              value={githubUrl}
              onChange={(e) => { setGithubUrl(e.target.value); setUrlError(""); }}
              placeholder="https://github.com/owner/repo"
              className={cn(
                "w-full px-3 py-2 rounded-md bg-card border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring",
                urlError ? "border-red-500" : "border-border"
              )}
              aria-label="GitHub repository URL"
              aria-describedby={urlError ? "url-error" : undefined}
            />
            {urlError && (
              <p id="url-error" className="text-xs text-red-400 mt-1 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> {urlError}
              </p>
            )}
          </div>
          <button
            onClick={handleIngest}
            disabled={ingesting || !githubUrl}
            className={cn(
              "px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors",
              ingesting || !githubUrl
                ? "bg-muted text-muted-foreground cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-500 text-white"
            )}
          >
            {ingesting && <Loader2 className="h-4 w-4 animate-spin" />}
            Index Repository
          </button>
        </div>

        {ingestionState && (
          <IngestionProgress
            stage={ingestionState.stage}
            current={ingestionState.current}
            total={ingestionState.total}
            message={ingestionState.message}
            status={ingestionState.status}
          />
        )}
      </div>

      {/* Repos list + chat */}
      <div className="grid grid-cols-3 gap-6">
        {/* Repo list */}
        <div className="col-span-1 space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Indexed Repos
          </h2>
          {repos.length === 0 && (
            <p className="text-sm text-muted-foreground">No repos indexed yet.</p>
          )}
          {repos.map((repo) => (
            <div
              key={repo.id}
              className={cn(
                "rounded-lg border p-3 space-y-2 transition-colors",
                activeRepo?.id === repo.id
                  ? "border-blue-500 bg-blue-500/5"
                  : "border-border bg-card hover:border-muted-foreground"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium text-sm text-foreground truncate">
                    {repo.name}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {repo.github_url}
                  </div>
                </div>
                <span className={cn(
                  "text-xs px-1.5 py-0.5 rounded border shrink-0",
                  repo.status === "complete"
                    ? "bg-green-500/20 text-green-400 border-green-500/30"
                    : "bg-muted text-muted-foreground border-border"
                )}>
                  {repo.status}
                </span>
              </div>
              {repo.stats && (
                <div className="text-xs text-muted-foreground flex gap-3">
                  <span>{repo.stats.functions} fn</span>
                  <span>{repo.stats.files} files</span>
                  <span>{repo.stats.edges} edges</span>
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setActiveRepo(repo);
                    setMessages([]);
                  }}
                  disabled={repo.status !== "complete"}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded text-xs transition-colors",
                    repo.status === "complete"
                      ? "bg-blue-600 hover:bg-blue-500 text-white"
                      : "bg-muted text-muted-foreground cursor-not-allowed"
                  )}
                >
                  <MessageSquare className="h-3 w-3" /> Chat
                </button>
                <button
                  onClick={() => setDeleteConfirm(repo.id)}
                  className="px-2 py-1 rounded text-xs text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  aria-label={`Delete ${repo.name}`}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Chat panel */}
        <div className="col-span-2 border border-border rounded-lg flex flex-col" style={{ height: "calc(100vh - 16rem)" }}>
          {!activeRepo ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              Select a repo to start chatting.
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div className="border-b border-border px-4 py-2 flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">{activeRepo.name}</span>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Retrieval:</span>
                  <button
                    onClick={() => setMode("naive")}
                    className={cn(
                      "px-2 py-0.5 rounded transition-colors",
                      retrievalMode === "naive"
                        ? "bg-blue-600 text-white"
                        : "hover:text-foreground"
                    )}
                  >
                    Naive
                  </button>
                  <button
                    onClick={() => setMode("graph")}
                    className={cn(
                      "px-2 py-0.5 rounded transition-colors",
                      retrievalMode === "graph"
                        ? "bg-blue-600 text-white"
                        : "hover:text-foreground"
                    )}
                  >
                    Graph
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center mt-8">
                    Ask anything about {activeRepo.name}
                  </p>
                )}
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      "max-w-[85%]",
                      msg.role === "user" ? "ml-auto" : "mr-auto"
                    )}
                  >
                    <div className={cn(
                      "rounded-lg px-3 py-2 text-sm",
                      msg.role === "user"
                        ? "bg-muted text-foreground"
                        : "bg-card border border-border text-foreground"
                    )}>
                      {msg.role === "user" ? (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      ) : (
                        <StreamingOutput
                          text={msg.content}
                          streaming={msg.streaming ?? false}
                        />
                      )}
                    </div>
                    {msg.chunks && msg.chunks.length > 0 && (
                      <RetrievalAccordion chunks={msg.chunks} latency_ms={msg.latency_ms} />
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="border-t border-border p-3 flex gap-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about the codebase… (⌘+Enter to send)"
                  rows={2}
                  disabled={querying}
                  className="flex-1 resize-none rounded-md bg-muted border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
                  aria-label="Message input"
                />
                <button
                  onClick={handleSend}
                  disabled={querying || !input.trim()}
                  className={cn(
                    "px-3 py-2 rounded-md transition-colors",
                    querying || !input.trim()
                      ? "bg-muted text-muted-foreground cursor-not-allowed"
                      : "bg-blue-600 hover:bg-blue-500 text-white"
                  )}
                  aria-label="Send message"
                >
                  {querying
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Send className="h-4 w-4" />}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Delete confirmation dialog */}
      {deleteConfirm && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
          role="dialog"
          aria-modal="true"
          aria-label="Confirm deletion"
        >
          <div className="bg-card border border-border rounded-lg p-6 max-w-sm w-full mx-4 space-y-4">
            <h3 className="font-medium text-foreground">Delete repository?</h3>
            <p className="text-sm text-muted-foreground">
              This will permanently delete the repo, its ChromaDB collections,
              and all chat history. This cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 rounded-md text-sm border border-border hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="px-4 py-2 rounded-md text-sm bg-red-600 hover:bg-red-500 text-white transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
