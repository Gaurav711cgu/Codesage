"use client";

import React, { useState, useRef, useEffect } from "react";
import { Terminal, Code, ArrowRight, Zap, Layers3 } from "lucide-react";

interface ChunkInfo {
  name: string;
  file: string;
  type: string;
}

interface ChatMessage {
  type: "system" | "user" | "assistant" | "error";
  content: string;
  chunks?: ChunkInfo[];
}

async function callGemini(
  prompt: string
): Promise<{ result: string; chunks?: ChunkInfo[] }> {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return {
    result: data.result as string,
    chunks: data.retrieved_chunks,
  };
}

const EXAMPLES = [
  "Write a palindrome checker in Python",
  "Implement a binary search tree with insert and search",
  "Write a function to flatten a nested list",
  "Explain how graph neural networks work",
];

export default function PlaygroundPage() {
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<ChatMessage[]>([
    { type: "system", content: "CodeSage — Interactive Sandbox" },
    {
      type: "system",
      content:
        "Direct REPL connection to the underlying semantic generation models with Graph-RAG augmentation.",
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
      const data = await callGemini(query);
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
        <div className="space-y-2 shrink-0 border-b border-border pb-6">
          <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-2">
            [ codesage / playground ]
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
              codesage_repl.exe
            </div>
            <div></div>
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
                  <div>
                    {msg.chunks && msg.chunks.length > 0 && (
                      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 mb-2 bg-primary/10 border border-primary/20 text-primary text-[10px] uppercase tracking-wider rounded-[2px]">
                        <Layers3 size={11} />
                        Graph-RAG Injected: {msg.chunks.length} AST Chunks ({msg.chunks.map((c) => c.name).join(", ")})
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
