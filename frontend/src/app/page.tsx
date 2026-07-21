"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Terminal, Code2, BarChart3, Network, ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import ProcessTimeline from "@/components/ProcessTimeline";
import ResearchSection from "@/components/ResearchSection";

const TERMINAL_STATS = [
  { label: "retrieval",  value: "graph-augmented"   },
  { label: "embeddings", value: "local lexical hash" },
  { label: "expansion",  value: "1-hop AST"          },
  { label: "context",    value: "top-8 chunks"       },
];

const PAGES = [
  {
    href: "/repos",
    label: "Repo Explorer",
    desc: "Index a GitHub repo. Ask cross-file questions. Callers and callees are retrieved alongside the direct match.",
    icon: Network,
    delay: 0.1,
    colSpan: "md:col-span-2",
  },
  {
    href: "/playground",
    label: "Code Playground",
    desc: "Paste any snippet. Get severity-ranked issues, an explained bug fix, or a generated test suite.",
    icon: Code2,
    delay: 0.2,
    colSpan: "md:col-span-1",
  },
  {
    href: "/benchmarks",
    label: "Benchmarks",
    desc: "Real call-graph edge recall and retrieval latency from indexed open-source repositories.",
    icon: BarChart3,
    delay: 0.3,
    colSpan: "md:col-span-1",
  },
  {
    href: "/architecture",
    label: "Architecture",
    desc: "7-stage ingestion: tree-sitter → NetworkX call graph → ChromaDB. Dive into how it works under the hood.",
    icon: Terminal,
    delay: 0.4,
    colSpan: "md:col-span-2",
  },
];

export default function Home() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="max-w-[900px] mx-auto px-4 py-20 md:py-32 flex flex-col items-center text-center relative z-10">
      
      {/* Eyebrow */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="label-accent mb-6 bg-primary/10 border border-primary/30 px-3 py-1 rounded-sm shadow-[0_0_15px_rgba(0,255,65,0.15)] backdrop-blur-md inline-block"
      >
        graph-augmented rag · python codebases
      </motion.div>

      {/* Headline */}
      <motion.h1 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="font-mono text-4xl md:text-6xl font-bold leading-tight tracking-tight text-foreground mb-6"
      >
        Understand <br className="md:hidden" />
        <span className="text-primary text-glow">
          any codebase.
        </span>
      </motion.h1>

      {/* Body */}
      <motion.p 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="font-sans text-base md:text-lg leading-relaxed text-muted-foreground max-w-[600px] mb-12"
      >
        Naive RAG retrieves isolated chunks. CodeSageZ retrieves the function you asked about{" "}
        <span className="text-foreground font-medium border-b border-primary/50 pb-0.5">
          and its callers and callees
        </span>
        . One-hop call graph expansion, scored and ranked, fed straight into context.
      </motion.p>

      {/* CTAs */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="flex flex-col sm:flex-row gap-4 mb-20 w-full sm:w-auto"
      >
        <Link
          href="/repos"
          className="font-sans text-sm font-semibold px-8 py-3 bg-primary text-primary-foreground rounded-sm shadow-[0_0_20px_rgba(0,255,65,0.4)] transition-all hover:shadow-[0_0_30px_rgba(0,255,65,0.6)] hover:scale-105 no-underline flex items-center justify-center gap-2 group"
        >
          Index a repo
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </Link>
        <Link
          href="/architecture"
          className="font-sans text-sm font-medium px-8 py-3 border border-white/20 bg-white/5 text-foreground hover:bg-white/10 rounded-md transition-all hover:border-primary/50 hover:shadow-[0_0_15px_rgba(255,255,255,0.05)] no-underline flex items-center justify-center"
        >
          How it works
        </Link>
      </motion.div>

      {/* Terminal stat bar */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="w-full max-w-[800px] mb-24"
      >
        <div className="terminal-bar glass-panel flex-col md:flex-row shadow-[0_0_30px_rgba(0,0,0,0.5)] border-white/10">
          {TERMINAL_STATS.map((s, i) => (
            <div key={s.label} className="terminal-bar-item flex-1 py-4 border-b md:border-b-0 md:border-r border-white/10 last:border-0 relative overflow-hidden group">
              <div className="absolute inset-0 bg-primary/5 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
              <span className="t-label relative z-10 text-white/50">{s.label}</span>
              <span className="t-value relative z-10 text-primary font-bold group-hover:text-glow transition-all">{s.value}</span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Bento Grid Features */}
      <div className="w-full max-w-[900px] grid grid-cols-1 md:grid-cols-3 gap-6 text-left mb-24">
        {PAGES.map((p, i) => {
          const Icon = p.icon;
          return (
            <motion.div
              key={p.href}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.6, delay: p.delay }}
              className={`group ${p.colSpan}`}
            >
              <Link
                href={p.href}
                className="glass-panel block p-8 rounded-sm h-full border border-white/10 hover:border-primary/50 transition-all duration-300 hover:shadow-[0_0_30px_rgba(0,255,65,0.15)] hover:-translate-y-1 no-underline relative overflow-hidden"
              >
                {/* Background glow blob */}
                <div className="absolute -right-20 -top-20 w-40 h-40 bg-primary/10 rounded-none blur-[50px] group-hover:bg-primary/20 transition-all duration-500" />
                
                <div className="relative z-10">
                  <div className="w-12 h-12 rounded-sm bg-white/5 border border-white/10 flex items-center justify-center mb-6 group-hover:border-primary/40 group-hover:bg-primary/10 transition-colors">
                    <Icon className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  
                  <div className="font-mono text-lg font-bold text-foreground mb-3 flex items-center gap-2">
                    {p.label}
                    <ArrowRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-primary" />
                  </div>
                  <p className="font-sans text-sm text-muted-foreground leading-relaxed">
                    {p.desc}
                  </p>
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>

      <ProcessTimeline />
      
      <div className="w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent my-12" />

      <ResearchSection />
      
    </div>
  );
}
