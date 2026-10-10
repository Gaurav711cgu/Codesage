# Design System: CodeSageZ Enterprise Engine
**Project ID:** `codesagez-core-v2`

## 1. Visual Theme & Atmosphere
The CodeSageZ interface adheres strictly to an **Industrial Glass** aesthetic—a deliberate blend of brutalist utilitarian engineering and high-precision developer tool design. Rather than relying on generic SaaS clichés, decorative gradients, or playful cartoonish rounded elements, the atmosphere evokes the cold, high-performance command bridge of a high-throughput systems compiler or distributed telemetry node.

- **Mood:** Utilitarian, razor-sharp, technical, deliberate, and uncompromised.
- **Density:** High information density. Screen real-estate is prioritized for actionable telemetry, abstract syntax tree (AST) visualizers, execution traces, and compiler metrics.
- **Surface Texture:** Dark obsidian glass surfaces with subtle, crisp 1px borders and targeted translucent backdrops (`backdrop-blur-md`). Ambient noise textures are minimal or removed in favor of clean mathematical grid alignment.

---

## 2. Color Palette & Roles

Every color in CodeSageZ is assigned a functional, operational role to eliminate arbitrary decoration:

| Descriptive Color Name | Hex Code / HSL | Functional System Role |
|:---|:---|:---|
| **Void Obsidian** | `#030712`<br>`hsl(224, 71%, 4%)` | Primary background canvas. Zero-saturation deep slate-black providing maximum contrast for telemetry. |
| **Deep Terminal Surface** | `#050c1e`<br>`hsl(224, 71%, 6%)` | Base container and card layer. Distinct from background canvas by 2% luminance. |
| **Elevated Console Slate** | `#0a142e`<br>`hsl(224, 71%, 10%)` | Hover states, interactive panels, focused card backgrounds, and terminal headers. |
| **Cold Machine Border** | `#0d1b3e`<br>`hsl(224, 71%, 12%)` | Structural bounding lines, table column dividers, and component outlines. |
| **High-Voltage Cyan** | `#22d3ee`<br>`hsl(191, 81%, 53%)` | Primary interactive accent. Used for primary CTA buttons, active route tabs, and AST edge focal points. |
| **High-Voltage Cyan Dim** | `rgba(34, 211, 238, 0.15)` | Interactive hover fills, active pill backgrounds, and subtle highlight rings. |
| **Phosphor Telemetry Green** | `#16a34a`<br>`hsl(142.1, 76.2%, 36.3%)` | Operational success, healthy daemon states, passing benchmarks, and active memory pools. |
| **Industrial Warning Amber** | `#f59e0b`<br>`hsl(38, 92%, 50%)` | Circuit breaker trips, cached fallbacks, degraded worker threads, and rate limits. |
| **Critical Execution Red** | `#ef4444`<br>`hsl(0, 84.2%, 60.2%)` | OOM alerts, syntax parse errors, compiler failures, and pipeline aborts. |
| **Phosphor White / Foreground** | `#f8fafc`<br>`hsl(210, 40%, 98%)` | Primary body and heading text. High contrast legibility against Void Obsidian. |
| **Muted Signal Slate** | `#94a3b8`<br>`hsl(215, 20.2%, 65.1%)` | Secondary metadata, code comments, inactive tabs, and technical descriptions. |

---

## 3. Typography Rules

Typography communicates structure, hierarchy, and mechanical precision. Dual-font system: Sans-serif for executive headers and body copy, Monospace for all telemetry, code, metrics, and tags.

- **Primary Interface Font:** `IBM Plex Sans` / `Inter` (`sans-serif`)
  - Weight Hierarchy: Regular (400) for body descriptions, Medium (500) for navigation and buttons, Bold (700) for top-level view titles.
  - Tracking: Headings use tight letter-spacing (`tracking-tight`, `-0.02em`) to maintain editorial authority.
- **Telemetry & Code Font:** `IBM Plex Mono` / `JetBrains Mono` (`monospace`)
  - Used for: Terminal simulation, log dumps, benchmark tables, code snippets, memory byte counts, latency readings, and system status tags.
  - Tag Styling: Uppercase with wide letter-spacing (`tracking-widest`, `0.05em`) wrapped in mechanical square brackets (e.g. `[ SYSTEM_METRICS ]`, `[ AST_WORKER_01 ]`).

---

## 4. Component Stylings

All components reject soft, rounded, mobile-first consumer aesthetics in favor of crisp, engineered workstation controls:

### Buttons
- **Shape & Geometry:** Strict squared corners with a micro-radius of 3px (`rounded-[3px]`). Zero oval or pill buttons.
- **Primary Button (`.btn-primary`):** Solid High-Voltage Cyan (`#22d3ee`) fill with Void Obsidian (`#030712`) bold sans-serif text. On hover, smooth opacity reduction (0.88); on active click, micro-compression scale (`scale(0.98)`).
- **Secondary / Ghost Button (`.btn-ghost`):** Transparent background with 1px Cold Machine Border (`#0d1b3e`) and Muted Signal Slate text. On hover, border color transitions to High-Voltage Cyan (`rgba(34, 211, 238, 0.4)`) and text shifts to Phosphor White.
- **Console Action Buttons:** Monospace uppercase with bracketed prefixes (e.g. `>_ EXECUTE QUERY`).

### Cards & Telemetry Containers
- **Border & Corner Treatment:** 1px sharp solid border in Cold Machine Border (`#0d1b3e`). Corner radius locked at 3px (`rounded-[3px]`).
- **Surface Elevation:** Deep Terminal Surface (`#050c1e`) with zero ambient drop shadows (`box-shadow: none`). Elevation is defined purely through luminance contrast and border luminescence.
- **Header Accents:** Cards feature a dedicated top sub-bar containing monospace metadata tags, status LEDs, and breadcrumb identifiers.

### Inputs & Form Controls
- **Stroke & Surface:** 1px solid Cold Machine Border with Deep Terminal Surface fill.
- **Typography:** Strict 13px `IBM Plex Mono`.
- **Focus State:** High-Voltage Cyan border stroke (`rgba(34, 211, 238, 0.6)`) with subtle inset ring; zero blurry glowing halos.

### Terminal & Simulation Displays
- **Window Chrome:** Minimalist bar with square operational indicator lights (not macOS colored circles).
- **Output Stream:** JetBrains Mono 12px with automated line-level syntax highlighting (`INIT`, `PARSING`, `UPSERT`, `SUCCESS`).
- **Cursor:** Monospaced vertical block with 1000ms square wave step-end animation (`cursor-blink`).

---

## 5. Layout Principles

- **Grid Alignment:** Strict 12-column responsive grid with consistent 16px/24px gutters. Content containers are capped at `max-w-7xl` or `max-w-5xl` for readable metric density.
- **Whitespace Rhythm:** Deliberate, balanced vertical rhythm (16px, 32px, 64px, 96px). Ample breathing room around complex data tables and graphs prevents cognitive fatigue without diluting technical density.
- **Recruiter Navigation Hierarchy:**
  1. Primary Global Header: Fixed 56px height, backdrop blur, logo, 8 core subsystem links, GitHub repo badge, and live console launch button.
  2. Subsystem Telemetry Bar: Sticky secondary tabs on detail pages for instant section jumping.
  3. Structured Engineering Footer: 3-column architecture index, live telemetry status, and direct author contact links.
