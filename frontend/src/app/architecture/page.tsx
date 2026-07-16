// frontend/src/app/architecture/page.tsx
"use client";

import { motion } from "framer-motion";
import { Download, FileCode2, Network, Database, BrainCircuit, Search, Rocket } from "lucide-react";

const PIPELINE_STAGES = [
  { icon: Download, title: "1. Clone", desc: "Shallow clone of the GitHub repository into a temporary workspace." },
  { icon: FileCode2, title: "2. Parse AST", desc: "Tree-sitter extracts function boundaries, classes, and all identifiers." },
  { icon: Network, title: "3. Call Graph", desc: "NetworkX builds a directed graph connecting callers to callees." },
  { icon: Database, title: "4. Chunking", desc: "Functions are embedded as discrete chunks to maintain semantic integrity." },
  { icon: BrainCircuit, title: "5. Embedding", desc: "text-embedding-004 encodes each chunk into a high-dimensional vector space." },
  { icon: Database, title: "6. Vector Store", desc: "ChromaDB stores embeddings with graph metadata attached to each document." },
  { icon: Search, title: "7. Graph RAG", desc: "At query time, vector hits are expanded by 1-hop using graph edges." },
];

export default function ArchitecturePage() {
  return (
    <div className="max-w-5xl mx-auto py-16 space-y-24">

      {/* Hero */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <h1 className="text-4xl font-bold mb-6 tracking-tight text-foreground">
          System <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">Architecture</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          CodeSageZ employs a 7-stage ingestion pipeline designed to preserve the structural relationships of source code.
        </p>
      </motion.div>

      {/* The Pipeline Visual */}
      <section>
        <h2 className="text-2xl font-semibold mb-10 text-center">The 7-Stage Ingestion Pipeline</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative">
          
          {PIPELINE_STAGES.map((stage, idx) => (
            <motion.div
              key={stage.title}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.1, duration: 0.5 }}
              className="glass p-6 rounded-2xl relative group overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-secondary/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 mb-4 group-hover:scale-110 transition-transform duration-300">
                <stage.icon className="w-6 h-6 text-secondary" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">{stage.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{stage.desc}</p>
            </motion.div>
          ))}

        </div>
      </section>

      {/* The Problem with Naive RAG vs Graph RAG */}
      <section className="grid md:grid-cols-2 gap-12 items-center">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className="space-y-6"
        >
          <h2 className="text-3xl font-bold">The Problem with Naive RAG</h2>
          <p className="text-muted-foreground leading-relaxed">
            Standard RAG chunks source files arbitrarily. If you ask a question about a function that relies on three other internal helpers, a naive retriever might only fetch the top-level function. The LLM is forced to hallucinate the missing implementations.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            By storing the Abstract Syntax Tree (AST) relationships in a NetworkX graph alongside our vector database, CodeSageZ can perform a <strong>1-hop expansion</strong>. It retrieves the semantically similar chunk, and then immediately fetches exactly what it calls, and who calls it.
          </p>
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className="glass p-8 rounded-3xl"
        >
          <pre className="bg-background/50 rounded-xl p-4 text-xs overflow-x-auto border border-white/5 font-mono text-primary/80">
            <code>{`# 1. Vector Search finds Seed Node
seed_nodes = vector_db.query("How does auth work?")
// returns: validate_token() [similarity: 0.85]

# 2. Graph Expansion fetches exact structural context
for node in seed_nodes:
    context.append( graph.get_callers(node) )
    context.append( graph.get_callees(node) )
    
// Context now contains:
// - authenticate() [caller]
// - validate_token() [seed]
// - decode_jwt() [callee]`}</code>
          </pre>
        </motion.div>
      </section>

      {/* Fine Tuning */}
      <motion.section 
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="glass-card p-10 rounded-3xl"
      >
        <div className="flex items-center gap-4 mb-6">
          <div className="p-3 bg-primary/20 rounded-xl">
            <Rocket className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-3xl font-bold">Fine-Tuning on Bug Fixes</h2>
        </div>
        <p className="text-muted-foreground leading-relaxed mb-6">
          Our underlying playground models are fine-tuned via QLoRA on the <strong>CommitPack dataset</strong>. We filter for surgical, single-file bug fixes (under 30 lines) and train the model to predict the exact diff required to fix a given error message.
        </p>
        <div className="grid md:grid-cols-3 gap-6">
          <div className="p-4 rounded-xl bg-white/5 border border-white/5 text-center">
            <div className="font-mono text-2xl text-secondary mb-1">10,000</div>
            <div className="text-xs text-muted-foreground uppercase tracking-widest">Training Samples</div>
          </div>
          <div className="p-4 rounded-xl bg-white/5 border border-white/5 text-center">
            <div className="font-mono text-2xl text-secondary mb-1">4-bit</div>
            <div className="text-xs text-muted-foreground uppercase tracking-widest">QLoRA Quantization</div>
          </div>
          <div className="p-4 rounded-xl bg-white/5 border border-white/5 text-center">
            <div className="font-mono text-2xl text-secondary mb-1">A100</div>
            <div className="text-xs text-muted-foreground uppercase tracking-widest">Training Hardware</div>
          </div>
        </div>
      </motion.section>

    </div>
  );
}
