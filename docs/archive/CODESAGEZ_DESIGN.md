# CodeSageZ — UI Design System
### Anti-vibecode frontend rebuild | DEBUG THUGS

---

## 0. What's wrong with the current UI (honest audit)

Before touching anything: here's exactly what reads as vibecoded and why.

| Element | Current | Problem |
|---------|---------|---------|
| Font | Inter (default) | Inter is the single most overused font in AI-generated UIs. Zero signal. |
| Primary color | `hsl(210 40% 98%)` — near-white | No accent. Everything is white-on-dark, nothing has personality. |
| Border radius | `0.5rem` everywhere | Uniform rounding = no hierarchy. Cards feel like Bootstrap defaults. |
| Homepage headline | Generic gradient text | "Next-Gen RAG Architecture" as an eyebrow tag above the h1 = vibecode tell #1 |
| Benchmarks page | Dashes everywhere (`—`) | Placeholder data rendered as if it's designed. Looks abandoned, not intentional. |
| Repos page | "Repository Dashboard" h1 | H1 on a functional app page = document thinking, not app thinking |
| Nav logo | "Z CodeSage" with letter prefix | Letter icon badge = shadcn starter template default |
| Card hover | Generic `bg-accent` | No directionality, no affordance |
| Stat strip | Grid of 4 equal boxes | No typographic weight difference between label and value |

**What the background actually is:** `hsl(224 71% 4%)` = deep cool navy-black. Excellent. Keep it. It's not pure black, has a faint blue warmth that makes it feel designed, not defaulted.

---

## 1. Design Plan

### Subject
CodeSageZ is a **developer tool** for engineers who want to ask questions about codebases. Audience: engineers. Emotional state: focused, skeptical of marketing. Device: desktop primary, laptop. Single job of every page: get them to the answer fast without visual noise.

### Direction
**Precision tooling.** Not a landing page. Not a SaaS marketing site. A tool that a senior engineer would actually trust. The aesthetic is: debugger meets document viewer. Sparse, high-contrast, data-forward. Monospace text where it's data; proportional where it's prose. No gradient heroes. No glowing cards.

### Palette (6 values, keeping the background)

```
--bg:          hsl(224 71% 4%)    #060b14  ← KEEP (the good part)
--surface:     hsl(224 60% 7%)    #0c1220  ← cards, panels (barely lighter)
--surface-hi:  hsl(224 50% 10%)   #111b2e  ← elevated, hover states
--border:      hsl(224 40% 15%)   #1a2540  ← dividers, input borders
--text:        hsl(213 25% 88%)   #d6dde8  ← primary text (slightly warm, not pure white)
--muted:       hsl(213 15% 52%)   #778395  ← secondary text, labels
--accent:      hsl(196 85% 58%)   #23c4e8  ← primary accent: cyan-blue (NOT acid green, NOT purple)
--accent-dim:  hsl(196 60% 35%)   #236b80  ← accent bg tint, badges
```

**Why cyan-blue:** It's the color of a terminal cursor, of a debugger highlight, of an active line in VS Code. It's contextually correct for a code intelligence tool. It's not the default (acid green = matrix; vermilion = startup; purple = AI startup). It contrasts cleanly against the navy background without being aggressive.

### Typography

```
Display:  "IBM Plex Mono"   — monospace, mechanical, technical authority
          Used for: headlines, stat values, file paths, badges
          Weight: 400 (headlines), 600 (values)
          
Body:     "IBM Plex Sans"   — the proportional companion
          Used for: body copy, descriptions, nav links
          Weight: 400 body, 500 labels

Both from Google Fonts — single import, same family, unified voice.
NOT Inter. NOT Geist. IBM Plex is designed by IBM for developer tooling.
```

### Type Scale
```
10px  → micro labels, badges
12px  → captions, metadata
14px  → body default, nav, form inputs
16px  → subheadings, card titles
20px  → section headings
28px  → page-level headings (sparingly)
40px  → hero headline (homepage only)
```

### Layout

Narrow single-column with intentional right-side panels for functional pages.
- Homepage: centered, max-w-2xl, generous vertical rhythm
- Repos: left sidebar (220px) + main content panel + right context drawer
- Playground: 50/50 split: editor left, output right
- Benchmarks: centered table with data emphasis
- Architecture: centered prose with inline diagrams

### Signature element
The **monospace stat strip on the homepage** — instead of 4 equal boxes, it becomes a single horizontal `<code>`-style line with piped separators: `graph-augmented | text-embedding-004 | 1-hop | top-8`. Looks like a terminal status bar. No box borders. No labels above values. One line. Unmistakable.

### Motion
- Nav link hover: `color` transition 120ms ease-out only
- Card hover: `background` transition 150ms ease-out + translate-y -1px
- Buttons: background + scale(0.98) on active, 100ms
- SSE cursor blink: keep existing
- Zero scroll reveals, zero parallax, zero entrance animations

---

## 2. Exact File Changes

### 2.1 `frontend/src/app/globals.css` — Full replacement

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* IBM Plex — developer tooling's own type family */
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap');

@layer base {
  :root {
    /* ── Palette ─────────────────────────────── */
    --background:          224 71% 4%;    /* #060b14 — keep, it's good */
    --surface:             224 60% 7%;    /* #0c1220 */
    --surface-hi:          224 50% 10%;   /* #111b2e */

    --foreground:          213 25% 88%;   /* #d6dde8 */
    --muted-foreground:    213 15% 52%;   /* #778395 */

    --border:              224 40% 15%;   /* #1a2540 */
    --input:               224 40% 15%;
    --ring:                196 85% 58%;

    --card:                var(--surface);
    --card-foreground:     var(--foreground);

    --primary:             196 85% 58%;   /* #23c4e8 — cyan accent */
    --primary-foreground:  224 71% 4%;
    --primary-dim:         196 60% 20%;   /* accent bg tint */

    --secondary:           224 50% 10%;
    --secondary-foreground: 213 25% 88%;

    --accent:              224 50% 10%;
    --accent-foreground:   213 25% 88%;

    --muted:               224 40% 11%;
    --destructive:         0 72% 51%;     /* #e84040 */
    --destructive-foreground: 213 25% 88%;
    --warning:             38 90% 52%;    /* #f5a623 */
    --success:             142 65% 48%;   /* #2ec47c */

    --radius:              3px;           /* sharper than default — tool, not landing page */
  }
}

@layer base {
  * {
    @apply border-border;
    box-sizing: border-box;
  }

  html {
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: optimizeLegibility;
  }

  body {
    @apply bg-background text-foreground;
    font-family: 'IBM Plex Sans', system-ui, sans-serif;
    font-size: 14px;
    line-height: 1.6;
    font-feature-settings: "ss01" 1, "calt" 1;
  }

  /* Monospace everywhere data lives */
  code, pre, kbd, samp,
  .font-mono {
    font-family: 'IBM Plex Mono', 'Fira Code', monospace;
    font-size: 13px;
  }

  h1, h2, h3 {
    font-family: 'IBM Plex Mono', monospace;
    line-height: 1.25;
    letter-spacing: -0.02em;
    color: hsl(var(--foreground));
  }

  /* Remove outline flash — replace with intentional focus ring */
  *:focus-visible {
    outline: 2px solid hsl(var(--primary));
    outline-offset: 2px;
  }
  *:focus:not(:focus-visible) {
    outline: none;
  }
}

/* ── Utility classes ────────────────────────────────────────── */

/* Terminal-style label — used for section eyebrows, badges */
.label-mono {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: hsl(var(--muted-foreground));
}

/* Accent label variant */
.label-accent {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: hsl(var(--primary));
}

/* Inline code chip */
.chip {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 2px;
  border: 1px solid hsl(var(--border));
  background: hsl(var(--surface));
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
}

/* Seed/neighbor retrieval badges */
.badge-seed {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 10px;
  font-weight: 500;
  padding: 2px 6px;
  border-radius: 2px;
  border: 1px solid hsl(196 85% 58% / 0.3);
  background: hsl(196 85% 58% / 0.08);
  color: hsl(196 85% 68%);
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.badge-neighbor {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 10px;
  font-weight: 500;
  padding: 2px 6px;
  border-radius: 2px;
  border: 1px solid hsl(38 90% 52% / 0.3);
  background: hsl(38 90% 52% / 0.08);
  color: hsl(38 90% 62%);
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

/* Status dot */
.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}
.status-dot.active  { background: hsl(var(--success)); box-shadow: 0 0 6px hsl(142 65% 48% / 0.4); }
.status-dot.error   { background: hsl(var(--destructive)); }
.status-dot.pending { background: hsl(var(--warning)); }
.status-dot.idle    { background: hsl(var(--border)); }

/* Thin horizontal rule */
.rule {
  border: none;
  border-top: 1px solid hsl(var(--border));
}

/* Score bar — used in benchmarks and retrieval panels */
.score-track {
  height: 2px;
  background: hsl(var(--border));
  border-radius: 1px;
  overflow: hidden;
}
.score-fill {
  height: 100%;
  background: hsl(var(--primary));
  border-radius: 1px;
  transition: width 400ms ease-out;
}
.score-fill.warn { background: hsl(var(--warning)); }
.score-fill.good { background: hsl(var(--success)); }

/* Terminal status bar — the signature homepage element */
.terminal-bar {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
  display: flex;
  align-items: center;
  gap: 0;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
  overflow: hidden;
  background: hsl(var(--surface));
}
.terminal-bar-item {
  padding: 6px 16px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  border-right: 1px solid hsl(var(--border));
}
.terminal-bar-item:last-child {
  border-right: none;
}
.terminal-bar-item .t-label {
  font-size: 10px;
  color: hsl(var(--muted-foreground));
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.terminal-bar-item .t-value {
  color: hsl(var(--primary));
  font-size: 12px;
  font-weight: 500;
}

/* Streaming cursor */
.streaming-cursor::after {
  content: "▋";
  animation: blink 1s step-start infinite;
  color: hsl(var(--primary));
}
@keyframes blink {
  50% { opacity: 0; }
}

/* Pipeline stage indicator (ingestion progress) */
.stage-list {
  display: flex;
  flex-direction: column;
  gap: 0;
}
.stage-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
  border-bottom: 1px solid hsl(var(--border) / 0.5);
}
.stage-item:last-child { border-bottom: none; }
.stage-item.done    { color: hsl(var(--foreground)); }
.stage-item.active  { color: hsl(var(--primary)); }
.stage-item.pending { color: hsl(var(--border)); }

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .streaming-cursor::after { animation: none; }
  .score-fill { transition: none; }
  * { transition-duration: 0.01ms !important; }
}
```

---

### 2.2 `frontend/src/app/layout.tsx` — Nav rebuild

What's wrong now: letter badge logo, nav links have no active state, no visual weight.

```tsx
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
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>

          {/* Nav ── slim, no decoration */}
          <header
            style={{
              position: "sticky",
              top: 0,
              zIndex: 50,
              borderBottom: "1px solid hsl(var(--border))",
              background: "hsl(var(--background) / 0.96)",
              backdropFilter: "blur(8px)",
            }}
          >
            <nav
              style={{
                maxWidth: 1100,
                margin: "0 auto",
                padding: "0 24px",
                height: 48,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              {/* Logo — monospace, no icon badge */}
              <Link
                href="/"
                style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: 14,
                  fontWeight: 600,
                  color: "hsl(var(--foreground))",
                  textDecoration: "none",
                  letterSpacing: "-0.02em",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                codesagez
                <span
                  style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: 10,
                    fontWeight: 400,
                    color: "hsl(var(--primary))",
                    border: "1px solid hsl(var(--primary) / 0.4)",
                    padding: "1px 5px",
                    borderRadius: 2,
                    letterSpacing: "0.05em",
                  }}
                >
                  v2
                </span>
              </Link>

              {/* Nav links */}
              <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                {NAV.map(({ href, label }) => (
                  <Link
                    key={href}
                    href={href}
                    style={{
                      fontFamily: "'IBM Plex Sans', sans-serif",
                      fontSize: 13,
                      fontWeight: 400,
                      color: "hsl(var(--muted-foreground))",
                      textDecoration: "none",
                      padding: "6px 12px",
                      borderRadius: "var(--radius)",
                      transition: "color 120ms ease-out, background 120ms ease-out",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = "hsl(var(--foreground))";
                      e.currentTarget.style.background = "hsl(var(--surface-hi))";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = "hsl(var(--muted-foreground))";
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    {label}
                  </Link>
                ))}
              </div>
            </nav>
          </header>

          <main style={{ flex: 1 }}>{children}</main>
        </div>
      </body>
    </html>
  );
}
```

> **Note:** If you want active nav highlighting, install `next/navigation` and use `usePathname()` in a `'use client'` wrapper component for the nav links. The inline style approach above works for the static shell.

---

### 2.3 `frontend/src/app/page.tsx` — Homepage rebuild

What's wrong now: "Next-Gen RAG Architecture" as a marketing eyebrow tag, generic gradient headline, 4 equal-weight cards.

```tsx
// frontend/src/app/page.tsx
import Link from "next/link";

const TERMINAL_STATS = [
  { label: "retrieval",  value: "graph-augmented"   },
  { label: "embeddings", value: "text-embedding-004" },
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
    desc: "Stratified eval: single-function, cross-file, call-chain. Graph RAG vs naive delta.",
  },
  {
    href: "/architecture",
    label: "Architecture",
    desc: "7-stage ingestion: tree-sitter → NetworkX call graph → ChromaDB. How it works.",
  },
];

export default function Home() {
  return (
    <div
      style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: "72px 24px 96px",
      }}
    >
      {/* Eyebrow — small, factual, not marketing */}
      <p
        className="label-accent"
        style={{ marginBottom: 20 }}
      >
        graph-augmented rag · python codebases
      </p>

      {/* Headline — monospace, no gradient */}
      <h1
        style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: "clamp(28px, 4vw, 42px)",
          fontWeight: 400,
          lineHeight: 1.2,
          letterSpacing: "-0.025em",
          color: "hsl(var(--foreground))",
          marginBottom: 24,
        }}
      >
        Ask questions about
        <br />
        <span style={{ color: "hsl(var(--primary))" }}>any codebase.</span>
      </h1>

      {/* Body — one clear paragraph, no bullet sells */}
      <p
        style={{
          fontFamily: "'IBM Plex Sans', sans-serif",
          fontSize: 15,
          lineHeight: 1.7,
          color: "hsl(var(--muted-foreground))",
          maxWidth: 560,
          marginBottom: 40,
        }}
      >
        Naive RAG retrieves isolated chunks. CodeSageZ retrieves the function
        you asked about{" "}
        <em style={{ color: "hsl(var(--foreground))", fontStyle: "normal" }}>
          and its callers and callees
        </em>
        . One-hop call graph expansion, scored and ranked, fed straight into
        context.
      </p>

      {/* CTAs */}
      <div style={{ display: "flex", gap: 12, marginBottom: 64 }}>
        <Link
          href="/repos"
          style={{
            fontFamily: "'IBM Plex Sans', sans-serif",
            fontSize: 13,
            fontWeight: 500,
            padding: "8px 20px",
            background: "hsl(var(--primary))",
            color: "hsl(var(--primary-foreground))",
            borderRadius: "var(--radius)",
            textDecoration: "none",
            transition: "opacity 120ms ease-out",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
        >
          Index a repo
        </Link>
        <Link
          href="/architecture"
          style={{
            fontFamily: "'IBM Plex Sans', sans-serif",
            fontSize: 13,
            fontWeight: 400,
            padding: "8px 20px",
            border: "1px solid hsl(var(--border))",
            color: "hsl(var(--muted-foreground))",
            borderRadius: "var(--radius)",
            textDecoration: "none",
            transition: "color 120ms, border-color 120ms",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "hsl(var(--foreground))";
            e.currentTarget.style.borderColor = "hsl(var(--primary) / 0.5)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "hsl(var(--muted-foreground))";
            e.currentTarget.style.borderColor = "hsl(var(--border))";
          }}
        >
          How it works
        </Link>
      </div>

      {/* ── Terminal stat bar — the signature element ── */}
      <div className="terminal-bar" style={{ marginBottom: 64 }}>
        {TERMINAL_STATS.map((s) => (
          <div key={s.label} className="terminal-bar-item">
            <span className="t-label">{s.label}</span>
            <span className="t-value">{s.value}</span>
          </div>
        ))}
      </div>

      {/* ── Feature list — NOT cards, rows with left border accent on hover ── */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        {PAGES.map((p, i) => (
          <Link
            key={p.href}
            href={p.href}
            style={{
              display: "flex",
              gap: 20,
              padding: "20px 0",
              borderTop: i > 0 ? "1px solid hsl(var(--border))" : "none",
              textDecoration: "none",
              transition: "background 150ms ease-out",
              margin: "0 -16px",
              padding: "20px 16px",
              borderRadius: "var(--radius)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "hsl(var(--surface))";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            {/* Index number */}
            <span
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 10,
                color: "hsl(var(--border))",
                marginTop: 3,
                width: 16,
                flexShrink: 0,
                letterSpacing: "0.05em",
              }}
            >
              {String(i + 1).padStart(2, "0")}
            </span>

            <div>
              <div
                style={{
                  fontFamily: "'IBM Plex Sans', sans-serif",
                  fontSize: 14,
                  fontWeight: 500,
                  color: "hsl(var(--foreground))",
                  marginBottom: 4,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {p.label}
                <span
                  style={{
                    fontSize: 10,
                    color: "hsl(var(--primary))",
                    opacity: 0,
                    transition: "opacity 150ms",
                  }}
                  className="arrow-hint"
                >
                  →
                </span>
              </div>
              <p
                style={{
                  fontFamily: "'IBM Plex Sans', sans-serif",
                  fontSize: 13,
                  color: "hsl(var(--muted-foreground))",
                  lineHeight: 1.6,
                  margin: 0,
                }}
              >
                {p.desc}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

---

### 2.4 Tailwind config — add custom tokens

Your `tailwind.config.ts` needs the custom CSS vars wired in:

```ts
// frontend/tailwind.config.ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background:    "hsl(var(--background))",
        surface:       "hsl(var(--surface))",
        "surface-hi":  "hsl(var(--surface-hi))",
        foreground:    "hsl(var(--foreground))",
        muted: {
          DEFAULT:    "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        border:        "hsl(var(--border))",
        input:         "hsl(var(--input))",
        ring:          "hsl(var(--ring))",
        primary: {
          DEFAULT:    "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          dim:        "hsl(var(--primary-dim))",
        },
        card: {
          DEFAULT:    "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        destructive: {
          DEFAULT:    "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        success:       "hsl(var(--success))",
        warning:       "hsl(var(--warning))",
      },
      fontFamily: {
        mono: ["'IBM Plex Mono'", "monospace"],
        sans: ["'IBM Plex Sans'", "system-ui", "sans-serif"],
      },
      borderRadius: {
        DEFAULT: "var(--radius)",
        sm:      "2px",
        md:      "var(--radius)",
        lg:      "6px",
      },
    },
  },
  plugins: [],
};

export default config;
```

---

### 2.5 Component patterns — apply to existing pages

These are the CSS patterns to apply when touching repos/playground/benchmarks. Not full rewrites — targeted changes.

#### Repos page — fix the header and empty state

```
CURRENT:  <h1>Repository Dashboard</h1>   ← h1 on an app page
REPLACE:  Remove h1 entirely. Use a compact top bar:
          [codesagez / repos]  (breadcrumb, monospace 12px)
          Input + button inline, no surrounding card

CURRENT:  "No Repository Selected" as card title
REPLACE:  Empty state with monospace instruction:
          $ select a repo from the list to start querying
          (styled as a terminal prompt line, not a heading)
```

#### Benchmarks page — fix the dashes

```
CURRENT:  Every metric shows "—" (em dash placeholder)
PROBLEM:  Looks abandoned, not intentional

Two options:
  A) Remove the metric entirely until you have real data
  B) Replace dash with a styled "pending" badge:
     <span class="chip">awaiting eval run</span>

Prefer option A for credibility. If the eval is broken, 
don't render the table structure at all — show:
     "Run benchmarks/run_internal_eval.py to populate results."
```

#### Playground page — fix the tab labels

```
CURRENT:  "Review | Debug | Tests | Complete" as tabs
PROBLEM:  "Complete" is not a tab — it's a mode or a status
          "Execute Review" as button label is verbose

REPLACE:
  Tabs: "Review" | "Debug" | "Tests"
  Button: "Run" (short, accurate)
  Output panel header: remove "AI Evaluation & Output" (obvious)
  Empty state: "Paste code above, then click Run."
```

#### Input / button component pattern

Use consistently everywhere instead of ad-hoc Tailwind on each page:

```css
/* Add to globals.css */

.input-field {
  width: 100%;
  padding: 8px 12px;
  background: hsl(var(--surface));
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
  color: hsl(var(--foreground));
  font-family: 'IBM Plex Mono', monospace;
  font-size: 13px;
  outline: none;
  transition: border-color 150ms ease-out;
}
.input-field:focus {
  border-color: hsl(var(--primary) / 0.6);
}
.input-field::placeholder {
  color: hsl(var(--muted-foreground));
}

.btn-primary {
  padding: 7px 18px;
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
  border: none;
  border-radius: var(--radius);
  font-family: 'IBM Plex Sans', sans-serif;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 120ms ease-out, transform 100ms ease-out;
}
.btn-primary:hover  { opacity: 0.88; }
.btn-primary:active { transform: scale(0.98); }
.btn-primary:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  transform: none;
}

.btn-ghost {
  padding: 7px 18px;
  background: transparent;
  color: hsl(var(--muted-foreground));
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
  font-family: 'IBM Plex Sans', sans-serif;
  font-size: 13px;
  cursor: pointer;
  transition: color 120ms, border-color 120ms;
}
.btn-ghost:hover {
  color: hsl(var(--foreground));
  border-color: hsl(var(--primary) / 0.4);
}
```

---

## 3. What NOT to add

Hard rules — adding any of these would immediately read as vibecoded:

| Do NOT add | Why |
|------------|-----|
| Gradient text on headlines | Top-3 AI design default |
| Glow / shadow on cards | Cards don't float in a tool UI |
| `rounded-xl` anywhere | Too soft for a code intelligence tool |
| Animated number counters | Marketing, not tooling |
| Grid of 3 feature cards with icons | Generic SaaS default |
| `from-primary to-accent` anywhere | Gradient = vibe |
| Frosted glass hero section | Over-designed, under-substantive |
| Lucide icons as decorative elements | Use only when functionally necessary |
| "Powered by Gemini" badge | Looks like a sponsored placement |
| Loading skeleton with purple shimmer | Default shadcn shimmer — change to `hsl(var(--border))` |

---

## 4. Before / After Summary

| Page element | Before | After |
|---|---|---|
| Font | Inter (default AI font) | IBM Plex (developer tooling font) |
| Accent color | Near-white (no accent) | Cyan `#23c4e8` (contextually correct) |
| Border radius | 0.5rem everywhere | 3px — sharper, more precise |
| Logo | Letter badge + name | `codesagez` monospace + version chip |
| Stat strip | 4 equal boxes with labels above values | Terminal bar: label/value stacked, piped separators |
| Homepage features | 4 equal-weight cards | Numbered list rows with hover bg shift |
| Benchmarks empty | `—` dashes | Removed or `chip` badge "awaiting eval run" |
| Repos header | `<h1>Repository Dashboard</h1>` | Breadcrumb + inline input |
| Button labels | "Execute Review", "Index Repository" | "Run", "Index" |
| Background | `hsl(224 71% 4%)` | **Unchanged — it's good** |

---

## 5. Implementation order (do this, in this sequence)

```
1. globals.css full replacement            (30 min)
2. tailwind.config.ts token wiring         (15 min)
3. layout.tsx nav rebuild                  (20 min)
4. page.tsx homepage rebuild               (30 min)
5. Benchmarks: remove placeholder dashes   (15 min)
6. Playground: fix tab labels + button     (20 min)
7. Repos: remove h1, fix empty state       (20 min)
8. Apply .input-field .btn-primary classes (30 min — find/replace in page components)
```

Total: ~3 hours. No new dependencies. No package installs. Pure CSS + TSX.

---

*CODESAGEZ_DESIGN.md | DEBUG THUGS | July 2026*
