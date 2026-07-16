"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Trash2, MessageSquare, Loader2, Send, AlertCircle, Github, Database, Search, BrainCircuit } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { api } from "@/lib/api";
import type { Repo, RetrievedChunk } from "@/lib/api";
import { subscribeToIngestion, streamQuery } from "@/lib/sse";
import type { IngestionProgressEvent, IngestionCompleteEvent } from "@/lib/sse";
import IngestionProgress from "@/components/IngestionProgress";
import RetrievalAccordion from "@/components/RetrievalAccordion";
import StreamingOutput from "@/components/StreamingOutput";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

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
    <div className="max-w-7xl mx-auto py-10 space-y-8">
      {/* Page Header */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-4"
      >
        <h1 className="text-4xl font-bold tracking-tight text-foreground">
          Repository <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">Dashboard</span>
        </h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          Ingest GitHub repositories, process their ASTs, and chat with them using graph-augmented retrieval.
        </p>
      </motion.div>

      {/* Ingest section */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-card p-6 rounded-3xl"
      >
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
          <div className="flex-1 w-full relative">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
              <Github className="w-5 h-5 text-muted-foreground" />
            </div>
            <input
              type="url"
              value={githubUrl}
              onChange={(e) => { setGithubUrl(e.target.value); setUrlError(""); }}
              placeholder="https://github.com/owner/repo"
              className={cn(
                "w-full pl-12 pr-4 py-4 rounded-xl bg-background/50 border text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all shadow-inner",
                urlError ? "border-red-500/50 focus:ring-red-500/50" : "border-white/10"
              )}
              aria-label="GitHub repository URL"
              aria-describedby={urlError ? "url-error" : undefined}
            />
            {urlError && (
              <p id="url-error" className="absolute -bottom-6 left-2 text-xs text-red-400 mt-1 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> {urlError}
              </p>
            )}
          </div>
          <button
            onClick={handleIngest}
            disabled={ingesting || !githubUrl}
            className={cn(
              "px-8 py-4 rounded-xl text-base font-semibold flex items-center justify-center gap-2 transition-all w-full md:w-auto shadow-lg",
              ingesting || !githubUrl
                ? "bg-white/5 text-white/40 cursor-not-allowed border border-white/5"
                : "bg-gradient-to-r from-primary to-secondary text-white hover:opacity-90 hover:scale-[1.02] border border-white/10"
            )}
          >
            {ingesting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Database className="h-5 w-5" />}
            {ingesting ? "Ingesting..." : "Index Repository"}
          </button>
        </div>

        <AnimatePresence>
          {ingestionState && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginTop: 0 }}
              animate={{ opacity: 1, height: "auto", marginTop: 24 }}
              exit={{ opacity: 0, height: 0, marginTop: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-background/40 p-4 rounded-2xl border border-white/5">
                <IngestionProgress
                  stage={ingestionState.stage}
                  current={ingestionState.current}
                  total={ingestionState.total}
                  message={ingestionState.message}
                  status={ingestionState.status}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Repos list + chat */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-[700px]"
      >
        {/* Repo list */}
        <div className="lg:col-span-4 glass rounded-3xl overflow-hidden flex flex-col">
          <div className="p-6 border-b border-white/5 bg-white/[0.02]">
            <h2 className="font-semibold flex items-center gap-2">
              <Database className="w-5 h-5 text-secondary" />
              Indexed Repos
            </h2>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {repos.length === 0 && (
              <div className="text-center py-12 text-muted-foreground flex flex-col items-center gap-3">
                <Search className="w-10 h-10 opacity-20" />
                <p>No repositories indexed yet.</p>
              </div>
            )}
            
            <AnimatePresence>
              {repos.map((repo, idx) => (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  key={repo.id}
                  className={cn(
                    "rounded-2xl border p-4 space-y-4 transition-all duration-300 relative group cursor-pointer",
                    activeRepo?.id === repo.id
                      ? "border-primary/50 bg-primary/10 shadow-[0_0_15px_rgba(var(--primary),0.2)]"
                      : "border-white/5 bg-white/5 hover:border-white/20 hover:bg-white/10"
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
                      <div className="font-semibold text-foreground truncate">
                        {repo.name}
                      </div>
                      <div className="text-xs text-muted-foreground truncate opacity-80 mt-1">
                        {repo.github_url}
                      </div>
                    </div>
                    <span className={cn(
                      "text-xs px-2 py-1 rounded-full border shrink-0 font-medium",
                      repo.status === "complete"
                        ? "bg-green-500/10 text-green-400 border-green-500/20"
                        : "bg-white/5 text-muted-foreground border-white/10"
                    )}>
                      {repo.status}
                    </span>
                  </div>
                  
                  {repo.stats && (
                    <div className="flex gap-4 text-xs font-mono text-muted-foreground/80 bg-background/30 p-2 rounded-lg">
                      <div className="flex flex-col"><span className="text-foreground/70 font-semibold">{repo.stats.functions}</span> functions</div>
                      <div className="flex flex-col"><span className="text-foreground/70 font-semibold">{repo.stats.files}</span> files</div>
                      <div className="flex flex-col"><span className="text-foreground/70 font-semibold">{repo.stats.edges}</span> edges</div>
                    </div>
                  )}
                  
                  <div className="flex gap-2">
                    {repo.status !== "complete" && (
                       <button
                       disabled
                       className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-medium bg-white/5 text-muted-foreground cursor-not-allowed border border-white/5"
                     >
                       <Loader2 className="h-4 w-4 animate-spin" /> Processing
                     </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirm(repo.id);
                      }}
                      className="px-3 py-2 rounded-xl text-xs text-muted-foreground hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-colors ml-auto"
                      aria-label={`Delete ${repo.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>

        {/* Chat panel */}
        <div className="lg:col-span-8 glass rounded-3xl flex flex-col overflow-hidden relative">
          {!activeRepo ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 mb-2">
                <MessageSquare className="w-8 h-8 opacity-50" />
              </div>
              <div>
                <h3 className="text-xl font-medium text-foreground mb-1">No Repository Selected</h3>
                <p>Select an indexed repository from the sidebar to start exploring its architecture.</p>
              </div>
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div className="px-6 py-4 border-b border-white/5 bg-white/[0.02] flex items-center justify-between z-10 backdrop-blur-md">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30">
                    <Github className="w-4 h-4 text-primary" />
                  </div>
                  <span className="font-semibold text-foreground">{activeRepo.name}</span>
                </div>
                
                <div className="flex items-center bg-background/50 p-1 rounded-lg border border-white/10">
                  <button
                    onClick={() => setMode("naive")}
                    className={cn(
                      "px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                      retrievalMode === "naive"
                        ? "bg-white/10 text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                    )}
                  >
                    Naive RAG
                  </button>
                  <button
                    onClick={() => setMode("graph")}
                    className={cn(
                      "px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                      retrievalMode === "graph"
                        ? "bg-primary text-white shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                    )}
                  >
                    Graph RAG
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar scroll-smooth">
                {messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-70">
                    <BrainCircuit className="w-12 h-12 text-primary/50" />
                    <p className="text-lg">Ask me anything about <span className="font-semibold text-foreground">{activeRepo.name}</span></p>
                    <div className="flex flex-wrap justify-center gap-2 max-w-md mt-4">
                      <span className="text-xs bg-white/5 border border-white/10 px-3 py-1.5 rounded-full cursor-pointer hover:bg-white/10 transition-colors" onClick={() => setInput("How is the database connected?")}>How is the database connected?</span>
                      <span className="text-xs bg-white/5 border border-white/10 px-3 py-1.5 rounded-full cursor-pointer hover:bg-white/10 transition-colors" onClick={() => setInput("Where are the API routes defined?")}>Where are the API routes defined?</span>
                    </div>
                  </div>
                )}
                
                <AnimatePresence>
                  {messages.map((msg) => (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      key={msg.id}
                      className={cn(
                        "max-w-[85%] flex flex-col space-y-2",
                        msg.role === "user" ? "ml-auto items-end" : "mr-auto items-start"
                      )}
                    >
                      <div className={cn(
                        "rounded-2xl px-5 py-3 text-sm shadow-sm",
                        msg.role === "user"
                          ? "bg-primary text-white rounded-tr-sm"
                          : "bg-white/5 border border-white/10 text-foreground rounded-tl-sm backdrop-blur-md"
                      )}>
                        {msg.role === "user" ? (
                          <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                        ) : (
                          <div className="prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-black/40 prose-pre:border prose-pre:border-white/10">
                            <StreamingOutput
                              text={msg.content}
                              streaming={msg.streaming ?? false}
                            />
                          </div>
                        )}
                      </div>
                      
                      {msg.chunks && msg.chunks.length > 0 && (
                        <div className="w-full max-w-[90%] opacity-90">
                          <RetrievalAccordion chunks={msg.chunks} latency_ms={msg.latency_ms} />
                        </div>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
                <div ref={messagesEndRef} className="h-4" />
              </div>

              {/* Input */}
              <div className="p-4 bg-white/[0.02] border-t border-white/5 backdrop-blur-md">
                <div className="relative flex items-end gap-2 bg-background/50 rounded-2xl border border-white/10 p-2 shadow-inner focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/50 transition-all">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask about the codebase... (⌘+Enter to send)"
                    rows={1}
                    disabled={querying}
                    className="flex-1 resize-none bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-50 min-h-[40px] max-h-[120px]"
                    aria-label="Message input"
                  />
                  <button
                    onClick={handleSend}
                    disabled={querying || !input.trim()}
                    className={cn(
                      "p-3 rounded-xl transition-all shrink-0 mb-0.5 mr-0.5",
                      querying || !input.trim()
                        ? "bg-white/5 text-white/30 cursor-not-allowed"
                        : "bg-gradient-to-r from-primary to-secondary text-white shadow-md hover:scale-105"
                    )}
                    aria-label="Send message"
                  >
                    {querying
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <Send className="h-4 w-4 ml-0.5" />}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </motion.div>

      {/* Delete confirmation dialog */}
      <AnimatePresence>
        {deleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Confirm deletion"
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="glass-card border border-white/10 rounded-2xl p-6 max-w-sm w-full space-y-5 shadow-2xl"
            >
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-2 border border-red-500/30">
                <AlertCircle className="w-6 h-6 text-red-500" />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-semibold text-foreground mb-2">Delete repository?</h3>
                <p className="text-sm text-muted-foreground">
                  This will permanently delete the repo, its ChromaDB collections,
                  and all chat history. This action cannot be undone.
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium border border-white/10 bg-white/5 hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirm)}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-red-600 hover:bg-red-500 text-white shadow-md transition-colors"
                >
                  Delete Repo
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
