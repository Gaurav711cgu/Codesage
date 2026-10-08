"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";

// Fallback AST nodes from live codebase
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
  const [sourceLabel, setSourceLabel] = useState<string>("AST Structural Graph");
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
            setSourceLabel("AST Structural Graph · Live Codebase AST Engine");
          }
        }
      })
      .catch(() => {});
  }, []);

  if (!mounted) return null;

  return (
    <div className="relative w-full h-[400px] bg-[#0A0A0B] border border-border rounded-sm overflow-hidden flex items-center justify-center font-mono select-none">
      <div className="absolute top-4 left-4 text-xs text-muted-foreground uppercase tracking-widest z-10">
        {sourceLabel}
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
              strokeWidth={isActive ? 2 : 1}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: isActive ? 1 : 0.4 }}
              transition={{ duration: 1, delay: i * 0.1 }}
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
            className={`absolute flex flex-col items-center justify-center -translate-x-1/2 -translate-y-1/2 cursor-crosshair group`}
            style={{ left: `${node.x}%`, top: `${node.y}%` }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", delay: 0.5 + i * 0.1 }}
            onMouseEnter={() => setActiveNode(node.id)}
            onMouseLeave={() => setActiveNode(null)}
          >
            <div className={`w-3 h-3 rounded-full mb-2 transition-colors ${isActive ? 'bg-primary shadow-[0_0_10px_hsl(var(--primary))]' : 'bg-muted-foreground'}`} />
            <div className={`text-[10px] whitespace-nowrap px-2 py-1 rounded-sm border transition-colors ${isActive ? 'border-primary text-primary bg-primary/10' : 'border-border bg-surface text-muted-foreground'}`}>
              {node.label}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
