// frontend/src/app/page.tsx
import Link from "next/link";

const TERMINAL_STATS = [
  { label: "retrieval",  value: "graph-augmented"   },
  { label: "embeddings", value: "local lexical hash" },
  { label: "expansion",  value: "1-hop AST"          },
  { label: "context",    value: "top-8 chunks"       },
];

const PAGES = [
  {
    href: "/repos",
    label: "Repo Explorer",
    desc: "Index a GitHub repo. Ask cross-file questions. Callers and callees are retrieved alongside the direct match.",
  },
  {
    href: "/playground",
    label: "Code Playground",
    desc: "Paste any snippet. Get severity-ranked issues, an explained bug fix, or a generated test suite.",
  },
  {
    href: "/benchmarks",
    label: "Benchmarks",
    desc: "Real call-graph edge recall and retrieval latency from indexed open-source repositories.",
  },
  {
    href: "/architecture",
    label: "Architecture",
    desc: "7-stage ingestion: tree-sitter → NetworkX call graph → ChromaDB. How it works.",
  },
];

export default function Home() {
  return (
    <div className="max-w-[720px] mx-auto px-6 py-[72px] md:py-24">
      {/* Eyebrow — small, factual, not marketing */}
      <p className="label-accent mb-5">
        graph-augmented rag · python codebases
      </p>

      {/* Headline — monospace, no gradient */}
      <h1 className="font-mono text-3xl md:text-4xl font-normal leading-tight tracking-tight text-foreground mb-6">
        Ask questions about
        <br />
        <span className="text-primary">any codebase.</span>
      </h1>

      {/* Body — one clear paragraph, no bullet sells */}
      <p className="font-sans text-[15px] leading-relaxed text-muted-foreground max-w-[560px] mb-10">
        Naive RAG retrieves isolated chunks. CodeSageZ retrieves the function
        you asked about{" "}
        <em className="text-foreground not-italic font-medium">
          and its callers and callees
        </em>
        . One-hop call graph expansion, scored and ranked, fed straight into
        context.
      </p>

      {/* CTAs */}
      <div className="flex gap-3 mb-16">
        <Link
          href="/repos"
          className="font-sans text-xs font-semibold px-5 py-2.5 bg-primary text-primary-foreground rounded-sm transition-opacity hover:opacity-85 no-underline"
        >
          Index a repo
        </Link>
        <Link
          href="/architecture"
          className="font-sans text-xs font-normal px-5 py-2.5 border border-border text-muted-foreground hover:text-foreground hover:border-primary/50 rounded-sm transition-colors no-underline"
        >
          How it works
        </Link>
      </div>

      {/* ── Terminal stat bar — the signature element ── */}
      <div className="terminal-bar mb-16">
        {TERMINAL_STATS.map((s) => (
          <div key={s.label} className="terminal-bar-item flex-1">
            <span className="t-label">{s.label}</span>
            <span className="t-value">{s.value}</span>
          </div>
        ))}
      </div>

      {/* ── Feature list — NOT cards, rows with left border accent on hover ── */}
      <div className="flex flex-col">
        {PAGES.map((p, i) => (
          <Link
            key={p.href}
            href={p.href}
            className="flex gap-5 px-4 py-5 hover:bg-surface border-t border-border/40 hover:border-t-border transition-colors duration-150 -mx-4 rounded-sm no-underline group"
          >
            {/* Index number */}
            <span className="font-mono text-[10px] text-border/60 mt-1 w-4 shrink-0 tracking-wide">
              {String(i + 1).padStart(2, "0")}
            </span>

            <div>
              <div className="font-sans text-sm font-semibold text-foreground mb-1 flex items-center gap-1.5">
                {p.label}
                <span className="text-[10px] text-primary opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                  →
                </span>
              </div>
              <p className="font-sans text-xs text-muted-foreground leading-relaxed m-0">
                {p.desc}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
