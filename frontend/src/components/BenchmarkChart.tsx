"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ErrorBar,
  ResponsiveContainer,
  Cell,
} from "recharts";

// ─── Fine-tuning chart (CodeBLEU / HumanEval) ────────────────────────────────

interface FTBarData {
  name: string;
  base: number | null;
  finetuned: number | null;
}

interface FineTuningChartProps {
  data: FTBarData[];
  yLabel?: string;
}

export function FineTuningChart({ data, yLabel }: FineTuningChartProps) {
  const chartData = data.map((d) => ({
    name: d.name,
    "Base model": d.base ?? 0,
    "Fine-tuned": d.finetuned ?? 0,
    pending: d.base === null || d.finetuned === null,
  }));

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(216 34% 17%)" />
        <XAxis dataKey="name" tick={{ fill: "hsl(215.4 16.3% 56.9%)", fontSize: 12 }} />
        <YAxis
          tick={{ fill: "hsl(215.4 16.3% 56.9%)", fontSize: 12 }}
          label={
            yLabel
              ? { value: yLabel, angle: -90, position: "insideLeft",
                  fill: "hsl(215.4 16.3% 56.9%)", fontSize: 11 }
              : undefined
          }
        />
        <Tooltip
          contentStyle={{
            background: "hsl(224 71% 6%)",
            border: "1px solid hsl(216 34% 17%)",
            borderRadius: 6,
            color: "hsl(213 31% 91%)",
            fontSize: 12,
          }}
          formatter={(value: number, name: string) =>
            value === 0 ? ["—", name] : [`${value}`, name]
          }
        />
        <Legend wrapperStyle={{ fontSize: 12, color: "hsl(215.4 16.3% 56.9%)" }} />
        <Bar dataKey="Base model" fill="hsl(222.2 47.4% 40%)" radius={[3, 3, 0, 0]} />
        <Bar dataKey="Fine-tuned" fill="hsl(210 90% 56%)" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Graph retrieval chart ───────────────────────────────────────────────────

interface RagCategoryData {
  category: string;
  naive: number | null;
  graph: number | null;
  naiveCiLow?: number;
  naiveCiHigh?: number;
  graphCiLow?: number;
  graphCiHigh?: number;
}

interface RagChartProps {
  data: RagCategoryData[];
}

function parseCi(ci: string | null | undefined): [number, number] | null {
  if (!ci) return null;
  const parts = ci.split("–").map(Number);
  return parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])
    ? [parts[0], parts[1]]
    : null;
}

export function RagAccuracyChart({ data }: RagChartProps) {
  const chartData = data.map((d) => {
    const naiveCi = d.naive !== null ? [d.naive - (d.naiveCiLow ?? d.naive),
                                        (d.naiveCiHigh ?? d.naive) - d.naive] : [0, 0];
    const graphCi = d.graph !== null ? [d.graph - (d.graphCiLow ?? d.graph),
                                        (d.graphCiHigh ?? d.graph) - d.graph] : [0, 0];
    return {
      category: d.category,
      Naive:    d.naive  ?? 0,
      Graph:    d.graph  ?? 0,
      naiveCi,
      graphCi,
    };
  });

  const CATEGORY_LABELS: Record<string, string> = {
    direct_callee: "Direct callee",
  };

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(216 34% 17%)" />
        <XAxis
          dataKey="category"
          tickFormatter={(v) => CATEGORY_LABELS[v] ?? v}
          tick={{ fill: "hsl(215.4 16.3% 56.9%)", fontSize: 12 }}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fill: "hsl(215.4 16.3% 56.9%)", fontSize: 12 }}
          tickFormatter={(v) => `${v}%`}
        />
        <Tooltip
          contentStyle={{
            background: "hsl(224 71% 6%)",
            border: "1px solid hsl(216 34% 17%)",
            borderRadius: 6,
            color: "hsl(213 31% 91%)",
            fontSize: 12,
          }}
          formatter={(value: number, name: string) =>
            value === 0 ? ["—", name] : [`${value}%`, name]
          }
        />
        <Legend wrapperStyle={{ fontSize: 12, color: "hsl(215.4 16.3% 56.9%)" }} />
        <Bar dataKey="Naive" fill="hsl(222.2 47.4% 40%)" radius={[3, 3, 0, 0]}>
          <ErrorBar dataKey="naiveCi" width={4} strokeWidth={2}
                    stroke="hsl(215.4 16.3% 56.9%)" direction="y" />
        </Bar>
        <Bar dataKey="Graph" fill="hsl(210 90% 56%)" radius={[3, 3, 0, 0]}>
          <ErrorBar dataKey="graphCi" width={4} strokeWidth={2}
                    stroke="hsl(215.4 16.3% 56.9%)" direction="y" />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Pending placeholder ──────────────────────────────────────────────────────

export function PendingChart({ label }: { label: string }) {
  return (
    <div className="h-60 flex items-center justify-center rounded-lg border border-dashed border-border">
      <p className="text-muted-foreground text-sm italic">{label} — benchmark pending</p>
    </div>
  );
}
