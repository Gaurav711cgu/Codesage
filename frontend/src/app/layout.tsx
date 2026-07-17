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
      <body className="font-sans antialiased bg-background text-foreground">
        <div className="min-h-screen flex flex-col">

          {/* Nav ── slim, no decoration */}
          <header className="sticky top-0 z-50 border-b border-border bg-background/96 backdrop-blur-md">
            <nav className="max-w-5xl mx-auto px-6 h-12 flex items-center justify-between">
              {/* Logo — monospace, no icon badge */}
              <Link
                href="/"
                className="font-mono text-sm font-semibold text-foreground tracking-tight flex items-center gap-2 no-underline"
              >
                codesagez
                <span className="font-mono text-[10px] font-normal text-primary border border-primary/45 px-1.5 py-0.5 rounded-sm tracking-widest uppercase">
                  v2
                </span>
              </Link>

              {/* Nav links */}
              <div className="flex items-center gap-1">
                {NAV.map(({ href, label }) => (
                  <Link
                    key={href}
                    href={href}
                    className="font-sans text-xs font-normal text-muted-foreground hover:text-foreground hover:bg-surface-hi px-3 py-1.5 rounded transition-colors duration-150 no-underline"
                  >
                    {label}
                  </Link>
                ))}
              </div>
            </nav>
          </header>

          <main className="flex-1 max-w-7xl mx-auto w-full px-6">{children}</main>
        </div>
      </body>
    </html>
  );
}
