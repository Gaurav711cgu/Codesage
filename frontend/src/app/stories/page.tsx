"use client";

import React from 'react';
import { COMPANY_CARDS } from '@/constants/content';

export default function StoriesPage() {
  return (
    <div className="max-w-5xl mx-auto py-12 space-y-12 px-4 sm:px-6 font-sans">
      {/* Header */}
      <div className="border-b border-border pb-6">
        <div className="text-[11px] font-mono text-muted-foreground uppercase tracking-widest mb-1.5 flex items-center gap-2">
          <span>CODESAGEZ</span>
          <span className="text-border">/</span>
          <span className="text-primary font-semibold">TECHNICAL EVALUATION DEFENSE</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold font-mono text-foreground">Staff Architectural Defense</h1>
        <p className="mt-2 text-sm text-muted-foreground max-w-2xl leading-relaxed">
          Technical defense vectors, architectural trade-offs, and empirical rationales tailored for technical deep-dives with principal engineers and AI research labs.
        </p>
      </div>

      <main className="w-full space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {COMPANY_CARDS.map((card, idx) => {
            return (
              <div key={idx} className="p-6 rounded-[3px] border border-border bg-surface flex flex-col space-y-4 hover:border-border/80 transition-colors">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-primary font-semibold">ADR-0{idx + 1}</span>
                    <span className="text-border">/</span>
                    <h2 className="text-sm font-bold font-mono text-foreground">{card.company}</h2>
                  </div>
                  <span className="px-1.5 py-0.5 border border-border bg-background text-[10px] font-mono text-muted-foreground uppercase rounded-[2px]">
                    DEFENSE SPEC
                  </span>
                </div>
                
                <div className="space-y-4 text-xs leading-relaxed flex-1">
                  {card.content.split('\n\n').map((paragraph, i) => {
                    const isQuestion = paragraph.includes("What they'll ask:") || paragraph.includes("They'll ask:");
                    const isStrategy = paragraph.includes('Connect:') || paragraph.includes('Lead with:');
                    
                    if (isQuestion) {
                      const lines = paragraph.split('\n');
                      return (
                        <div key={i} className="p-3 border border-border bg-background rounded-[2px] space-y-2">
                          <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest block border-b border-border/50 pb-1">
                            [ TARGET INTERVIEW PROBE ]
                          </span>
                          <span className="font-mono text-foreground font-semibold block">
                            {lines[0]}
                          </span>
                          <p className="text-muted-foreground text-[11px] leading-relaxed pl-2 border-l border-primary/50">
                            {lines.slice(1).join(' ')}
                          </p>
                        </div>
                      );
                    }
                    
                    if (isStrategy) {
                      return (
                        <div key={i} className="space-y-1">
                          <span className="text-[10px] font-mono text-primary uppercase tracking-widest block">
                            &gt; ARCHITECTURAL STRATEGY:
                          </span>
                          <p className="text-foreground/90 font-mono text-[11px] leading-relaxed">
                            {paragraph}
                          </p>
                        </div>
                      );
                    }
                    
                    return (
                      <p key={i} className="text-muted-foreground leading-relaxed">
                        {paragraph}
                      </p>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
