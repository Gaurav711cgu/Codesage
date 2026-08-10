import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import RevealSection from '../components/RevealSection';
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

function StatCard({ stat, isVisible }) {
  const animVal = useCountUp(stat.value, 1500, isVisible);
  return (
    <div className="rounded-xl p-4 text-center transition-all duration-200 hover:translate-y-[-2px]"
      style={{ background: 'var(--cs-surface)', border: '1px solid var(--cs-border)' }}>
      <div className="font-head font-bold text-2xl sm:text-3xl" style={{ color: stat.color }}>
        {stat.prefix || ''}{typeof animVal === 'number' ? (stat.value.includes('.') ? animVal.toFixed(1) : Math.round(animVal).toLocaleString()) : stat.value}{stat.suffix}
      </div>
      <div className="text-xs mt-1" style={{ color: 'var(--cs-text2)' }}>{stat.label}</div>
      <div className="text-xs mt-0.5" style={{ color: 'var(--cs-text3)' }}>{stat.sub}</div>
    </div>
  );
}

const STATS = [
  { value: '+7.1', suffix: 'pp', color: 'var(--cs-green)', label: 'HumanEval improvement', sub: 'vs base Llama 3.3 8B (pass@1)' },
  { value: '12500', suffix: '', color: 'var(--cs-blue)', label: 'tokens/sec throughput', sub: 'vLLM + PagedAttention on H100' },
  { value: '9.40', suffix: '', color: 'var(--cs-orange)', label: 'total fine-tuning cost', sub: '8B model, A100 80GB, Modal', prefix: '$' },
  { value: '4', suffix: '-bit', color: 'var(--cs-purple)', label: 'NF4 QLoRA quantization', sub: '80-90% of full fine-tune quality' },
];

const SECTIONS = [
  {
    to: '/playground',
    badge: 'Interactive',
    badgeColor: 'blue',
    title: 'Live Playground',
    desc: 'Code completion, review, test generation, and documentation — powered by Gemini.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--cs-blue-l)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
      </svg>
    ),
  },
  {
    to: '/training',
    badge: 'Pipeline',
    badgeColor: 'amber',
    title: 'Training Deep-Dive',
    desc: 'Dataset curation, QLoRA config, W&B tracking, adapter merging, Modal deployment.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--cs-amber)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
      </svg>
    ),
  },
  {
    to: '/benchmarks',
    badge: 'Results',
    badgeColor: 'green',
    title: 'Benchmarks',
    desc: 'HumanEval, MBPP, HumanEval+, SQL generation — animated charts and comparisons.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--cs-green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
    ),
  },
  {
    to: '/inference',
    badge: 'Architecture',
    badgeColor: 'purple',
    title: 'Inference Stack',
    desc: 'vLLM + PagedAttention: 12,500 tok/s, interactive architecture diagram.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--cs-purple-l)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/>
      </svg>
    ),
  },
  {
    to: '/failures',
    badge: 'Analysis',
    badgeColor: 'red',
    title: 'What Breaks',
    desc: '6 real failure modes — catastrophic forgetting, OOM, quantization noise, and more.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--cs-red)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
    ),
  },
  {
    to: '/mcp',
    badge: 'Integration',
    badgeColor: 'purple',
    title: 'MCP Server',
    desc: '4 tools exposed via Model Context Protocol — usable by Claude, Cursor, any agent.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--cs-purple-l)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
      </svg>
    ),
  },
];

const colorMap = {
  text3: 'var(--cs-text3)',
  blue: 'var(--cs-blue)',
  amber: 'var(--cs-amber)',
  green: 'var(--cs-green-l)',
};

export default function Home() {
  const [visibleLines, setVisibleLines] = useState([]);
  const [isVisible, setIsVisible] = useState(false);
  const statsRef = useRef(null);
  const timerRef = useRef([]);

  const startAnimation = useCallback(() => {
    setVisibleLines([]);
    timerRef.current.forEach(clearTimeout);
    timerRef.current = [];
    TERMINAL_LINES.forEach((line) => {
      const t = setTimeout(() => {
        setVisibleLines(prev => [...prev, line]);
      }, line.delay);
      timerRef.current.push(t);
    });
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
    if (statsRef.current) observer.observe(statsRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div>
      {/* Hero */}
      <section className="pt-28 pb-10 sm:pt-32 sm:pb-14 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <RevealSection>
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
            <h1 className="font-head font-bold text-center leading-none mb-5"
              style={{ fontSize: 'clamp(40px, 6vw, 68px)', color: 'var(--cs-text)', letterSpacing: '-0.02em' }}>
              A Code Model That<br/>Actually Improves.
            </h1>
            <p className="text-center mx-auto mb-10" style={{ maxWidth: 540, color: 'var(--cs-text2)', fontSize: '16px', lineHeight: '1.75' }}>
              QLoRA fine-tuned on curated code datasets.
              Benchmarked against base Llama 3.3 8B on HumanEval and MBPP.
              Served at 12,500 tok/s via vLLM + PagedAttention.
              Exposed as an MCP tool to any agent or IDE.
            </p>
          </RevealSection>

          {/* Terminal */}
          <RevealSection delay={120}>
            <div data-testid="hero-terminal" className="mx-auto mb-10" style={{ maxWidth: 680 }}>
              <div className="rounded-xl overflow-hidden" style={{ background: 'var(--cs-code-bg)', border: '1px solid var(--cs-border)' }}>
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
                <div className="p-4 font-mono text-xs sm:text-sm overflow-x-auto" style={{ minHeight: 300, lineHeight: '1.7' }}>
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
          </RevealSection>

          {/* Stats */}
          <RevealSection delay={200}>
            <div ref={statsRef} className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-xl mx-auto mb-10">
              {STATS.map((stat, i) => (
                <StatCard key={i} stat={stat} isVisible={isVisible} />
              ))}
            </div>
          </RevealSection>

          {/* CTA */}
          <RevealSection delay={280}>
            <div className="flex flex-wrap justify-center gap-3 mb-16">
              <Link to="/playground" data-testid="hero-try-playground-button"
                className="px-6 py-3 rounded-lg font-semibold text-sm text-white transition-all duration-200 hover:translate-y-[-1px] hover:shadow-lg"
                style={{ background: 'linear-gradient(135deg, #3B82F6, #60A5FA)' }}>
                Try Live Playground &rarr;
              </Link>
              <Link to="/benchmarks" data-testid="hero-view-benchmarks-button"
                className="px-6 py-3 rounded-lg text-sm transition-colors duration-150"
                style={{ border: '1px solid var(--cs-border)', color: 'var(--cs-text2)', background: 'transparent' }}>
                View Benchmarks
              </Link>
              <a href="https://github.com/Gaurav711cgu" target="_blank" rel="noopener noreferrer"
                className="px-6 py-3 rounded-lg text-sm transition-colors duration-150"
                style={{ border: '1px solid var(--cs-border)', color: 'var(--cs-text2)', background: 'transparent' }}>
                GitHub Repository
              </a>
            </div>
          </RevealSection>
        </div>
      </section>

      {/* Section cards */}
      <section className="pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <RevealSection>
            <h2 className="font-head font-semibold text-2xl sm:text-3xl text-center mb-2" style={{ color: 'var(--cs-text)' }}>
              Explore the Project
            </h2>
            <p className="text-center mb-10 text-sm" style={{ color: 'var(--cs-text3)' }}>
              Each section dives deep into a different aspect of CodeSage.
            </p>
          </RevealSection>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {SECTIONS.map((sec, i) => {
              const cmap = {
                blue: { bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.2)', text: 'var(--cs-blue-l)' },
                amber: { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)', text: 'var(--cs-amber)' },
                green: { bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.2)', text: 'var(--cs-green)' },
                purple: { bg: 'rgba(168,85,247,0.08)', border: 'rgba(168,85,247,0.2)', text: 'var(--cs-purple-l)' },
                red: { bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)', text: 'var(--cs-red)' },
              };
              const c = cmap[sec.badgeColor] || cmap.blue;
              return (
                <RevealSection key={i} delay={i * 80}>
                  <Link to={sec.to}
                    data-testid={`home-card-${sec.to.slice(1)}`}
                    className="block rounded-xl p-5 transition-all duration-200 hover:translate-y-[-3px] group h-full"
                    style={{ background: 'var(--cs-surface)', border: '1px solid var(--cs-border)' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = c.border}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--cs-border)'}>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 rounded-lg" style={{ background: c.bg }}>
                        {sec.icon}
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
                        {sec.badge}
                      </span>
                    </div>
                    <h3 className="font-head font-semibold text-base mb-1.5 group-hover:text-blue-400 transition-colors"
                      style={{ color: 'var(--cs-text)' }}>{sec.title}</h3>
                    <p className="text-xs" style={{ color: 'var(--cs-text3)', lineHeight: '1.6' }}>{sec.desc}</p>
                    <div className="mt-3 text-xs font-medium flex items-center gap-1" style={{ color: c.text }}>
                      Explore
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                    </div>
                  </Link>
                </RevealSection>
              );
            })}
          </div>

          {/* Additional links row */}
          <RevealSection delay={500}>
            <div className="flex flex-wrap justify-center gap-3 mt-10">
              <Link to="/stack" className="px-4 py-2 rounded-lg text-xs transition-all duration-150 hover:translate-y-[-1px]"
                style={{ background: 'var(--cs-surface)', color: 'var(--cs-text2)', border: '1px solid var(--cs-border)' }}>
                Tech Stack
              </Link>
              <Link to="/resume" className="px-4 py-2 rounded-lg text-xs transition-all duration-150 hover:translate-y-[-1px]"
                style={{ background: 'var(--cs-surface)', color: 'var(--cs-text2)', border: '1px solid var(--cs-border)' }}>
                Resume Bullet
              </Link>
            </div>
          </RevealSection>
        </div>
      </section>
    </div>
  );
}
