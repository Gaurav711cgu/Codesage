"use client";

import { useState, useCallback } from "react";
import { Play, Loader2 } from "lucide-react";
import MonacoEditor from "@/components/MonacoEditor";
import StreamingOutput from "@/components/StreamingOutput";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import type { CodeReviewResult, DebugResult, TestGenResult } from "@/lib/api";

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

  const TABS: { id: Tab; label: string }[] = [
    { id: "review", label: "Review" },
    { id: "debug",  label: "Debug" },
    { id: "tests",  label: "Tests" },
    { id: "complete", label: "Complete" },
  ];

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col md:flex-row">
      {/* Left column */}
      <div className="w-full md:w-1/2 border-b md:border-b-0 md:border-r border-border flex flex-col p-4 gap-3 overflow-y-auto">
        {/* Tab selector */}
        <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "px-3 py-1 text-sm rounded-md transition-colors",
                tab === t.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Language selector */}
        <div className="flex gap-2 items-center">
          <span className="text-xs text-muted-foreground">Language:</span>
          {(["python", "javascript", "typescript"] as Language[]).map((l) => (
            <button
              key={l}
              onClick={() => handleLangChange(l)}
              className={cn(
                "text-xs px-2 py-0.5 rounded border transition-colors",
                lang === l
                  ? "border-blue-500 text-blue-400 bg-blue-500/10"
                  : "border-border text-muted-foreground hover:border-muted-foreground"
              )}
            >
              {l}
            </button>
          ))}
        </div>

        {/* Main code editor */}
        <MonacoEditor
          value={code}
          onChange={setCode}
          language={lang}
          height="calc(100vh - 20rem)"
          label="Code"
        />

        {/* Error input for debug tab */}
        {tab === "debug" && (
          <MonacoEditor
            value={errorText}
            onChange={setError}
            language="text"
            height="100px"
            label="Error / Stack trace"
          />
        )}

        {/* Run button */}
        <button
          onClick={run}
          disabled={running}
          className={cn(
            "flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
            running
              ? "bg-muted text-muted-foreground cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-500 text-white"
          )}
          aria-label={`Run ${tab}`}
        >
          {running ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Running…</>
          ) : (
            <><Play className="h-4 w-4" /> Run</>
          )}
        </button>
      </div>

      {/* Right column — output */}
      <div className="w-full md:w-1/2 p-4 overflow-y-auto">
        <StreamingOutput text={output} streaming={streaming} />
      </div>
    </div>
  );
}
