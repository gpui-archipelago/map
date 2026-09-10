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
  "7": "Everything before this study ran on fixtures: e2e tests spawn cargo gocar against fixture manifests that are \"never compiled\", lock tests use --offline, and the facade demo compiles fixture forks that mirror recorded surfaces. UC-01 itself warns that the scaffolded main.rs is \"a template to compile-check after locking\" — nobody had ever compile-checked it.",
  "8": "cargo gocar report (T-12) delivers UC-05's targeted-upgrades promise: it checks an app's used-API slice against every measured release of every provider and prints compatible windows plus exact incompatibilities. But the v0 item model measures type/trait/fn names only, and real GPUI usage is overwhelmingly method chains on elements (div().flex().child(…)), impl-block items, and derive/macro attributes — every one of which v1 must list as unprovable, never assumed. So: on a real, compiling GPUI app, does the report advise — or return \"nothing checkable\" on exactly the code it exists for? And are its claimed windows compile-true?",
  "9": "Migrate (T-14, UC-07) and the facade (T-13/T-16, UC-06) had only ever run on fixture source that is never compiled (the e2e harness) or on fixture forks mirroring recorded surfaces — the T-14 demo's call site was the synthetic record_frame_timing(()), and the facade's debt signal had never been checked against a real fork's compile behavior. UC-06/07's claim — \"switching is report → guided codemod → clean verify-env (or an explicit facade deferral)\" — was unverified. So: does report → facade → migrate → add → lock → build → verify-env carry a real, compiling-at-1.16.1 app across 1.17.2 to 1.18.1 — and where do hands take over?",
  "12": "Doc 11 documented the alias-shim — a same-name re-export crate + [patch] that routes a kit's fork binding onto another release of the same measured generation — and verified it to resolution + lock shape on the real gpui-kit 0.6.0 (T-22). Its status line named the open risk: \"Nothing has compiled gpui-kit 0.6.0's stack against uno 1.19.0-pre. … a default-feature build of the aliased workspace is the test that confirms or kills it\". And the reverse direction — a layer that binds gpui-unofficial compiled onto gpui-pre — had never been run on a real uno-bound kit at all (doc 11 reasoned about a \"hypothetical uno-bound kit\"). Both halves executed here, on real crates.io artifacts, with cargo build.",
  "13": "There are two UI kits on crates.io that build on GPUI, and they picked different names for the same underlying tree:",
};
