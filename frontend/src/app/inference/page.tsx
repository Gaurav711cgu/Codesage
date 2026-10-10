"use client";

import React from 'react';
import { INFERENCE_COMPONENTS } from '@/constants/content';

export default function InferencePage() {
  return (
    <div className="max-w-5xl mx-auto py-12 space-y-12 px-4 sm:px-6 font-sans">
      {/* Header */}
      <div className="border-b border-border pb-6">
        <div className="text-[11px] font-mono text-muted-foreground uppercase tracking-widest mb-1.5 flex items-center gap-2">
          <span>CODESAGEZ</span>
          <span className="text-border">/</span>
          <span className="text-primary font-semibold">INFERENCE INFRASTRUCTURE</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold font-mono text-foreground">vLLM Inference Engine &amp; PagedAttention</h1>
        <p className="mt-2 text-sm text-muted-foreground max-w-2xl leading-relaxed">
          High-throughput serving architecture powered by PagedAttention and continuous batching. Eliminates KV cache memory fragmentation for sub-100ms TTFT.
        </p>
      </div>

      <main className="w-full space-y-10">
        {/* Memory Allocation Comparison Bar */}
        <section className="p-6 border border-border bg-surface rounded-[3px] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
            <h2 className="text-sm font-bold font-mono uppercase tracking-wider text-foreground">
              KV Cache Memory Efficiency (2048 Context Length)
            </h2>
            <span className="text-xs font-mono text-primary font-semibold">MEMORY REDUCTION: 76%</span>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="p-4 border border-border bg-background rounded-[2px] space-y-2">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-muted-foreground">Standard Serving (Contiguous Pre-allocation)</span>
                <span className="text-destructive font-semibold">68% Wastage</span>
              </div>
              <div className="h-3 w-full bg-surface border border-border rounded-[1px] overflow-hidden flex">
                <div className="h-full bg-destructive/60" style={{ width: '32%' }}></div>
                <div className="h-full bg-destructive/20" style={{ width: '68%' }}></div>
              </div>
              <p className="text-[11px] text-muted-foreground font-mono">
                Pre-allocates memory for maximum sequence length (8k). Unused slots cannot be shared across concurrent queries.
              </p>
            </div>

            <div className="p-4 border border-border bg-background rounded-[2px] space-y-2">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-foreground font-semibold">PagedAttention (Dynamic 16-Token Blocks)</span>
                <span className="text-success font-semibold">&lt;4% Wastage</span>
              </div>
              <div className="h-3 w-full bg-surface border border-border rounded-[1px] overflow-hidden flex">
                <div className="h-full bg-success" style={{ width: '96%' }}></div>
                <div className="h-full bg-success/20" style={{ width: '4%' }}></div>
              </div>
              <p className="text-[11px] text-muted-foreground font-mono">
                Allocates KV cache into fixed 16-token virtual pages on demand. Zero internal fragmentation; 2.4x higher throughput.
              </p>
            </div>
          </div>
        </section>

        {/* Inference Architecture Table */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold font-mono text-foreground uppercase tracking-wider">
              Serving Subsystems &amp; Execution Latency
            </h2>
            <span className="text-xs font-mono text-muted-foreground">ENGINE: vLLM V1</span>
          </div>

          <div className="border border-border bg-surface rounded-[3px] overflow-hidden">
            <div className="hidden md:grid grid-cols-12 px-4 py-2.5 border-b border-border bg-surface-hi/40 text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
              <div className="col-span-1">ID</div>
              <div className="col-span-3">Component</div>
              <div className="col-span-3">Mechanism</div>
              <div className="col-span-5">Operational Details</div>
            </div>

            <div className="divide-y divide-border">
              {INFERENCE_COMPONENTS.map((comp, idx) => (
                <div 
                  key={comp.id} 
                  className="p-4 md:px-4 md:py-3.5 grid grid-cols-1 md:grid-cols-12 items-start md:items-center gap-2 md:gap-4 hover:bg-surface-hi/50 transition-colors"
                >
                  <div className="col-span-1 font-mono text-xs font-semibold text-primary">
                    0{idx + 1}
                  </div>
                  <div className="col-span-3 font-mono text-xs font-semibold text-foreground">
                    {comp.title}
                  </div>
                  <div className="col-span-3 font-mono text-xs text-muted-foreground">
                    <span className="inline-block px-1.5 py-0.5 border border-border bg-background text-[10px] text-foreground rounded-[2px]">
                      {comp.summary}
                    </span>
                  </div>
                  <div className="col-span-5 text-xs text-muted-foreground leading-relaxed">
                    {comp.details}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Latency Waterfall */}
        <section className="p-6 border border-border bg-surface rounded-[3px] space-y-3">
          <h3 className="text-sm font-bold font-mono uppercase tracking-wider text-foreground">
            End-to-End Latency Profile (200 Output Tokens)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs pt-2">
            <div className="p-3 border border-border bg-background rounded-[2px]">
              <div className="text-[10px] text-muted-foreground uppercase">TTFT (Time To First Token)</div>
              <div className="text-xl font-bold text-foreground mt-1">72 ms</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">Prefill phase (H100)</div>
            </div>
            <div className="p-3 border border-border bg-background rounded-[2px]">
              <div className="text-[10px] text-muted-foreground uppercase">Inter-Token Latency</div>
              <div className="text-xl font-bold text-primary mt-1">8 ms/tok</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">Continuous decode batching</div>
            </div>
            <div className="p-3 border border-border bg-background rounded-[2px]">
              <div className="text-[10px] text-muted-foreground uppercase">Total Ingestion &amp; Generation</div>
              <div className="text-xl font-bold text-success mt-1">1.67 s</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">Complete RAG answer delivery</div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
