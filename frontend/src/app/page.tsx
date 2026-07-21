"use client";

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { TERMINAL_LINES, RESUME_BULLET } from '@/constants/content';
import { Database, Sliders, LineChart, Merge, Cloud, Code2, Search, FlaskConical, Book, Terminal } from 'lucide-react';

function useCountUp(target: string | number, duration = 1500, trigger = false) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!trigger) return;
    const num = parseFloat(String(target).replace(/[^0-9.]/g, ''));
    if (isNaN(num)) { setValue(target as number); return; }
    const start = performance.now();
    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * num * 10) / 10);
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration, trigger]);
  return value;
}

function StatCard({ stat, isVisible }: { stat: any; isVisible: boolean }) {
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
    icon: <Code2 className="w-[22px] h-[22px]" color="var(--cs-blue-l)" strokeWidth={1.5} />
  },
  {
    to: '/training',
    badge: 'Pipeline',
    badgeColor: 'amber',
    title: 'Training Deep-Dive',
    desc: 'Dataset curation, QLoRA config, W&B tracking, adapter merging, Modal deployment.',
    icon: <Sliders className="w-[22px] h-[22px]" color="var(--cs-amber)" strokeWidth={1.5} />
  },
  {
    to: '/benchmarks',
    badge: 'Results',
    badgeColor: 'green',
    title: 'Benchmarks',
    desc: 'HumanEval, MBPP, HumanEval+, SQL generation — animated charts and comparisons.',
    icon: <LineChart className="w-[22px] h-[22px]" color="var(--cs-green)" strokeWidth={1.5} />
  },
  {
    to: '/inference',
    badge: 'Architecture',
    badgeColor: 'purple',
    title: 'Inference Stack',
    desc: 'vLLM + PagedAttention: 12,500 tok/s, interactive architecture diagram.',
    icon: <Database className="w-[22px] h-[22px]" color="var(--cs-purple-l)" strokeWidth={1.5} />
  },
  {
    to: '/failures',
    badge: 'Analysis',
    badgeColor: 'red',
    title: 'What Breaks',
    desc: '6 real failure modes — catastrophic forgetting, OOM, quantization noise, and more.',
    icon: <Search className="w-[22px] h-[22px]" color="var(--cs-red)" strokeWidth={1.5} />
  },
  {
    to: '/mcp',
    badge: 'Integration',
    badgeColor: 'purple',
    title: 'MCP Server',
    desc: '4 tools exposed via Model Context Protocol — usable by Claude, Cursor, any agent.',
    icon: <Terminal className="w-[22px] h-[22px]" color="var(--cs-purple-l)" strokeWidth={1.5} />
  },
];

const colorMap: Record<string, string> = {
  text3: 'var(--cs-text3)',
  blue: 'var(--cs-blue)',
  amber: 'var(--cs-amber)',
  green: 'var(--cs-green-l)',
};

const TECH_LOGOS = [
  { name: 'Python', src: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/python/python-original.svg' },
  { name: 'TypeScript', src: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/typescript/typescript-original.svg' },
  { name: 'React', src: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/react/react-original.svg' },
  { name: 'Next.js', src: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/nextjs/nextjs-original.svg', invert: true },
  { name: 'Tailwind', src: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/tailwindcss/tailwindcss-original.svg' },
  { name: 'PyTorch', src: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/pytorch/pytorch-original.svg' },
  { name: 'vLLM', src: 'https://raw.githubusercontent.com/vllm-project/vllm/main/docs/source/assets/logos/vllm-logo-text-light.png', isWide: true },
];

export default function Home() {
  const [visibleLines, setVisibleLines] = useState<any[]>([]);
  const [isVisible, setIsVisible] = useState(false);
  const statsRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let timeouts: NodeJS.Timeout[] = [];
    let isRunning = true;
    let sequenceIndex = 0;
    
    const runSequence = () => {
      if (!isRunning) return;
      
      const playSequence = async () => {
        while (isRunning) {
          setVisibleLines([]);
          for (let i = 0; i < TERMINAL_LINES.length; i++) {
            if (!isRunning) break;
            const line = TERMINAL_LINES[i];
            const delay = i === 0 ? line.delay : line.delay - TERMINAL_LINES[i - 1].delay;
            await new Promise(resolve => {
              const t = setTimeout(resolve, delay);
              timeouts.push(t);
            });
            if (isRunning) {
              setVisibleLines(prev => [...prev, line]);
            }
          }
          if (!isRunning) break;
          await new Promise(resolve => {
            const t = setTimeout(resolve, 3000);
            timeouts.push(t);
          });
        }
      };
      playSequence();
    };

    runSequence();

    return () => {
      isRunning = false;
      timeouts.forEach(clearTimeout);
    };
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsVisible(true); },
      { threshold: 0.2 }
    );
    if (statsRef.current) observer.observe(statsRef.current);
    return () => observer.disconnect();
  }, [mounted]);

  return (
    <div>
      {/* Hero */}
      <section className="pt-28 pb-10 sm:pt-32 sm:pb-14 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center gap-12">
          
          <div className="flex-1">
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div className="flex items-center gap-2 mb-6">
                <span className="px-3 py-1 rounded-full text-[10px] sm:text-xs font-semibold tracking-widest uppercase border"
                  style={{ background: 'rgba(255,51,102,0.1)', color: 'var(--cs-primary)', borderColor: 'rgba(255,51,102,0.2)' }}>
                  <span className="inline-block w-1.5 h-1.5 rounded-full mr-2" style={{ background: 'var(--cs-primary)' }}></span>
                  A Next-Gen Code Model
                </span>
              </div>
              <h1 className="font-playfair font-bold leading-[1.1] mb-5"
                style={{ fontSize: 'clamp(48px, 7vw, 84px)', color: 'var(--cs-text)', letterSpacing: '-0.02em' }}>
                Code Intelligence.<br/>
                <span className="italic" style={{ color: 'var(--cs-primary)' }}>Simplified.</span>
              </h1>
              <p className="mb-10" style={{ maxWidth: 480, color: 'var(--cs-text2)', fontSize: '18px', lineHeight: '1.6' }}>
                Curated code datasets, QLoRA fine-tuning, and robust evaluations — <span className="italic">all in one open-source package.</span>
              </p>
            </div>

            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
              <div className="flex flex-wrap gap-4 mb-10">
                <Link href="/playground" data-testid="hero-try-playground-button"
                  className="px-8 py-3.5 rounded-full font-semibold text-sm text-white transition-all duration-300 hover:scale-105 shadow-lg no-underline flex items-center gap-2"
                  style={{ background: 'linear-gradient(135deg, #FF3366, #FB7185)' }}>
                  Enter the flow &rarr;
                </Link>
                <Link href="/benchmarks" data-testid="hero-view-benchmarks-button"
                  className="px-8 py-3.5 rounded-full text-sm font-medium transition-all duration-300 hover:bg-white/5 no-underline flex items-center gap-2"
                  style={{ border: '1px solid var(--cs-border)', color: 'var(--cs-text)' }}>
                  <span style={{ color: 'var(--cs-primary)' }}>✦</span> Try the demo
                </Link>
              </div>
            </div>
          </div>

          <div className="flex-1 w-full max-w-lg relative">
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
              <div className="absolute -inset-4 bg-gradient-to-r from-pink-500/10 to-purple-500/10 blur-xl opacity-50 rounded-[2rem]"></div>
              
              {/* Terminal / Floating Cards simulation */}
              <div data-testid="hero-terminal" className="relative shadow-2xl rounded-2xl overflow-hidden transition-transform duration-500 hover:-translate-y-2 hover:rotate-1" 
                style={{ background: 'var(--cs-surface)', border: '1px solid var(--cs-border)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.7)' }}>
                <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid var(--cs-border)' }}>
                  <div className="font-playfair font-semibold text-sm">Training Run #1024</div>
                  <div className="ml-auto flex items-center gap-2">
                    <span className="text-[10px] px-2 py-0.5 rounded-full border border-pink-500/30 text-pink-400 bg-pink-500/10">In Progress</span>
                    <span className="text-gray-500">...</span>
                  </div>
                </div>
                <div className="p-5 font-mono text-xs overflow-y-auto" style={{ height: 260, lineHeight: '1.8' }}>
                  {visibleLines.map((line, i) => (
                    <div key={i} style={{ color: colorMap[line.color] || 'var(--cs-text2)' }}>
                      {line.text}
                      {line.check && <span style={{ color: 'var(--cs-green)' }}> &#10003;</span>}
                    </div>
                  ))}
                  {visibleLines.length > 0 && (
                    <span className="cursor-blink inline-block w-2 h-4 ml-0.5" style={{ background: 'var(--cs-primary)' }}></span>
                  )}
                </div>
              </div>

              {/* Decorative floating card */}
              <div className="absolute -bottom-6 -left-8 rounded-xl p-4 shadow-2xl backdrop-blur-md hidden sm:block animate-bounce"
                style={{ background: 'rgba(18,18,20,0.85)', border: '1px solid var(--cs-border)', animationDuration: '4s' }}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-pink-500/20 flex items-center justify-center text-pink-400 font-serif font-bold text-xs border border-pink-500/30">
                    CS
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-white">Llama 3.3 8B</div>
                    <div className="text-[10px] text-gray-400">Model Configuration</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* Section cards */}
      <section className="pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div>
            <h2 className="font-playfair font-semibold text-3xl sm:text-4xl text-center mb-2" style={{ color: 'var(--cs-text)' }}>
              Explore the Project
            </h2>
            <p className="text-center mb-10 text-sm" style={{ color: 'var(--cs-text2)' }}>
              Each section dives deep into a different aspect of CodeSage.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {SECTIONS.map((sec, i) => {
              const c = { bg: 'rgba(255,51,102,0.05)', border: 'rgba(255,51,102,0.15)', text: 'var(--cs-primary)', hoverBorder: 'rgba(255,51,102,0.4)' };
              return (
                <div key={i} className="h-full">
                  <Link href={sec.to}
                    data-testid={`home-card-${sec.to.slice(1)}`}
                    className="block rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 group h-full no-underline shadow-lg"
                    style={{ background: 'var(--cs-surface)', border: '1px solid var(--cs-border)' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = c.hoverBorder}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--cs-border)'}>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2.5 rounded-xl flex items-center justify-center transition-colors group-hover:bg-pink-500/10" style={{ background: c.bg }}>
                        {React.cloneElement(sec.icon, { color: c.text })}
                      </div>
                      <span className="text-[10px] px-2.5 py-1 rounded-full font-semibold uppercase tracking-wider transition-colors group-hover:bg-pink-500/10"
                        style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
                        {sec.badge}
                      </span>
                    </div>
                    <h3 className="font-playfair font-semibold text-xl mb-2 group-hover:text-pink-400 transition-colors"
                      style={{ color: 'var(--cs-text)' }}>{sec.title}</h3>
                    <p className="text-sm" style={{ color: 'var(--cs-text2)', lineHeight: '1.6' }}>{sec.desc}</p>
                    <div className="mt-4 text-xs font-semibold flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" style={{ color: c.text }}>
                      Explore
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>

          {/* Resume & Tech Stack */}
          <div>
            <div className="mt-20 pt-16 border-t" style={{ borderColor: 'var(--cs-border)' }}>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                
                {/* Tech Stack */}
                <div>
                  <h3 className="font-playfair font-semibold text-2xl mb-6" style={{ color: 'var(--cs-text)' }}>Core Tech Stack</h3>
                  <div className="flex flex-wrap gap-3">
                    {TECH_LOGOS.map((tech) => (
                      <div key={tech.name} className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl transition-colors hover:bg-white/5" 
                        style={{ width: tech.isWide ? '120px' : '80px', background: 'var(--cs-surface)', border: '1px solid var(--cs-border)' }}>
                        <img src={tech.src} alt={tech.name} className={`object-contain ${tech.invert ? 'invert opacity-90' : ''} ${tech.isWide ? 'w-16 h-8' : 'w-8 h-8'}`} />
                        <span className="text-[10px] font-medium text-center" style={{ color: 'var(--cs-text2)' }}>{tech.name}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Resume Bullet */}
                <div>
                  <h3 className="font-playfair font-semibold text-2xl mb-6 flex items-center gap-3" style={{ color: 'var(--cs-text)' }}>
                    Resume Bullet
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-mono uppercase tracking-widest" style={{ background: 'rgba(255,51,102,0.1)', color: 'var(--cs-primary)', border: '1px solid rgba(255,51,102,0.2)' }}>TL;DR</span>
                  </h3>
                  <div className="p-6 rounded-2xl font-mono text-sm leading-relaxed shadow-lg" style={{ background: 'var(--cs-surface)', border: '1px solid var(--cs-border)', color: 'var(--cs-text2)' }}>
                    {RESUME_BULLET}
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
