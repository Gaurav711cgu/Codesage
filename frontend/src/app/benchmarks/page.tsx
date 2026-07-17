import React from "react";
import { api } from "@/lib/api";
import type { BenchmarkData, CategoryResult } from "@/lib/api";
import { FineTuningChart, RagAccuracyChart, PendingChart } from "@/components/BenchmarkChart";
import { Activity, BarChart3, Clock, Zap } from "lucide-react";

// Next.js ISR — revalidate every 10 minutes
export const revalidate = 600;

function fmt(v: number | null, suffix = ""): React.ReactNode {
  return v !== null ? `${v}${suffix}` : <span className="chip">awaiting eval run</span>;
}

function parseCiBounds(ci: string | null): { low: number; high: number } | null {
  if (!ci) return null;
  const [lo, hi] = ci.split("–").map(Number);
  return isNaN(lo) || isNaN(hi) ? null : { low: lo, high: hi };
}

function CategoryRow({
  label,
  cat,
}: {
  label: string;
  cat: CategoryResult;
}) {
  return (
    <tr className="border-b border-border/50 hover:bg-surface-hi transition-colors">
      <td className="py-3 px-4 text-xs text-muted-foreground">{label}</td>
      <td className="py-3 px-4 text-xs text-foreground font-mono">
        {cat.naive !== null
          ? `${cat.naive}% [${cat.naive_ci ?? "—"}]`
          : <span className="chip">awaiting eval run</span>}
      </td>
      <td className="py-3 px-4 text-xs text-primary font-mono">
        {cat.graph !== null
          ? `${cat.graph}% [${cat.graph_ci ?? "—"}]`
          : <span className="chip">awaiting eval run</span>}
      </td>
    </tr>
  );
}

export default async function BenchmarksPage() {
  const res = await api.getBenchmarks();
  const data: BenchmarkData | null = res.data;

  const ft   = data?.fine_tuning;
  const rag  = data?.rag;
  const ing  = data?.ingestion;
  const ret  = data?.retrieval_latency;

  // Prepare chart data
  const ftChartData = [
    {
      name: "CodeBLEU",
      base:      ft?.primary_metric.base      ?? null,
      finetuned: ft?.primary_metric.finetuned ?? null,
    },
  ];
  const heChartData = [
    {
      name: "HumanEval Pass@1 (%)",
      base:      ft?.secondary_metric.base      ?? null,
      finetuned: ft?.secondary_metric.finetuned ?? null,
    },
  ];

  const ragChartData = rag ? [{
    category: "direct_callee",
    naive: rag.graph_edge.naive,
    graph: rag.graph_edge.graph,
    naiveCiLow: parseCiBounds(rag.graph_edge.naive_ci)?.low,
    naiveCiHigh: parseCiBounds(rag.graph_edge.naive_ci)?.high,
    graphCiLow: parseCiBounds(rag.graph_edge.graph_ci)?.low,
    graphCiHigh: parseCiBounds(rag.graph_edge.graph_ci)?.high,
  }] : [];

  const hasFtData  = ft?.primary_metric.base !== null && ft?.primary_metric.base !== undefined;
  const hasRagData = rag?.graph_edge.naive !== null && rag?.graph_edge.naive !== undefined;

  return (
    <div className="max-w-4xl mx-auto py-12 space-y-12">

      {/* Page Header */}
      <div className="space-y-2 border-b border-border pb-6">
        <div className="font-mono text-xs text-primary font-medium uppercase tracking-wider">codesagez / benchmarks</div>
        <p className="text-muted-foreground text-xs">
          Reproducible measurements from real indexed repositories and system retrieval latencies.
        </p>
      </div>

      {/* Fine-tuning */}
      <section className="bg-surface border border-border p-6 rounded-sm">
        <div className="flex items-center gap-2 mb-2">
          <Activity className="w-4 h-4 text-primary" />
          <h2 className="text-base font-semibold text-foreground m-0">Fine-tuning Results</h2>
        </div>
        <p className="font-mono text-[11px] text-muted-foreground mb-6">
          Model: <span className="text-foreground">{ft?.model ?? "Qwen2.5-Coder-1.5B-Instruct"}</span> ·{" "}
          <span className="text-foreground">{ft?.training_samples ?? 8000}</span> training samples ·{" "}
          <span className="text-foreground">{ft?.epochs ?? "—"}</span> epochs
          {ft?.eval_date && ` · Evaluated ${ft.eval_date}`}
        </p>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-background p-5 border border-border rounded-sm">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-semibold text-foreground uppercase tracking-wider font-mono">CodeBLEU <span className="text-muted-foreground text-[10px] font-normal lowercase">(primary)</span></p>
              {ft?.primary_metric.delta !== null && ft?.primary_metric.delta !== undefined && (
                <div className="px-2 py-0.5 bg-success/10 text-success text-[10px] font-mono rounded-sm border border-success/20">
                  Δ +{ft.primary_metric.delta} pts
                </div>
              )}
            </div>
            
            <div className="h-48 mb-4">
              {hasFtData ? (
                <FineTuningChart data={ftChartData} yLabel="CodeBLEU" />
              ) : (
                <PendingChart label="CodeBLEU" />
              )}
            </div>
            
            <p className="text-[11px] text-muted-foreground leading-relaxed bg-surface p-3 border border-border rounded-sm">
              Measures how well generated fixes align with ground truth references across syntax structures, keywords, and data flows.
            </p>
          </div>

          <div className="bg-background p-5 border border-border rounded-sm">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-semibold text-foreground uppercase tracking-wider font-mono">HumanEval Pass@1 <span className="text-muted-foreground text-[10px] font-normal lowercase">(forgetting check)</span></p>
            </div>
            
            <div className="h-48 mb-4">
              {ft?.secondary_metric.base !== null && ft?.secondary_metric.base !== undefined ? (
                <FineTuningChart data={heChartData} yLabel="Pass@1 (%)" />
              ) : (
                <PendingChart label="HumanEval" />
              )}
            </div>
            
            <div className="space-y-2">
              <p className="text-[11px] text-muted-foreground leading-relaxed bg-surface p-3 border border-border rounded-sm">
                Surgical bug-fix fine-tuning can cause catastrophic forgetting. We measure general completion Pass@1 to watch regressions.
              </p>
              {ft?.secondary_metric.interpretation && (
                <p className="text-[11px] text-primary italic px-1 font-mono">
                  {ft.secondary_metric.interpretation}
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* RAG accuracy */}
      <section className="bg-surface border border-border p-6 rounded-sm">
        <div className="flex items-center gap-2 mb-2">
          <BarChart3 className="w-4 h-4 text-primary" />
          <h2 className="text-base font-semibold text-foreground m-0">Call-Graph Retrieval</h2>
        </div>
        <p className="font-mono text-[11px] text-muted-foreground mb-6">
          Direct-callee recall@8 across {rag?.graph_edge.edges ?? "—"} parsed call-graph edges from FastAPI, HTTPX, and Celery, with 95% Wilson confidence intervals.
          {rag?.eval_date && ` Evaluated ${rag.eval_date}.`}
        </p>

        <div className="space-y-6">
          <div className="h-64 w-full bg-background p-5 border border-border rounded-sm">
            {hasRagData ? (
              <RagAccuracyChart data={ragChartData} />
            ) : (
              <PendingChart label="Call-graph retrieval benchmark" />
            )}
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="md:col-span-2 overflow-hidden bg-background border border-border rounded-sm">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border bg-surface-hi">
                    <th className="py-2.5 px-4 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider font-mono">Metric</th>
                    <th className="py-2.5 px-4 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider font-mono">Naive RAG</th>
                    <th className="py-2.5 px-4 text-[10px] text-primary font-semibold uppercase tracking-wider font-mono">Graph RAG</th>
                  </tr>
                </thead>
                <tbody>
                  {rag ? (
                    <CategoryRow label="Direct callee recall@8" cat={rag.graph_edge} />
                  ) : (
                    <tr>
                      <td colSpan={3} className="py-8 text-center text-xs text-muted-foreground font-mono">
                        Run benchmarks/run_graph_edge_eval.py to populate results.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="bg-surface border border-primary/20 p-5 rounded-sm flex flex-col justify-center">
              <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider font-mono mb-3">Measurement scope</h3>
              <p className="text-[11px] leading-relaxed text-muted-foreground">{rag?.graph_edge.description ?? "Awaiting a reproducible benchmark run."}</p>
            </div>
          </div>
        </div>
      </section>

      {/* System performance */}
      <section className="grid md:grid-cols-2 gap-6">
        <div className="bg-surface border border-border p-6 rounded-sm relative overflow-hidden">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground m-0">Ingestion Throughput</h2>
          </div>
          
          <div className="bg-background p-5 border border-border rounded-sm">
            <p className="text-xs text-muted-foreground mb-1">Average time to index 50K LOC</p>
            <div className="flex items-baseline gap-2 font-mono text-3xl font-semibold text-primary">
              {fmt(ing?.avg_seconds_50k_loc ?? null, "s")}
            </div>
            
            <div className="mt-5 pt-5 border-t border-border grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] text-muted-foreground mb-0.5 uppercase tracking-wider font-mono">p95 Latency</p>
                <p className="text-sm font-mono text-foreground">{fmt(ing?.p95_seconds_50k_loc ?? null, "s")}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground mb-0.5 uppercase tracking-wider font-mono">Test Set</p>
                <p className="text-xs text-foreground truncate font-mono" title={ing?.test_repos.join(", ") ?? "fastapi, httpx, celery"}>
                  {ing?.test_repos.join(", ") ?? "fastapi, httpx, celery"}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-surface border border-border p-6 rounded-sm relative overflow-hidden">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground m-0">Retrieval Latency</h2>
          </div>
          
          <div className="space-y-4">
            <div className="bg-background p-4 border border-border rounded-sm flex justify-between items-center">
              <div>
                <h3 className="text-xs font-semibold text-foreground font-mono">Naive RAG</h3>
                <p className="text-[10px] text-muted-foreground">Standard vector search</p>
              </div>
              <div className="text-right font-mono">
                <div className="text-sm text-foreground">{fmt(ret?.naive_p50_ms ?? null, "ms")} <span className="text-[10px] text-muted-foreground font-sans">p50</span></div>
                <div className="text-xs text-muted-foreground">{fmt(ret?.naive_p95_ms ?? null, "ms")} <span className="text-[10px] font-sans">p95</span></div>
              </div>
            </div>

            <div className="bg-primary/5 p-4 border border-primary/20 rounded-sm flex justify-between items-center">
              <div>
                <h3 className="text-xs font-semibold text-primary font-mono">Graph RAG</h3>
                <p className="text-[10px] text-muted-foreground">Vector + 1-hop expansion</p>
              </div>
              <div className="text-right font-mono">
                <div className="text-sm text-primary">{fmt(ret?.graph_p50_ms ?? null, "ms")} <span className="text-[10px] text-muted-foreground font-sans">p50</span></div>
                <div className="text-xs text-muted-foreground">{fmt(ret?.graph_p95_ms ?? null, "ms")} <span className="text-[10px] font-sans">p95</span></div>
              </div>
            </div>

            <p className="text-[10px] text-muted-foreground text-center mt-2 font-mono">
              Measured over {ret?.measurement_queries ?? 100} queries
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
