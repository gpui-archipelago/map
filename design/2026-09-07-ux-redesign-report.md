# UX Redesign & Improvement Report: The GPUI Fork Map

This document breaks down the user experience (UX) and interface design (UI) enhancements made when transitioning the GPUI Fork Map from a flat, static HTML reference into an interactive, developer-focused single-page application.

## 1. Information Architecture & Navigation

**Before (Raw HTML)**

**Redesign (Archipelago UI)**

- All 5 views were stacked vertically in raw HTML using `hidden=""` attributes with disconnected anchor fragments (`#/changes`, `#/alignment`).
- A persistent, sticky top navigation bar organizes the tool into five primary workflows with active indicators and visual diff counts.
- Required page-wide vertical scrolling and hunting through massive unstructured tables.
- Clear modular separation between Overview, Changes Delta, Alignment Matrix, Configure & Scaffold, and Release Journal.
- External documentation references (`../../docs/...`) led to dead ends or disrupted context.
- Study documents and honest rules open in an integrated in-app modal, preserving the user's active search state and view context.

**Key Improvements:**

- **Context Preservation:** Switching between tabs does not reset user inputs (e.g., baseline/target release selections, search queries, or scaffold parameters).
- **Clear Workflows:** Distinct tabs cater to specific user intents: investigating a breaking change (Changes), tracking API longevity (Alignment), initiating a project (Configure), or auditing historical releases (Journal).

## 2. Diffing & Comparison Ergonomics (Changes View)

### One-Click Release Swapping

**Problem:** Comparing Release A against Release B often prompted developers to compare the inverse direction (B against A) to see what was added versus removed. In the original document, this required manually changing multiple dropdowns.

**Solution:** Introduced a centralized "Swap" button between baseline and target releases that flips the direction and recalculates the diff instantly.

### Quick Preset "Recorded Stories"

**Problem:** Users exploring the tool for the first time did not know which release pairings contained notable breaking changes or historical inflection points.

**Solution:** Added one-click story preset chips (e.g., uno 1.14.2 → ce 0.2.2, uno 1.16.3 → 1.17.2, kael 0.1.2 → 0.2.0), allowing users to immediately see real-world breakages without manual configuration.

### Live Filter by Kind and Search

**Problem:** In the original document, 168 diff items were presented as an unfilterable, multi-screen wall of text.

**Solution:**

- Added a dedicated text search input with instant clear functionality.
- Added a kind dropdown filter (fn, struct, enum, trait, use, type).
- Displays reactive difference counters for total matches, removals, additions, and re-signatures.

### Dynamic Nature Banners (RULE-1 Enforcement)

**Problem:** Comparing two releases within the same fork is a chronological changelog, while comparing two different forks is an empirical snapshot comparison without lineage. Users could easily misinterpret cross-fork comparisons.

**Solution:** The application automatically evaluates if the comparison is intra-stream or cross-fork, rendering a color-coded explanatory alert:

- Ocean banner (Informational): Confirms an intra-stream continuous changelog.
- Amber banner (Cautionary): Explicitly states that the view is a snapshot surface difference (RULE-1), preventing invalid assumptions about migration paths.

## 3. API Item Lineage & Cross-Linking (Alignment View)

### Fast-Path Pivot from Diff to Matrix

**Problem:** When a user discovered a dropped function in the diff view (e.g., `fn:Hsla::alpha`), checking whether another fork still supported it required navigating away, re-typing the symbol, and re-querying.

**Solution:** Every diff row includes an inline alignment button that automatically navigates to the Alignment Matrix and populates the query input with that specific qualified identity (`kind:name`).

### Instant Status Cards with Architectural Badging

Rather than requiring users to decipher dense dot-matrix tables, each fork displays a dedicated status card summarizing:

- **Presence Status:** Explicit tags (✓ Present, ✕ Removed in [version], ~ Re-signed in [version]).
- **Architecture Model:** Clearly denotes whether the fork uses a pre-split (self-contained) or post-split (separate platform companion) layout.

## 4. Developer Scaffolding & Frictionless Onboarding (Configure View)

### Zero-Edit Manifest & Code Generation

**Problem:** Setting up a GPUI project outside of Zed is error-prone due to mismatched companion crates (`gpui_ce_platform`, `gpui-platform-gpui-unofficial`) and package renaming.

**Solution:** The Configure view renders byte-exact `Cargo.toml` and `src/main.rs` templates tailored to the selected provider, version floor, and custom project name.

### Single-Click Clipboard Actions & Toast Feedback

Each code block features a copy button that writes directly to the clipboard and triggers a non-blocking toast notification (*Copied Cargo.toml to clipboard*).

Terminal commands for artifact pinning and locked compilation (`cargo gocar lock`, `cargo build --locked`, `cargo gocar verify-env`) are presented directly below the code blocks.

## 5. Visual Hierarchy & Archipelago Design Language

### Semantic Palette & Density

Replaced generic dark-mode styling with the official GPUI Archipelago visual identity:

- **Warm Sand Tint** (`#fae0b766`, `#fff8ed`): Evokes the archipelago cartography theme.
- **Ocean Ink** (`#174d68`): High-contrast, readable typography.
- **Coral Accent** (`#ef4e28`): Actionable triggers, active tab states, and destructive diff markers.
- **Island Green** (`#7dab59`): Compile-verified indicators and additions.
- **Amber** (`#a86214`): Re-signature warnings and advisory notes.

### Typography Calibration

- **Headings and Body:** Rendered in Source Sans 3 with comfortable line heights to ease long-form reading of technical study notes.
- **Identities and Hashes:** Rendered in JetBrains Mono to ensure distinct readability for Rust module paths (`fn:profiler::record_frame_timing`), version semver strings, and API hashes.

## 6. Display Honesty & Provenance (RULE-1 to RULE-7)

- **Clear Separation of Truth Layers:** A dedicated matrix contrasts Registry truth (crates.io metadata), Measured truth (syn-level AST analysis), and Unmeasured attributes (derives, trait interfaces, compiler floors), preventing false confidence.
- **Compile Evidence Traceability:** "Compile-verified" badges only appear where actual builds succeeded on crates.io artifacts, complete with explicit rustc compiler version tags linked to their evidence studies (doc 07, doc 12).
