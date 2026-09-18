// T-39 — study-reader excerpts: one opening paragraph per study doc (docs
// 07/08/09/12/13), extracted verbatim from the repo markdown by the rule in
// src/study/excerpt.ts (first paragraph under the doc's first "## " section,
// inline markdown stripped to plain text) and plain-text-normalized.
//
// GENERATED FILE — do not hand-edit. Regenerate with `bun run study:excerpts`
// (scripts/gen-study-excerpts.ts). The excerpt is a diff-checked snapshot:
// `bun test` regenerates every entry from the live docs and compares it to
// this file, so a doc edit that moves its opening breaks the parity suite —
// drift stays visible, and the modal never silently quotes a stale opening.

export const STUDY_EXCERPTS: Record<string, string> = {
  "7": "You can switch an application between different GPUI forks without changing a single line of Rust code, provided both forks belong to the same measured API generation. Because the modern forks split their platform code into separate companion crates, a compiling project is always the fork plus its version-locked companion.",
  "8": "On real, compiling GPUI code the compatibility report reasons about 16 of the 20 used symbols (80%), and it names the exact release that removes a function. Its limits are honest ones: it cannot follow method chains on visual elements — 30 of the app's 64 call sites stay unscanned — and it refuses cross-fork upgrades its type-level data cannot prove, even where the compiler succeeds.",
  "9": "Automated migration carries none of this upgrade on realistic application code: the one rewrite rule the tool confirmed targets a function real apps never call, and the edit it produced does not compile. What the tool is excellent at is the other half — it names every broken line, with the reason, and rewrites nothing it was not asked to touch.",
  "12": "A same-generation alias shim carries a real UI kit's whole stack onto the other fork: gpui-kit 0.6.0 built against gpui-unofficial 1.19.0-pre with one engine in the graph. Across a generation boundary the shim cannot help — the reverse direction needed a one-line kit patch, because what breaks there is a method signature, not a package name.",
  "13": "Two UI kits that appear to need different GPUI forks are the same measured generation published under two names, so either kit can be routed to either fork with a one-crate alias shim. That equality is an item-set fingerprint rather than byte-identical sources — and the generation below it still costs a kit one line.",
};
