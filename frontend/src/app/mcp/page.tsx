"use client";

import React from 'react';
import { MCP_TOOLS } from '@/constants/content';

export default function MCPPage() {
  return (
    <div className="max-w-5xl mx-auto py-12 space-y-12 px-4 sm:px-6 font-sans">
      {/* Header */}
      <div className="border-b border-border pb-6">
        <div className="text-[11px] font-mono text-muted-foreground uppercase tracking-widest mb-1.5 flex items-center gap-2">
          <span>CODESAGEZ</span>
          <span className="text-border">/</span>
          <span className="text-primary font-semibold">MODEL CONTEXT PROTOCOL (MCP)</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold font-mono text-foreground">MCP Tool Server &amp; JSON-RPC Gateway</h1>
        <p className="mt-2 text-sm text-muted-foreground max-w-2xl leading-relaxed">
          Open Model Context Protocol (MCP) server implementation. Exposes repository AST traversal, automated code review, and test generation over standard JSON-RPC 2.0 transport for Claude Desktop, Cursor, and agentic workflows.
        </p>
      </div>

      <main className="w-full space-y-6">
        <div className="border border-border bg-surface rounded-[3px] divide-y divide-border overflow-hidden">
          {MCP_TOOLS.map((tool, idx) => (
            <div key={idx} className="p-6 space-y-4 hover:bg-surface-hi/30 transition-colors">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-xs text-primary font-semibold">RPC-0{idx + 1}</span>
                  <span className="text-border">/</span>
                  <h2 className="text-sm font-bold font-mono text-foreground">{tool.name}</h2>
                </div>
                <span className="px-2 py-0.5 font-mono text-[10px] uppercase font-semibold border border-border bg-background text-muted-foreground rounded-[2px] self-start sm:self-auto">
                  ROLE: {tool.badge}
                </span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs font-mono">
                <div className="space-y-2">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">
                    [ PARAMETERS SCHEMA ]
                  </span>
                  <div className="p-3 border border-border bg-background rounded-[2px] space-y-1.5 leading-relaxed">
                    {tool.params.map((param, i) => {
                      const [name, type] = param.split(': ');
                      return (
                        <div key={i} className="flex items-baseline gap-2">
                          <span className="text-primary font-semibold">{name}:</span>
                          <span className="text-muted-foreground">{type}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">
                    [ RETURN PAYLOAD SPEC ]
                  </span>
                  <div className="p-3 border border-border bg-background rounded-[2px] text-muted-foreground leading-relaxed h-[calc(100%-24px)] flex items-center">
                    <span className="text-foreground/90">{tool.returns}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
