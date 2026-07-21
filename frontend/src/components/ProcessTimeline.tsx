"use client";

import { motion } from "framer-motion";
import { Code, GitCommit, Database, BrainCircuit, ArrowDown } from "lucide-react";

const STEPS = [
  {
    title: "Tree-Sitter Parsing",
    desc: "We parse the raw Python source code into an Abstract Syntax Tree (AST) to extract deterministic function definitions and calls.",
    icon: Code,
  },
  {
    title: "NetworkX Graph Construction",
    desc: "The AST edges are converted into a directed graph in NetworkX. We cache this locally, ensuring sub-3ms graph traversal latency.",
    icon: GitCommit,
  },
  {
    title: "Gemini 1.5 Pro Embedding",
    desc: "Each function and its docstring are embedded using Gemini 1.5 Pro, generating dense vectors that capture semantic intent.",
    icon: BrainCircuit,
  },
  {
    title: "ChromaDB Indexing",
    desc: "Vectors and metadata are stored in ChromaDB. At query time, 1-hop AST expansion boosts recall by 53.3%.",
    icon: Database,
  },
];

export default function ProcessTimeline() {
  return (
    <div className="w-full max-w-[900px] mx-auto py-24 px-4 relative z-10">
      
      <div className="text-center mb-16">
        <motion.h2 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="font-mono text-3xl md:text-4xl font-bold mb-4"
        >
          How it <span className="text-primary text-glow">Works</span>
        </motion.h2>
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="text-muted-foreground font-sans text-lg max-w-[600px] mx-auto"
        >
          A deterministic, 4-stage pipeline that eliminates hallucination and guarantees sub-3ms graph traversal.
        </motion.p>
      </div>

      <div className="relative">
        {/* The glowing vertical line */}
        <div className="absolute left-[39px] md:left-1/2 top-0 bottom-0 w-[2px] bg-white/10 md:-translate-x-1/2">
          <motion.div 
            className="absolute top-0 left-0 w-full bg-primary shadow-[0_0_10px_#23c4e8]"
            initial={{ height: "0%" }}
            whileInView={{ height: "100%" }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 1.5, ease: "easeInOut" }}
          />
        </div>

        <div className="flex flex-col gap-12">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            const isEven = index % 2 === 0;

            return (
              <div key={step.title} className={`relative flex items-center md:justify-between w-full ${isEven ? 'md:flex-row-reverse' : 'md:flex-row'}`}>
                
                {/* Center Node */}
                <motion.div 
                  initial={{ scale: 0, opacity: 0 }}
                  whileInView={{ scale: 1, opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.3, type: "spring" }}
                  className="absolute left-[20px] md:left-1/2 w-10 h-10 rounded-full bg-background border-2 border-primary flex items-center justify-center shadow-[0_0_15px_rgba(35,196,232,0.4)] z-10 -translate-x-1/2"
                >
                  <div className="w-3 h-3 bg-primary rounded-full" />
                </motion.div>

                {/* Content Card */}
                <motion.div 
                  initial={{ opacity: 0, x: isEven ? 50 : -50 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.3 + 0.2, duration: 0.5 }}
                  className={`ml-16 md:ml-0 md:w-[45%] glass-panel p-6 rounded-2xl border border-white/10 hover:border-primary/50 transition-colors group`}
                >
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 group-hover:bg-primary/20 transition-colors">
                      <Icon className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="font-mono text-xl font-bold text-foreground">{step.title}</h3>
                  </div>
                  <p className="font-sans text-muted-foreground leading-relaxed">
                    {step.desc}
                  </p>
                </motion.div>
                
                {/* Empty space for the other side on desktop */}
                <div className="hidden md:block md:w-[45%]" />
                
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
