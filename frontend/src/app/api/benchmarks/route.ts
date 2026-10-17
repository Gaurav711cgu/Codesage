import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export interface ParadigmSummary {
  mode: string;
  query_count: number;
  mean_precision_at_1: number;
  mean_precision_at_3: number;
  mean_precision_at_5: number;
  mean_precision_at_8: number;
  mean_recall_at_1: number;
  mean_recall_at_3: number;
  mean_recall_at_5: number;
  mean_recall_at_8: number;
  mean_reciprocal_rank: number;
  latency_p50_ms: number;
  latency_p95_ms: number;
  latency_mean_ms: number;
}

export interface BenchmarkPayload {
  timestamp: string;
  dataset: string;
  summaries: Record<string, ParadigmSummary>;
}

export async function GET() {
  try {
    const filePath = path.resolve(process.cwd(), "../benchmarks/results/offline_eval_results.json");
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf-8");
      const data = JSON.parse(content);
      return NextResponse.json({
        source: "empirical_evaluation",
        timestamp: data.timestamp,
        dataset: data.dataset,
        summaries: data.summaries,
      });
    }
  } catch (error) {
    console.error("Failed to read benchmark results:", error);
  }

  // Fallback defaults grounded in empirical evaluation run
  return NextResponse.json({
    source: "static_receipt",
    timestamp: "2026-10-08T14:52:51Z",
    dataset: "golden_eval_dataset.json",
    summaries: {
      dense: {
        mode: "dense",
        query_count: 20,
        mean_precision_at_1: 0.55,
        mean_precision_at_3: 0.35,
        mean_precision_at_5: 0.27,
        mean_precision_at_8: 0.20,
        mean_recall_at_1: 0.1667,
        mean_recall_at_3: 0.3208,
        mean_recall_at_5: 0.4208,
        mean_recall_at_8: 0.4875,
        mean_reciprocal_rank: 0.5975,
        latency_p50_ms: 67.15,
        latency_p95_ms: 3280.81,
        latency_mean_ms: 227.99,
      },
      bm25: {
        mode: "bm25",
        query_count: 20,
        mean_precision_at_1: 0.55,
        mean_precision_at_3: 0.3333,
        mean_precision_at_5: 0.26,
        mean_precision_at_8: 0.1875,
        mean_recall_at_1: 0.1667,
        mean_recall_at_3: 0.30,
        mean_recall_at_5: 0.40,
        mean_recall_at_8: 0.4583,
        mean_reciprocal_rank: 0.6017,
        latency_p50_ms: 0.09,
        latency_p95_ms: 7.11,
        latency_mean_ms: 0.49,
      },
      hybrid: {
        mode: "hybrid",
        query_count: 20,
        mean_precision_at_1: 0.55,
        mean_precision_at_3: 0.3333,
        mean_precision_at_5: 0.28,
        mean_precision_at_8: 0.1938,
        mean_recall_at_1: 0.1667,
        mean_recall_at_3: 0.3125,
        mean_recall_at_5: 0.4333,
        mean_recall_at_8: 0.4750,
        mean_reciprocal_rank: 0.6225,
        latency_p50_ms: 68.37,
        latency_p95_ms: 73.69,
        latency_mean_ms: 68.09,
      },
      graph: {
        mode: "graph",
        query_count: 20,
        mean_precision_at_1: 0.55,
        mean_precision_at_3: 0.35,
        mean_precision_at_5: 0.27,
        mean_precision_at_8: 0.2062,
        mean_recall_at_1: 0.1667,
        mean_recall_at_3: 0.3208,
        mean_recall_at_5: 0.4208,
        mean_recall_at_8: 0.5042,
        mean_reciprocal_rank: 0.5975,
        latency_p50_ms: 67.81,
        latency_p95_ms: 77.39,
        latency_mean_ms: 68.06,
      },
    },
  });
}
