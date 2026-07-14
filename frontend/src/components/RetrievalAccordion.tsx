"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RetrievedChunk } from "@/lib/api";

interface Props {
  chunks: RetrievedChunk[];
  latency_ms?: number;
}

const SEVERITY_COLOR: Record<string, string> = {
  seed:     "bg-blue-500/20 text-blue-300 border-blue-500/30",
  neighbor: "bg-amber-500/20 text-amber-300 border-amber-500/30",
};

export default function RetrievalAccordion({ chunks, latency_ms }: Props) {
  const [open, setOpen] = useState(false);

  if (!chunks.length) return null;

  return (
    <div className="border border-border rounded-md text-sm mt-2">
      <button
        className="w-full flex items-center justify-between px-3 py-2 text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => setOpen((p) => !p)}
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          <ChevronRight
            className={cn("h-4 w-4 transition-transform", open && "rotate-90")}
          />
          Retrieval context
          <span className="text-xs">
            ({chunks.length} chunk{chunks.length !== 1 ? "s" : ""}
            {latency_ms !== undefined && `, ${latency_ms}ms`})
          </span>
        </span>
        <span className="text-xs">
          {chunks.filter((c) => c.type === "seed").length} seeds ·{" "}
          {chunks.filter((c) => c.type === "neighbor").length} neighbors
        </span>
      </button>

      {open && (
        <div className="border-t border-border divide-y divide-border">
          {chunks.map((chunk, i) => (
            <div key={i} className="px-3 py-2 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="font-mono text-xs text-foreground truncate">
                  {chunk.name}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {chunk.file}
                  {chunk.lines[0] > 0 &&
                    ` · L${chunk.lines[0]}–${chunk.lines[1]}`}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span
                  className={cn(
                    "text-xs px-1.5 py-0.5 rounded border font-mono",
                    SEVERITY_COLOR[chunk.type]
                  )}
                >
                  {chunk.type}
                </span>
                <span className="text-xs text-muted-foreground font-mono">
                  {chunk.score.toFixed(3)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
