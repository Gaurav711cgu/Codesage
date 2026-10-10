"use client";

import React, { useState } from 'react';
import Link from 'next/link';

export default function AnimatedHero() {
  const [copied, setCopied] = useState(false);
  const installCmd = "codesage index --repo tiangolo/fastapi --depth 1";

  const handleCopy = () => {
    navigator.clipboard.writeText(installCmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative z-10 flex flex-col items-center justify-center pt-8 pb-4 text-center px-4 w-full max-w-4xl mx-auto font-sans">
      {/* System Telemetry Header Bar */}
      <div className="flex flex-wrap items-center justify-center gap-2 mb-6 font-mono text-[11px] text-muted-foreground">
        <span className="px-2.5 py-1 border border-border bg-surface text-foreground font-semibold rounded-[2px]">
          CODESAGEZ // v2.0-PROD
        </span>
        <span className="hidden sm:inline-block px-2.5 py-1 border border-border bg-surface text-muted-foreground rounded-[2px]">
          AST: Tree-sitter 0.22
        </span>
        <span className="hidden sm:inline-block px-2.5 py-1 border border-border bg-surface text-muted-foreground rounded-[2px]">
          GRAPH: NetworkX 3.2
        </span>
        <span className="px-2.5 py-1 border border-border bg-surface text-primary rounded-[2px]">
          LATENCY: &lt;50ms
        </span>
      </div>
      
      {/* Un-slopped Systems Headline */}
      <h1 className="text-4xl sm:text-6xl font-bold tracking-tight text-foreground mb-6 font-mono">
        AST-Aware Graph-RAG Engine
      </h1>
      
      {/* Precise Technical Scope */}
      <p className="max-w-2xl text-sm sm:text-base text-muted-foreground mb-8 leading-relaxed font-sans">
        Eliminates LLM hallucination on complex repositories by combining Tree-sitter abstract syntax trees with dense vector search. Performs 1-hop relational expansion across caller-callee call graphs to inject exact compilation contexts into Gemini 2.5 Flash.
      </p>

      {/* Interactive CLI Invocation Bar */}
      <div className="w-full max-w-xl mb-8 flex items-center justify-between border border-border bg-surface px-4 py-2.5 font-mono text-xs text-foreground rounded-[3px] shadow-inner">
        <div className="flex items-center gap-2 overflow-x-auto text-left">
          <span className="text-primary font-bold select-none">&gt;</span>
          <span className="text-muted-foreground select-none">$</span>
          <span className="text-foreground">{installCmd}</span>
        </div>
        <button
          onClick={handleCopy}
          className="ml-3 shrink-0 px-2 py-1 border border-border bg-background hover:bg-surface-hi text-[10px] font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors rounded-[2px]"
          title="Copy command"
        >
          {copied ? "COPIED" : "COPY"}
        </button>
      </div>

      {/* Industrial Workstation Actions */}
      <div className="flex flex-wrap items-center justify-center gap-4">
        <Link 
          href="/repos" 
          className="px-5 py-2.5 bg-foreground text-background hover:bg-foreground/90 font-mono text-xs font-semibold uppercase tracking-wider transition-all rounded-[3px] no-underline flex items-center gap-2"
        >
          <span>[+] Connect Repository</span>
        </Link>
        <Link 
          href="/architecture" 
          className="px-5 py-2.5 border border-border bg-surface hover:bg-surface-hi hover:border-primary/50 text-foreground font-mono text-xs font-semibold uppercase tracking-wider transition-all rounded-[3px] no-underline flex items-center gap-2"
        >
          <span>Architecture Spec &rarr;</span>
        </Link>
      </div>
    </div>
  );
}
