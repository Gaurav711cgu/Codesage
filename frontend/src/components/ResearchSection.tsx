"use client";

import { motion } from "framer-motion";
import { Lightbulb, AlertTriangle, CheckCircle2, FlaskConical, ArrowRight } from "lucide-react";

export default function ResearchSection() {
  return (
    <div className="w-full max-w-[900px] mx-auto py-24 px-4 relative z-10">
      
      <div className="text-center mb-16">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="inline-flex items-center gap-2 label-accent mb-6 bg-primary/10 border border-primary/30 px-4 py-1.5 rounded-full shadow-[0_0_15px_rgba(35,196,232,0.15)]"
        >
          <FlaskConical className="w-4 h-4 text-primary" />
          <span className="font-mono text-sm uppercase tracking-wider text-primary">Research & Engineering</span>
        </motion.div>
        
        <motion.h2 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="font-mono text-3xl md:text-4xl font-bold mb-4"
        >
          The Journey to <span className="text-primary text-glow">53.3% Better Recall</span>
        </motion.h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* The Discovery */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="glass-panel p-8 rounded-2xl border border-white/10 md:col-span-2 relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[80px] group-hover:bg-primary/10 transition-colors" />
          <div className="flex items-start gap-4 relative z-10">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
              <Lightbulb className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h3 className="font-mono text-xl font-bold text-foreground mb-2">The Core Discovery</h3>
              <p className="font-sans text-muted-foreground leading-relaxed">
                Standard RAG operates on dense vectors, completely destroying the structural hierarchy of code. We hypothesized that if we could preserve the <strong>Call Graph</strong> and expand the LLM&apos;s context window by strictly 1-hop (immediate callers and callees), we could drastically reduce hallucination. The result? A <span className="text-primary font-medium">53.3% improvement in exact-match recall</span> over naive cosine similarity.
              </p>
            </div>
          </div>
        </motion.div>

        {/* The Struggle */}
        <motion.div 
          initial={{ opacity: 0, x: -30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="glass-panel p-8 rounded-2xl border border-red-500/20 hover:border-red-500/40 transition-colors"
        >
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="w-6 h-6 text-red-400" />
            <h3 className="font-mono text-lg font-bold text-foreground">Where Things Got Worse</h3>
          </div>
          <p className="font-sans text-sm text-muted-foreground leading-relaxed">
            Initially, we tried using LLMs to extract the call graph from raw text during ingestion. This was a disaster. It was unacceptably slow (taking hours for medium-sized repos) and prone to hallucinations, fabricating function calls that didn&apos;t exist. Graph databases like Neo4j introduced too much network overhead.
          </p>
        </motion.div>

        {/* The Triumph */}
        <motion.div 
          initial={{ opacity: 0, x: 30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="glass-panel p-8 rounded-2xl border border-green-500/20 hover:border-green-500/40 transition-colors"
        >
          <div className="flex items-center gap-3 mb-4">
            <CheckCircle2 className="w-6 h-6 text-green-400" />
            <h3 className="font-mono text-lg font-bold text-foreground">How We Handled It</h3>
          </div>
          <p className="font-sans text-sm text-muted-foreground leading-relaxed">
            We ripped out the LLM extraction and fell back to pure, deterministic Computer Science. We integrated <strong>Tree-Sitter</strong> to parse the AST directly in Python, and built the graph locally using <strong>NetworkX</strong>. By caching the graph in memory, our graph-traversal latency dropped to a blistering <span className="text-green-400 font-mono bg-green-400/10 px-1 rounded">&lt; 3ms</span> per query.
          </p>
        </motion.div>

        {/* Future Work */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="glass-panel p-6 rounded-2xl border border-white/10 md:col-span-2 flex items-center justify-between group hover:border-primary/40 transition-colors cursor-pointer"
        >
          <div>
            <h3 className="font-mono text-base font-bold text-foreground mb-1">What&apos;s Next? (Experimental)</h3>
            <p className="font-sans text-sm text-muted-foreground">
              Running QLoRA fine-tuning on the CommitPack dataset to train our own local routing models.
            </p>
          </div>
          <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-primary/20 transition-colors shrink-0">
            <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
        </motion.div>

      </div>
    </div>
  );
}
