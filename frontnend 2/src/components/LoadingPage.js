import React from 'react';

export const LoadingPage = () => {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--cs-bg)' }}>
      <div className="text-center">
        {/* Loading Spinner */}
        <div className="mb-6">
          <svg width="64" height="64" viewBox="0 0 64 64" className="mx-auto animate-spin" style={{ animationDuration: '1s' }}>
            <circle
              cx="32"
              cy="32"
              r="28"
              fill="none"
              stroke="var(--cs-blue)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray="140 40"
              opacity="0.7"
            />
          </svg>
        </div>

        {/* Loading Text */}
        <p className="font-mono text-sm" style={{ color: 'var(--cs-text2)' }}>
          Loading<span className="animate-pulse">...</span>
        </p>
      </div>
    </div>
  );
};
