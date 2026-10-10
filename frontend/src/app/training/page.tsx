"use client";

import React from 'react';
import { TRAINING_STAGES } from '@/constants/content';

export default function TrainingPage() {
  return (
    <div className="max-w-5xl mx-auto py-12 space-y-12 px-4 sm:px-6 font-sans">
      {/* Header */}
      <div className="border-b border-border pb-6">
        <div className="text-[11px] font-mono text-muted-foreground uppercase tracking-widest mb-1.5 flex items-center gap-2">
          <span>CODESAGEZ</span>
          <span className="text-border">/</span>
          <span className="text-primary font-semibold">QLORA TRAINING PIPELINE</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold font-mono text-foreground">Adaptation &amp; Training Dynamics</h1>
        <p className="mt-2 text-sm text-muted-foreground max-w-2xl leading-relaxed">
          Full execution lifecycle for fine-tuning Llama-3.3-8B and Qwen2.5-Coder across 52K verified code pairs using QLoRA, DoRA, and NF4 quantization on Modal A100 GPUs ($9.40 total compute).
        </p>
      </div>

      <main className="w-full space-y-8">
        <div className="border border-border bg-surface rounded-[3px] divide-y divide-border overflow-hidden">
          {TRAINING_STAGES.map((stage, idx) => (
            <div key={idx} className="p-6 flex flex-col md:flex-row gap-6 hover:bg-surface-hi/30 transition-colors">
              {/* Stage Identifier & Constraints */}
              <div className="shrink-0 md:w-52 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-primary font-mono text-xs font-semibold">STAGE-0{idx + 1}</span>
                  <span className="text-border">/</span>
                  <h2 className="text-sm font-bold font-mono text-foreground">{stage.title}</h2>
                </div>
                <div className="inline-block px-2 py-0.5 border border-border bg-background font-mono text-[10px] text-muted-foreground rounded-[2px] uppercase">
                  {stage.badge}
                </div>
              </div>

              {/* Technical Specifications */}
              <div className="flex-1 space-y-4">
                <p className="text-xs text-foreground font-mono leading-relaxed bg-background p-2.5 border border-border rounded-[2px]">
                  {stage.summary}
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 text-xs">
                  {Object.entries(stage.content).map(([key, value], i) => (
                    <div key={i} className="space-y-1.5">
                      <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest block border-b border-border/50 pb-0.5">
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </span>
                      {Array.isArray(value) ? (
                        <ul className="space-y-1 font-mono text-[11px]">
                          {value.map((item, j) => (
                            <li key={j} className="text-muted-foreground leading-relaxed flex items-start gap-1.5">
                              <span className="text-primary font-bold">›</span>
                              {typeof item === 'string' ? item : (
                                <span>
                                  <strong className="text-foreground">{item.name || item.config}</strong>: {item.details || item.status}
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      ) : typeof value === 'object' && value !== null ? (
                        <div className="space-y-1 font-mono text-[11px]">
                          {Object.entries(value).map(([k, v], j) => (
                            <div key={j} className="flex justify-between border-b border-border/30 pb-0.5">
                              <span className="text-muted-foreground">{k}:</span>
                              <span className="text-foreground font-semibold">{v as string}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted-foreground font-mono text-[11px] leading-relaxed">{String(value)}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
