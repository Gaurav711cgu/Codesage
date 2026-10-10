"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";

const INITIAL_NODES = [
  { id: "file_main_py", label: "main.py", x: 50, y: 45, type: "file" },
  { id: "fn_health_check", label: "health_check()", x: 25, y: 20, type: "function" },
  { id: "file_code_py", label: "api/v1/code.py", x: 75, y: 20, type: "file" },
  { id: "fn_review_code", label: "review_code()", x: 25, y: 75, type: "function" },
  { id: "file_repo_py", label: "api/v1/repo.py", x: 75, y: 75, type: "file" },
  { id: "fn_get_ast_graph", label: "get_ast_graph()", x: 50, y: 85, type: "function" },
  { id: "file_ast_chunker_py", label: "ast_chunker.py", x: 35, y: 50, type: "file" },
  { id: "cls_ASTChunker", label: "ASTChunker", x: 65, y: 50, type: "class" },
];

const INITIAL_EDGES = [
  { source: "file_main_py", target: "fn_health_check" },
  { source: "file_code_py", target: "fn_review_code" },
  { source: "file_repo_py", target: "fn_get_ast_graph" },
  { source: "file_ast_chunker_py", target: "cls_ASTChunker" },
  { source: "file_main_py", target: "file_code_py" },
  { source: "file_main_py", target: "file_repo_py" },
  { source: "file_repo_py", target: "file_ast_chunker_py" },
];

export function GraphVisualizer() {
  const [activeNode, setActiveNode] = useState<string | null>(null);
  const [nodes, setNodes] = useState(INITIAL_NODES);
  const [edges, setEdges] = useState(INITIAL_EDGES);
  const [sourceLabel, setSourceLabel] = useState<string>("AST RELATIONAL CALL GRAPH // TOPOLOGY TRACE");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetch("/api/graph")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.nodes) && data.nodes.length > 0) {
          setNodes(data.nodes);
          setEdges(data.edges || []);
          if (data.source === "live_ast_engine") {
            setSourceLabel("LIVE AST ENGINE // TREE-SITTER SYMBOL MAP");
          }
        }
      })
      .catch(() => {});
  }, []);

  if (!mounted) return null;

  return (
    <div className="relative w-full h-[380px] bg-surface border border-border rounded-[3px] overflow-hidden flex items-center justify-center font-mono select-none">
      <div className="absolute top-3 left-4 text-[10px] text-muted-foreground uppercase tracking-widest z-10 flex items-center gap-2">
        <span className="w-1.5 h-1.5 bg-primary rounded-[1px]"></span>
        <span>{sourceLabel}</span>
      </div>
      
      {/* Edges */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        {edges.map((edge, i) => {
          const sourceNode = nodes.find(n => n.id === edge.source);
          const targetNode = nodes.find(n => n.id === edge.target);
          if (!sourceNode || !targetNode) return null;
          
          const isActive = activeNode === edge.source || activeNode === edge.target;
          
          return (
            <motion.line
              key={i}
              x1={`${sourceNode.x}%`}
              y1={`${sourceNode.y}%`}
              x2={`${targetNode.x}%`}
              y2={`${targetNode.y}%`}
              stroke={isActive ? "hsl(var(--primary))" : "hsl(var(--border))"}
              strokeWidth={isActive ? 1.5 : 1}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: isActive ? 1 : 0.3 }}
              transition={{ duration: 0.6, delay: i * 0.05 }}
            />
          );
        })}
      </svg>
      
      {/* Nodes */}
      {nodes.map((node, i) => {
        const isActive = activeNode === node.id;
        
        return (
          <motion.div
            key={node.id}
            className="absolute flex flex-col items-center justify-center -translate-x-1/2 -translate-y-1/2 cursor-pointer group"
            style={{ left: `${node.x}%`, top: `${node.y}%` }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", delay: 0.2 + i * 0.05 }}
            onMouseEnter={() => setActiveNode(node.id)}
            onMouseLeave={() => setActiveNode(null)}
          >
            {/* Square/Diamond Technical Node */}
            <div className={`w-2.5 h-2.5 rotate-45 mb-1.5 border transition-all ${
              isActive 
                ? 'border-primary bg-primary' 
                : 'border-muted-foreground/60 bg-background'
            }`} />
            
            <div className={`text-[10px] whitespace-nowrap px-2 py-0.5 border transition-colors rounded-[2px] ${
              isActive 
                ? 'border-primary text-primary bg-surface-hi' 
                : 'border-border bg-background text-muted-foreground'
            }`}>
              {node.label}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
