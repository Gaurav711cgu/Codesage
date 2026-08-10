import React from 'react';

const COLUMNS = [
  {
    title: 'Model Layer',
    color: 'var(--cs-blue)',
    items: [
      { name: 'Llama 3.3 8B Instruct', reason: 'Best open-source 8B for code (HumanEval 72.6 base). 128K context. Commercial-friendly license.' },
    ],
  },
  {
    title: 'Training',
    color: 'var(--cs-amber)',
    items: [
      { name: 'QLoRA + Unsloth', reason: '8B fine-tuning on single A100 for $9.40. 2x faster, 60% less VRAM vs standard HF.' },
      { name: 'DoRA adapter', reason: '+1-4.4pp improvement over standard LoRA at same rank. Zero inference overhead.' },
      { name: 'W&B', reason: 'Track loss curves, hyperparameter sweeps, eval metrics.' },
    ],
  },
  {
    title: 'Inference',
    color: 'var(--cs-purple)',
    items: [
      { name: 'vLLM', reason: '12,500 tok/s. PagedAttention <4% memory waste. OpenAI-compatible API.' },
      { name: 'BF16 serving', reason: 'Better numerical stability than FP16. Same memory.' },
    ],
  },
  {
    title: 'Deployment',
    color: 'var(--cs-orange)',
    items: [
      { name: 'Modal', reason: 'Serverless GPU. Pay only for inference. ~95% cheaper than always-on AWS.' },
    ],
  },
  {
    title: 'Tooling',
    color: 'var(--cs-green)',
    items: [
      { name: 'MCP', reason: "Anthropic's protocol. 97M monthly SDK downloads. Every major AI provider supports it." },
      { name: 'HuggingFace Hub', reason: 'Model versioning, model cards, eval results published publicly.' },
      { name: 'EvalPlus', reason: 'Stricter than HumanEval. Report both for credibility.' },
    ],
  },
];

export default function TechStack({ embedded }) {
  return (
    <section id="techstack" data-testid="tech-stack-section" className={embedded ? "pb-16 px-4 sm:px-6 lg:px-8" : "py-16 sm:py-20 px-4 sm:px-6 lg:px-8"}
      aria-label="Technology Stack">
      <div className="max-w-6xl mx-auto">
        {!embedded && (
        <div className="text-center mb-10">
          <span className="text-xs font-medium px-3 py-1 rounded-full mb-3 inline-block"
            style={{ background: 'rgba(59,130,246,0.12)', color: 'var(--cs-blue-l)', border: '1px solid rgba(59,130,246,0.25)' }}>
            Stack
          </span>
          <h2 className="font-head font-semibold text-3xl sm:text-4xl mt-3" style={{ color: 'var(--cs-text)' }}>
            The Stack
          </h2>
          <p className="mt-3" style={{ color: 'var(--cs-text2)' }}>
            Every choice made for a specific reason.
          </p>
        </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {COLUMNS.map((col, i) => (
            <div key={i} className="rounded-xl p-4" style={{ background: 'var(--cs-surface)', border: '1px solid var(--cs-border)' }}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full" style={{ background: col.color }}></div>
                <span className="text-sm font-semibold" style={{ color: col.color }}>{col.title}</span>
              </div>
              <div className="space-y-3">
                {col.items.map((item, j) => (
                  <div key={j}>
                    <div className="text-sm font-medium" style={{ color: 'var(--cs-text)' }}>{item.name}</div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--cs-text3)' }}>{item.reason}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
