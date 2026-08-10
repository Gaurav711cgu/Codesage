import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Page header used on every sub-page.
 * Shows a back link, badge, title, and subtitle.
 */
export default function PageHeader({ badge, badgeColor = 'blue', title, subtitle, backLabel = 'Back to Home', backTo = '/' }) {
  const colors = {
    blue: { bg: 'rgba(59,130,246,0.12)', text: 'var(--cs-blue-l)', border: 'rgba(59,130,246,0.25)' },
    green: { bg: 'rgba(34,197,94,0.12)', text: 'var(--cs-green)', border: 'rgba(34,197,94,0.25)' },
    amber: { bg: 'rgba(245,158,11,0.12)', text: 'var(--cs-amber)', border: 'rgba(245,158,11,0.25)' },
    red: { bg: 'rgba(239,68,68,0.12)', text: 'var(--cs-red)', border: 'rgba(239,68,68,0.25)' },
    purple: { bg: 'rgba(168,85,247,0.12)', text: 'var(--cs-purple-l)', border: 'rgba(168,85,247,0.25)' },
    orange: { bg: 'rgba(249,115,22,0.12)', text: 'var(--cs-orange)', border: 'rgba(249,115,22,0.25)' },
  };
  const c = colors[badgeColor] || colors.blue;

  return (
    <div className="pt-24 pb-10 sm:pt-28 sm:pb-14 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <Link to={backTo} className="inline-flex items-center gap-1.5 text-xs mb-6 transition-colors"
          style={{ color: 'var(--cs-text3)' }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--cs-text2)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--cs-text3)'}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/></svg>
          {backLabel}
        </Link>
        <span className="text-xs font-medium px-3 py-1 rounded-full mb-4 inline-block"
          style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
          {badge}
        </span>
        <h1 className="font-head font-bold mt-3" style={{ fontSize: 'clamp(28px, 4vw, 44px)', color: 'var(--cs-text)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
          {title}
        </h1>
        {subtitle && (
          <p className="mt-4" style={{ color: 'var(--cs-text2)', maxWidth: 560, fontSize: '15px', lineHeight: '1.75' }}>
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}
