"use client";

import { useState, useCallback } from "react";
import { Play, Loader2, Code2, Bug, CheckCircle2, Sparkles } from "lucide-react";
import MonacoEditor from "@/components/MonacoEditor";
import StreamingOutput from "@/components/StreamingOutput";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import type { CodeReviewResult, DebugResult, TestGenResult } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";

type Tab = "review" | "debug" | "tests" | "complete";
type Language = "python" | "javascript" | "typescript";

const PLACEHOLDER: Record<Language, string> = {
  python: `def process_items(items):
    result = []
    for i in range(len(items)):
        if items[i] > 0:
            result.append(items[i] * 2)
    return result
`,
  javascript: `function processItems(items) {
  const result = [];
  for (let i = 0; i < items.length; i++) {
    if (items[i] > 0) {
      result.push(items[i] * 2);
    }
  }
  return result;
}
`,
  typescript: `function processItems(items: number[]): number[] {
  const result: number[] = [];
  for (let i = 0; i < items.length; i++) {
    if (items[i] > 0) {
      result.push(items[i] * 2);
    }
  }
  return result;
}
`,
};

export default function PlaygroundPage() {
  const [tab, setTab]         = useState<Tab>("review");
  const [lang, setLang]       = useState<Language>("python");
  const [code, setCode]       = useState(PLACEHOLDER.python);
  const [errorText, setError] = useState("");
  const [output, setOutput]   = useState("");
  const [streaming, setStreaming] = useState(false);
  const [running, setRunning] = useState(false);

  const handleLangChange = (l: Language) => {
    setLang(l);
    setCode(PLACEHOLDER[l]);
    setOutput("");
  };

  const formatReview = (r: CodeReviewResult): string => {
    const lines = [
      `Overall score: ${r.overall_score}/100`,
      "",
      r.summary,
      "",
    ];
    if (r.issues.length) {
      lines.push("Issues:");
      r.issues.forEach((issue) => {
        lines.push(
          `  [${issue.severity.toUpperCase()}]${issue.line ? ` L${issue.line}` : ""} ${issue.description}`
        );
        lines.push(`  → ${issue.suggestion}`);
      });
      lines.push("");
    }
    if (r.strengths.length) {
      lines.push("Strengths:");
      r.strengths.forEach((s) => lines.push(`  ✓ ${s}`));
    }
    return lines.join("\n");
  };

  const formatDebug = (r: DebugResult): string => [
    `Probable cause: ${r.probable_cause}`,
    r.root_location ? `Root location: ${r.root_location}` : "",
    r.execution_path.length ? `\nExecution path:\n${r.execution_path.map((s) => `  → ${s}`).join("\n")}` : "",
    `\nConfidence: ${r.confidence}`,
    `Model used: ${r.model_used}`,
    "",
    "Fix:",
    "```python",
    r.fix,
    "```",
  ].filter(Boolean).join("\n");

  const formatTests = (r: TestGenResult): string => [
    `Generated ${r.test_count} test(s):`,
    r.cases.map((c) => `  [${c.type}] ${c.name}`).join("\n"),
    "",
    "```python",
    r.test_code,
    "```",
  ].join("\n");

  const run = useCallback(async () => {
    if (running) return;
    setRunning(true);
    setStreaming(true);
    setOutput("");

    try {
      if (tab === "review") {
        const res = await api.reviewCode(code, lang);
        setOutput(res.data ? formatReview(res.data) : `Error: ${res.error?.message}`);
      } else if (tab === "debug") {
        const res = await api.debugCode(code, errorText, lang);
        setOutput(res.data ? formatDebug(res.data) : `Error: ${res.error?.message}`);
      } else {
        const res = await api.generateTests(code, lang);
        setOutput(res.data ? formatTests(res.data) : `Error: ${res.error?.message}`);
      }
    } catch (e: unknown) {
      setOutput(`Error: ${e instanceof Error ? e.message : "Unknown error"}`);
    } finally {
      setStreaming(false);
      setRunning(false);
    }
  }, [tab, code, lang, errorText, running]);

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "review", label: "Review", icon: <Code2 className="w-4 h-4" /> },
    { id: "debug",  label: "Debug", icon: <Bug className="w-4 h-4" /> },
    { id: "tests",  label: "Tests", icon: <CheckCircle2 className="w-4 h-4" /> },
    { id: "complete", label: "Complete", icon: <Sparkles className="w-4 h-4" /> },
  ];

  return (
    <div className="h-[calc(100vh-4.5rem)] flex flex-col md:flex-row p-6 gap-6 max-w-[1600px] mx-auto w-full overflow-hidden">
      {/* Left column - Editor pane */}
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="w-full md:w-1/2 h-full flex flex-col gap-4"
      >
        <div className="glass rounded-3xl p-6 h-full flex flex-col relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
            <Code2 className="w-64 h-64" />
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 relative z-10">
            <h2 className="text-2xl font-bold tracking-tight">Code <span className="text-primary">Playground</span></h2>
            
            <div className="flex gap-2 p-1.5 bg-background/50 backdrop-blur-md rounded-xl border border-white/10 shadow-inner">
              {(["python", "javascript", "typescript"] as Language[]).map((l) => (
                <button
                  key={l}
                  onClick={() => handleLangChange(l)}
                  className={cn(
                    "text-xs px-3 py-1.5 rounded-lg transition-all font-medium capitalize",
                    lang === l
                      ? "bg-primary text-white shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                  )}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Action Tabs */}
          <div className="flex gap-2 p-1 bg-background/40 backdrop-blur-md rounded-xl border border-white/5 mb-4 relative z-10">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-lg transition-all font-medium",
                  tab === t.id
                    ? "bg-white/10 text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                )}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex-1 rounded-2xl overflow-hidden border border-white/5 shadow-inner relative z-10">
            <MonacoEditor
              value={code}
              onChange={setCode}
              language={lang}
              height="100%"
              label="Source Code"
            />
          </div>

          <AnimatePresence>
            {tab === "debug" && (
              <motion.div 
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: "auto", marginTop: 16 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                className="rounded-2xl overflow-hidden border border-white/5 shadow-inner relative z-10"
              >
                <div className="bg-red-500/10 border-b border-white/5 px-4 py-2 flex items-center gap-2">
                  <Bug className="w-4 h-4 text-red-400" />
                  <span className="text-xs font-semibold text-red-400 uppercase tracking-wider">Error Trace</span>
                </div>
                <MonacoEditor
                  value={errorText}
                  onChange={setError}
                  language="text"
                  height="120px"
                  label=""
                />
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-6 flex justify-end relative z-10">
            <button
              onClick={run}
              disabled={running}
              className={cn(
                "flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all shadow-lg min-w-[140px]",
                running
                  ? "bg-white/5 text-white/40 cursor-not-allowed border border-white/5"
                  : "bg-gradient-to-r from-primary to-secondary text-white hover:opacity-90 hover:scale-[1.02] border border-white/10"
              )}
            >
              {running ? (
                <><Loader2 className="h-5 w-5 animate-spin" /> Processing...</>
              ) : (
                <><Play className="h-5 w-5 fill-current" /> Execute {TABS.find(t => t.id === tab)?.label}</>
              )}
            </button>
          </div>
        </div>
      </motion.div>

      {/* Right column - Output pane */}
      <motion.div 
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="w-full md:w-1/2 h-full"
      >
        <div className="glass rounded-3xl h-full flex flex-col overflow-hidden relative shadow-2xl border border-white/5">
          <div className="px-6 py-5 border-b border-white/5 bg-white/[0.02] flex items-center gap-3 backdrop-blur-md">
            <div className="w-8 h-8 rounded-full bg-secondary/20 flex items-center justify-center border border-secondary/30">
              <Sparkles className="w-4 h-4 text-secondary" />
            </div>
            <h2 className="font-semibold text-foreground">AI Evaluation & Output</h2>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-background/20 relative">
            {!output && !running ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground opacity-50 p-8 text-center space-y-4">
                <Sparkles className="w-16 h-16 opacity-30" />
                <div>
                  <p className="text-lg font-medium text-foreground mb-1">Awaiting Execution</p>
                  <p className="text-sm">Click the execute button to generate AI insights.</p>
                </div>
              </div>
            ) : (
              <div className="prose prose-invert max-w-none prose-sm sm:prose-base prose-pre:bg-black/40 prose-pre:border prose-pre:border-white/10 prose-headings:text-foreground prose-a:text-secondary">
                <StreamingOutput text={output} streaming={streaming} />
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
