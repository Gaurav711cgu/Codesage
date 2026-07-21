"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';

const NAV_LINKS = [
  { to: '/playground', label: 'Playground' },
  { to: '/training', label: 'Training' },
  { to: '/benchmarks', label: 'Benchmarks' },
  { to: '/inference', label: 'Inference' },
  { to: '/failures', label: 'Failures' },
  { to: '/mcp', label: 'MCP' },
  { to: '/stories', label: 'Stories' },
];

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <>
      <nav
        data-testid="sticky-nav"
        className="fixed top-0 left-0 right-0 z-50 transition-colors duration-200"
        role="navigation"
        aria-label="Main navigation"
        style={{
          background: scrolled ? 'rgba(8,11,18,0.92)' : 'transparent',
          backdropFilter: scrolled ? 'blur(16px)' : 'none',
          borderBottom: scrolled ? '1px solid var(--cs-border)' : '1px solid transparent',
        }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group no-underline" aria-label="CodeSage Home">
            <div className="relative w-8 h-8 rounded-md overflow-hidden bg-white shadow-sm flex items-center justify-center p-0.5">
              <Image 
                src="/logo.png" 
                alt="CodeSageZ Logo" 
                fill 
                className="object-cover group-hover:scale-105 transition-transform"
              />
            </div>
            <span className="font-head font-bold text-lg" style={{ color: 'var(--cs-text)' }}>CodeSage</span>
          </Link>

          {/* Center links (desktop) */}
          <div className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((link) => {
              const active = pathname === link.to;
              return (
                <Link
                  key={link.to}
                  href={link.to}
                  data-testid={`nav-link-${link.to.slice(1)}`}
                  className="text-sm px-3 py-1.5 rounded-md transition-all duration-150 no-underline"
                  style={{
                    color: active ? 'var(--cs-blue-l)' : 'var(--cs-text3)',
                    background: active ? 'rgba(59,130,246,0.08)' : 'transparent',
                  }}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>

          {/* Right buttons */}
          <div className="flex items-center gap-3">
            <a
              href="https://github.com/Gaurav711cgu"
              target="_blank"
              rel="noopener noreferrer"
              data-testid="nav-github-link"
              className="hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm transition-colors duration-150 no-underline"
              style={{ border: '1px solid var(--cs-border)', color: 'var(--cs-text2)' }}
            >
              <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
              GitHub
            </a>

            {/* Mobile menu button */}
            <button
              className="md:hidden p-3 rounded-lg transition-colors duration-150 active:scale-95"
              style={{ 
                color: 'var(--cs-text2)', 
                background: mobileOpen ? 'rgba(59,130,246,0.1)' : 'transparent',
                minWidth: '44px',
                minHeight: '44px'
              }}
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
              data-testid="mobile-menu-toggle"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {mobileOpen ? (
                  <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>
                ) : (
                  <><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></>
                )}
              </svg>
            </button>

            <Link
              href="/playground"
              data-testid="nav-open-playground-button"
              className="hidden sm:inline-flex px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-150 hover:translate-y-[-1px] no-underline"
              style={{ background: 'linear-gradient(135deg, #3B82F6, #60A5FA)', color: 'white' }}
            >
              Try Live Demo
            </Link>
          </div>
        </div>
      </nav>

      {/* Mobile menu dropdown */}
      {mobileOpen && (
        <div 
          className="fixed inset-0 z-40 md:hidden animate-fadeIn" 
          onClick={() => setMobileOpen(false)}
          data-testid="mobile-menu-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Mobile navigation menu"
        >
          <div className="absolute inset-0" style={{ background: 'rgba(8,11,18,0.85)', backdropFilter: 'blur(8px)' }}></div>
          <div 
            className="relative top-16 mx-4 rounded-xl p-4 space-y-1 animate-slideDown shadow-2xl"
            style={{ background: 'var(--cs-surface)', border: '1px solid var(--cs-border)' }}
            onClick={e => e.stopPropagation()}
          >
            {NAV_LINKS.map((link) => {
              const active = pathname === link.to;
              return (
                <Link
                  key={link.to}
                  href={link.to}
                  data-testid={`mobile-nav-link-${link.to.slice(1)}`}
                  className="block text-base px-4 py-3 rounded-lg transition-all duration-150 active:scale-98 no-underline"
                  style={{
                    color: active ? 'var(--cs-blue)' : 'var(--cs-text2)',
                    background: active ? 'rgba(59,130,246,0.12)' : 'transparent',
                    minHeight: '44px',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  {link.label}
                </Link>
              );
            })}
            <div className="pt-2 mt-2" style={{ borderTop: '1px solid var(--cs-border)' }}>
              <Link 
                href="/stack" 
                data-testid="mobile-nav-link-stack"
                className="block text-base px-4 py-3 rounded-lg transition-colors duration-150 no-underline" 
                style={{ color: 'var(--cs-text3)', minHeight: '44px', display: 'flex', alignItems: 'center' }}
              >
                Tech Stack
              </Link>
              <Link 
                href="/resume" 
                data-testid="mobile-nav-link-resume"
                className="block text-base px-4 py-3 rounded-lg transition-colors duration-150 no-underline" 
                style={{ color: 'var(--cs-text3)', minHeight: '44px', display: 'flex', alignItems: 'center' }}
              >
                Resume
              </Link>
            </div>
            <Link 
              href="/playground"
              data-testid="mobile-nav-cta"
              className="block w-full text-center px-4 py-3 rounded-lg text-base font-semibold mt-3 text-white transition-transform duration-150 active:scale-98 no-underline"
              style={{ background: 'linear-gradient(135deg, #3B82F6, #60A5FA)', minHeight: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              Try Live Demo
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
