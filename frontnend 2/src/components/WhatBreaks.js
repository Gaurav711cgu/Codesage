import React, { useState } from 'react';
import { FAILURE_MODES } from '../constants/content';
import { ChevronDown } from 'lucide-react';

const severityColors = {
  high: { bg: 'rgba(239,68,68,0.12)', border: 'var(--cs-red)', badge: 'var(--cs-red)' },
  medium: { bg: 'rgba(245,158,11,0.12)', border: 'var(--cs-amber)', badge: 'var(--cs-amber)' },
  low: { bg: 'rgba(59,130,246,0.12)', border: 'var(--cs-blue)', badge: 'var(--cs-blue-l)' },
};

function FailureCard({ failure, index }) {
  const [expanded, setExpanded] = useState(false);
  const sc = severityColors[failure.severity] || severityColors.medium;

  return (
    <div data-testid={`failure-card-${index}`}
      className="rounded-xl overflow-hidden transition-colors duration-200"
      style={{ background: 'var(--cs-surface)', border: '1px solid var(--cs-border)', borderLeft: `3px solid ${sc.border}` }}
    >
      <button onClick={() => setExpanded(!expanded)} className="w-full text-left p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ background: sc.bg, color: sc.badge, border: `1px solid ${sc.border}33` }}>
                {failure.severity.toUpperCase()}
              </span>
            </div>
            <h4 className="text-sm font-semibold" style={{ color: 'var(--cs-text)' }}>{failure.title}</h4>
            {!expanded && (
              <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--cs-text3)' }}>{failure.problem}</p>
            )}
          </div>
          <ChevronDown size={16} style={{ color: 'var(--cs-text3)', transform: expanded ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 200ms', flexShrink: 0, marginTop: 4 }} />
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3" style={{ borderTop: '1px solid var(--cs-border)' }}>
          <div className="pt-3">
            <div className="text-xs font-semibold mb-1" style={{ color: 'var(--cs-red)' }}>Problem</div>
            <p className="text-xs" style={{ color: 'var(--cs-text2)' }}>{failure.problem}</p>
          </div>
          <div>
            <div className="text-xs font-semibold mb-1" style={{ color: 'var(--cs-amber)' }}>Root Cause</div>
            <p className="text-xs" style={{ color: 'var(--cs-text2)' }}>{failure.rootCause}</p>
          </div>
          <div>
            <div className="text-xs font-semibold mb-1" style={{ color: 'var(--cs-green)' }}>How CodeSage Handles It</div>
            <p className="text-xs" style={{ color: 'var(--cs-text2)', whiteSpace: 'pre-line' }}>{failure.fix}</p>
          </div>
          <div>
            <div className="text-xs font-semibold mb-1" style={{ color: 'var(--cs-text3)' }}>Remaining Risk</div>
            <p className="text-xs" style={{ color: 'var(--cs-text3)' }}>{failure.risk}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function WhatBreaks({ embedded }) {
  return (
    <section id="failures" data-testid="failure-analysis-section" className={embedded ? "pb-16 px-4 sm:px-6 lg:px-8" : "py-16 sm:py-20 px-4 sm:px-6 lg:px-8"}
      aria-label="Failure Analysis">
      <div className="max-w-4xl mx-auto">
        {!embedded && (
        <div className="text-center mb-10">
          <span className="text-xs font-medium px-3 py-1 rounded-full mb-3 inline-block"
            style={{ background: 'rgba(239,68,68,0.12)', color: 'var(--cs-red)', border: '1px solid rgba(239,68,68,0.25)' }}>
            Failure Analysis
          </span>
          <h2 className="font-head font-semibold text-3xl sm:text-4xl mt-3" style={{ color: 'var(--cs-text)' }}>
            What Breaks in Production
          </h2>
          <p className="mt-3" style={{ color: 'var(--cs-text2)', maxWidth: 500, margin: '12px auto 0' }}>
            The section most ML portfolio projects never write. These are real failure modes.
          </p>
        </div>
        )}

        <div className="space-y-3">
          {FAILURE_MODES.map((f, i) => (
            <FailureCard key={i} failure={f} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
