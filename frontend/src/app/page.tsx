// frontend/src/app/page.tsx
import Link from "next/link";

const STATS = [
  { label: "retrieval strategy",  value: "graph-augmented" },
  { label: "embedding model",     value: "text-embedding-004" },
  { label: "graph depth",         value: "1-hop expansion"  },
  { label: "context window",      value: "top-8 chunks"     },
];

const FEATURES = [
  {
    href: "/repos",
    tag: "01",
    title: "Repo Explorer",
    desc: "Index any public GitHub repo. Ask cross-file questions. The system retrieves callers and callees alongside the direct match.",
  },
  {
    href: "/playground",
    tag: "02",
    title: "Code Playground",
    desc: "Paste any snippet. Get a structured review with severity-ranked issues, a bug fix, or a generated test suite.",
  },
  {
    href: "/benchmarks",
    tag: "03",
    title: "Benchmarks",
    desc: "Internal stratified eval across single-function, cross-file, and call-chain questions. Graph vs. naive delta measured.",
  },
  {
    href: "/architecture",
    tag: "04",
    title: "Architecture",
    desc: "7-stage ingestion pipeline. tree-sitter parse → NetworkX call graph → ChromaDB. Read how it works.",
  },
];

export default function Home() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-16">

      {/* Hero */}
      <div className="mb-16">
        {/* Eyebrow */}
        <div className="flex items-center gap-2 mb-6">
          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          <span className="font-mono text-xs text-primary uppercase tracking-widest">
            graph-augmented rag
          </span>
        </div>

        {/* Headline */}
        <h1 className="text-3xl font-semibold text-foreground leading-tight mb-4">
          Code intelligence that understands<br />
          <span className="text-primary">how functions call each other.</span>
        </h1>

        <p className="text-base text-muted-foreground leading-relaxed max-w-xl mb-8">
          Naive RAG retrieves the function you asked about. CodeSageZ also retrieves
          its callers and callees — because the answer to most cross-file questions
          lives in the surrounding call graph, not just the matched chunk.
        </p>

        {/* CTA */}
        <div className="flex items-center gap-3">
          <Link
            href="/repos"
            className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium 
                       rounded hover:bg-primary-hover transition-colors duration-150"
          >
            Index a repo
          </Link>
          <Link
            href="/playground"
            className="px-4 py-2 border border-border text-sm text-muted-foreground 
                       hover:text-foreground hover:border-primary/50 rounded 
                       transition-all duration-150"
          >
            Try playground
          </Link>
        </div>
      </div>

      {/* Inline stats — monospace data strip */}
      <div className="border border-border rounded-sm mb-16 overflow-hidden">
        <div className="grid grid-cols-2 md:grid-cols-4">
          {STATS.map((s, i) => (
            <div
              key={s.label}
              className={`px-5 py-4 ${
                i < STATS.length - 1 ? "border-r border-border" : ""
              }`}
            >
              <div className="font-mono text-xs text-muted-foreground mb-1">{s.label}</div>
              <div className="font-mono text-sm text-primary">{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Feature list — numbered, not cards */}
      <div className="space-y-0">
        {FEATURES.map((f, i) => (
          <Link
            key={f.href}
            href={f.href}
            className={`flex gap-6 items-start py-6 group
                        ${i > 0 ? "border-t border-border" : ""}
                        hover:bg-card/50 -mx-4 px-4 transition-colors duration-150`}
          >
            <span className="font-mono text-xs text-muted-foreground pt-0.5 w-5 flex-shrink-0">
              {f.tag}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors duration-150">
                  {f.title}
                </span>
                <span className="text-muted-foreground opacity-0 group-hover:opacity-100 
                                 transition-opacity duration-150 text-xs">→</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
