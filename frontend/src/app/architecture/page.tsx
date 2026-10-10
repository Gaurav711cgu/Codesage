"use client";

import React from "react";
import { GraphVisualizer } from "@/components/GraphVisualizer";

const PIPELINE_STAGES = [
  { id: "01", name: "Clone", engine: "asyncio.subprocess", input: "git clone --depth 1 <url>", output: "Raw Repository Mirror", sla: "<1.2s" },
  { id: "02", name: "Parse AST", engine: "Tree-sitter 0.22", input: "Concrete Syntax Trees", output: "ASTNode Definitions", sla: "Zero Loss" },
  { id: "03", name: "Call Graph", engine: "NetworkX 3.2", input: "Caller -> Callee AST refs", output: "Directed Reference DiGraph", sla: "1-Hop Bound" },
  { id: "04", name: "Chunking", engine: "Semantic AST Chunker", input: "Isolated Class/Def Scopes", output: "Discrete Code Chunks", sla: "<512 tok" },
  { id: "05", name: "Embedding", engine: "Google GenAI (Gemini)", input: "Normalized Code Strings", output: "3072-dim Float Vectors", sla: "Batch 64" },
  { id: "06", name: "Vector Store", engine: "ChromaDB HNSW", input: "Vector + Metadata Payload", output: "Indexed Vector Collection", sla: "P95 < 25ms" },
  { id: "07", name: "Graph RAG", engine: "SingleFlight + SQL Traversal", input: "Query Vector + 1-Hop Graph", output: "Augmented System Prompt", sla: "Total < 50ms" },
];

export default function ArchitecturePage() {
  return (
    <div className="max-w-5xl mx-auto py-12 space-y-12 px-4 sm:px-6 font-sans">
      {/* Header */}
      <div className="border-b border-border pb-6">
        <div className="text-[11px] font-mono text-muted-foreground uppercase tracking-widest mb-1.5 flex items-center gap-2">
          <span>CODESAGEZ</span>
          <span className="text-border">/</span>
          <span className="text-primary font-semibold">ARCHITECTURE SPECIFICATION</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold font-mono text-foreground">Pipeline &amp; Graph Topology</h1>
        <p className="mt-2 text-sm text-muted-foreground max-w-2xl leading-relaxed">
          Combines dense vector similarity with relational abstract syntax tree call graphs (Graph-RAG) to ensure LLM code generations remain grounded in actual repository compilation units.
        </p>
      </div>

      {/* Live Graph Visualizer */}
      <div className="w-full">
        <GraphVisualizer />
      </div>

      {/* Execution Pipeline Table */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold font-mono text-foreground uppercase tracking-wider">
            Ingestion Pipeline Stages
          </h2>
          <span className="text-xs font-mono text-muted-foreground">7 STAGES // DETERMINISTIC</span>
        </div>

        <div className="border border-border bg-surface rounded-[3px] overflow-hidden">
          <div className="hidden md:grid grid-cols-12 px-4 py-2.5 border-b border-border bg-surface-hi/40 text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
            <div className="col-span-1">Stage</div>
            <div className="col-span-2">Name</div>
            <div className="col-span-3">Engine / Worker</div>
            <div className="col-span-4">Transformation</div>
            <div className="col-span-2 text-right">Target SLA</div>
          </div>

          <div className="divide-y divide-border">
            {PIPELINE_STAGES.map((stage) => (
              <div key={stage.id} className="p-4 md:px-4 md:py-3 grid grid-cols-1 md:grid-cols-12 items-start md:items-center gap-2 md:gap-4 hover:bg-surface-hi/50 transition-colors">
                <div className="col-span-1 font-mono text-xs text-primary font-semibold">{stage.id}</div>
                <div className="col-span-2 font-mono text-xs font-semibold text-foreground">{stage.name}</div>
                <div className="col-span-3 font-mono text-xs text-muted-foreground">{stage.engine}</div>
                <div className="col-span-4 text-xs text-muted-foreground">
                  <span className="font-mono text-foreground/80">{stage.output}</span>
                </div>
                <div className="col-span-2 font-mono text-xs text-right text-primary">{stage.sla}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* RAG Context Expansion Comparison */}
      <section className="grid md:grid-cols-2 gap-6 items-start border-t border-border pt-10">
        <div className="space-y-3">
          <h2 className="text-base font-bold font-mono uppercase tracking-wider text-foreground">
            Structural vs Naive Chunking
          </h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Standard semantic chunking splits files by arbitrary token windows. If an LLM is asked about a class that calls internal helpers in sibling modules, naive retrieval returns incomplete signatures, triggering hallucinated implementations.
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            CodeSageZ traverses the NetworkX call graph 1 hop outward from the initial vector match, pulling callers, callees, and type definitions into the prompt without token blowup.
          </p>
        </div>
        
        <div className="p-4 border border-border bg-surface rounded-[3px]">
          <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider pb-2 border-b border-border mb-3">
            Execution Trace // 1-Hop Expansion
          </div>
          <pre className="text-xs font-mono text-muted-foreground overflow-x-auto leading-relaxed">
<span className="text-primary"># 1. Vector Search locates seed node</span>
seed = chroma.query(&quot;auth header token&quot;, k=1)
<span className="text-muted-foreground"># -&gt; match: validate_bearer_token() (sim: 0.88)</span>

<span className="text-primary"># 2. Relational SQL expansion</span>
callers = db.get_callers(&quot;validate_bearer_token&quot;)
callees = db.get_callees(&quot;validate_bearer_token&quot;)

<span className="text-primary"># 3. Exact compiler context injected:</span>
- <span className="text-foreground">auth_middleware()</span> [CALLER]
- <span className="text-foreground">validate_bearer_token()</span> [SEED]
- <span className="text-foreground">decode_jwt_claims()</span> [CALLEE]
          </pre>
        </div>
      </section>
    </div>
  );
}
