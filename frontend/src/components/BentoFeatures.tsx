"use client";

import React, { useEffect, useRef } from 'react';
import anime from 'animejs';

const features = [
  {
    title: "Semantic Code Graph",
    description: "Parses abstract syntax trees into an interconnected knowledge graph, understanding deep relationships between functions and classes.",
    colSpan: "md:col-span-2",
    icon: "M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" // Code icon
  },
  {
    title: "Zero-Trust Ready",
    description: "Built for enterprise security. Local-first execution prevents IP leakage to public models.",
    colSpan: "md:col-span-1",
    icon: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" // Lock icon
  },
  {
    title: "Sub-50ms Caching",
    description: "Distributed Redis cluster caches AST parses and embedding lookups for instant sequential queries.",
    colSpan: "md:col-span-1",
    icon: "M13 10V3L4 14h7v7l9-11h-7z" // Lightning icon
  },
  {
    title: "Vector + Graph RAG",
    description: "Combines dense vector search (ChromaDB) with structural traversal (NetworkX) to conquer the context limit.",
    colSpan: "md:col-span-2",
    icon: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" // Database icon
  }
];

export default function BentoFeatures() {
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Simple intersection observer to trigger Anime.js stagger
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          anime({
            targets: '.bento-card',
            translateY: [40, 0],
            opacity: [0, 1],
            delay: anime.stagger(150),
            duration: 1000,
            easing: 'easeOutExpo'
          });
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });

    if (gridRef.current) {
      observer.observe(gridRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <section className="relative z-10 py-24 px-4 w-full max-w-6xl mx-auto pointer-events-auto">
      <div className="mb-16 text-center md:text-left">
        <h2 className="text-sm font-mono text-gray-500 uppercase tracking-widest mb-3">Architecture</h2>
        <p className="text-3xl md:text-4xl font-semibold text-white tracking-tight">
          Designed for structural intelligence.
        </p>
      </div>

      <div ref={gridRef} className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {features.map((feat, i) => (
          <div 
            key={i} 
            className={`bento-card opacity-0 translate-y-10 group relative p-8 rounded-3xl overflow-hidden ${feat.colSpan}`}
            style={{ 
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              backdropFilter: 'blur(10px)'
            }}
          >
            {/* Subtle hover gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.05] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            
            <div className="relative z-10">
              <div className="w-12 h-12 mb-6 rounded-2xl flex items-center justify-center bg-white/5 border border-white/10 group-hover:bg-white/10 transition-colors duration-300">
                <svg className="w-6 h-6 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={feat.icon} />
                </svg>
              </div>
              <h3 className="text-xl font-medium text-white mb-3">{feat.title}</h3>
              <p className="text-gray-400 font-light leading-relaxed">
                {feat.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
