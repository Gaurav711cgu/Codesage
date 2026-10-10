import React from 'react';
import { BenchmarkChart } from '@/components/BenchmarkChart';

const BENCHMARK_METRICS = [
  {
    metric: "Recall@8 (Caller/Callee Dependencies)",
    baseline: "0.0%",
    codesage: "50.8%",
    delta: "+50.8pp",
    deltaPositive: true,
    benchmark: "HumanEval Multi-file repo testbed",
  },
  {
    metric: "CodeBLEU Generation Score",
    baseline: "60.64",
    codesage: "70.02",
    delta: "+9.38",
    deltaPositive: true,
    benchmark: "Qwen2.5 QLoRA fine-tuned evaluation",
  },
  {
    metric: "AST Syntax Hallucination Rate",
    baseline: "14.2%",
    codesage: "0.0%",
    delta: "-14.2pp",
    deltaPositive: true,
    benchmark: "Tree-sitter compiler verification",
  },
  {
    metric: "P95 Concurrent Query Latency",
    baseline: "62ms",
    codesage: "38ms",
    delta: "-24ms (-38%)",
    deltaPositive: true,
    benchmark: "SingleFlight request coalescing under 500 rps",
  },
];

export default function BenchmarksPage() {
  return (
    <div className="max-w-5xl mx-auto py-12 space-y-12 px-4 sm:px-6 font-sans">
      {/* Header */}
      <div className="border-b border-border pb-6">
        <div className="text-[11px] font-mono text-muted-foreground uppercase tracking-widest mb-1.5 flex items-center gap-2">
          <span>CODESAGEZ</span>
          <span className="text-border">/</span>
          <span className="text-primary font-semibold">EMPIRICAL EVALUATION</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold font-mono text-foreground">Empirical Benchmarks</h1>
        <p className="mt-2 text-sm text-muted-foreground max-w-2xl leading-relaxed">
          Quantitative evaluation comparing vanilla semantic vector retrieval against AST-aware Graph-RAG expansion across multi-file code generation and retrieval benchmarks.
        </p>
      </div>

      <main className="w-full space-y-10">
        {/* Core RAG Metric Chart */}
        <section>
          <BenchmarkChart />
        </section>

        {/* Evaluation Matrix */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold font-mono text-foreground uppercase tracking-wider">
              Comparative Benchmark Results
            </h2>
            <span className="text-xs font-mono text-muted-foreground">BENCHMARK SET: v2.0-STABLE</span>
          </div>

          <div className="border border-border bg-surface rounded-[3px] overflow-hidden">
            <div className="hidden md:grid grid-cols-12 px-4 py-2.5 border-b border-border bg-surface-hi/40 text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
              <div className="col-span-4">Evaluation Metric</div>
              <div className="col-span-2 text-right">Naive Vector</div>
              <div className="col-span-2 text-right">CodeSageZ</div>
              <div className="col-span-2 text-right">Delta</div>
              <div className="col-span-2 text-right">Methodology</div>
            </div>

            <div className="divide-y divide-border">
              {BENCHMARK_METRICS.map((row) => (
                <div 
                  key={row.metric} 
                  className="p-4 md:px-4 md:py-3.5 grid grid-cols-1 md:grid-cols-12 items-start md:items-center gap-2 md:gap-4 hover:bg-surface-hi/50 transition-colors"
                >
                  <div className="col-span-4 font-mono text-xs font-semibold text-foreground">
                    {row.metric}
                    <div className="text-[11px] text-muted-foreground md:hidden mt-0.5">{row.benchmark}</div>
                  </div>
                  <div className="col-span-2 text-left md:text-right font-mono text-xs text-muted-foreground">
                    <span className="md:hidden text-[10px] text-muted-foreground mr-2">BASE:</span>
                    {row.baseline}
                  </div>
                  <div className="col-span-2 text-left md:text-right font-mono text-xs text-foreground font-semibold">
                    <span className="md:hidden text-[10px] text-muted-foreground mr-2">CODESAGEZ:</span>
                    {row.codesage}
                  </div>
                  <div className="col-span-2 text-left md:text-right font-mono text-xs text-success font-semibold">
                    {row.delta}
                  </div>
                  <div className="col-span-2 hidden md:block text-right font-mono text-[11px] text-muted-foreground">
                    {row.benchmark}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Security / Stability section */}
        <section className="p-6 border border-border bg-surface rounded-[3px] space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h3 className="text-sm font-bold text-foreground font-mono uppercase tracking-wider">
              Stability &amp; Concurrency Mitigations
            </h3>
            <span className="text-[10px] font-mono text-muted-foreground uppercase">ALL INVARIANTS PASSING</span>
          </div>
          
          <div className="divide-y divide-border/60">
            <div className="flex flex-col md:flex-row md:items-center justify-between py-2.5 gap-2">
              <span className="text-xs font-mono font-semibold text-foreground">Memory Bloat (OOM)</span>
              <span className="text-[11px] font-mono text-success flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-success rounded-[1px]"></span> MITIGATED</span>
              <span className="text-xs text-muted-foreground font-mono">Migrated nx.node_link_data JSON directly into normalized GraphEdge SQL.</span>
            </div>
            
            <div className="flex flex-col md:flex-row md:items-center justify-between py-2.5 gap-2">
              <span className="text-xs font-mono font-semibold text-foreground">Thread Starvation</span>
              <span className="text-[11px] font-mono text-success flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-success rounded-[1px]"></span> MITIGATED</span>
              <span className="text-xs text-muted-foreground font-mono">Replaced blocking GitPython calls with native asyncio.create_subprocess_exec.</span>
            </div>
            
            <div className="flex flex-col md:flex-row md:items-center justify-between py-2.5 gap-2">
              <span className="text-xs font-mono font-semibold text-foreground">API Rate Limiting</span>
              <span className="text-[11px] font-mono text-success flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-success rounded-[1px]"></span> MITIGATED</span>
              <span className="text-xs text-muted-foreground font-mono">CircuitBreaker isolates Gemini API timeouts; SingleFlight coalesces RAG queries.</span>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
