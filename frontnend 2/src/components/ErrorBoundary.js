import React from 'react';
import { Link } from 'react-router-dom';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center py-20 px-4" style={{ background: 'var(--cs-bg)' }}>
          <div className="text-center max-w-2xl">
            {/* Error Icon */}
            <div className="mb-8">
              <svg width="120" height="120" viewBox="0 0 120 120" className="mx-auto" fill="none">
                <circle cx="60" cy="60" r="55" stroke="var(--cs-red)" strokeWidth="2" fill="var(--cs-surface)" opacity="0.5" />
                <path d="M60 35 L60 65" stroke="var(--cs-red)" strokeWidth="4" strokeLinecap="round" />
                <circle cx="60" cy="80" r="3" fill="var(--cs-red)" />
              </svg>
            </div>

            {/* Heading */}
            <h1 className="font-head text-4xl md:text-5xl font-bold mb-4" style={{ color: 'var(--cs-text)' }}>
              Something went wrong
            </h1>
            
            {/* Description */}
            <p className="text-base md:text-lg mb-8" style={{ color: 'var(--cs-text2)' }}>
              We encountered an unexpected error. Please try refreshing the page or return home.
            </p>

            {/* Error Details (Dev Mode) */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="mb-8 p-4 rounded-lg text-left overflow-auto" style={{ background: 'var(--cs-code-bg)', border: '1px solid var(--cs-border)' }}>
                <p className="font-mono text-xs mb-2" style={{ color: 'var(--cs-red)' }}>
                  {this.state.error.toString()}
                </p>
                {this.state.errorInfo && (
                  <pre className="font-mono text-xs" style={{ color: 'var(--cs-text3)' }}>
                    {this.state.errorInfo.componentStack}
                  </pre>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={this.handleReload}
                data-testid="error-reload-button"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all duration-150 hover:translate-y-[-1px]"
                style={{ background: 'var(--cs-blue)', color: 'white' }}
              >
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
                </svg>
                Reload Page
              </button>

              <Link
                to="/"
                data-testid="error-home-link"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold border transition-all duration-150 hover:bg-opacity-80"
                style={{ border: '1px solid var(--cs-border)', color: 'var(--cs-text2)', background: 'var(--cs-surface2)' }}
              >
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
                Go Home
              </Link>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
