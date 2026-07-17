// frontend/src/app/playground/page.tsx
"use client";

import { useState, useCallback } from "react";
import { Play, Loader2, Code2, Bug, CheckCircle2 } from "lucide-react";
import MonacoEditor from "@/components/MonacoEditor";
import StreamingOutput from "@/components/StreamingOutput";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import type { CodeReviewResult, DebugResult, TestGenResult } from "@/lib/api";

type Tab = "review" | "debug" | "tests";
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

  const TABS = [
    { id: "review" as const, label: "Review", icon: <Code2 className="w-3.5 h-3.5" /> },
    { id: "debug" as const,  label: "Debug", icon: <Bug className="w-3.5 h-3.5" /> },
    { id: "tests" as const,  label: "Tests", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col md:flex-row p-6 gap-6 max-w-[1600px] mx-auto w-full overflow-hidden">
      {/* Left column - Editor pane */}
      <div className="w-full md:w-1/2 h-full flex flex-col gap-4">
        <div className="bg-surface border border-border p-6 h-full flex flex-col relative overflow-hidden rounded-sm">
          
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-5">
            <div className="space-y-1">
              <div className="font-mono text-xs text-primary font-medium uppercase tracking-wider">codesagez / playground</div>
            </div>
            
            <div className="flex gap-1 p-1 bg-background/50 rounded-sm border border-border font-mono">
              {(["python", "javascript", "typescript"] as Language[]).map((l) => (
                <button
                  key={l}
                  onClick={() => handleLangChange(l)}
                  className={cn(
                    "text-[10px] uppercase tracking-wider px-2 py-1 rounded-sm transition-colors",
                    lang === l
                      ? "bg-surface-hi text-primary border border-border"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Action Tabs */}
          <div className="flex gap-1 p-1 bg-background/40 rounded-sm border border-border mb-4">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs rounded-sm transition-colors font-mono font-medium",
                  tab === t.id
                    ? "bg-surface-hi text-primary border border-border"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex-1 rounded-sm overflow-hidden border border-border">
            <MonacoEditor
              value={code}
              onChange={setCode}
              language={lang}
              height="100%"
              label="Source Code"
            />
          </div>

          {tab === "debug" && (
            <div className="mt-4 rounded-sm overflow-hidden border border-border flex flex-col">
              <div className="bg-destructive/10 border-b border-border px-4 py-1.5 flex items-center gap-2">
                <Bug className="w-3.5 h-3.5 text-destructive" />
                <span className="text-[10px] font-mono font-semibold text-destructive uppercase tracking-wider">Error Trace</span>
              </div>
              <MonacoEditor
                value={errorText}
                onChange={setError}
                language="text"
                height="100px"
                label=""
              />
            </div>
          )}

          <div className="mt-5 flex justify-end">
            <button
              onClick={run}
              disabled={running}
              className="btn-primary min-w-[120px] flex items-center justify-center gap-2"
            >
              {running ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Running...</>
              ) : (
                <><Play className="h-4 w-4 fill-current" /> Run</>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Right column - Output pane */}
      <div className="w-full md:w-1/2 h-full">
        <div className="bg-surface border border-border h-full flex flex-col overflow-hidden rounded-sm">
          <div className="flex-1 overflow-y-auto p-6 bg-background/20 relative font-mono text-xs leading-relaxed">
            {!output && !running ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground p-8 text-center space-y-2">
                <div className="font-mono text-xs">
                  $ paste code, select mode, then click Run.
                </div>
              </div>
            ) : (
              <div className="prose prose-invert max-w-none prose-sm prose-pre:bg-black/40 prose-pre:border prose-pre:border-border prose-headings:text-foreground prose-a:text-primary font-mono">
                <StreamingOutput text={output} streaming={streaming} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
