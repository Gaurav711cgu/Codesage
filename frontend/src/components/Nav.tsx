"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_LINKS = [
  { to: '/architecture', label: 'Architecture' },
  { to: '/benchmarks',   label: 'Benchmarks' },
  { to: '/playground',   label: 'Playground' },
  { to: '/training',     label: 'Training' },
  { to: '/inference',    label: 'Inference' },
  { to: '/failures',     label: 'Failures' },
  { to: '/mcp',          label: 'MCP' },
  { to: '/stories',      label: 'Stories' },
];

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <>
      <nav
        data-testid="sticky-nav"
        className={`fixed top-0 left-0 right-0 z-50 transition-colors duration-150 border-b ${
          scrolled
            ? 'bg-background/95 backdrop-blur-md border-border shadow-sm'
            : 'bg-background/80 border-border/40 backdrop-blur-sm'
        }`}
        role="navigation"
        aria-label="Main navigation"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-14">
          {/* Logo & Technical Monogram */}
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 font-mono font-bold text-sm tracking-tight text-foreground hover:text-primary transition-colors no-underline">
              {/* Minimalist AST Compiler SVG Monogram */}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" className="text-primary">
                <rect x="3" y="3" width="6" height="6" />
                <rect x="15" y="3" width="6" height="6" />
                <rect x="9" y="15" width="6" height="6" />
                <path d="M6 9v3h6v3" />
                <path d="M18 9v3h-6" />
              </svg>
              <span>codesagez</span>
            </Link>
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 border border-border bg-surface text-[10px] font-mono text-muted-foreground uppercase tracking-wider rounded-[2px]">
              <span className="w-1.5 h-1.5 bg-primary rounded-[1px]"></span>
              SOURCE WORKBENCH
            </span>
          </div>

          {/* Desktop Navigation Links */}
          <div className="hidden lg:flex items-center gap-1">
            {NAV_LINKS.map((link) => {
              const active = pathname === link.to;
              return (
                <Link
                  key={link.to}
                  href={link.to}
                  data-testid={`nav-link-${link.to.slice(1)}`}
                  className={`text-xs font-mono uppercase tracking-wider px-3 py-1.5 transition-colors no-underline rounded-[2px] ${
                    active
                      ? 'text-primary bg-primary/10 border border-primary/30'
                      : 'text-muted-foreground hover:text-foreground hover:bg-surface border border-transparent'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>

          {/* Right Action buttons */}
          <div className="flex items-center gap-2.5">
            <a
              href="https://github.com/Gaurav711cgu"
              target="_blank"
              rel="noopener noreferrer"
              data-testid="nav-github-link"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 border border-border bg-surface hover:bg-surface-hi text-xs font-mono text-muted-foreground hover:text-foreground transition-colors no-underline rounded-[2px]"
            >
              <svg width="13" height="13" fill="currentColor" viewBox="0 0 16 16">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
              </svg>
              <span>GitHub</span>
            </a>

            <Link
              href="/playground"
              data-testid="nav-open-playground-button"
              className="px-3.5 py-1.5 border border-primary/40 bg-surface hover:bg-primary/10 text-primary font-mono text-xs uppercase tracking-wider transition-colors no-underline rounded-[2px] flex items-center gap-1.5"
            >
              <span className="text-[10px]">&gt;_</span>
              <span>Console</span>
            </Link>

            {/* Mobile menu toggle */}
            <button
              className="lg:hidden p-1.5 border border-border bg-surface text-muted-foreground hover:text-foreground rounded-[2px]"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
              data-testid="mobile-menu-toggle"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square">
                {mobileOpen ? (
                  <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>
                ) : (
                  <><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></>
                )}
              </svg>
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu Dropdown */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden bg-background/90 backdrop-blur-md pt-16 px-4"
          onClick={() => setMobileOpen(false)}
          data-testid="mobile-menu-overlay"
        >
          <div
            className="border border-border bg-surface p-4 flex flex-col gap-2 rounded-[2px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-[11px] font-mono text-muted-foreground uppercase tracking-widest pb-2 border-b border-border">
              Subsystem Index
            </div>
            {NAV_LINKS.map((link) => {
              const active = pathname === link.to;
              return (
                <Link
                  key={link.to}
                  href={link.to}
                  data-testid={`mobile-nav-link-${link.to.slice(1)}`}
                  className={`px-3 py-2 text-xs font-mono uppercase tracking-wider border rounded-[2px] ${
                    active
                      ? 'border-primary text-primary bg-primary/10'
                      : 'border-border text-muted-foreground hover:text-foreground hover:bg-surface-hi'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
