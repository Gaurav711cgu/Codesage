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
      <body className={`${GeistSans.variable} ${GeistMono.variable} font-sans relative`}>
        {/* Ambient Background Glows */}
        <div className="ambient-glow bg-primary w-[500px] h-[500px] top-[-250px] left-[-250px]" />
        <div className="ambient-glow bg-secondary w-[400px] h-[400px] top-[20%] right-[-150px]" />

        <div className="min-h-screen flex flex-col relative z-10">
          
          {/* Nav — Premium Glassmorphism */}
          <header className="sticky top-0 z-50 py-4 px-6">
            <nav className="max-w-5xl mx-auto h-14 flex items-center justify-between glass rounded-2xl px-6">
              
              {/* Logo */}
              <Link href="/" className="flex items-center gap-2 group">
                <div className="w-6 h-6 rounded bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-[0_0_15px_rgba(168,85,247,0.5)]">
                  <span className="font-mono text-xs font-bold text-black">Z</span>
                </div>
                <span className="font-sans font-semibold tracking-tight text-foreground 
                                 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-primary group-hover:to-secondary transition-all duration-300">
                  CodeSage
                </span>
              </Link>

              {/* Nav links */}
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
                    className="px-4 py-2 text-sm font-medium text-muted-foreground 
                               hover:text-foreground hover:bg-white/5 
                               rounded-lg transition-all duration-300"
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
