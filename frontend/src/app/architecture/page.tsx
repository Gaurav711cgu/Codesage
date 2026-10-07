"use client";

import React from "react";
import { Download, FileCode2, Network, Database, BrainCircuit, Search, Rocket } from "lucide-react";
import { GraphVisualizer } from "@/components/GraphVisualizer";

const PIPELINE_STAGES = [
  { icon: Download, title: "1. Clone", desc: "Native async subprocess git clone." },
  { icon: FileCode2, title: "2. Parse AST", desc: "Tree-sitter extracts strict boundaries." },
  { icon: Network, title: "3. Call Graph", desc: "NetworkX directed caller-callee edges." },
  { icon: Database, title: "4. Chunking", desc: "Isolated discrete functional chunks." },
  { icon: BrainCircuit, title: "5. Embedding", desc: "Gemini / Lexical hash dimension embedding." },
  { icon: Database, title: "6. Vector Store", desc: "ChromaDB vector hit storage." },
  { icon: Search, title: "7. Graph RAG", desc: "1-hop expansion via SQL edges." },
];

export default function ArchitecturePage() {
  return (
    <div className="max-w-5xl mx-auto py-16 space-y-16 px-6 font-sans">
      {/* Header */}
      <div className="border-b border-border pb-6">
        <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-2">[ codesagez / architecture ]</div>
        <h1 className="text-3xl font-bold text-foreground">System Architecture</h1>
        <p className="mt-4 text-sm text-muted-foreground max-w-2xl leading-relaxed">
          CodeSageZ employs a resilient 7-stage ingestion pipeline, combining dense vector embeddings with AST-based call graphs (Graph-RAG) stored relationally to mitigate context-window limitations in LLMs.
        </p>
      </div>

      <div className="w-full">
        <GraphVisualizer />
      </div>

      {/* Pipeline Visual */}
      <section>
        <h2 className="text-xl font-bold mb-6 text-foreground font-mono">Pipeline Execution</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {PIPELINE_STAGES.map((stage, idx) => (
            <div key={stage.title} className="p-4 border border-border bg-surface hover:border-primary/50 transition-colors rounded-sm">
              <stage.icon className="w-5 h-5 text-primary mb-3" />
              <h3 className="font-semibold text-foreground text-sm font-mono mb-1">{stage.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{stage.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* RAG Section */}
      <section className="grid md:grid-cols-2 gap-8 items-start border-t border-border pt-12">
        <div>
          <h2 className="text-xl font-bold mb-4 font-mono">Graph-RAG vs Naive RAG</h2>
          <p className="text-sm text-muted-foreground leading-relaxed mb-4">
            Standard RAG chunks source files arbitrarily. If asked about a function relying on hidden internal helpers, naive retrieval forces the LLM to hallucinate missing implementations.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            By storing the Abstract Syntax Tree (AST) relationships normalized in SQL alongside our ChromaDB vector database, CodeSageZ performs <strong>1-hop structural expansion</strong>.
          </p>
        </div>
        
        <div className="p-4 border border-border bg-surface rounded-sm">
          <pre className="text-xs font-mono text-muted-foreground overflow-x-auto">
<code className="text-primary"># 1. Vector Search finds Seed Node</code>
<br/>seed_nodes = vector_db.query(<span className="text-success">&quot;auth?&quot;</span>)
<br/><code className="text-primary"># -&gt; validate_token() [sim: 0.85]</code>
<br/><br/><code className="text-primary"># 2. SQL Graph Edge Expansion</code>
<br/>for node in seed_nodes:
<br/>    context.append( db.get_callers(node) )
<br/>    context.append( db.get_callees(node) )
<br/><br/><code className="text-primary"># Context strictly bound:</code>
<br/>- authenticate() <span className="text-primary/70">[caller]</span>
<br/>- validate_token() <span className="text-primary/70">[seed]</span>
<br/>- decode_jwt() <span className="text-primary/70">[callee]</span>
          </pre>
        </div>
      </section>

    </div>
  );
}
