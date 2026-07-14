"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface Props {
  text: string;
  streaming: boolean;
  className?: string;
}

/**
 * Renders streaming LLM output. Code blocks are highlighted with a
 * pre/code element; prose renders as plain text with a blinking cursor
 * while streaming.
 */
export default function StreamingOutput({ text, streaming, className }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom as tokens arrive
  useEffect(() => {
    if (streaming) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [text, streaming]);

  if (!text && !streaming) {
    return (
      <div className={cn("text-muted-foreground text-sm italic", className)}>
        Output appears here after you run.
      </div>
    );
  }

  if (!text && streaming) {
    return (
      <div className={cn("space-y-2", className)}>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-4 bg-muted rounded animate-pulse"
            style={{ width: `${70 + i * 8}%` }}
          />
        ))}
      </div>
    );
  }

  // Split on fenced code blocks and render alternately
  const parts = text.split(/(```[\w]*\n[\s\S]*?```)/g);

  return (
    <div className={cn("text-sm leading-relaxed space-y-3 overflow-auto", className)}>
      {parts.map((part, i) => {
        if (part.startsWith("```")) {
          const firstLine = part.split("\n")[0];
          const lang = firstLine.replace("```", "").trim() || "text";
          const code = part
            .replace(/^```[\w]*\n/, "")
            .replace(/```$/, "")
            .trim();
          return (
            <pre
              key={i}
              className="bg-muted rounded-md p-4 overflow-x-auto text-xs"
              aria-label={`Code block (${lang})`}
            >
              <code>{code}</code>
            </pre>
          );
        }
        return (
          <p key={i} className={cn("whitespace-pre-wrap text-foreground",
            streaming && i === parts.length - 1 && "streaming-cursor")}>
            {part}
          </p>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
