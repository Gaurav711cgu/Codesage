"use client";

import React, { useState, useRef, useEffect } from "react";
import { Terminal, Code, ArrowRight, Zap } from "lucide-react";

async function callGemini(prompt: string): Promise<string> {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data.result as string;
}

const EXAMPLES = [
  "Write a palindrome checker in Python",
  "Implement a binary search tree with insert and search",
  "Write a function to flatten a nested list",
  "Explain how graph neural networks work",
];

export default function PlaygroundPage() {
  const [input, setInput] = useState("");
  const [history, setHistory] = useState([
    { type: "system", content: "CodeSage — powered by Gemini 1.5 Flash" },
    {
      type: "system",
      content:
        'Ask anything about code or Python. e.g. "Write a palindrome checker"',
    },
  ]);
  const [isGenerating, setIsGenerating] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history]);

  const addMsg = (type: string, content: string) =>
    setHistory((prev) => [...prev, { type, content }]);

  const submit = async (query: string) => {
    if (!query.trim() || isGenerating) return;
    setInput("");
    addMsg("user", "> " + query);
    setIsGenerating(true);
    try {
      const result = await callGemini(query);
      addMsg("assistant", result);
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
    <div className="min-h-screen bg-[#090909] text-green-400 font-mono flex flex-col items-center p-4 sm:p-8">
      <main className="flex-1 w-full max-w-4xl mt-24 mb-16 space-y-8 flex flex-col">
        {/* Header */}
        <div className="space-y-3 text-center shrink-0">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full text-green-400 text-sm font-semibold">
            <Zap size={13} className="animate-pulse" />
            Live · Gemini 1.5 Flash
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight font-sans">
            Live Playground
          </h1>
          <p className="text-gray-500 text-base leading-relaxed max-w-xl mx-auto font-sans">
            Real AI responses — no mocks, no hardcoded outputs.
          </p>
        </div>

        {/* Example chips */}
        <div className="flex flex-wrap gap-2 justify-center">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => submit(ex)}
              disabled={isGenerating}
              className="px-3 py-1.5 rounded-full text-xs border border-white/10 text-gray-400 hover:border-green-500/40 hover:text-green-400 transition-all font-sans disabled:opacity-40"
            >
              {ex}
            </button>
          ))}
        </div>

        {/* Terminal */}
        <div className="flex-1 min-h-[500px] max-h-[680px] border border-white/10 rounded-xl bg-[#0a0a0a] flex flex-col overflow-hidden shadow-2xl shadow-green-900/10">
          {/* Bar */}
          <div className="h-11 bg-white/[0.03] border-b border-white/10 flex items-center px-4 gap-3 shrink-0">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500/70" />
              <div className="w-3 h-3 rounded-full bg-amber-500/70" />
              <div className="w-3 h-3 rounded-full bg-green-500/70" />
            </div>
            <div className="ml-2 flex items-center text-xs text-gray-500 font-sans gap-1.5">
              <Terminal size={13} />
              <span>codesage ~ gemini-1.5-flash</span>
            </div>
          </div>

          {/* Output area */}
          <div className="flex-1 p-5 overflow-y-auto space-y-5 text-sm leading-relaxed">
            {history.map((msg, i) => (
              <div key={i}>
                {msg.type === "user" && (
                  <div className="text-blue-400">{msg.content}</div>
                )}
                {msg.type === "system" && (
                  <div className="text-gray-600 text-xs">{msg.content}</div>
                )}
                {msg.type === "error" && (
                  <div className="text-red-400 text-xs">{msg.content}</div>
                )}
                {msg.type === "assistant" && (
                  <pre className="whitespace-pre-wrap break-words text-green-300 font-mono text-sm leading-relaxed">
                    {msg.content}
                  </pre>
                )}
              </div>
            ))}
            {isGenerating && (
              <div className="flex items-center gap-2 text-green-500">
                <span className="inline-block w-2 h-4 bg-green-400 animate-pulse rounded-sm" />
                <span className="text-gray-500 text-xs font-sans">
                  Gemini is thinking…
                </span>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <form
            onSubmit={handleSubmit}
            className="shrink-0 px-4 py-3 bg-white/[0.03] border-t border-white/10 flex items-center gap-3"
          >
            <Code size={16} className="text-gray-600 shrink-0" />
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask CodeSage anything…"
              className="flex-1 bg-transparent border-none outline-none text-white placeholder:text-gray-700 font-mono text-sm"
              disabled={isGenerating}
              autoComplete="off"
              autoFocus
            />
            <button
              type="submit"
              disabled={isGenerating || !input.trim()}
              className="p-1.5 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 disabled:opacity-30 transition-colors"
            >
              <ArrowRight size={16} />
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-700 font-sans">
          API key is server-side only · never exposed to the browser
        </p>
      </main>
    </div>
  );
}
