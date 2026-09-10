# Architecture & UX Refinement Report: GPUI Fork Map (Raw CLI Export → Tailwind Prototype)

This document specifies the architectural, design, and user-experience transformations required to transition from the current baseline (the raw, static CLI HTML export from `cargo gocar export-fork-map`) to the desired state (the high-density, interactive Archipelago Tailwind Prototype).

## 1. Executive Summary & Paradigm Shift

The current version is an unstyled, static HTML export where all views are dumped into a single DOM tree with `hidden=""` attributes, relying on an external script and raw file loading. The desired state is an interactive, responsive developer workspace that translates raw AST measurement datasets into an intuitive decision-support tool for the GPUI ecosystem.

| Dimension | Current Version (Raw CLI Export) | Desired State (Tailwind Prototype) |
| --- | --- | --- |
| Information Architecture | Flat DOM dump of 5 views (`view-landing`, `view-changes`, etc.) hidden via HTML attributes; fragment-only jumps. | Stateful SPA Workspace with persistent top-level navigation, active indicators, and context retention across views. |
| Visual Design System | Basic CSS variables, default browser form controls, unpadded tables, raw monospace text blocks. | Archipelago Cartography System in Tailwind CSS: Warm Sand (`#fff8ed`, `#fae0b7`), Ocean Ink (`#174d68`), Coral Action (`#ef4e28`), and Island Green (`#7dab59`). |
| Changes & Diffing | Long, unfilterable list of 168 diff items; nested `<select>` dropdowns; static text labels. | Interactive Diff Stage with ⇄ swap ergonomics, one-click "recorded stories" presets, live search, kind filters (fn, struct, etc.), and Rule-1 dynamic nature banners. |
| Alignment Inspection | Rigid, overflowing 67-column dot matrix with browser-native title tooltips; empty text search. | Reactive API Inspector featuring an autosuggest query palette with release prevalence counts (28 releases), interactive status cards, and responsive lifecycle dots. |
| Scaffold Generator | Static `<pre>` code blocks with raw text; manual copy buttons with no feedback. | Live Scaffold Materializer dynamically updating Cargo.toml and src/main.rs with project name bindings, clipboard toast feedback, and clear v2 negative-scope panels. |
| Release Journal | Single massive vertical scroll of 67 releases across 6 forks; difficult to isolate streams. | Stream-Filtered Chronological Timeline with republish detection (`.je-same`), expandable diff rows, and one-click deep links directly into Changes Diff. |
| Honesty & Provenance | `<details>` disclosure blocks tucked at the bottom of pages; hard-to-reach external markdown links. | Integrated Provenance Engine with in-app study modals (doc 07, doc 12), 1:1 code-to-DOM rule IDs (`honest-rule-1..7`), and explicit truth-layer badging. |

## 2. Global Shell & Navigation Architecture

### 2.1 Brand Cartography & Status Header

**Current State:**

```html
<header class="site-header">
  <span class="brand-tile"><span class="tile-isle i1"></span>...</span>
  <span class="brand-mark">gpui-archipelago</span>
  <div class="header-metrics mono">6 forks · 67 releases...</div>
</header>
```

The raw header contains static text metrics and an unstyled navigation menu. If opened via `file://`, the user is greeted by an intrusive `#fatal` error block.

**Desired Tailwind State:**

- **Sticky Glass Header:** Built with `sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-ocean-hairline`.
- **Brand Lockup:** Integrates the archipelago island glyph with warm sand background (`bg-sand-200 border border-ocean-hairline`) and schema badge (`bundle gocar.forkmap.v1`).
- **Live Dataset Telemetry Pill:** A dedicated monospace pill showing real-time dataset health with a pulsing green indicator (`bg-island animate-pulse`), displaying forks, releases, measured records (166,292), and facade shim tables.
- **Client-Side Tab Navigation:** Replaces hash reloads with fluid tab buttons (`tab-btn`) that maintain selected baseline releases, queries, and active filters when switching views.

### 2.2 Toast Feedback & Non-Blocking Resilience

Replaces browser alerts and silent failures with a non-blocking floating notification toast (`#toast`) that animates on clipboard copy or action triggers:

```html
<div id="toast" class="fixed bottom-6 right-6 z-50 transform translate-y-16 opacity-0 transition-all duration-300">
  <span class="w-2 h-2 rounded-full bg-coral"></span>
  <span id="toast-msg">Copied to clipboard</span>
</div>
```

## 3. Map Overview & Attestation Layers (View 01)

### 3.1 Workflow Gateway Cards

**Current State:** Plain text list of 4 numbered cards with minimal visual differentiation.

**Desired Tailwind State:** High-contrast, interactive action cards (01 Changes, 02 Alignment, 03 Configure, 04 Journal) using hover border transitions (`hover:border-ocean hover:shadow-md`) and accent color headers (Coral, Ocean, Island Green, Amber). Clicking any card transitions directly to that workflow.

### 3.2 The Three Truth Layers

The dataset operates on three distinct layers of attestation. The Tailwind prototype elevates this into a structured, color-coded comparison matrix:

- **Registry Truth (Blue):** Live crates.io sync (published versions, yanked/prerelease flags, declared `rust-version`).
- **Measured Truth (Green):** AST-level syn analysis (`kind:name` + SHA-256 surface digests).
- **Not Yet Measured (Sand/Muted):** Derives, trait blanket implementations, compiler floors, cfg evaluations. Labeled explicitly as *not measured, never guessed* (RULE-4).

### 3.3 Compile-Verified Badges & Kit Probes

Displays the six-provider verification grid where real binaries compiled without hand edits:

- Each card displays the verified rustc compiler version (1.95.0 or 1.97.1).
- Links directly to the evidence study (doc 07, doc 12) via an in-app reader modal.
- Details the Kit Probes story: `gpui-kit 0.6.0` (exit 0 through alias shim) versus `gpuikit 0.9.0` (blocked by 1 re-signature: `Window::blur()` → `Window::blur(cx)`).

## 4. Changes View: Precision Lineage & Diff Ergonomics (View 02)

### 4.1 Paired Release Picker & Swap Control

**Current State:** Two disconnected rows of `<select>` dropdowns for Provider A, Version A, Provider B, Version B.

**Desired Tailwind State:**

- Clean two-column card layout (Release A · Baseline vs Release B · Target).
- Centralized ⇄ Swap button that inverts baseline and target releases in a single click and recalculates the diff.
- Recorded Stories Presets: Quick-access chips to jump directly to historical inflection points:
  - uno 1.14.2 → ce 0.2.2 (cross-fork 168 diff)
  - uno 1.16.3 → 1.17.2 (frame_trace dropped)
  - kael 0.1.2 → 0.2.0 (AccessibilityNode re-sign)

### 4.2 Dynamic Nature Alert Banners (RULE-1 Enforcement)

The UI automatically detects whether the comparison is intra-stream or cross-fork:

- **Cross-Fork (Amber Banner):** Explicitly states that the view is an empirical snapshot difference with no lineage edge. Prevents invalid assumptions about changelog progression.
- **Same-Stream (Ocean Banner):** Confirms an intra-stream chronological changelog where successor rules indicate confirmed migration paths.

### 4.3 Live Filtering & Verbatim Qualified Chips (`.kchip`)

- **Live Search & Kind Filter:** Search box with clear button (✕) and kind dropdown (all, fn, struct, enum, trait, use, type).
- **Semantic Headings with Real Counts:** Added, Removed, and Re-signed lists are grouped by kind (fn — 17, struct — 2).
- **Fast-Path Cross Navigation:** Every diff row features a monospace `.kchip` with an inline alignment button that immediately navigates to the Alignment Matrix with that exact symbol pre-filled.

## 5. Alignment View: API Presence & The Dot Matrix (View 03)

### 5.1 Reactive Autosuggest Palette

**Current State:** Basic search input with hidden suggestion list that requires manual keyboard events.

**Desired Tailwind State:**

- Real-time query input with sample preset buttons (`struct:AccessibilityNode`, `fn:Window::blur`, `fn:Hsla::alpha`, `fn:App::emit`, `struct:BackdropFilter`).
- Suggestion overlay displaying matching qualified symbols alongside their total release presence count (28 releases, 65 releases).

### 5.2 Six-State Dot Matrix Stream Visualizer

Replaces static dot characters with tokenized interactive cells:

- `.cell-same`: Present with unchanged digest hash.
- `.cell-changed`: Re-signed (parameter types or doc comments modified).
- `.cell-added`: Appears for the first time in this stream.
- `.cell-removed`: Removed at this exact release.
- `.cell-absent`: Not present in this release.
- `.cell-unknown`: Unmeasured (never assumed).

Each dot provides hover tooltips detailing: release channel, yanked/prerelease flags, and the exact 64-character SHA-256 surface digest.

### 5.3 Fork Status & Architecture Cards

Detailed cards for each of the 6 forks summarizing:

- **Current Presence:** ✓ Present, ✕ Removed in [version], ~ Re-signed in [version].
- **Architecture Model:** Clearly denotes pre-split (self-contained engine) vs post-split (separate platform companion crate like `gpui-platform-gpui-unofficial`).

## 6. Configure View: Real-World Scaffolding (View 04)

### 6.1 Dynamic Manifest & Starter Generation

**Current State:** Hardcoded text blocks for a single provider.

**Desired Tailwind State:**

- Interactive form: Provider dropdown, Version floor selector, and Project Name input.
- Real-time interpolation into byte-exact `Cargo.toml` and `src/main.rs` templates matching `cargo gocar new`.
- Automatically resolves platform companion dependencies and launch shape (`gpui_platform::application()` for post-split vs `App::new()` for pre-split).

### 6.2 One-Click Clipboard Actions

- Integrated copy buttons on every code block that trigger non-blocking toast notifications.
- Direct display of next terminal workflow commands (`cargo gocar lock`, `cargo build --locked`, `cargo gocar verify-env`).

### 6.3 Negative Scope Transparency ("What this view does not do")

Dedicated panel articulating system boundaries to maintain engineering trust:

- Kit-rebase alias-shim bundles are out of scope for v1 (requires active compile probes).
- Facade shims remain human-authored (shim tables provide data, source generation is manual).
- Era boundaries within a stream (companion requirements default to post-split; early versions carry clear warnings).

## 7. Release Journal: Chronological Timeline (View 05)

### 7.1 Stream Filtering & Republish Detection

**Current State:** 67 releases dumped in a continuous unfilterable column.

**Desired Tailwind State:**

- **Stream Selector:** Filter feed to show all 6 streams or isolate an individual fork.
- **Exact-Copy Republish Banners (`.je-same`):** Identifies when consecutive releases have identical measured surfaces (e.g., gpui-ce 0.3.3 identical to 0.3.2).
- **Expandable Diff Rows:** Collapsible accordion to view measured item rows directly in the feed without leaving the journal.
- **Deep Linking:** Header links jump directly into the Changes Diff view with pre-populated baseline and target query parameters.

## 8. Display Honesty & In-App Study Reader

### 8.1 1:1 Code-to-DOM Rule Tracing

To guarantee auditability, all seven display rules are maintained with identical IDs in the DOM and script:

- `honest-rule-1`: Epochs are exact-copy-only within a stream. Cross-fork comparisons are snapshot diffs only.
- `honest-rule-2`: Qualified item identity (`kind:name`). Doc comment modifications count as digest changes.
- `honest-rule-3`: Out-of-model is stated, never inferred (derives, auto-traits, compiler floors).
- `honest-rule-4`: null is never "unchanged" — unmeasured rows render "not measured".
- `honest-rule-5`: Badges require compile evidence (doc 07, doc 12).
- `honest-rule-6`: Flags are shown prominently (yanked, prerelease).
- `honest-rule-7`: Every claim traces directly to the dataset schema.

### 8.2 In-App Study Modal

Instead of external links that navigate away from the tool, study documentation opens in an integrated modal reader:

- doc 07: Real hello-world compile case study across forks.
- doc 08: What the used-API report can prove on real code.
- doc 09: Migrate and facade across the 1.17.2 break.
- doc 12: Alias-shim compile evidence on both real kits.
- doc 13: Field note on two kits, one measured generation.
