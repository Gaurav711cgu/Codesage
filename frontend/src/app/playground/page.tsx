"use client";

import React, { useState, useRef, useEffect } from "react";
import { Terminal, Code, ArrowRight, Zap, Layers3 } from "lucide-react";

interface ChunkInfo {
  name: string;
  file: string;
  type: string;
  content?: string;
  score?: number;
}

interface ChatMessage {
  type: "system" | "user" | "assistant" | "error";
  content: string;
  chunks?: ChunkInfo[];
}

async function callGemini(
  prompt: string,
  repo_id: string = "sample"
): Promise<{ result: string; chunks?: ChunkInfo[] }> {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, repo_id }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return {
    result: data.result as string,
    chunks: data.retrieved_chunks,
  };
}

const EXAMPLES = [
  "Explain circuit breaker state transitions in resilience.py",
  "How does SingleFlight request deduplication work?",
  "Find callers and implementation of compute_tax",
  "Write a binary search tree with insert and search",
];

const REPO_PRESETS = [
  { id: "sample", label: "Sample Repo (codesage-sample-repo)" },
  { id: "core", label: "CodeSage Core" },
  { id: "active_workspace", label: "Active Workspace" },
];

export default function PlaygroundPage() {
  const [input, setInput] = useState("");
  const [selectedRepo, setSelectedRepo] = useState("sample");
  const [expandedChunksIndex, setExpandedChunksIndex] = useState<number | null>(null);
  const [history, setHistory] = useState<ChatMessage[]>([
    { type: "system", content: "CodeSage — Interactive Sandbox" },
    {
      type: "system",
      content:
        "Direct REPL connection to the underlying semantic generation models with 2-hop Graph-RAG augmentation.",
    },
  ]);
  const [isGenerating, setIsGenerating] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history]);

  const addMsg = (
    type: "system" | "user" | "assistant" | "error",
    content: string,
    chunks?: ChunkInfo[]
  ) => setHistory((prev) => [...prev, { type, content, chunks }]);

  const submit = async (query: string) => {
    if (!query.trim() || isGenerating) return;
    setInput("");
    addMsg("user", "> " + query);
    setIsGenerating(true);
    try {
      const data = await callGemini(query, selectedRepo);
      addMsg("assistant", data.result, data.chunks);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      addMsg("error", "Error: " + msg);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submit(input.trim());
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans flex flex-col items-center p-4 sm:p-8">
      <main className="flex-1 w-full max-w-4xl mt-16 mb-16 space-y-8 flex flex-col">
        {/* Header */}
        <div className="space-y-4 shrink-0 border-b border-border pb-6">
          <div className="flex items-center justify-between">
            <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
              [ codesage / playground ]
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-mono">Target Repo:</span>
              <select
                value={selectedRepo}
                onChange={(e) => setSelectedRepo(e.target.value)}
                className="bg-surface border border-border text-foreground text-xs font-mono rounded px-2.5 py-1 outline-none"
              >
                {REPO_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <h1 className="text-3xl font-bold text-foreground">
            Interactive Sandbox
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-xl">
            Live generation workbench connected to backend 2-hop Graph-RAG and Gemini 2.5.
          </p>
        </div>

        {/* Example chips */}
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => submit(ex)}
              disabled={isGenerating}
              className="btn-ghost py-1.5 px-3 text-[11px]"
            >
              {ex}
            </button>
          ))}
        </div>

        {/* Terminal */}
        <div className="flex-1 min-h-[500px] max-h-[680px] border border-border bg-surface flex flex-col overflow-hidden shadow-2xl rounded-sm">
          {/* Bar */}
          <div className="flex items-center justify-between px-3 py-2 bg-surface-hi border-b border-border text-[10px] text-muted-foreground font-mono select-none">
            <div className="flex gap-2">
              <span>[ _ ]</span>
              <span>[ □ ]</span>
              <span>[ X ]</span>
            </div>
            <div className="opacity-70 flex items-center gap-1.5">
              <Terminal size={10} />
              codesage_repl.exe — Graph-RAG Active
            </div>
            <div className="text-[10px] text-primary">Connected</div>
          </div>

          {/* Output area */}
          <div className="flex-1 p-5 overflow-y-auto space-y-4 text-[13px] leading-relaxed font-mono">
            {history.map((msg, i) => (
              <div key={i} className="space-y-1.5">
                {msg.type === "user" && (
                  <div className="text-primary opacity-90">{msg.content}</div>
                )}
                {msg.type === "system" && (
                  <div className="text-muted-foreground text-[11px] uppercase tracking-widest">
                    {msg.content}
                  </div>
                )}
                {msg.type === "error" && (
                  <div className="text-destructive text-xs">{msg.content}</div>
                )}
                {msg.type === "assistant" && (
                  <div className="space-y-3">
                    {msg.chunks && msg.chunks.length > 0 && (
                      <div className="space-y-2">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedChunksIndex(expandedChunksIndex === i ? null : i)
                          }
                          className="inline-flex items-center gap-2 px-2.5 py-1 bg-primary/10 border border-primary/20 text-primary text-[11px] uppercase tracking-wider rounded cursor-pointer hover:bg-primary/20 transition-colors"
                        >
                          <Layers3 size={12} />
                          Graph-RAG Injected: {msg.chunks.length} AST Chunks
                          <span className="text-[10px] opacity-70">
                            {expandedChunksIndex === i ? "▲ Hide" : "▼ Inspect"}
                          </span>
                        </button>

                        {expandedChunksIndex === i && (
                          <div className="p-3 bg-surface-hi border border-border rounded text-xs space-y-3">
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                              Retrieved AST Nodes & Call Graph Neighbors
                            </div>
                            <div className="grid gap-2">
                              {msg.chunks.map((chunk, cIdx) => (
                                <div
                                  key={cIdx}
                                  className="p-2.5 bg-background border border-border/80 rounded space-y-1.5"
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="font-semibold text-foreground flex items-center gap-1.5">
                                      <Code size={11} className="text-primary" />
                                      {chunk.name}
                                    </div>
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface border border-border text-muted-foreground">
                                      {chunk.type}
                                    </span>
                                  </div>
                                  <div className="text-[10px] text-muted-foreground font-mono">
                                    {chunk.file}
                                  </div>
                                  {chunk.content && (
                                    <pre className="mt-1 p-2 bg-surface rounded text-[11px] text-foreground/90 overflow-x-auto max-h-32">
                                      {chunk.content}
                                    </pre>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    <pre className="whitespace-pre-wrap break-words text-foreground text-[13px] leading-relaxed">
                      {msg.content}
                    </pre>
                  </div>
                )}
              </div>
            ))}
            {isGenerating && (
              <div className="flex items-center gap-2">
                <span className="text-primary">❯</span>
                <span className="inline-block w-2 h-4 bg-primary cursor-blink align-middle" />
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <form
            onSubmit={handleSubmit}
            className="shrink-0 p-4 bg-surface-hi border-t border-border flex items-center gap-3"
          >
            <span className="text-primary font-mono text-sm">❯</span>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Execute command or enter query..."
              className="flex-1 bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground font-mono text-[13px]"
              disabled={isGenerating}
              autoComplete="off"
              autoFocus
            />
            <button
              type="submit"
              disabled={isGenerating || !input.trim()}
              className="p-1.5 rounded-sm bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-30 transition-colors"
            >
              <ArrowRight size={14} />
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
