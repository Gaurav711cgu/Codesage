"use client";

import React from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

export interface ParadigmDataPoint {
  name: string;
  recall: number;
  color: string;
  latency: string;
  mrr: string;
}

interface BenchmarkChartProps {
  dataPoints?: ParadigmDataPoint[];
}

const DEFAULT_DATA: ParadigmDataPoint[] = [
  {
    name: "BM25 Keyword",
    recall: 45.8,
    color: "hsl(var(--muted-foreground))",
    latency: "0.1ms",
    mrr: "0.6017",
  },
  {
    name: "Dense Vector (MiniLM)",
    recall: 48.8,
    color: "#64748b",
    latency: "67.2ms",
    mrr: "0.5975",
  },
  {
    name: "Hybrid RRF (Dense+BM25)",
    recall: 47.5,
    color: "#3b82f6",
    latency: "68.4ms",
    mrr: "0.6225",
  },
  {
    name: "Graph-Augmented RAG",
    recall: 50.4,
    color: "hsl(var(--primary))",
    latency: "67.8ms",
    mrr: "0.5975",
  },
];

export function BenchmarkChart({ dataPoints = DEFAULT_DATA }: BenchmarkChartProps) {
  const bestRecall = Math.max(...dataPoints.map((d) => d.recall));

  return (
    <div className="w-full bg-surface border border-border p-6 rounded-sm shadow-2xl flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-6 border-b border-border/40 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-foreground font-mono text-sm tracking-wider uppercase font-bold">
              Recall@8 Across 4 Retrieval Paradigms
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
              EMPIRICALLY VERIFIED
            </span>
          </div>
          <p className="text-muted-foreground text-xs font-mono mt-1">
            Golden multi-hop dependency evaluation on FastAPI, HTTPX, Celery (20 AST queries)
          </p>
        </div>
        <div className="text-left sm:text-right">
          <div className="text-primary text-2xl font-mono font-bold">{bestRecall.toFixed(1)}%</div>
          <p className="text-muted-foreground text-[10px] font-mono uppercase tracking-wider">Top Recall@8 (Graph-RAG)</p>
        </div>
      </div>

      <div className="w-full h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={dataPoints} layout="vertical" margin={{ top: 0, right: 30, left: 20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
            <XAxis
              type="number"
              domain={[0, 60]}
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              tickFormatter={(tick) => `${tick}%`}
            />
            <YAxis
              dataKey="name"
              type="category"
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              width={170}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: "hsl(var(--surface-hi)/30)" }}
              contentStyle={{
                backgroundColor: "hsl(var(--surface-hi))",
                borderColor: "hsl(var(--border))",
                borderRadius: "3px",
                fontFamily: '"IBM Plex Mono", monospace',
                fontSize: "12px",
              }}
              itemStyle={{ color: "hsl(var(--foreground))" }}
              formatter={(value, _name, item) => {
                const payload = (item as unknown as { payload: ParadigmDataPoint }).payload;
                return [
                  `${value}% (MRR: ${payload.mrr}, P50 Latency: ${payload.latency})`,
                  "Recall@8",
                ];
              }}
            />
            <Bar dataKey="recall" radius={[0, 3, 3, 0]} barSize={28}>
              {dataPoints.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6 pt-4 border-t border-border/40 text-xs font-mono">
        {dataPoints.map((dp) => (
          <div key={dp.name} className="p-2.5 rounded bg-surface-hi/30 border border-border/40">
            <div className="text-[11px] text-muted-foreground truncate">{dp.name}</div>
            <div className="text-base font-bold text-foreground mt-0.5">{dp.recall.toFixed(1)}%</div>
            <div className="text-[10px] text-muted-foreground mt-1 flex justify-between">
              <span>MRR {dp.mrr}</span>
              <span>{dp.latency}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
