import React from 'react';
import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center py-20 px-4">
      <div className="text-center max-w-2xl">
        {/* 404 Icon */}
        <div className="mb-8">
          <svg width="120" height="120" viewBox="0 0 120 120" className="mx-auto" fill="none">
            <circle cx="60" cy="60" r="55" stroke="var(--cs-border)" strokeWidth="2" fill="var(--cs-surface)" />
            <text x="60" y="75" textAnchor="middle" fill="var(--cs-text2)" fontSize="40" fontFamily="JetBrains Mono" fontWeight="700">404</text>
          </svg>
        </div>

        {/* Heading */}
        <h1 className="font-head text-4xl md:text-5xl font-bold mb-4" style={{ color: 'var(--cs-text)' }}>
          Page Not Found
        </h1>
        
        {/* Description */}
        <p className="text-base md:text-lg mb-8" style={{ color: 'var(--cs-text2)' }}>
          The page you're looking for doesn't exist or has been moved.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/"
            data-testid="404-home-link"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all duration-150 hover:translate-y-[-1px]"
            style={{ background: 'var(--cs-blue)', color: 'white' }}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            Back to Home
          </Link>

          <Link
            to="/playground"
            data-testid="404-playground-link"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold border transition-all duration-150 hover:bg-opacity-80"
            style={{ border: '1px solid var(--cs-border)', color: 'var(--cs-text2)', background: 'var(--cs-surface2)' }}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
            Try Playground
          </Link>
        </div>

        {/* Helpful Links */}
        <div className="mt-12 pt-8" style={{ borderTop: '1px solid var(--cs-border)' }}>
          <p className="text-sm mb-4" style={{ color: 'var(--cs-text3)' }}>
            Quick Links:
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link to="/training" className="text-sm hover:underline" style={{ color: 'var(--cs-blue)' }}>Training Pipeline</Link>
            <Link to="/benchmarks" className="text-sm hover:underline" style={{ color: 'var(--cs-blue)' }}>Benchmarks</Link>
            <Link to="/inference" className="text-sm hover:underline" style={{ color: 'var(--cs-blue)' }}>Inference Architecture</Link>
            <Link to="/mcp" className="text-sm hover:underline" style={{ color: 'var(--cs-blue)' }}>MCP Integration</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
