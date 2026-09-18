// T-39 — the documents index (#/docs) annotations.
//
// The index is one table over the published set: doc, topic, status, and what
// the document establishes. Titles live in content/docs.ts (they match the
// documents' own H1s); the prose lives here, so the view stays a renderer.
//
// Every claim below is drawn from the document it names — the equality claims
// say *measured generation* (an item-set fingerprint), the toolchain floors are
// advisory in the tool and enforced by cargo, and the shim work is
// compile-verified. When a document is rewritten, revisit its row: the tests
// only assert that every published doc has an entry, never the wording.

export interface DocIndexEntry {
  /** What kind of document it is, and how far it got. */
  status: string;
  /** One qualifier under the status, or "" for none. */
  note: string;
  /** What the document establishes, in one sentence. */
  finding: string;
  /** The operational points it leaves you with. */
  points: string[];
}

export const DOC_INDEX: Record<string, DocIndexEntry> = {
  "7": {
    status: "Completed study",
    note: "all six providers",
    finding:
      "Equivalent forks swap without touching Rust, but a modern project is the fork plus its version-locked platform companion — and the shipped scaffold did not compile until that was fixed.",
    points: [
      "The same `main.rs` compiled unchanged on `gpui-unofficial` 1.16.1 and `gpui-box` 0.1.1 — one measured generation, `ef93dce2…`.",
      "Every post-split fork needs its companion crate; `cargo gocar add --equivalent` moves both lines in one diff.",
      "A stale companion puts two engines in the lock: the workspace audit refuses it, naming both generations.",
    ],
  },
  "8": {
    status: "Completed study",
    note: "scan unblocked at item level",
    finding:
      "On real compiling code the report reasons about 16 of the 20 used symbols and names the release that removes a function; it cannot follow method chains, so 30 of 64 call sites stay unscanned.",
    points: [
      "It validated 16 of 20 used symbols (80%), and named the exact release that drops `set_frame_trace_enabled`.",
      "The 30 unscanned sites: 1 glob import, 23 gpui-shaped builder chains, and 6 std/companion calls.",
      "Cross-fork refusals are conservative — `gpui-box` 0.1.1 is refused on type digests yet compiles — so run it forward from the release you are on.",
    ],
  },
  "9": {
    status: "Completed study",
    note: "feature-gate check added",
    finding:
      "Automated migration carried none of this upgrade: the one rewrite rule fired on a probe no real app calls, and the edit it wrote did not compile. Its value is naming every broken line without touching the rest.",
    points: [
      "`migrate --write` wrote one rewrite in one file; `main.rs` and `profiling.rs` stayed byte-identical (`cmp`), and 2 calls were marked manual.",
      "The written code hit 4 compiler errors: the successor sits behind `#[cfg(feature = \"profiler\")]` and needs a payload wrap, not a rename.",
      "The manual fix came from rustc's own suggestion, and a quiet facade is not a clean bill of health.",
    ],
  },
  "10": {
    status: "Completed study",
    note: "partial floors patched",
    finding:
      "The workspace audit catches a real kit dragging a second engine into the lock and refuses it; declared compiler floors are advisory in the tool and enforced by cargo.",
    points: [
      "`check-workspace` exited 1, naming `gpui-pre` 0.3.3 as a clash against the app's `gpui-unofficial` 1.18.1 — two measured generations.",
      "It names the fork, not the culprit: the reverse-edge walk back to the kit is not built yet.",
      "`gpui-box` declares `1.97` (two components), which the parser skipped; partial floors are padded with `.0` now, in the warning and the environment check alike.",
    ],
  },
  "11": {
    status: "Workaround guide",
    note: "compile proven in doc 12",
    finding:
      "One small crate plus one `[patch]` line route a kit onto an equivalent fork — sound only when the two releases are the same measured generation.",
    points: [
      "The constraint is the generation, not the name: only measured-equal classes qualify — here `gpui-pre` 0.3.x with `gpui-unofficial` 1.19.0-pre.",
      "Replicate the impersonated package's feature surface; a name the target lacks (`inspector`) is an empty marker, and a dependent that needs it is unproven.",
      "The tool's audits refuse the aliased workspace by design — they key on package names, and the alias deliberately breaks name and identity apart.",
    ],
  },
  "12": {
    status: "Completed study",
    note: "one source line at most",
    finding:
      "A same-generation shim carried `gpui-kit`'s whole stack onto `gpui-unofficial` with one engine and zero edits; the reverse direction needed one source line — and a no-shim control exonerated the shim.",
    points: [
      "`gpui-kit` 0.6.0 built against `gpui-unofficial` 1.19.0-pre in 3m05s; `cargo tree -i` shows the engine once, reachable only through the shim.",
      "`gpuikit` 0.9.0's caret floors on 1.18.1 and excludes prereleases, so reaching the twin takes `=1.19.0-pre` plus three vendored version lines.",
      "The `blur` arity error shows up without any shim too (registry uno 1.19.0-pre), so it is an era break; one line, `window.blur(cx)`, fixes it.",
    ],
  },
  "13": {
    status: "Field note",
    note: "summary of docs 11–12",
    finding:
      "Two kits that appear to need different forks share one measured generation published under two names, so either kit can be routed to either fork. That equality is an item-set fingerprint, not byte-identical sources.",
    points: [
      "`546fcb11…` is the same public items with the same signatures, item for item — not a claim about the sources.",
      "Neither kit forces its fork: a thin relay crate named after the package the kit expects, plus one `[patch]` line, re-routes the whole stack.",
      "Crossing the generation below still costs a kit one line — `blur(cx)` — and no re-export shim can absorb a re-signed method.",
    ],
  },
};

export interface SuiteTakeaway {
  /** The claim, as the lead-in. */
  title: string;
  /** What it rests on. */
  body: string;
}

/** The three claims that hold across the whole suite. */
export const SUITE_TAKEAWAYS: readonly SuiteTakeaway[] = [
  {
    title: "The generation, not the name, is the identity.",
    body: "`gpui-pre` 0.3.x and `gpui-unofficial` 1.19.0-pre are one measured generation (`546fcb11…`): the same public items, item for item.",
  },
  {
    title: "One engine per binary.",
    body: "`check-workspace` and `verify-env` exist to stop two GPUI runtimes being compiled into one executable — the rule is one fork package per lock, not one version.",
  },
  {
    title: "Audit first; do not trust the auto-rewrite.",
    body: "The tooling is accurate at finding and explaining breaks, so a migration run is an inspection list — fluent UI chains and re-signed methods still take a human.",
  },
];
