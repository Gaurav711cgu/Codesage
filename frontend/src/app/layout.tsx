import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CodeSageZ — Graph-Augmented Code Intelligence",
  description:
    "Repository-level code Q&A using call-graph-augmented RAG and a QLoRA fine-tuned Qwen2.5-Coder model.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <div className="min-h-screen flex flex-col">
          <header className="border-b border-border bg-card sticky top-0 z-50">
            <nav className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
              <Link href="/" className="font-semibold text-foreground tracking-tight">
                CodeSageZ
                <span className="ml-2 text-xs font-normal text-muted-foreground">v2</span>
              </Link>
              <div className="flex items-center gap-6 text-sm text-muted-foreground">
                <Link href="/playground" className="hover:text-foreground transition-colors">
                  Playground
                </Link>
                <Link href="/repos" className="hover:text-foreground transition-colors">
                  Repos
                </Link>
                <Link href="/benchmarks" className="hover:text-foreground transition-colors">
                  Benchmarks
                </Link>
                <Link href="/architecture" className="hover:text-foreground transition-colors">
                  Architecture
                </Link>
              </div>
            </nav>
          </header>
          <main className="flex-1">{children}</main>
        </div>
      </body>
    </html>
  );
}
