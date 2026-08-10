import React, { useState } from 'react';
import { INFERENCE_COMPONENTS } from '../constants/content';

const colorMap = {
  amber: { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.35)', text: 'var(--cs-amber)' },
  blue: { bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.35)', text: 'var(--cs-blue-l)' },
  purple: { bg: 'rgba(168,85,247,0.12)', border: 'rgba(168,85,247,0.35)', text: 'var(--cs-purple-l)' },
  green: { bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.35)', text: 'var(--cs-green)' },
};

const STATS = [
  { value: '12,500', unit: 'tok/s', label: 'Peak throughput on H100', sub: 'vs 793 tok/s Ollama' },
  { value: '72ms', unit: '', label: 'TTFT at low concurrency', sub: 'time-to-first-token on H100' },
  { value: '24x', unit: '', label: 'vs HuggingFace Transformers', sub: 'at high concurrency' },
  { value: '<4%', unit: '', label: 'KV cache memory waste', sub: 'vs 60-80% traditional' },
];

export default function InferenceArch({ embedded }) {
  const [active, setActive] = useState(null);

  return (
    <section id="inference" data-testid="inference-architecture-section" className={embedded ? "pb-16 px-4 sm:px-6 lg:px-8" : "py-16 sm:py-20 px-4 sm:px-6 lg:px-8"}
      aria-label="Inference Architecture">
      <div className="max-w-6xl mx-auto">
        {!embedded && (
        <div className="text-center mb-10">
          <span className="text-xs font-medium px-3 py-1 rounded-full mb-3 inline-block"
            style={{ background: 'rgba(168,85,247,0.12)', color: 'var(--cs-purple-l)', border: '1px solid rgba(168,85,247,0.25)' }}>
            Inference
          </span>
          <h2 className="font-head font-semibold text-3xl sm:text-4xl mt-3" style={{ color: 'var(--cs-text)' }}>
            vLLM + PagedAttention: Production Serving
          </h2>
          <p className="mt-3" style={{ color: 'var(--cs-text2)', maxWidth: 500, margin: '12px auto 0' }}>
            Not a demo. Real throughput numbers from benchmarks.
          </p>
        </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
          {STATS.map((s, i) => (
            <div key={i} className="rounded-xl p-4 text-center" style={{ background: 'var(--cs-surface)', border: '1px solid var(--cs-border)' }}>
              <div className="font-head font-bold text-xl sm:text-2xl" style={{ color: 'var(--cs-blue)' }}>{s.value}{s.unit}</div>
              <div className="text-xs mt-1" style={{ color: 'var(--cs-text2)' }}>{s.label}</div>
              <div className="text-xs" style={{ color: 'var(--cs-text3)' }}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Architecture diagram */}
        <div data-testid="inference-architecture-diagram" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Component list */}
          <div className="lg:col-span-1 space-y-3">
            {INFERENCE_COMPONENTS.map((comp) => {
              const c = colorMap[comp.color] || colorMap.blue;
              const isActive = active === comp.id;
              return (
                <button
                  key={comp.id}
                  data-testid={`arch-node-${comp.id}`}
                  onClick={() => setActive(isActive ? null : comp.id)}
                  className="w-full text-left rounded-xl p-4 transition-colors duration-200"
                  style={{
                    background: isActive ? c.bg : 'var(--cs-surface)',
                    border: `1px solid ${isActive ? c.border : 'var(--cs-border)'}`,
                    cursor: 'pointer',
                  }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 rounded-full" style={{ background: c.text }}></div>
                    <span className="text-sm font-semibold" style={{ color: isActive ? c.text : 'var(--cs-text)' }}>{comp.title}</span>
                  </div>
                  <div className="text-xs" style={{ color: 'var(--cs-text3)' }}>{comp.summary}</div>
                </button>
              );
            })}
          </div>

          {/* Inspector */}
          <div data-testid="arch-inspector" className="lg:col-span-2 rounded-xl p-6" style={{ background: 'var(--cs-surface)', border: '1px solid var(--cs-border)', minHeight: 300 }}>
            {active ? (
              <div>
                {(() => {
                  const comp = INFERENCE_COMPONENTS.find(c => c.id === active);
                  const c = colorMap[comp.color] || colorMap.blue;
                  return (
                    <>
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-3 h-3 rounded-full" style={{ background: c.text }}></div>
                        <h3 className="font-head font-semibold text-xl" style={{ color: c.text }}>{comp.title}</h3>
                      </div>
                      <p className="text-sm leading-relaxed" style={{ color: 'var(--cs-text2)', whiteSpace: 'pre-line' }}>{comp.details}</p>
                    </>
                  );
                })()}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="text-sm" style={{ color: 'var(--cs-text3)' }}>Click a component to explore</div>
                  <div className="text-xs mt-1" style={{ color: 'var(--cs-text3)' }}>Each node reveals architecture details</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Cost comparison */}
        <div className="mt-10 rounded-xl overflow-hidden" style={{ background: 'var(--cs-surface)', border: '1px solid var(--cs-border)' }}>
          <div className="p-5">
            <h3 className="font-head font-semibold text-lg mb-4" style={{ color: 'var(--cs-text)' }}>Why Self-Host vs OpenAI?</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-lg p-4" style={{ background: 'var(--cs-surface2)' }}>
                <div className="text-sm font-semibold mb-2" style={{ color: 'var(--cs-text3)' }}>OpenAI API</div>
                <div className="space-y-1 text-xs" style={{ color: 'var(--cs-text2)' }}>
                  <div>~$5.00 per 1M tokens</div>
                  <div>No data sovereignty</div>
                  <div>No customization</div>
                </div>
              </div>
              <div className="rounded-lg p-4" style={{ background: 'var(--cs-surface2)', border: '1px solid rgba(59,130,246,0.3)' }}>
                <div className="text-sm font-semibold mb-2" style={{ color: 'var(--cs-blue-l)' }}>CodeSage on Modal</div>
                <div className="space-y-1 text-xs" style={{ color: 'var(--cs-text2)' }}>
                  <div><span style={{ color: 'var(--cs-green)' }}>~$0.18</span> per 1M tokens</div>
                  <div>Full data sovereignty</div>
                  <div>Complete customization</div>
                  <div className="font-semibold" style={{ color: 'var(--cs-green)' }}>97% cost reduction</div>
                </div>
              </div>
              <div className="rounded-lg p-4" style={{ background: 'var(--cs-surface2)' }}>
                <div className="text-sm font-semibold mb-2" style={{ color: 'var(--cs-text3)' }}>AWS A10G</div>
                <div className="space-y-1 text-xs" style={{ color: 'var(--cs-text2)' }}>
                  <div>~$1.00/hr on-demand</div>
                  <div>$0.125 per 1M tokens</div>
                  <div>You own the SLA</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
