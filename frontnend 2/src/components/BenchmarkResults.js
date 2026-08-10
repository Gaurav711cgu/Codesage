import React, { useState, useEffect, useRef } from 'react';
import { BENCHMARK_DATA, BENCHMARK_DOMAIN, COMPARISON_MODELS, LOSS_CURVE_DATA } from '../constants/fallbacks';

function BenchmarkBar({ item, visible, delay }) {
  return (
    <div data-testid={`benchmark-row-${item.name.replace(/\s+/g, '-').toLowerCase()}`} className="mb-5">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-medium" style={{ color: 'var(--cs-text2)' }}>{item.name}</span>
        <span className="text-xs px-2 py-0.5 rounded-full font-mono font-semibold"
          style={{ background: 'rgba(34,197,94,0.12)', color: 'var(--cs-green)', border: '1px solid rgba(34,197,94,0.25)' }}>
          {item.delta}
        </span>
      </div>
      {/* Base bar */}
      <div className="relative h-7 rounded-md mb-1" style={{ background: 'var(--cs-surface2)' }}>
        <div className="benchmark-bar absolute top-0 left-0 h-full rounded-md flex items-center justify-end px-2"
          style={{
            width: visible ? `${item.base}%` : '0%',
            background: 'rgba(155,163,184,0.15)',
            transitionDelay: `${delay}ms`,
          }}>
          <span className="text-xs font-mono" style={{ color: 'var(--cs-text3)' }}>{item.base}%</span>
        </div>
      </div>
      <div className="relative h-7 rounded-md" style={{ background: 'var(--cs-surface2)' }}>
        <div className="benchmark-bar absolute top-0 left-0 h-full rounded-md flex items-center justify-end px-2"
          style={{
            width: visible ? `${item.codesage}%` : '0%',
            background: 'rgba(59,130,246,0.25)',
            transitionDelay: `${delay + 150}ms`,
          }}>
          <span className="text-xs font-mono font-semibold" style={{ color: 'var(--cs-blue-l)' }}>{item.codesage}%</span>
        </div>
      </div>
      <div className="flex gap-4 mt-1">
        <span className="text-xs" style={{ color: 'var(--cs-text3)' }}>Base Llama 3.3 8B</span>
        <span className="text-xs font-medium" style={{ color: 'var(--cs-blue-l)' }}>CodeSage v1.0</span>
      </div>
    </div>
  );
}

function LossCurveChart({ visible }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!visible || !canvasRef.current) return;
    let destroyed = false;

    const loadChart = async () => {
      try {
        const { Chart, registerables } = await import('chart.js');
        Chart.register(...registerables);

        if (destroyed) return;

        if (chartRef.current) chartRef.current.destroy();

        chartRef.current = new Chart(canvasRef.current, {
          type: 'line',
          data: {
            labels: LOSS_CURVE_DATA.labels,
            datasets: LOSS_CURVE_DATA.datasets.map(ds => ({
              ...ds,
              borderWidth: 2,
              pointRadius: 0,
              tension: 0.3,
              fill: false,
            })),
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 1000 },
            plugins: {
              legend: {
                labels: { color: '#9BA3B8', font: { size: 11 } },
              },
              tooltip: {
                backgroundColor: '#0F1319',
                borderColor: '#252D3D',
                borderWidth: 1,
                titleColor: '#F0F4FF',
                bodyColor: '#9BA3B8',
              },
            },
            scales: {
              x: {
                title: { display: true, text: 'Training Steps', color: '#9BA3B8' },
                ticks: { color: '#5C6478', maxTicksLimit: 10 },
                grid: { color: 'rgba(155,163,184,0.08)' },
              },
              y: {
                title: { display: true, text: 'Loss', color: '#9BA3B8' },
                ticks: { color: '#5C6478' },
                grid: { color: 'rgba(155,163,184,0.08)' },
                min: 0.5,
                max: 1.5,
              },
            },
          },
        });
      } catch (e) {
        console.error('Chart.js load error:', e);
      }
    };
    loadChart();
    return () => { destroyed = true; if (chartRef.current) chartRef.current.destroy(); };
  }, [visible]);

  return (
    <div data-testid="benchmarks-chart" className="rounded-xl p-4" style={{ background: 'var(--cs-surface)', border: '1px solid var(--cs-border)', height: 350 }}>
      <div className="text-sm font-semibold mb-2" style={{ color: 'var(--cs-text)' }}>Training Loss Over 3 Epochs</div>
      <div style={{ height: 290 }}>
        <canvas data-testid="benchmarks-chart-canvas" ref={canvasRef}></canvas>
      </div>
    </div>
  );
}

export default function BenchmarkResults({ embedded }) {
  const [visible, setVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { threshold: 0.15 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section id="benchmarks" data-testid="benchmarks-section" ref={ref} className={embedded ? "pb-16 px-4 sm:px-6 lg:px-8" : "py-16 sm:py-20 px-4 sm:px-6 lg:px-8"}>
      <div className="max-w-6xl mx-auto">
        {!embedded && (
        <div className="text-center mb-10">
          <span className="text-xs font-medium px-3 py-1 rounded-full mb-3 inline-block"
            style={{ background: 'rgba(34,197,94,0.12)', color: 'var(--cs-green)', border: '1px solid rgba(34,197,94,0.25)' }}>
            Benchmarks
          </span>
          <h2 className="font-head font-semibold text-3xl sm:text-4xl mt-3" style={{ color: 'var(--cs-text)' }}>
            Numbers You Can Cite in an Interview
          </h2>
          <p className="mt-3" style={{ color: 'var(--cs-text2)', maxWidth: 560, margin: '12px auto 0' }}>
            All evaluations run with the same harness against held-out test sets.
          </p>
        </div>
        )}

        {/* Note card */}
        <div className="rounded-lg p-4 mb-8 max-w-4xl mx-auto" style={{ background: 'var(--cs-surface)', borderLeft: '3px solid var(--cs-amber)' }}>
          <span className="text-xs" style={{ color: 'var(--cs-amber)' }}>
            These are the benchmark targets for CodeSage v1.0. Reproduce: <code className="font-mono">python eval/run_humaneval.py --model codesage-v1</code>
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Animated bars */}
          <div>
            {BENCHMARK_DATA.map((item, i) => (
              <BenchmarkBar key={i} item={item} visible={visible} delay={i * 150} />
            ))}

            {/* Domain-specific */}
            <div className="mt-6">
              <div className="text-sm font-semibold mb-3" style={{ color: 'var(--cs-text)' }}>Domain-Specific Evaluations</div>
              {BENCHMARK_DOMAIN.map((item, i) => (
                <div key={i} className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid var(--cs-border)' }}>
                  <span className="text-xs" style={{ color: 'var(--cs-text2)' }}>{item.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold" style={{ color: 'var(--cs-blue-l)' }}>{item.value}{typeof item.value === 'number' ? '%' : ''}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(59,130,246,0.12)', color: 'var(--cs-blue-l)', border: '1px solid rgba(59,130,246,0.25)' }}>
                      {item.badge}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Loss curves + Comparison */}
          <div className="space-y-6">
            <LossCurveChart visible={visible} />

            {/* Comparison table */}
            <div className="rounded-xl overflow-hidden" style={{ background: 'var(--cs-surface)', border: '1px solid var(--cs-border)' }}>
              <div className="p-4">
                <div className="text-sm font-semibold mb-3" style={{ color: 'var(--cs-text)' }}>vs Other 8B Code Models</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--cs-border)' }}>
                        <th className="text-left py-2 pr-3 font-medium" style={{ color: 'var(--cs-text3)' }}>Model</th>
                        <th className="text-right py-2 px-3 font-medium" style={{ color: 'var(--cs-text3)' }}>HumanEval</th>
                        <th className="text-right py-2 px-3 font-medium" style={{ color: 'var(--cs-text3)' }}>Params</th>
                        <th className="text-right py-2 pl-3 font-medium" style={{ color: 'var(--cs-text3)' }}>License</th>
                      </tr>
                    </thead>
                    <tbody>
                      {COMPARISON_MODELS.map((m, i) => (
                        <tr key={i} style={{
                          borderBottom: '1px solid var(--cs-border)',
                          background: m.highlight ? 'rgba(59,130,246,0.06)' : 'transparent',
                        }}>
                          <td className="py-2 pr-3 font-medium" style={{ color: m.highlight ? 'var(--cs-blue-l)' : 'var(--cs-text)' }}>{m.model}</td>
                          <td className="py-2 px-3 text-right font-mono" style={{ color: m.highlight ? 'var(--cs-green)' : 'var(--cs-text2)' }}>{m.humaneval}</td>
                          <td className="py-2 px-3 text-right" style={{ color: 'var(--cs-text3)' }}>{m.params}</td>
                          <td className="py-2 pl-3 text-right" style={{ color: 'var(--cs-text3)' }}>{m.license}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
