"use client";

import React from 'react';

const subsystems = [
  {
    code: "AST-01",
    subsystem: "AST Syntax Parsing",
    engine: "Tree-sitter 0.22",
    sla: "Zero Parse Loss",
    detail: "Parses source files into concrete syntax trees using native C-bindings. Extracts function signatures, class hierarchies, and decorator scopes."
  },
  {
    code: "GRP-02",
    subsystem: "Relational Call Graph",
    engine: "NetworkX 3.2 + SQLite",
    sla: "1-Hop Expansion",
    detail: "Constructs directed graphs linking caller and callee symbols. Expands seed vector matches with structural compiler context."
  },
  {
    code: "CON-03",
    subsystem: "SingleFlight Coalescer",
    engine: "Request Coalescing Lock",
    sla: "Zero Thundering Herd",
    detail: "Deduplicates concurrent identical RAG queries in-flight. Dispatches a single vector search and shares the result across all waiting callers."
  },
  {
    code: "VEC-04",
    subsystem: "Dense Vector Storage",
    engine: "ChromaDB HNSW Cosine",
    sla: "<50ms P95 Retrieval",
    detail: "Indexes 3072-dimensional embeddings locally. Zero IP leakage to public training sets with local lexical fallback."
  }
];

export default function BentoFeatures() {
  return (
    <section className="w-full max-w-5xl mx-auto my-8 pointer-events-auto font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border pb-3 mb-6 gap-2">
        <div>
          <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest block">
            [ SPECIFICATION MATRIX ]
          </span>
          <h2 className="text-xl font-bold font-mono text-foreground">
            System Subsystems &amp; Invariants
          </h2>
        </div>
        <div className="font-mono text-xs text-muted-foreground">
          TOTAL SUBSYSTEMS: 04 // PROTOCOL: v2.0
        </div>
      </div>

      <div className="border border-border bg-surface rounded-[3px] overflow-hidden">
        {/* Table Header */}
        <div className="hidden md:grid grid-cols-12 px-6 py-3 border-b border-border bg-surface-hi/40 text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
          <div className="col-span-1">ID</div>
          <div className="col-span-3">Subsystem</div>
          <div className="col-span-3">Engine / Stack</div>
          <div className="col-span-2">Invariant</div>
          <div className="col-span-3 text-right">Verification</div>
        </div>

        {/* Rows */}
        <div className="divide-y divide-border">
          {subsystems.map((item) => (
            <div 
              key={item.code} 
              className="p-5 md:px-6 md:py-4 grid grid-cols-1 md:grid-cols-12 items-start md:items-center gap-2 md:gap-4 hover:bg-surface-hi/50 transition-colors"
            >
              <div className="col-span-1 font-mono text-xs font-semibold text-primary">
                {item.code}
              </div>
              <div className="col-span-3">
                <div className="text-sm font-semibold text-foreground">{item.subsystem}</div>
                <div className="text-xs text-muted-foreground md:hidden mt-1">{item.detail}</div>
              </div>
              <div className="col-span-3 font-mono text-xs text-muted-foreground">
                {item.engine}
              </div>
              <div className="col-span-2">
                <span className="inline-block px-2 py-0.5 border border-border bg-background font-mono text-[10px] text-foreground rounded-[2px] uppercase">
                  {item.sla}
                </span>
              </div>
              <div className="col-span-3 hidden md:block text-right font-mono text-xs text-muted-foreground">
                {item.detail}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
