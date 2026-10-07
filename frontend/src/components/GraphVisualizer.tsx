"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";

// Mock AST Data for Visualizer
const NODES = [
  { id: "main", label: "main.py", x: 50, y: 50, type: "file" },
  { id: "setup", label: "setup_app()", x: 30, y: 25, type: "function" },
  { id: "router", label: "api_router", x: 70, y: 25, type: "variable" },
  { id: "repo", label: "repo.py", x: 70, y: 70, type: "file" },
  { id: "get_repo", label: "get_repo()", x: 50, y: 90, type: "function" },
  { id: "GraphEdge", label: "GraphEdge", x: 90, y: 90, type: "class" },
];

const EDGES = [
  { source: "main", target: "setup" },
  { source: "main", target: "router" },
  { source: "main", target: "repo" },
  { source: "repo", target: "get_repo" },
  { source: "repo", target: "GraphEdge" },
  { source: "get_repo", target: "GraphEdge" },
];

export function GraphVisualizer() {
  const [activeNode, setActiveNode] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="relative w-full h-[400px] bg-[#0A0A0B] border border-border rounded-sm overflow-hidden flex items-center justify-center font-mono select-none">
      <div className="absolute top-4 left-4 text-xs text-muted-foreground uppercase tracking-widest z-10">
        AST Structural Graph
      </div>
      
      {/* Edges */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        {EDGES.map((edge, i) => {
          const sourceNode = NODES.find(n => n.id === edge.source);
          const targetNode = NODES.find(n => n.id === edge.target);
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
      {NODES.map((node, i) => {
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
