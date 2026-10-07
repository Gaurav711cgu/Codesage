import React from 'react';
import { TrendingUp, Database, BrainCircuit, ShieldCheck } from 'lucide-react';
import { BenchmarkChart } from '@/components/BenchmarkChart';

export default function BenchmarksPage() {
  return (
    <div className="max-w-5xl mx-auto py-16 space-y-16 px-6 font-sans">
      
      {/* Header */}
      <div className="border-b border-border pb-6">
        <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-2">[ codesagez / benchmarks ]</div>
        <h1 className="text-3xl font-bold text-foreground">Empirical Evaluation</h1>
        <p className="mt-4 text-sm text-muted-foreground max-w-2xl leading-relaxed">
          System performance metrics evaluated against naive baselines. Measurements validate the effectiveness of structural Graph-RAG expansion over semantic-only vector databases.
        </p>
      </div>

      <main className="w-full space-y-12">
        
        {/* Core RAG Metric Chart */}
        <section>
          <BenchmarkChart />
        </section>

        {/* System Stats Grid */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 border border-border bg-surface flex flex-col items-start gap-4 rounded-sm">
            <Database className="w-6 h-6 text-primary" />
            <div>
              <div className="text-2xl font-mono text-foreground">0.0%</div>
              <div className="text-xs text-muted-foreground font-mono uppercase mt-1">Naive Recall@8</div>
            </div>
            <p className="text-[11px] text-muted-foreground">Standard semantic chunking fails to fetch interconnected call graph dependencies.</p>
          </div>

          <div className="p-6 border border-border bg-surface flex flex-col items-start gap-4 rounded-sm border-l-2 border-l-primary">
            <TrendingUp className="w-6 h-6 text-primary" />
            <div>
              <div className="text-2xl font-mono text-foreground">50.8%</div>
              <div className="text-xs text-muted-foreground font-mono uppercase mt-1">Graph Recall@8</div>
            </div>
            <p className="text-[11px] text-muted-foreground">1-hop AST structural expansion successfully retrieves callers and callees.</p>
          </div>

          <div className="p-6 border border-border bg-surface flex flex-col items-start gap-4 rounded-sm">
            <BrainCircuit className="w-6 h-6 text-primary" />
            <div>
              <div className="text-2xl font-mono text-foreground">70.02</div>
              <div className="text-xs text-muted-foreground font-mono uppercase mt-1">CodeBLEU Score</div>
            </div>
            <p className="text-[11px] text-muted-foreground">Qwen2.5 QLoRA finetuned model achieves +9.38 improvement over base model.</p>
          </div>
        </section>

        {/* Security / Stability section */}
        <section className="p-8 border border-border bg-surface-hi rounded-sm">
          <h3 className="text-lg font-bold text-foreground mb-6 flex items-center gap-3 font-mono uppercase tracking-widest">
            <ShieldCheck className="text-primary w-5 h-5" />
            Stability Enhancements
          </h3>
          
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between py-3 border-b border-border gap-2">
              <span className="text-sm font-semibold text-foreground">Memory Bloat (OOM)</span>
              <span className="text-xs font-mono text-success flex items-center gap-2"><span className="w-1.5 h-1.5 bg-success rounded-full"></span> mitigated</span>
              <span className="text-sm text-muted-foreground">Migrated `nx.node_link_data` JSON directly into normalized `GraphEdge` SQL.</span>
            </div>
            
            <div className="flex flex-col md:flex-row md:items-center justify-between py-3 border-b border-border gap-2">
              <span className="text-sm font-semibold text-foreground">Thread Starvation</span>
              <span className="text-xs font-mono text-success flex items-center gap-2"><span className="w-1.5 h-1.5 bg-success rounded-full"></span> mitigated</span>
              <span className="text-sm text-muted-foreground">Replaced blocking GitPython threads with `asyncio.create_subprocess_exec`.</span>
            </div>
            
            <div className="flex flex-col md:flex-row md:items-center justify-between py-3 gap-2">
              <span className="text-sm font-semibold text-foreground">API Rate Limiting</span>
              <span className="text-xs font-mono text-success flex items-center gap-2"><span className="w-1.5 h-1.5 bg-success rounded-full"></span> mitigated</span>
              <span className="text-sm text-muted-foreground">CircuitBreaker isolates Gemini API timeouts; SingleFlight coalesces RAG queries.</span>
            </div>
          </div>
        </section>

      </main>
    </div>
  );
}
