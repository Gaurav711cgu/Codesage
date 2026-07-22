"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Terminal, Code, ArrowRight } from 'lucide-react';

const HF_MODEL = "Qwen/Qwen2.5-Coder-1.5B-Instruct";
const HF_API_URL = `https://api-inference.huggingface.co/models/${HF_MODEL}`;

// Uses HF Inference API (free tier, no key needed for public models)
async function queryModel(prompt: string): Promise<string> {
  const systemPrompt =
    "You are CodeSage, an expert Python coding assistant. " +
    "Respond only with clean, well-commented code. No prose unless asked.";

  const fullPrompt = `<|im_start|>system\n${systemPrompt}<|im_end|>\n<|im_start|>user\n${prompt}<|im_end|>\n<|im_start|>assistant\n`;

  const res = await fetch(HF_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      inputs: fullPrompt,
      parameters: {
        max_new_tokens: 512,
        temperature: 0.2,
        do_sample: true,
        return_full_text: false,
        stop: ["<|im_end|>"],
      },
    }),
  });

  if (res.status === 503) {
    // Model is loading (cold start) — HF free tier warms up in ~20s
    const data = await res.json();
    const wait = (data?.estimated_time ?? 20) * 1000;
    throw new Error(`MODEL_LOADING:${Math.ceil(wait / 1000)}`);
  }

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const raw: string =
    Array.isArray(data) ? data[0]?.generated_text ?? "" : data?.generated_text ?? "";

  return raw.replace(/<\|im_end\|>/g, "").trim();
}

export default function PlaygroundPage() {
  const [input, setInput] = useState("");
  const [history, setHistory] = useState([
    {
      type: "system",
      content: `CodeSage — ${HF_MODEL}`,
    },
    {
      type: "system",
      content:
        'Type a prompt to generate Python code. e.g. "Write a palindrome checker"',
    },
  ]);
  const [isGenerating, setIsGenerating] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history]);

  const addMsg = (type: string, content: string) =>
    setHistory((prev) => [...prev, { type, content }]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isGenerating) return;

    const query = input.trim();
    setInput("");
    addMsg("user", "> " + query);
    setIsGenerating(true);

    let attempt = 0;
    const maxAttempts = 3;

    while (attempt < maxAttempts) {
      try {
        const result = await queryModel(query);
        addMsg("assistant", result || "(empty response — try rephrasing)");
        break;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.startsWith("MODEL_LOADING:")) {
          const secs = msg.split(":")[1];
          addMsg(
            "system",
            `Model is warming up on HuggingFace (cold start ~${secs}s). Retrying…`
          );
          await new Promise((r) => setTimeout(r, parseInt(secs) * 1000 + 2000));
          attempt++;
        } else {
          addMsg(
            "error",
            `Error: ${msg}\n\nNote: HuggingFace free tier has rate limits. Wait a moment and try again.`
          );
          break;
        }
      }
    }

    setIsGenerating(false);
  };

  return (
    <div className="min-h-screen bg-black text-green-500 font-mono flex flex-col items-center p-4 sm:p-8">
      <main className="flex-1 w-full max-w-4xl mt-24 mb-16 space-y-8 flex flex-col">
        {/* Header */}
        <div className="space-y-4 text-center shrink-0">
          <div className="inline-block px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full text-green-400 text-sm font-semibold mb-2">
            Live · No Mock Data
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight">
            Live Playground
          </h1>
          <p className="text-gray-400 text-lg leading-relaxed max-w-2xl mx-auto">
            Calls{" "}
            <span className="text-green-400 font-semibold">
              {HF_MODEL}
            </span>{" "}
            directly via HuggingFace Inference API.
          </p>
        </div>

        {/* Terminal */}
        <div className="flex-1 min-h-[500px] max-h-[700px] border border-white/20 rounded-xl bg-[#0a0a0a] flex flex-col overflow-hidden shadow-2xl shadow-green-900/20">
          {/* Terminal Header */}
          <div className="h-12 bg-white/5 border-b border-white/10 flex items-center px-4 gap-2 shrink-0">
            <div className="flex gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500/80" />
              <div className="w-3 h-3 rounded-full bg-amber-500/80" />
              <div className="w-3 h-3 rounded-full bg-green-500/80" />
            </div>
            <div className="ml-4 flex items-center text-xs text-gray-400 font-sans gap-2 font-semibold">
              <Terminal size={14} />
              <span>codesage@hf-inference:~$</span>
            </div>
          </div>

          {/* Output */}
          <div className="flex-1 p-6 overflow-y-auto space-y-4 text-sm font-mono leading-relaxed">
            {history.map((msg, i) => (
              <div
                key={i}
                className={`flex ${
                  msg.type === "user"
                    ? "text-blue-400"
                    : msg.type === "system"
                    ? "text-gray-500"
                    : msg.type === "error"
                    ? "text-red-400"
                    : "text-green-400"
                }`}
              >
                {msg.type === "assistant" ? (
                  <pre className="whitespace-pre-wrap break-words w-full">
                    {msg.content}
                  </pre>
                ) : (
                  <span>{msg.content}</span>
                )}
              </div>
            ))}
            {isGenerating && (
              <div className="text-green-400 animate-pulse flex items-center gap-2">
                <span className="inline-block w-2 h-4 bg-green-400" />
                <span className="text-gray-500 text-xs font-sans">generating…</span>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <form
            onSubmit={handleSubmit}
            className="shrink-0 p-4 bg-white/5 border-t border-white/10 flex items-center gap-3"
          >
            <Code size={18} className="text-gray-500 shrink-0" />
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask CodeSage to write some code…"
              className="flex-1 bg-transparent border-none outline-none text-white placeholder:text-gray-600 font-mono"
              disabled={isGenerating}
              autoComplete="off"
            />
            <button
              type="submit"
              disabled={isGenerating || !input.trim()}
              className="p-2 rounded bg-green-500/20 text-green-400 hover:bg-green-500/30 disabled:opacity-50 transition-colors"
            >
              <ArrowRight size={18} />
            </button>
          </form>
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-gray-600 font-sans">
          Powered by HuggingFace free Inference API · Cold starts may take ~20s ·
          Rate limited on free tier
        </p>
      </main>
    </div>
  );
}
