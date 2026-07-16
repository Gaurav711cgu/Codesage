// frontend/src/app/layout.tsx
import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import "./globals.css";
import Link from "next/link";

export const metadata: Metadata = {
  title: "CodeSageZ — Graph-Augmented Code Intelligence",
  description: "Repository-level code Q&A using call-graph-augmented RAG.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${GeistSans.variable} ${GeistMono.variable} font-sans`}>
        <div className="min-h-screen flex flex-col bg-background text-foreground">
          
          {/* Nav — slim, technical, no flair */}
          <header className="border-b border-border sticky top-0 z-50 bg-background/95 backdrop-blur-sm">
            <nav className="max-w-7xl mx-auto px-6 h-12 flex items-center justify-between">
              
              {/* Logo — monospace, version as git-style tag */}
              <Link href="/" className="flex items-center gap-2 group">
                <span className="font-mono text-sm font-semibold text-foreground 
                                 group-hover:text-primary transition-colors duration-150">
                  codesagez
                </span>
                <span className="font-mono text-[10px] text-muted-foreground 
                                 border border-border px-1 py-0.5 rounded-sm">
                  v2
                </span>
              </Link>

              {/* Nav links — muted by default, active = sage */}
              <div className="flex items-center gap-1">
                {[
                  { href: "/repos",        label: "Repos"        },
                  { href: "/playground",   label: "Playground"   },
                  { href: "/benchmarks",   label: "Benchmarks"   },
                  { href: "/architecture", label: "Architecture"  },
                ].map(({ href, label }) => (
                  <Link
                    key={href}
                    href={href}
                    className="px-3 py-1.5 text-sm text-muted-foreground 
                               hover:text-foreground hover:bg-card 
                               rounded transition-all duration-150"
                  >
                    {label}
                  </Link>
                ))}
              </div>
            </nav>
          </header>

          <main className="flex-1">{children}</main>
        </div>
      </body>
    </html>
  );
}
