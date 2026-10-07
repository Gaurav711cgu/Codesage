"use client";

import React, { useEffect, useState, useRef } from "react";

export interface TerminalViewProps {
  lines: string[];
  streaming?: boolean;
  className?: string;
}

export function TerminalView({ lines, streaming = true, className = "" }: TerminalViewProps) {
  const [displayedLines, setDisplayedLines] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!streaming) {
      setDisplayedLines(lines);
      return;
    }

    setDisplayedLines([]);
    let currentIndex = 0;
    
    const interval = setInterval(() => {
      if (currentIndex < lines.length) {
        setDisplayedLines(prev => [...prev, lines[currentIndex]]);
        currentIndex++;
      } else {
        clearInterval(interval);
      }
    }, 300); // 300ms per line simulated stream speed

    return () => clearInterval(interval);
  }, [lines, streaming]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [displayedLines]);

  return (
    <div className={`flex flex-col border border-border bg-surface shadow-2xl rounded-sm overflow-hidden ${className}`}>
      {/* Terminal Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-surface-hi border-b border-border text-[10px] text-muted-foreground font-mono select-none">
        <div className="flex gap-2">
          <span>[ _ ]</span>
          <span>[ □ ]</span>
          <span>[ X ]</span>
        </div>
        <div className="opacity-70">CodeSageZ.exe</div>
        <div></div>
      </div>
      
      {/* Terminal Body */}
      <div 
        ref={scrollRef}
        className="flex-1 p-4 overflow-y-auto font-mono text-[13px] leading-relaxed text-foreground"
      >
        {displayedLines.map((line, i) => (
          <div key={i} className="mb-1">
            <span className="text-primary mr-2">❯</span>
            <span className="opacity-90">{line}</span>
          </div>
        ))}
        {streaming && displayedLines.length < lines.length && (
          <div>
            <span className="text-primary mr-2">❯</span>
            <span className="inline-block w-2 h-4 bg-primary cursor-blink align-middle" />
          </div>
        )}
        {(!streaming || displayedLines.length === lines.length) && (
          <div className="mt-2">
            <span className="text-primary mr-2">❯</span>
            <span className="inline-block w-2 h-4 bg-primary cursor-blink align-middle" />
          </div>
        )}
      </div>
    </div>
  );
}
