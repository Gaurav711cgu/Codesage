"use client";

import React, { useState } from "react";
import { TerminalView } from "./TerminalView";

const INGESTION_LOGS = [
  "INIT subprocess: git clone --depth=1 https://github.com/tiangolo/fastapi.git",
  "Cloning into 'fastapi'...",
  "RESOLVED repo cloned in 0.84s. Spawning AST worker.",
  "PARSING 142 Python files via tree-sitter-python...",
  "EXTRACTED 844 functions, 219 classes. Creating nodes.",
  "BUILDING NetworkX call graph...",
  "MAPPED 1,204 structural edges (caller -> callee).",
  "EMBEDDING via google-genai (gemini-2.0-flash)...",
  "UPSERT ChromaDB: inserted 1,063 vector embeddings.",
  "SQL INSERT: storing 1,204 normalized graph edges.",
  "SUCCESS: Repository 'fastapi' ingestion complete."
];

const RETRIEVAL_LOGS = [
  "RECV Query: 'How does the dependency injection system work?'",
  "SINGLEFLIGHT: Coalescing identical concurrent requests...",
  "EMBEDDING query string -> 3072-dim vector (Gemini).",
  "CHROMADB: Dense semantic search (top_k=5)...",
  "MATCH [0.89]: fastapi/dependencies/models.py (Dependant)",
  "MATCH [0.85]: fastapi/dependencies/utils.py (get_dependant)",
  "GRAPH TRAVERSAL: Expanding 1-hop structural edges...",
  "FOUND EDGE: get_dependant() calls solve_dependencies()",
  "FOUND EDGE: solve_dependencies() calls request_params()",
  "AUGMENTING context window with 3 extra AST nodes.",
  "LLM SYNTHESIS: Yielding SSE stream back to client."
];

export function SystemSimulation() {
  const [mode, setMode] = useState<"ingestion" | "retrieval">("ingestion");
  const [trigger, setTrigger] = useState(0); // to force re-render/re-stream

  return (
    <div className="flex flex-col gap-4 w-full max-w-4xl mx-auto my-8">
      <div className="flex items-center justify-between border-b border-border pb-2">
        <h3 className="font-mono text-sm uppercase tracking-widest text-primary">System Simulation</h3>
        <div className="flex gap-2">
          <button 
            className={`px-3 py-1 text-xs font-mono border ${mode === 'ingestion' ? 'border-primary text-primary bg-primary/10' : 'border-border text-muted-foreground hover:text-foreground'}`}
            onClick={() => { setMode("ingestion"); setTrigger(t => t + 1); }}
          >
            INGESTION
          </button>
          <button 
            className={`px-3 py-1 text-xs font-mono border ${mode === 'retrieval' ? 'border-primary text-primary bg-primary/10' : 'border-border text-muted-foreground hover:text-foreground'}`}
            onClick={() => { setMode("retrieval"); setTrigger(t => t + 1); }}
          >
            RETRIEVAL
          </button>
        </div>
      </div>
      
      <div className="grid md:grid-cols-2 gap-6">
        <div className="flex flex-col justify-center gap-6 p-4">
          <div>
            <h4 className="text-foreground font-semibold mb-2">
              {mode === "ingestion" ? "AST Pipeline & Subprocesses" : "Graph-RAG & SingleFlight"}
            </h4>
            <p className="text-sm text-muted-foreground">
              {mode === "ingestion" 
                ? "CodeSageZ avoids thread starvation by using native async subprocesses for heavy I/O like git cloning, before handing off to Tree-sitter for AST graph generation and Gemini for dense vector embeddings." 
                : "Retrieval coalesces duplicate requests via SingleFlight, performs a dense vector search in ChromaDB, and finally traverses relational SQL edges to retrieve strict structural compilation contexts."}
            </p>
          </div>
          
          <div className="flex flex-col gap-2 p-4 border border-border bg-surface-hi/50 rounded-sm">
            <span className="text-xs font-mono text-primary mb-1">Architecture Components:</span>
            <div className="flex items-center gap-2 text-sm text-foreground">
              <span className="w-2 h-2 rounded-full bg-success"></span> 
              {mode === "ingestion" ? "Tree-sitter Parser" : "SingleFlight Group"}
            </div>
            <div className="flex items-center gap-2 text-sm text-foreground">
              <span className="w-2 h-2 rounded-full bg-success"></span> 
              {mode === "ingestion" ? "NetworkX Graph Builder" : "Circuit Breaker"}
            </div>
            <div className="flex items-center gap-2 text-sm text-foreground">
              <span className="w-2 h-2 rounded-full bg-success"></span> 
              {mode === "ingestion" ? "ChromaDB Upsert" : "Graph Edge Traversal"}
            </div>
          </div>
        </div>

        {/* Use the trigger as key to force remount and re-trigger typing effect */}
        <TerminalView 
          key={trigger} 
          lines={mode === "ingestion" ? INGESTION_LOGS : RETRIEVAL_LOGS} 
          className="h-80" 
        />
      </div>
    </div>
  );
}
