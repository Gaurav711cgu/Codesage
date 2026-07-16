// frontend/src/app/page.tsx
"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Code2, GitBranch, Cpu, LineChart } from "lucide-react";

const STATS = [
  { label: "retrieval strategy",  value: "graph-augmented" },
  { label: "embedding model",     value: "text-embedding-004" },
  { label: "graph depth",         value: "1-hop expansion"  },
  { label: "context window",      value: "top-8 chunks"     },
];

const FEATURES = [
  {
    href: "/repos",
    tag: "01",
    title: "Repo Explorer",
    desc: "Index any public GitHub repo. Ask cross-file questions. The system retrieves callers and callees alongside the direct match.",
    icon: GitBranch,
  },
  {
    href: "/playground",
    tag: "02",
    title: "Code Playground",
    desc: "Paste any snippet. Get a structured review with severity-ranked issues, a bug fix, or a generated test suite.",
    icon: Code2,
  },
  {
    href: "/benchmarks",
    tag: "03",
    title: "Benchmarks",
    desc: "Internal stratified eval across single-function, cross-file, and call-chain questions. Graph vs. naive delta measured.",
    icon: LineChart,
  },
  {
    href: "/architecture",
    tag: "04",
    title: "Architecture",
    desc: "7-stage ingestion pipeline. tree-sitter parse → NetworkX call graph → ChromaDB. Read how it works.",
    icon: Cpu,
  },
];

export default function Home() {
  return (
    <div className="max-w-5xl mx-auto py-24 relative">
      
      {/* Hero Section */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="flex flex-col items-center text-center mb-24 relative z-10"
      >
        {/* Eyebrow */}
        <div className="flex items-center gap-2 mb-8 glass px-4 py-1.5 rounded-full border-primary/30 shadow-[0_0_15px_rgba(168,85,247,0.2)]">
          <div className="w-2 h-2 rounded-full bg-secondary shadow-[0_0_8px_rgba(6,182,212,0.8)] animate-pulse" />
          <span className="font-mono text-xs text-foreground uppercase tracking-widest font-medium">
            Next-Gen RAG Architecture
          </span>
        </div>

        {/* Headline */}
        <h1 className="text-5xl md:text-6xl font-bold text-foreground leading-[1.1] mb-6 tracking-tight">
          Code intelligence that understands<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">
            the entire call graph.
          </span>
        </h1>

        <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl mb-10">
          Naive RAG retrieves isolated chunks. CodeSage retrieves the structural context. 
          By augmenting vector search with 1-hop AST expansion, we pass the exact callers 
          and callees straight into the LLM context window.
        </p>

        {/* CTA */}
        <div className="flex items-center gap-4">
          <Link
            href="/repos"
            className="px-6 py-3 bg-foreground text-background font-semibold 
                       rounded-xl hover:scale-105 hover:shadow-[0_0_20px_rgba(255,255,255,0.3)] transition-all duration-300 flex items-center gap-2"
          >
            Index a repo <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/architecture"
            className="px-6 py-3 glass text-foreground font-medium 
                       rounded-xl hover:bg-white/10 transition-all duration-300"
          >
            How it works
          </Link>
        </div>
      </motion.div>

      {/* Inline stats — monospace data strip */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.2 }}
        className="glass rounded-2xl mb-24 overflow-hidden"
      >
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-white/10">
          {STATS.map((s) => (
            <div key={s.label} className="p-6 text-center">
              <div className="font-mono text-xs text-muted-foreground mb-2 uppercase tracking-wider">{s.label}</div>
              <div className="font-mono text-sm text-foreground font-semibold">{s.value}</div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Bento Grid Features */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.4 }}
        className="grid md:grid-cols-2 gap-6"
      >
        {FEATURES.map((f, i) => (
          <Link
            key={f.href}
            href={f.href}
            className="glass-card p-8 rounded-3xl group relative overflow-hidden"
          >
            {/* Hover Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-secondary/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            
            <div className="relative z-10 flex flex-col h-full">
              <div className="flex items-center justify-between mb-6">
                <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:scale-110 transition-transform duration-500">
                  <f.icon className="w-6 h-6 text-primary" />
                </div>
                <span className="font-mono text-xl text-white/20 font-bold group-hover:text-secondary/40 transition-colors duration-500">
                  {f.tag}
                </span>
              </div>
              
              <h3 className="text-xl font-semibold text-foreground mb-3 flex items-center gap-2">
                {f.title}
                <ArrowRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 text-secondary" />
              </h3>
              
              <p className="text-sm text-muted-foreground leading-relaxed mt-auto">
                {f.desc}
              </p>
            </div>
          </Link>
        ))}
      </motion.div>

    </div>
  );
}
