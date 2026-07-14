"use client";

import { cn } from "@/lib/utils";

const STAGE_LABELS: Record<string, string> = {
  queued:      "Queued",
  cloning:     "Cloning repository",
  discovering: "Discovering files",
  parsing:     "Parsing AST",
  graph:       "Building call graph",
  embedding:   "Generating embeddings",
  storing:     "Storing in ChromaDB",
  complete:    "Complete",
  failed:      "Failed",
};

const STAGE_ORDER = [
  "cloning", "discovering", "parsing", "graph", "embedding", "storing", "complete",
];

interface Props {
  stage: string;
  current: number;
  total: number;
  message?: string;
  status: "running" | "complete" | "failed" | "idle";
}

export default function IngestionProgress({
  stage,
  current,
  total,
  message,
  status,
}: Props) {
  const stageIndex = STAGE_ORDER.indexOf(stage);
  const pct =
    total > 0 ? Math.min(100, Math.round((current / total) * 100)) :
    status === "complete" ? 100 :
    stageIndex >= 0 ? Math.round(((stageIndex + 1) / STAGE_ORDER.length) * 100) : 5;

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="text-foreground font-medium">
          {STAGE_LABELS[stage] ?? stage}
        </span>
        <span
          className={cn(
            "text-xs px-2 py-0.5 rounded-full border",
            status === "complete" && "bg-green-500/20 text-green-400 border-green-500/30",
            status === "failed"   && "bg-red-500/20   text-red-400   border-red-500/30",
            status === "running"  && "bg-blue-500/20  text-blue-400  border-blue-500/30",
            status === "idle"     && "bg-muted        text-muted-foreground border-border",
          )}
        >
          {status}
        </span>
      </div>

      {/* Progress bar */}
      <div
        className="h-1.5 w-full bg-muted rounded-full overflow-hidden"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            status === "complete" && "bg-green-500",
            status === "failed"   && "bg-red-500",
            status === "running"  && "bg-blue-500",
            status === "idle"     && "bg-muted-foreground",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>

      {message && (
        <p className="text-xs text-muted-foreground">{message}</p>
      )}
      {total > 0 && status === "running" && (
        <p className="text-xs text-muted-foreground">
          {current} / {total}
        </p>
      )}
    </div>
  );
}
