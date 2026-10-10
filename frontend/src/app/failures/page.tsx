"use client";

import React from 'react';
import { FAILURE_MODES } from '@/constants/content';

const severityBadge: Record<string, { label: string; class: string }> = {
  high: { label: "SEV-1 // CRITICAL", class: "border-destructive/40 text-destructive bg-destructive/10" },
  medium: { label: "SEV-2 // ELEVATED", class: "border-warning/40 text-warning bg-warning/10" },
  low: { label: "SEV-3 // LOW", class: "border-border text-muted-foreground bg-background" },
};

export default function FailuresPage() {
  return (
    <div className="max-w-5xl mx-auto py-12 space-y-12 px-4 sm:px-6 font-sans">
      {/* Header */}
      <div className="border-b border-border pb-6">
        <div className="text-[11px] font-mono text-muted-foreground uppercase tracking-widest mb-1.5 flex items-center gap-2">
          <span>CODESAGEZ</span>
          <span className="text-border">/</span>
          <span className="text-primary font-semibold">INCIDENT POST-MORTEMS</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold font-mono text-foreground">Edge Cases &amp; Root Cause Analysis</h1>
        <p className="mt-2 text-sm text-muted-foreground max-w-2xl leading-relaxed">
          Production engineering audit detailing real failure modes encountered during repository AST ingestion, QLoRA quantization, and vLLM continuous batching, with applied mitigations.
        </p>
      </div>

      <main className="w-full space-y-6">
        <div className="border border-border bg-surface rounded-[3px] divide-y divide-border overflow-hidden">
          {FAILURE_MODES.map((failure, idx) => {
            const badge = severityBadge[failure.severity] || severityBadge.low;
            return (
              <div key={idx} className="p-6 space-y-4 hover:bg-surface-hi/30 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-3">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-muted-foreground">INC-0{idx + 1}</span>
                    <h2 className="text-sm font-bold font-mono text-foreground">{failure.title}</h2>
                  </div>
                  <span className={`px-2 py-0.5 font-mono text-[10px] uppercase font-semibold border rounded-[2px] self-start sm:self-auto ${badge.class}`}>
                    {badge.label}
                  </span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs leading-relaxed">
                  <div className="space-y-1">
                    <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider block">
                      [ FAILURE TRIGGER ]
                    </span>
                    <p className="text-foreground/90">{failure.problem}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider block">
                      [ ROOT CAUSE DIAGNOSIS ]
                    </span>
                    <p className="text-foreground/90">{failure.rootCause}</p>
                  </div>
                </div>
                
                <div className="p-3 border border-border bg-background rounded-[2px] space-y-1 font-mono text-xs">
                  <span className="text-[10px] text-primary uppercase tracking-wider block">
                    &gt; APPLIED ARCHITECTURAL MITIGATION:
                  </span>
                  <div className="text-foreground/90 leading-relaxed">
                    {failure.fix}
                  </div>
                </div>
                
                <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground pt-1">
                  <span>Residual Risk Boundary: <span className="text-foreground">{failure.risk}</span></span>
                  <span className="text-success">[STATUS: STABILIZED]</span>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
