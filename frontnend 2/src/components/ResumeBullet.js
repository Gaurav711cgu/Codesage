import React, { useState } from 'react';
import { RESUME_BULLET, COMPANY_CARDS } from '../constants/content';
import { Copy, Check } from 'lucide-react';

const CARD_COLORS = {
  Anthropic: { bg: 'rgba(59,130,246,0.06)', border: 'rgba(59,130,246,0.25)', accent: 'var(--cs-blue-l)' },
  OpenAI: { bg: 'rgba(34,197,94,0.06)', border: 'rgba(34,197,94,0.25)', accent: 'var(--cs-green)' },
  DeepMind: { bg: 'rgba(168,85,247,0.06)', border: 'rgba(168,85,247,0.25)', accent: 'var(--cs-purple-l)' },
};

export default function ResumeBullet({ embedded }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(RESUME_BULLET);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section id="resume" data-testid="resume-bullet-section" className={embedded ? "pb-16 px-4 sm:px-6 lg:px-8" : "py-16 sm:py-20 px-4 sm:px-6 lg:px-8"}
      aria-label="Resume Bullet">
      <div className="max-w-4xl mx-auto">
        {!embedded && (
        <div className="text-center mb-10">
          <span className="text-xs font-medium px-3 py-1 rounded-full mb-3 inline-block"
            style={{ background: 'rgba(59,130,246,0.12)', color: 'var(--cs-blue-l)', border: '1px solid rgba(59,130,246,0.25)' }}>
            Resume
          </span>
          <h2 className="font-head font-semibold text-3xl sm:text-4xl mt-3" style={{ color: 'var(--cs-text)' }}>
            How To Present This
          </h2>
          <p className="mt-3" style={{ color: 'var(--cs-text2)' }}>
            Written for three different interview contexts.
          </p>
        </div>
        )}

        {/* Resume bullet */}
        <div className="rounded-xl overflow-hidden mb-8" style={{ background: 'var(--cs-code-bg)', border: '1px solid var(--cs-border)' }}>
          <div className="flex items-center justify-between px-4 py-2" style={{ borderBottom: '1px solid var(--cs-border)' }}>
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ background: '#EF4444' }}></div>
                <div className="w-2 h-2 rounded-full" style={{ background: '#F59E0B' }}></div>
                <div className="w-2 h-2 rounded-full" style={{ background: '#22C55E' }}></div>
              </div>
              <span className="font-mono text-xs" style={{ color: 'var(--cs-text3)' }}>resume-bullet.txt</span>
            </div>
            <button
              data-testid="resume-copy-button"
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-colors duration-150"
              style={{ background: 'var(--cs-surface2)', color: copied ? 'var(--cs-green)' : 'var(--cs-text2)', border: '1px solid var(--cs-border)' }}
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <div className="p-5">
            <p data-testid="resume-bullet-text" className="font-mono text-xs sm:text-sm leading-relaxed" style={{ color: 'var(--cs-text2)' }}>
              {RESUME_BULLET}
            </p>
          </div>
        </div>

        {/* Company cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {COMPANY_CARDS.map((card, i) => {
            const cc = CARD_COLORS[card.company] || CARD_COLORS.Anthropic;
            return (
              <div key={i} className="rounded-xl p-5" style={{ background: cc.bg, border: `1px solid ${cc.border}` }}>
                <div className="font-head font-semibold text-lg mb-3" style={{ color: cc.accent }}>{card.company}</div>
                <div className="text-xs leading-relaxed whitespace-pre-line" style={{ color: 'var(--cs-text2)' }}>
                  {card.content}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
