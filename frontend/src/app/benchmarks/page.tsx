import { api } from "@/lib/api";
import type { BenchmarkData, CategoryResult } from "@/lib/api";
import { FineTuningChart, RagAccuracyChart, PendingChart } from "@/components/BenchmarkChart";
import { Activity, BarChart3, Clock, Zap } from "lucide-react";

// Next.js ISR — revalidate every 10 minutes
export const revalidate = 600;

function fmt(v: number | null, suffix = ""): string {
  return v !== null ? `${v}${suffix}` : "—";
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
    <tr className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
      <td className="py-3 px-4 text-sm text-muted-foreground">{label}</td>
      <td className="py-3 px-4 text-sm text-foreground font-mono">
        {cat.naive !== null
          ? `${cat.naive}% [${cat.naive_ci ?? "—"}]`
          : <span className="text-muted-foreground italic text-xs bg-white/5 px-2 py-1 rounded-md">pending</span>}
      </td>
      <td className="py-3 px-4 text-sm text-secondary font-mono">
        {cat.graph !== null
          ? `${cat.graph}% [${cat.graph_ci ?? "—"}]`
          : <span className="text-muted-foreground italic text-xs bg-white/5 px-2 py-1 rounded-md">pending</span>}
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

  const ragChartData = rag
    ? [
        {
          category: "single_function",
          naive:    rag.internal.single_function.naive,
          graph:    rag.internal.single_function.graph,
          naiveCiLow:  parseCiBounds(rag.internal.single_function.naive_ci)?.low,
          naiveCiHigh: parseCiBounds(rag.internal.single_function.naive_ci)?.high,
          graphCiLow:  parseCiBounds(rag.internal.single_function.graph_ci)?.low,
          graphCiHigh: parseCiBounds(rag.internal.single_function.graph_ci)?.high,
        },
        {
          category: "cross_file",
          naive:    rag.internal.cross_file.naive,
          graph:    rag.internal.cross_file.graph,
          naiveCiLow:  parseCiBounds(rag.internal.cross_file.naive_ci)?.low,
          naiveCiHigh: parseCiBounds(rag.internal.cross_file.naive_ci)?.high,
          graphCiLow:  parseCiBounds(rag.internal.cross_file.graph_ci)?.low,
          graphCiHigh: parseCiBounds(rag.internal.cross_file.graph_ci)?.high,
        },
        {
          category: "call_chain",
          naive:    rag.internal.call_chain.naive,
          graph:    rag.internal.call_chain.graph,
          naiveCiLow:  parseCiBounds(rag.internal.call_chain.naive_ci)?.low,
          naiveCiHigh: parseCiBounds(rag.internal.call_chain.naive_ci)?.high,
          graphCiLow:  parseCiBounds(rag.internal.call_chain.graph_ci)?.low,
          graphCiHigh: parseCiBounds(rag.internal.call_chain.graph_ci)?.high,
        },
      ]
    : [];

  const hasFtData  = ft?.primary_metric.base !== null;
  const hasRagData = rag?.internal.cross_file.naive !== null;

  return (
    <div className="max-w-6xl mx-auto py-16 space-y-16">

      {/* Page Header */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold tracking-tight text-foreground">
          System <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">Benchmarks</span>
        </h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          Comprehensive performance evaluation across model fine-tuning, RAG accuracy, and system latencies.
        </p>
      </div>

      {/* Fine-tuning */}
      <section className="glass rounded-3xl p-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-primary/20 rounded-lg">
            <Activity className="w-5 h-5 text-primary" />
          </div>
          <h2 className="text-2xl font-semibold text-foreground">Fine-tuning results</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-8 ml-11">
          Model: <span className="text-foreground">{ft?.model ?? "Qwen2.5-Coder-1.5B-Instruct"}</span> ·{" "}
          <span className="text-foreground">{ft?.training_samples ?? 8000}</span> training samples ·{" "}
          <span className="text-foreground">{ft?.epochs ?? "—"}</span> epochs
          {ft?.eval_date && ` · Evaluated ${ft.eval_date}`}
        </p>

        <div className="grid md:grid-cols-2 gap-8 ml-11">
          <div className="bg-background/40 p-6 rounded-2xl border border-white/5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-base font-medium text-foreground">CodeBLEU <span className="text-muted-foreground text-sm font-normal">(Primary metric)</span></p>
              {ft?.primary_metric.delta !== null && ft?.primary_metric.delta !== undefined && (
                <div className="px-2 py-1 bg-green-500/10 text-green-400 text-xs font-mono rounded-md border border-green-500/20 flex items-center gap-1">
                  Δ +{ft.primary_metric.delta} pts
                </div>
              )}
            </div>
            
            <div className="h-64 mb-4">
              {hasFtData ? (
                <FineTuningChart data={ftChartData} yLabel="CodeBLEU" />
              ) : (
                <PendingChart label="CodeBLEU" />
              )}
            </div>
            
            <p className="text-xs text-muted-foreground leading-relaxed bg-white/5 p-3 rounded-lg border border-white/5">
              CodeBLEU measures how well the model&apos;s generated bug fix matches
              the reference fix across four dimensions: token match, AST structure
              match, data flow match, and code keyword match.
            </p>
          </div>

          <div className="bg-background/40 p-6 rounded-2xl border border-white/5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-base font-medium text-foreground">HumanEval Pass@1 <span className="text-muted-foreground text-sm font-normal">(Forgetting check)</span></p>
            </div>
            
            <div className="h-64 mb-4">
              {ft?.secondary_metric.base !== null && ft?.secondary_metric.base !== undefined ? (
                <FineTuningChart data={heChartData} yLabel="Pass@1 (%)" />
              ) : (
                <PendingChart label="HumanEval" />
              )}
            </div>
            
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground leading-relaxed bg-white/5 p-3 rounded-lg border border-white/5">
                HumanEval measures general code completion ability. We use it as a
                catastrophic forgetting check — a small regression is expected since
                our training data focuses on surgical bug fixes.
              </p>
              {ft?.secondary_metric.interpretation && (
                <p className="text-xs text-secondary italic px-1">
                  {ft.secondary_metric.interpretation}
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* RAG accuracy */}
      <section className="glass rounded-3xl p-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-secondary/20 rounded-lg">
            <BarChart3 className="w-5 h-5 text-secondary" />
          </div>
          <h2 className="text-2xl font-semibold text-foreground">RAG Accuracy</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-8 ml-11">
          60 questions across FastAPI, HTTPX, Celery — stratified into
          single-function, cross-file, and call-chain categories.
          Error bars show 95% Wilson confidence intervals.
          {rag?.eval_date && ` Evaluated ${rag.eval_date}.`}
        </p>

        <div className="ml-11 space-y-8">
          <div className="h-80 w-full bg-background/40 p-6 rounded-2xl border border-white/5">
            {hasRagData ? (
              <RagAccuracyChart data={ragChartData} />
            ) : (
              <PendingChart label="RAG accuracy — internal benchmark" />
            )}
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="md:col-span-2 overflow-hidden bg-background/40 rounded-2xl border border-white/5">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.02]">
                    <th className="py-3 px-4 text-xs text-muted-foreground font-semibold uppercase tracking-wider">Category</th>
                    <th className="py-3 px-4 text-xs text-muted-foreground font-semibold uppercase tracking-wider">Naive RAG</th>
                    <th className="py-3 px-4 text-xs text-secondary font-semibold uppercase tracking-wider">Graph RAG</th>
                  </tr>
                </thead>
                <tbody>
                  {rag && (
                    <>
                      <CategoryRow label="Single-function (n=20)" cat={rag.internal.single_function} />
                      <CategoryRow label="Cross-file (n=20)"      cat={rag.internal.cross_file} />
                      <CategoryRow label="Call-chain (n=20)"      cat={rag.internal.call_chain} />
                    </>
                  )}
                </tbody>
              </table>
            </div>

            <div className="bg-gradient-to-br from-primary/10 to-secondary/10 p-6 rounded-2xl border border-white/10 flex flex-col justify-center">
              <h3 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                RepoBench-R Recall@10
              </h3>
              <div className="space-y-3">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Naive Baseline</div>
                  <div className="text-2xl font-mono">{fmt(rag?.repobench.naive_recall_at_10 ?? null, "%")}</div>
                </div>
                <div>
                  <div className="text-xs text-secondary mb-1">Graph-Augmented</div>
                  <div className="text-3xl font-mono text-secondary flex items-baseline gap-2">
                    {fmt(rag?.repobench.graph_recall_at_10 ?? null, "%")}
                    {rag?.repobench.delta !== null && rag?.repobench.delta !== undefined && (
                      <span className="text-sm text-green-400 bg-green-500/10 px-2 py-0.5 rounded-md">
                        Δ +{rag.repobench.delta}pp
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* System performance */}
      <section className="grid md:grid-cols-2 gap-6">
        <div className="glass rounded-3xl p-8 relative overflow-hidden group">
          <div className="absolute -right-6 -top-6 text-primary/5 group-hover:scale-110 transition-transform duration-500 pointer-events-none">
            <Zap className="w-48 h-48" />
          </div>
          <div className="flex items-center gap-3 mb-6 relative z-10">
            <div className="p-2 bg-primary/20 rounded-lg">
              <Zap className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-xl font-semibold text-foreground">Ingestion Speed</h2>
          </div>
          
          <div className="bg-background/40 p-6 rounded-2xl border border-white/5 relative z-10">
            <p className="text-sm text-muted-foreground mb-2">Average time to index 50K LOC</p>
            <div className="flex items-baseline gap-2">
              <p className="text-5xl font-mono font-semibold text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">
                {fmt(ing?.avg_seconds_50k_loc ?? null, "s")}
              </p>
            </div>
            
            <div className="mt-6 pt-6 border-t border-white/5 grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">p95 Latency</p>
                <p className="text-lg font-mono text-foreground">{fmt(ing?.p95_seconds_50k_loc ?? null, "s")}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Test Set</p>
                <p className="text-sm text-foreground truncate" title={ing?.test_repos.join(", ") ?? "fastapi, httpx, celery"}>
                  {ing?.test_repos.join(", ") ?? "fastapi, httpx, celery"}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="glass rounded-3xl p-8 relative overflow-hidden group">
          <div className="absolute -right-6 -top-6 text-secondary/5 group-hover:scale-110 transition-transform duration-500 pointer-events-none">
            <Clock className="w-48 h-48" />
          </div>
          <div className="flex items-center gap-3 mb-6 relative z-10">
            <div className="p-2 bg-secondary/20 rounded-lg">
              <Clock className="w-5 h-5 text-secondary" />
            </div>
            <h2 className="text-xl font-semibold text-foreground">Retrieval Latency</h2>
          </div>
          
          <div className="space-y-4 relative z-10">
            <div className="bg-background/40 p-5 rounded-2xl border border-white/5 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-medium text-foreground">Naive RAG</h3>
                <p className="text-xs text-muted-foreground">Standard vector search</p>
              </div>
              <div className="text-right">
                <div className="text-lg font-mono text-foreground">{fmt(ret?.naive_p50_ms ?? null, "ms")} <span className="text-xs text-muted-foreground font-sans">p50</span></div>
                <div className="text-sm font-mono text-muted-foreground">{fmt(ret?.naive_p95_ms ?? null, "ms")} <span className="text-xs font-sans">p95</span></div>
              </div>
            </div>

            <div className="bg-primary/5 p-5 rounded-2xl border border-primary/20 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-medium text-primary">Graph RAG</h3>
                <p className="text-xs text-muted-foreground">Vector + 1-hop expansion</p>
              </div>
              <div className="text-right">
                <div className="text-lg font-mono text-primary">{fmt(ret?.graph_p50_ms ?? null, "ms")} <span className="text-xs text-muted-foreground font-sans">p50</span></div>
                <div className="text-sm font-mono text-muted-foreground">{fmt(ret?.graph_p95_ms ?? null, "ms")} <span className="text-xs font-sans">p95</span></div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground text-center mt-2">
              Measured over {ret?.measurement_queries ?? 100} automated queries
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
