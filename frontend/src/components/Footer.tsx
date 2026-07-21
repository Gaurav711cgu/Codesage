"use client";

import React from 'react';
import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="py-12 px-4 sm:px-6 lg:px-8 mt-auto" style={{ borderTop: '1px solid var(--cs-border)' }}>
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-6">
          <Link href="/" className="font-head font-bold text-lg mb-1 inline-block no-underline" style={{ color: 'var(--cs-text)' }}>
            CodeSageZ — Graph-Augmented Retrieval
          </Link>
          <div className="text-xs" style={{ color: 'var(--cs-text3)' }}>
            Built on Gemini + ChromaDB + NetworkX
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-3 mb-6">
          <a href="https://github.com/Gaurav711cgu/Codesage" target="_blank" rel="noopener noreferrer"
            className="text-xs px-3 py-1.5 rounded-md transition-colors duration-150 no-underline"
            style={{ background: 'var(--cs-surface)', color: 'var(--cs-text2)', border: '1px solid var(--cs-border)' }}>
            GitHub Repository
          </a>
        </div>

        {/* Quick nav */}
        <div className="flex flex-wrap justify-center gap-2 mb-6">
          {[
            { to: '/playground', label: 'Playground' },
            { to: '/repos', label: 'Repos' },
            { to: '/benchmarks', label: 'Benchmarks' },
            { to: '/architecture', label: 'Architecture' },
          ].map(link => (
            <Link key={link.to} href={link.to} className="text-xs transition-colors duration-150 no-underline"
              style={{ color: 'var(--cs-text3)' }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--cs-text2)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--cs-text3)'}>
              {link.label}
            </Link>
          ))}
        </div>

        <div className="text-center">
          <p className="text-xs italic" style={{ color: 'var(--cs-text3)' }}>
            &quot;Solving real codebase context limits with structural graph expansions.&quot;
          </p>
        </div>
      </div>
    </footer>
  );
}
