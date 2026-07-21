// frontend/src/app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";

export const metadata: Metadata = {
  title: "CodeSageZ",
  description: "Graph-augmented code intelligence. Ask questions about any Python codebase.",
};

const NAV = [
  { href: "/repos",        label: "Repos"       },
  { href: "/playground",   label: "Playground"  },
  { href: "/benchmarks",   label: "Benchmarks"  },
  { href: "/architecture", label: "Architecture" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans antialiased bg-background text-foreground relative overflow-x-hidden">
        {/* Animated background grid */}
        <div className="absolute inset-0 z-0 bg-grid-pattern pointer-events-none opacity-50" />
        
        <div className="min-h-screen flex flex-col relative z-10">

          {/* Nav ── glassmorphism upgrade */}
          <header className="sticky top-0 z-50 border-b border-white/10 bg-background/60 backdrop-blur-xl">
            <nav className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
              {/* Logo */}
              <Link
                href="/"
                className="font-mono text-sm font-bold text-foreground tracking-tight flex items-center gap-2 no-underline hover:text-primary transition-colors group"
              >
                codesage<span className="text-primary group-hover:text-glow">z</span>
                <span className="font-mono text-[10px] font-normal text-primary border border-primary/40 bg-primary/10 px-1.5 py-0.5 rounded-sm tracking-widest uppercase shadow-[0_0_8px_rgba(35,196,232,0.3)]">
                  v2
                </span>
              </Link>

              {/* Nav links */}
              <div className="flex items-center gap-1">
                {NAV.map(({ href, label }) => (
                  <Link
                    key={href}
                    href={href}
                    className="font-sans text-xs font-medium text-muted-foreground hover:text-primary hover:bg-white/5 px-3 py-1.5 rounded-md transition-all duration-200 no-underline"
                  >
                    {label}
                  </Link>
                ))}
              </div>
            </nav>
          </header>

          <main className="flex-1 max-w-7xl mx-auto w-full px-6 flex flex-col">{children}</main>
        </div>
      </body>
    </html>
  );
}
