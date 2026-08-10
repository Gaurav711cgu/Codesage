import React, { useState, useEffect, useRef, useCallback } from 'react';
import { TERMINAL_LINES } from '../constants/content';

function useCountUp(target, duration = 1500, trigger = false) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!trigger) return;
    const num = parseFloat(String(target).replace(/[^0-9.]/g, ''));
    if (isNaN(num)) { setValue(target); return; }
    const start = performance.now();
    const step = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * num * 10) / 10);
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration, trigger]);
  return value;
}

const STATS = [
  { value: '+7.1', suffix: 'pp', color: 'var(--cs-green)', label: 'HumanEval improvement', sub: 'vs base Llama 3.3 8B (pass@1)' },
  { value: '12500', suffix: '', color: 'var(--cs-blue)', label: 'tokens/sec throughput', sub: 'vLLM + PagedAttention on H100' },
  { value: '9.40', suffix: '', color: 'var(--cs-orange)', label: 'total fine-tuning cost', sub: '8B model, A100 80GB, Modal', prefix: '$' },
  { value: '4', suffix: '-bit', color: 'var(--cs-purple)', label: 'NF4 QLoRA quantization', sub: '80-90% of full fine-tune quality' },
];

function StatCard({ stat, isVisible }) {
  const animVal = useCountUp(stat.value, 1500, isVisible);
  return (
    <div className="rounded-xl p-4 text-center" style={{ background: 'var(--cs-surface)', border: '1px solid var(--cs-border)' }}>
      <div className="font-head font-bold text-2xl sm:text-3xl" style={{ color: stat.color }}>
        {stat.prefix || ''}{typeof animVal === 'number' ? (stat.value.includes('.') ? animVal.toFixed(1) : Math.round(animVal).toLocaleString()) : stat.value}{stat.suffix}
      </div>
      <div className="text-xs mt-1" style={{ color: 'var(--cs-text2)' }}>{stat.label}</div>
      <div className="text-xs mt-0.5" style={{ color: 'var(--cs-text3)' }}>{stat.sub}</div>
    </div>
  );
}

export default function Hero() {
  const [visibleLines, setVisibleLines] = useState([]);
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef(null);
  const timerRef = useRef([]);

  const startAnimation = useCallback(() => {
    setVisibleLines([]);
    timerRef.current.forEach(clearTimeout);
    timerRef.current = [];
    
    TERMINAL_LINES.forEach((line, idx) => {
      const t = setTimeout(() => {
        setVisibleLines(prev => [...prev, line]);
      }, line.delay);
      timerRef.current.push(t);
    });

    // Loop
    const loopTimer = setTimeout(() => startAnimation(), 15000);
    timerRef.current.push(loopTimer);
  }, []);

  useEffect(() => {
    startAnimation();
    return () => timerRef.current.forEach(clearTimeout);
  }, [startAnimation]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsVisible(true); },
      { threshold: 0.2 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  const colorMap = {
    text3: 'var(--cs-text3)',
    blue: 'var(--cs-blue)',
    amber: 'var(--cs-amber)',
    green: 'var(--cs-green-l)',
  };

  return (
    <section id="hero" data-testid="hero-section" ref={sectionRef}
      className="pt-28 pb-16 sm:pt-32 sm:pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Eyebrow badges */}
        <div className="flex flex-wrap gap-2 mb-6 justify-center">
          <span className="px-3 py-1 rounded-full text-xs font-medium"
            style={{ background: 'rgba(59,130,246,0.12)', color: 'var(--cs-blue-l)', border: '1px solid rgba(59,130,246,0.25)' }}>
            Llama 3.3 8B Fine-Tuned
          </span>
          <span className="px-3 py-1 rounded-full text-xs font-medium"
            style={{ background: 'rgba(59,130,246,0.12)', color: 'var(--cs-blue-l)', border: '1px solid rgba(59,130,246,0.25)' }}>
            vLLM Production Serving
          </span>
        </div>

        {/* Headline */}
        <h1 className="font-head font-bold text-center leading-none mb-5"
          style={{ fontSize: 'clamp(40px, 6vw, 68px)', color: 'var(--cs-text)', letterSpacing: '-0.02em' }}>
          A Code Model That<br/>Actually Improves.
        </h1>

        {/* Subheadline */}
        <p className="text-center mx-auto mb-10" style={{ maxWidth: 540, color: 'var(--cs-text2)', fontSize: '16px', lineHeight: '1.75' }}>
          QLoRA fine-tuned on curated code datasets.
          Benchmarked against base Llama 3.3 8B on HumanEval and MBPP.
          Served at 12,500 tok/s via vLLM + PagedAttention.
          Exposed as an MCP tool to any agent or IDE.
        </p>

        {/* Terminal */}
        <div data-testid="hero-terminal" className="mx-auto mb-10" style={{ maxWidth: 680 }}>
          <div className="rounded-xl overflow-hidden" style={{ background: 'var(--cs-code-bg)', border: '1px solid var(--cs-border)' }}>
            {/* Title bar */}
            <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid var(--cs-border)' }}>
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#EF4444' }}></div>
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#F59E0B' }}></div>
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#22C55E' }}></div>
              </div>
              <span className="font-mono text-xs ml-2" style={{ color: 'var(--cs-text3)' }}>
                codesage-train — Modal A100 80GB — epoch 3/3
              </span>
            </div>
            {/* Terminal body */}
            <div className="p-4 font-mono text-xs sm:text-sm overflow-x-auto" style={{ minHeight: 320, lineHeight: '1.7' }}>
              {visibleLines.map((line, i) => (
                <div key={i} style={{ color: colorMap[line.color] || 'var(--cs-text3)' }}>
                  {line.text}
                  {line.check && <span style={{ color: 'var(--cs-green)' }}> &#10003;</span>}
                </div>
              ))}
              {visibleLines.length > 0 && (
                <span className="cursor-blink inline-block w-2 h-4 ml-0.5" style={{ background: 'var(--cs-green-l)' }}></span>
              )}
            </div>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-xl mx-auto mb-10">
          {STATS.map((stat, i) => (
            <StatCard key={i} stat={stat} isVisible={isVisible} />
          ))}
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-wrap justify-center gap-3">
          <button
            data-testid="hero-try-playground-button"
            onClick={() => document.getElementById('playground')?.scrollIntoView({ behavior: 'smooth' })}
            className="px-6 py-3 rounded-lg font-semibold text-sm transition-colors duration-150"
            style={{ background: 'linear-gradient(135deg, #3B82F6, #60A5FA)', color: 'white' }}
          >
            Try Live Playground &rarr;
          </button>
          <button
            data-testid="hero-view-benchmarks-button"
            onClick={() => document.getElementById('benchmarks')?.scrollIntoView({ behavior: 'smooth' })}
            className="px-6 py-3 rounded-lg text-sm transition-colors duration-150"
            style={{ border: '1px solid var(--cs-border)', color: 'var(--cs-text2)', background: 'transparent' }}
          >
            View Benchmarks &darr;
          </button>
          <a
            href="https://github.com/Gaurav711cgu"
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-3 rounded-lg text-sm transition-colors duration-150"
            style={{ border: '1px solid var(--cs-border)', color: 'var(--cs-text2)', background: 'transparent' }}
          >
            GitHub Repository
          </a>
        </div>
      </div>
    </section>
  );
}
