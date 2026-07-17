// frontend/src/app/repos/page.tsx
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Trash2, Loader2, Send, AlertCircle, Github, Database, BrainCircuit } from "lucide-react";
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
      setUrlError("Invalid URL: must be https://github.com/owner/repo");
      return;
    }
    setUrlError("");
    setIngesting(true);

    const res = await api.ingestRepo(url);
    if (res.error || !res.data) {
      setUrlError(res.error?.message ?? "Ingestion failed");
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
    <div className="max-w-[1400px] mx-auto py-10 space-y-6">
      
      {/* breadcrumb bar header */}
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div className="font-mono text-xs text-primary font-medium uppercase tracking-wider">codesagez / repos</div>
      </div>

      {/* Ingest section */}
      <div className="bg-surface border border-border p-5 rounded-sm">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="flex-1 w-full relative">
            <input
              type="url"
              value={githubUrl}
              onChange={(e) => { setGithubUrl(e.target.value); setUrlError(""); }}
              placeholder="https://github.com/owner/repo"
              className="input-field"
              aria-label="GitHub repository URL"
            />
            {urlError && (
              <p className="text-[11px] text-destructive mt-1.5 flex items-center gap-1 font-mono">
                <AlertCircle className="h-3 w-3" /> {urlError}
              </p>
            )}
          </div>
          <button
            onClick={handleIngest}
            disabled={ingesting || !githubUrl}
            className="btn-primary flex items-center justify-center gap-1.5 min-w-[110px]"
          >
            {ingesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Database className="h-3.5 w-3.5" />}
            {ingesting ? "Indexing" : "Index"}
          </button>
        </div>

        {ingestionState && (
          <div className="mt-4 bg-background p-4 border border-border rounded-sm">
            <IngestionProgress
              stage={ingestionState.stage}
              current={ingestionState.current}
              total={ingestionState.total}
              message={ingestionState.message}
              status={ingestionState.status}
            />
          </div>
        )}
      </div>

      {/* Repos list + chat */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 h-[640px]">
        {/* Repo list sidebar */}
        <div className="md:col-span-4 bg-surface border border-border rounded-sm overflow-hidden flex flex-col">
          <div className="px-5 py-3 border-b border-border bg-surface-hi flex items-center gap-2">
            <Database className="w-4 h-4 text-primary" />
            <span className="font-mono text-xs font-semibold text-foreground uppercase tracking-wider">Repositories</span>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {repos.length === 0 && (
              <div className="text-center py-12 text-muted-foreground flex flex-col items-center gap-2 font-mono text-[11px]">
                <p>$ no repositories indexed yet</p>
              </div>
            )}
            
            {repos.map((repo) => (
              <div
                key={repo.id}
                className={cn(
                  "border p-3.5 space-y-3 transition-colors rounded-sm cursor-pointer",
                  activeRepo?.id === repo.id
                    ? "border-primary bg-primary/5"
                    : "border-border bg-background hover:border-primary/50 hover:bg-surface-hi"
                )}
                onClick={() => {
                  if (repo.status === "complete") {
                    setActiveRepo(repo);
                    setMessages([]);
                  }
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-sans text-xs font-semibold text-foreground truncate">
                      {repo.name}
                    </div>
                    <div className="text-[10px] font-mono text-muted-foreground truncate mt-0.5">
                      {repo.github_url}
                    </div>
                  </div>
                  <span className={cn(
                    "text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 border rounded-sm shrink-0",
                    repo.status === "complete"
                      ? "bg-success/15 text-success border-success/20"
                      : "bg-surface text-muted-foreground border-border"
                  )}>
                    {repo.status}
                  </span>
                </div>
                
                {repo.stats && (
                  <div className="flex gap-4 text-[10px] font-mono text-muted-foreground/80 bg-background/50 border border-border/50 p-1.5 rounded-sm">
                    <div><span className="text-foreground">{repo.stats.functions}</span> fn</div>
                    <div><span className="text-foreground">{repo.stats.files}</span> files</div>
                    <div><span className="text-foreground">{repo.stats.edges}</span> edges</div>
                  </div>
                )}
                
                <div className="flex gap-2 items-center">
                  {repo.status !== "complete" && (
                    <div className="text-[10px] font-mono text-muted-foreground flex items-center gap-1.5">
                      <Loader2 className="h-3 w-3 animate-spin text-primary" /> processing
                    </div>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteConfirm(repo.id);
                    }}
                    className="p-1 text-muted-foreground hover:text-destructive transition-colors ml-auto"
                    aria-label={`Delete ${repo.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Chat panel */}
        <div className="md:col-span-8 bg-surface border border-border rounded-sm flex flex-col overflow-hidden relative">
          {!activeRepo ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8 text-center font-mono">
              <div className="text-[11px] text-muted-foreground">
                $ select a repo from the list to start querying
              </div>
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div className="px-5 py-3 border-b border-border bg-surface-hi flex items-center justify-between z-10">
                <div className="flex items-center gap-2">
                  <Github className="w-4 h-4 text-primary" />
                  <span className="font-mono text-xs font-semibold text-foreground uppercase tracking-wider">{activeRepo.name}</span>
                </div>
                
                <div className="flex items-center bg-background/50 p-0.5 rounded-sm border border-border font-mono">
                  <button
                    onClick={() => setMode("naive")}
                    className={cn(
                      "px-2.5 py-1 rounded-sm text-[10px] uppercase font-mono tracking-wider transition-colors",
                      retrievalMode === "naive"
                        ? "bg-surface-hi text-primary border border-border"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Naive
                  </button>
                  <button
                    onClick={() => setMode("graph")}
                    className={cn(
                      "px-2.5 py-1 rounded-sm text-[10px] uppercase font-mono tracking-wider transition-colors",
                      retrievalMode === "graph"
                        ? "bg-surface-hi text-primary border border-border"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Graph
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar scroll-smooth">
                {messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-center space-y-3 opacity-80 font-mono text-[11px]">
                    <BrainCircuit className="w-10 h-10 text-primary/55" />
                    <p className="text-xs">Ask anything about <span className="text-foreground">{activeRepo.name}</span></p>
                    <div className="flex flex-wrap justify-center gap-2 max-w-md mt-4">
                      <span className="chip cursor-pointer hover:border-primary/50" onClick={() => setInput("How is the database connected?")}>How is the database connected?</span>
                      <span className="chip cursor-pointer hover:border-primary/50" onClick={() => setInput("Where are the API routes defined?")}>Where are the API routes defined?</span>
                    </div>
                  </div>
                )}
                
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      "max-w-[90%] flex flex-col space-y-1.5",
                      msg.role === "user" ? "ml-auto items-end" : "mr-auto items-start"
                    )}
                  >
                    <div className={cn(
                      "rounded-sm px-4 py-2.5 text-xs font-sans border shadow-sm leading-relaxed",
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background border-border text-foreground"
                    )}>
                      {msg.role === "user" ? (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      ) : (
                        <div className="prose prose-invert prose-xs max-w-none prose-pre:bg-black/40 prose-pre:border prose-pre:border-border font-mono leading-relaxed">
                          <StreamingOutput
                            text={msg.content}
                            streaming={msg.streaming ?? false}
                          />
                        </div>
                      )}
                    </div>
                    
                    {msg.chunks && msg.chunks.length > 0 && (
                      <div className="w-full max-w-none">
                        <RetrievalAccordion chunks={msg.chunks} latency_ms={msg.latency_ms} />
                      </div>
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} className="h-4" />
              </div>

              {/* Input */}
              <div className="p-4 bg-surface-hi border-t border-border">
                <div className="relative flex items-end gap-2 bg-background rounded-sm border border-border p-2 focus-within:border-primary/50 transition-colors">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask about the codebase... (Enter to send)"
                    rows={1}
                    disabled={querying}
                    className="flex-1 resize-none bg-transparent px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-50 min-h-[36px] max-h-[120px] font-sans"
                    aria-label="Message input"
                  />
                  <button
                    onClick={handleSend}
                    disabled={querying || !input.trim()}
                    className={cn(
                      "p-2.5 rounded-sm transition-colors shrink-0 mb-0.5 mr-0.5",
                      querying || !input.trim()
                        ? "bg-surface text-muted-foreground/30 cursor-not-allowed"
                        : "bg-primary text-primary-foreground hover:opacity-85"
                    )}
                    aria-label="Send message"
                  >
                    {querying
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <Send className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Delete confirmation dialog */}
      {deleteConfirm && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Confirm deletion"
        >
          <div className="bg-surface border border-border rounded-sm p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="text-center font-mono space-y-2">
              <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">Delete repository?</h3>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Permanently delete repo, ChromaDB collections, and chat logs. This cannot be undone.
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="btn-ghost flex-1 py-2 text-xs"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="btn-primary flex-1 py-2 text-xs bg-destructive text-destructive-foreground hover:opacity-85"
              >
                Delete Repo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
