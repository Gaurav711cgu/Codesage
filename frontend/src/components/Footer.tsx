"use client";

import React from 'react';
import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-border bg-surface text-muted-foreground font-mono text-xs py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between gap-8">
        {/* Left Column: System identity & Telemetry */}
        <div className="flex flex-col gap-2 max-w-sm">
          <div className="flex items-center gap-2 text-foreground font-bold text-sm">
            <span className="text-primary">&gt;_</span>
            <span>CodeSageZ Platform</span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Repository intelligence prototype. AST parsing via Tree-sitter, dense semantic vector search via ChromaDB, and structural graph traversal with NetworkX.
          </p>
          <div className="flex items-center gap-2 pt-2 text-[10px]">
            <span className="w-1.5 h-1.5 bg-primary rounded-[1px]"></span>
            <span className="text-foreground">MODEL: configured per backend</span>
            <span className="text-muted-foreground">|</span>
            <span className="text-foreground">SOURCE: inspectable context</span>
          </div>
        </div>

        {/* Center Columns: Site Index */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 text-[11px]">
          <div>
            <div className="text-foreground font-semibold uppercase tracking-wider mb-2">[ Core Engine ]</div>
            <ul className="space-y-1.5">
              <li>
                <Link href="/architecture" className="hover:text-primary transition-colors no-underline">
                  Architecture
                </Link>
              </li>
              <li>
                <Link href="/benchmarks" className="hover:text-primary transition-colors no-underline">
                  Benchmarks
                </Link>
              </li>
              <li>
                <Link href="/playground" className="hover:text-primary transition-colors no-underline">
                  Playground
                </Link>
              </li>
              <li>
                <Link href="/repos" className="hover:text-primary transition-colors no-underline">
                  Repository Ingestion
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <div className="text-foreground font-semibold uppercase tracking-wider mb-2">[ Runtime & Eval ]</div>
            <ul className="space-y-1.5">
              <li>
                <Link href="/inference" className="hover:text-primary transition-colors no-underline">
                  Inference &amp; KV Cache
                </Link>
              </li>
              <li>
                <Link href="/training" className="hover:text-primary transition-colors no-underline">
                  Training Dynamics
                </Link>
              </li>
              <li>
                <Link href="/failures" className="hover:text-primary transition-colors no-underline">
                  Failure Audits
                </Link>
              </li>
              <li>
                <Link href="/mcp" className="hover:text-primary transition-colors no-underline">
                  MCP Protocol
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <div className="text-foreground font-semibold uppercase tracking-wider mb-2">[ Artifacts ]</div>
            <ul className="space-y-1.5">
              <li>
                <Link href="/stories" className="hover:text-primary transition-colors no-underline">
                  Engineering Stories
                </Link>
              </li>
              <li>
                <a href="https://github.com/Gaurav711cgu/Codesage" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors no-underline">
                  GitHub Source
                </a>
              </li>
              <li>
                <a href="https://github.com/Gaurav711cgu" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors no-underline">
                  Author Profile
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto mt-8 pt-4 border-t border-border/40 flex flex-col sm:flex-row justify-between items-center gap-2 text-[10px] text-muted-foreground">
        <div>&copy; 2026 CodeSageZ Systems. Local source exploration.</div>
        <div>Built to inspect source, retrieval context, and call relationships.</div>
      </div>
    </footer>
  );
}
