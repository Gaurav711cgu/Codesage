import { api } from "@/lib/api";
import type { BenchmarkData, CategoryResult } from "@/lib/api";
import { FineTuningChart, RagAccuracyChart, PendingChart } from "@/components/BenchmarkChart";

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
    <tr className="border-b border-border">
      <td className="py-2 pr-4 text-sm text-muted-foreground">{label}</td>
      <td className="py-2 pr-4 text-sm text-foreground font-mono">
        {cat.naive !== null
          ? `${cat.naive}% [${cat.naive_ci ?? "—"}]`
          : <span className="text-muted-foreground italic text-xs">pending</span>}
      </td>
      <td className="py-2 text-sm text-foreground font-mono">
        {cat.graph !== null
          ? `${cat.graph}% [${cat.graph_ci ?? "—"}]`
          : <span className="text-muted-foreground italic text-xs">pending</span>}
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
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-12">

      {/* Fine-tuning */}
      <section>
        <h2 className="text-lg font-semibold text-foreground mb-1">Fine-tuning results</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Model: {ft?.model ?? "Qwen2.5-Coder-1.5B-Instruct"} ·{" "}
          {ft?.training_samples ?? 8000} training samples ·{" "}
          {ft?.epochs ?? "—"} epochs
          {ft?.eval_date && ` · Evaluated ${ft.eval_date}`}
        </p>

        <div className="grid grid-cols-2 gap-8">
          <div>
            <p className="text-sm font-medium text-foreground mb-3">
              CodeBLEU (primary metric)
            </p>
            {hasFtData ? (
              <FineTuningChart data={ftChartData} yLabel="CodeBLEU" />
            ) : (
              <PendingChart label="CodeBLEU" />
            )}
            <p className="text-xs text-muted-foreground mt-3">
              CodeBLEU measures how well the model&apos;s generated bug fix matches
              the reference fix across four dimensions: token match, AST structure
              match, data flow match, and code keyword match. Evaluated on the
              held-out CommitPack test set (n=1,000).
            </p>
            {ft?.primary_metric.delta !== null && ft?.primary_metric.delta !== undefined && (
              <p className="text-sm font-mono mt-2 text-green-400">
                Δ +{ft.primary_metric.delta} points
              </p>
            )}
          </div>

          <div>
            <p className="text-sm font-medium text-foreground mb-3">
              HumanEval Pass@1 (forgetting check)
            </p>
            {ft?.secondary_metric.base !== null && ft?.secondary_metric.base !== undefined ? (
              <FineTuningChart data={heChartData} yLabel="Pass@1 (%)" />
            ) : (
              <PendingChart label="HumanEval" />
            )}
            <p className="text-xs text-muted-foreground mt-3">
              HumanEval measures general code completion ability. We use it as a
              catastrophic forgetting check — a small regression is expected since
              our training data does not contain general algorithmic problems.
            </p>
            {ft?.secondary_metric.interpretation && (
              <p className="text-xs text-muted-foreground mt-2 italic">
                {ft.secondary_metric.interpretation}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* RAG accuracy */}
      <section>
        <h2 className="text-lg font-semibold text-foreground mb-1">RAG accuracy</h2>
        <p className="text-sm text-muted-foreground mb-6">
          60 questions across FastAPI, HTTPX, Celery — stratified into
          single-function, cross-file, and call-chain categories.
          Error bars show 95% Wilson confidence intervals.
          {rag?.eval_date && ` Evaluated ${rag.eval_date}.`}
        </p>

        {hasRagData ? (
          <RagAccuracyChart data={ragChartData} />
        ) : (
          <PendingChart label="RAG accuracy — internal benchmark" />
        )}

        {/* Table */}
        <table className="w-full mt-6 text-left">
          <thead>
            <tr className="border-b border-border">
              <th className="py-2 pr-4 text-xs text-muted-foreground font-medium">Category</th>
              <th className="py-2 pr-4 text-xs text-muted-foreground font-medium">Naive</th>
              <th className="py-2 text-xs text-muted-foreground font-medium">Graph-augmented</th>
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

        {/* RepoBench */}
        <div className="mt-6 p-4 bg-card rounded-lg border border-border space-y-1">
          <p className="text-sm font-medium text-foreground">RepoBench-R Recall@10</p>
          <p className="text-sm font-mono">
            Naive: {fmt(rag?.repobench.naive_recall_at_10 ?? null, "%")} ·{" "}
            Graph: {fmt(rag?.repobench.graph_recall_at_10 ?? null, "%")}
            {rag?.repobench.delta !== null && rag?.repobench.delta !== undefined &&
              <span className="text-green-400"> (Δ +{rag.repobench.delta}pp)</span>}
          </p>
        </div>
      </section>

      {/* System performance */}
      <section>
        <h2 className="text-lg font-semibold text-foreground mb-4">System performance</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-card rounded-lg border border-border">
            <p className="text-sm text-muted-foreground mb-1">Ingestion speed (50K LOC)</p>
            <p className="text-2xl font-mono text-foreground">
              {fmt(ing?.avg_seconds_50k_loc ?? null, "s")}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              p95: {fmt(ing?.p95_seconds_50k_loc ?? null, "s")} ·{" "}
              repos: {ing?.test_repos.join(", ") ?? "fastapi, httpx, celery"}
            </p>
          </div>
          <div className="p-4 bg-card rounded-lg border border-border">
            <p className="text-sm text-muted-foreground mb-1">Retrieval latency</p>
            <div className="text-sm font-mono text-foreground space-y-1 mt-1">
              <div>Naive p50: {fmt(ret?.naive_p50_ms ?? null, "ms")} · p95: {fmt(ret?.naive_p95_ms ?? null, "ms")}</div>
              <div>Graph p50: {fmt(ret?.graph_p50_ms ?? null, "ms")} · p95: {fmt(ret?.graph_p95_ms ?? null, "ms")}</div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Measured over {ret?.measurement_queries ?? 100} queries
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
