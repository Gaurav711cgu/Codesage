import React, { useState, useRef, useEffect } from 'react';
import { TRAINING_STAGES } from '../constants/content';
import { ChevronDown, Database, SlidersHorizontal, LineChart, GitMerge, Cloud } from 'lucide-react';

const ICONS = {
  database: Database,
  sliders: SlidersHorizontal,
  chart: LineChart,
  merge: GitMerge,
  cloud: Cloud,
};

function DataSourceCard({ source }) {
  return (
    <div className="rounded-lg p-3 mb-2" style={{ background: 'var(--cs-surface2)', border: '1px solid var(--cs-border)' }}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium" style={{ color: 'var(--cs-text)' }}>{source.name}</span>
        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(34,197,94,0.12)', color: 'var(--cs-green)', border: '1px solid rgba(34,197,94,0.25)' }}>
          Kept: {source.kept}
        </span>
      </div>
      <p className="text-xs" style={{ color: 'var(--cs-text2)' }}>{source.details}</p>
    </div>
  );
}

function ConfigBlock({ label, value }) {
  return (
    <div className="flex items-start gap-2 mb-1">
      <span className="font-mono text-xs shrink-0" style={{ color: 'var(--cs-blue-l)' }}>{label}:</span>
      <span className="text-xs" style={{ color: 'var(--cs-text2)' }}>{value}</span>
    </div>
  );
}

function Stage({ stage, index }) {
  const [open, setOpen] = useState(false);
  const Icon = ICONS[stage.icon] || Database;

  return (
    <div data-testid={`training-stage-${index}`} className="rounded-xl overflow-hidden mb-3"
      style={{ background: 'var(--cs-surface)', border: '1px solid var(--cs-border)' }}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 p-4 transition-colors duration-150"
        style={{ background: open ? 'var(--cs-surface2)' : 'transparent' }}
      >
        <div className="p-2 rounded-lg" style={{ background: 'rgba(59,130,246,0.1)' }}>
          <Icon size={18} style={{ color: 'var(--cs-blue)' }} />
        </div>
        <div className="flex-1 text-left">
          <div className="text-sm font-semibold" style={{ color: 'var(--cs-text)' }}>{stage.title}</div>
          <div className="text-xs" style={{ color: 'var(--cs-text3)' }}>{stage.summary}</div>
        </div>
        <span className="text-xs px-2 py-1 rounded-full shrink-0 hidden sm:inline"
          style={{ background: 'rgba(59,130,246,0.12)', color: 'var(--cs-blue-l)', border: '1px solid rgba(59,130,246,0.25)' }}>
          {stage.badge}
        </span>
        <ChevronDown
          size={16}
          style={{ color: 'var(--cs-text3)', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 200ms' }}
        />
      </button>

      {open && (
        <div className="p-4" style={{ borderTop: '1px solid var(--cs-border)' }}>
          {/* Stage 0: Dataset */}
          {index === 0 && stage.content.sources && (
            <div>
              <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--cs-text)' }}>Data Sources</h4>
              {stage.content.sources.map((s, i) => <DataSourceCard key={i} source={s} />)}
              <h4 className="text-sm font-semibold mt-4 mb-2" style={{ color: 'var(--cs-text)' }}>Filtering Pipeline</h4>
              {stage.content.filtering.map((f, i) => (
                <div key={i} className="text-xs mb-1 flex items-start gap-2" style={{ color: 'var(--cs-text2)' }}>
                  <span style={{ color: 'var(--cs-green)' }}>&#10003;</span> {f}
                </div>
              ))}
              <h4 className="text-sm font-semibold mt-4 mb-2" style={{ color: 'var(--cs-text)' }}>Distribution</h4>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(stage.content.distribution).map(([k, v]) => (
                  <div key={k} className="rounded-lg p-2 text-center" style={{ background: 'var(--cs-surface2)' }}>
                    <div className="text-xs font-medium" style={{ color: 'var(--cs-text2)' }}>{k}</div>
                    <div className="text-sm font-semibold" style={{ color: 'var(--cs-text)' }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Stage 1: QLoRA */}
          {index === 1 && stage.content.lora && (
            <div className="space-y-3">
              <div className="rounded-lg p-3" style={{ background: 'var(--cs-surface2)' }}>
                <h4 className="text-xs font-semibold mb-2" style={{ color: 'var(--cs-text3)' }}>BASE MODEL</h4>
                <div className="text-sm" style={{ color: 'var(--cs-text)' }}>{stage.content.baseModel}</div>
              </div>
              <div className="rounded-lg p-3" style={{ background: 'var(--cs-surface2)' }}>
                <h4 className="text-xs font-semibold mb-2" style={{ color: 'var(--cs-text3)' }}>QUANTIZATION</h4>
                <ConfigBlock label="type" value={stage.content.quantization.type} />
                <ConfigBlock label="compute" value={stage.content.quantization.compute} />
                <ConfigBlock label="double_quant" value={String(stage.content.quantization.doubleQuant)} />
                <div className="text-xs mt-1" style={{ color: 'var(--cs-text3)' }}>{stage.content.quantization.reason}</div>
              </div>
              <div className="rounded-lg p-3" style={{ background: 'var(--cs-surface2)' }}>
                <h4 className="text-xs font-semibold mb-2" style={{ color: 'var(--cs-text3)' }}>LORA CONFIG</h4>
                <ConfigBlock label="r" value={String(stage.content.lora.r)} />
                <ConfigBlock label="alpha" value={String(stage.content.lora.alpha)} />
                <ConfigBlock label="dropout" value={String(stage.content.lora.dropout)} />
                <ConfigBlock label="targets" value={stage.content.lora.targets} />
                <ConfigBlock label="dora" value={String(stage.content.lora.dora)} />
                <div className="text-xs mt-1" style={{ color: 'var(--cs-amber)' }}>{stage.content.lora.doraReason}</div>
              </div>
              <div className="rounded-lg p-3" style={{ background: 'var(--cs-surface2)' }}>
                <h4 className="text-xs font-semibold mb-2" style={{ color: 'var(--cs-text3)' }}>TRAINING</h4>
                <ConfigBlock label="epochs" value={String(stage.content.training.epochs)} />
                <ConfigBlock label="batch_size" value={stage.content.training.batchSize} />
                <ConfigBlock label="learning_rate" value={stage.content.training.lr} />
                <ConfigBlock label="optimizer" value={stage.content.training.optimizer} />
                <ConfigBlock label="packing" value={String(stage.content.training.packing)} />
              </div>
              <div className="text-sm font-medium" style={{ color: 'var(--cs-orange)' }}>{stage.content.hardware}</div>
            </div>
          )}

          {/* Stage 2: W&B */}
          {index === 2 && stage.content.runs && (
            <div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                {stage.content.runs.map((run, i) => (
                  <div key={i} className="rounded-lg p-3" style={{ background: 'var(--cs-surface2)', border: run.status === 'Production' ? '1px solid rgba(34,197,94,0.4)' : '1px solid var(--cs-border)' }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-xs" style={{ color: 'var(--cs-text)' }}>{run.name}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded-full" style={{
                        background: run.status === 'Production' ? 'rgba(34,197,94,0.12)' : 'rgba(155,163,184,0.1)',
                        color: run.status === 'Production' ? 'var(--cs-green)' : 'var(--cs-text3)',
                      }}>{run.status}</span>
                    </div>
                    <div className="text-xs" style={{ color: 'var(--cs-text3)' }}>{run.config}</div>
                    <div className="mt-2 flex items-center gap-3">
                      <span className="text-xs" style={{ color: 'var(--cs-text2)' }}>Loss: <span className="font-mono">{run.loss}</span></span>
                      <span className="text-xs font-medium" style={{ color: 'var(--cs-green)' }}>{run.humaneval}</span>
                    </div>
                  </div>
                ))}
              </div>
              <h4 className="text-sm font-semibold mb-2" style={{ color: 'var(--cs-text)' }}>Key Findings</h4>
              {stage.content.findings.map((f, i) => (
                <div key={i} className="text-xs mb-1.5 flex items-start gap-2" style={{ color: 'var(--cs-text2)' }}>
                  <span style={{ color: 'var(--cs-amber)' }}>&bull;</span> {f}
                </div>
              ))}
            </div>
          )}

          {/* Stage 3: Merge */}
          {index === 3 && stage.content.steps && (
            <div>
              <h4 className="text-sm font-semibold mb-2" style={{ color: 'var(--cs-text)' }}>Merging Process</h4>
              {stage.content.steps.map((s, i) => (
                <div key={i} className="text-xs mb-1.5 flex items-start gap-2" style={{ color: 'var(--cs-text2)' }}>
                  <span className="font-mono" style={{ color: 'var(--cs-blue)' }}>{i+1}.</span> {s}
                </div>
              ))}
              <h4 className="text-sm font-semibold mt-4 mb-2" style={{ color: 'var(--cs-text)' }}>Output Formats</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {stage.content.formats.map((f, i) => (
                  <div key={i} className="rounded-lg p-3" style={{ background: 'var(--cs-surface2)' }}>
                    <div className="text-xs font-semibold" style={{ color: 'var(--cs-text)' }}>{f.name}</div>
                    <div className="text-xs" style={{ color: 'var(--cs-text3)' }}>{f.use}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Stage 4: Modal */}
          {index === 4 && stage.content.whyModal && (
            <div>
              <div className="rounded-lg p-3 mb-3" style={{ background: 'var(--cs-surface2)', borderLeft: '3px solid var(--cs-orange)' }}>
                <div className="text-xs" style={{ color: 'var(--cs-text2)' }}>{stage.content.whyModal}</div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {Object.entries(stage.content.config).map(([k, v]) => (
                  <div key={k} className="rounded-lg p-2 text-center" style={{ background: 'var(--cs-surface2)' }}>
                    <div className="text-xs" style={{ color: 'var(--cs-text3)' }}>{k.replace(/([A-Z])/g, ' $1').trim()}</div>
                    <div className="text-sm font-mono font-semibold" style={{ color: 'var(--cs-text)' }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function TrainingPipeline({ embedded }) {
  const sectionRef = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { threshold: 0.05 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section id="training" data-testid="training-pipeline-section" ref={sectionRef}
      className={embedded ? "pb-16 px-4 sm:px-6 lg:px-8" : "py-16 sm:py-20 px-4 sm:px-6 lg:px-8"} aria-label="Training Pipeline">
      <div className="max-w-4xl mx-auto" style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(24px)', transition: 'opacity 0.6s cubic-bezier(0.16,1,0.3,1), transform 0.6s cubic-bezier(0.16,1,0.3,1)' }}>
        {!embedded && (
        <div className="text-center mb-10">
          <span className="text-xs font-medium px-3 py-1 rounded-full mb-3 inline-block"
            style={{ background: 'rgba(245,158,11,0.12)', color: 'var(--cs-amber)', border: '1px solid rgba(245,158,11,0.25)' }}>
            The Training Pipeline
          </span>
          <h2 className="font-head font-semibold text-3xl sm:text-4xl mt-3" style={{ color: 'var(--cs-text)' }}>
            How CodeSage Was Built
          </h2>
          <p className="mt-3" style={{ color: 'var(--cs-text2)' }}>
            Every decision is documented. Every number is real.
          </p>
        </div>
        )}
        <div data-testid="training-pipeline-accordion">
          {TRAINING_STAGES.map((stage, i) => (
            <Stage key={i} stage={stage} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
