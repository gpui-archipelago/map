// T-39 — curated study links (prose + paths only — no numbers live here).
//
// The paths are the *published* study docs: site-root-relative, so the
// deployed viewer's "read the full doc" links resolve inside its own `docs/`
// mirror (the build copies them there), and the excerpt generator + the drift
// test read the same files from the repo root. Their source is
// `gpui-corpus/curation/research/`, where the studies are published beside the
// curated data whose evidence fields cite them (fetch with the repo's
// `scripts/fetch-docs.sh`); the authoring originals are `cargo-gocar`'s
// `docs/04-user-docs/`.

export const DOCS: Record<string, { title: string; path: string }> = {
  "7": {
    title: "doc 07 — case study: real hello-world, switched between real forks",
    path: "docs/04-user-docs/07-real-fork-compile-case-study.md",
  },
  "8": {
    title: "doc 08 — study: is the used-API report meaningful on real GPUI code?",
    path: "docs/04-user-docs/08-used-api-report-on-real-code.md",
  },
  "9": {
    title: "doc 09 — study: do migrate and the facade carry a real app across the 1.17.2 break?",
    path: "docs/04-user-docs/09-migrate-and-facade-on-real-code.md",
  },
  "10": {
    title: "doc 10 — study: a real kit through the workspace audit; declared toolchain floors",
    path: "docs/04-user-docs/10-kit-and-toolchain-floors.md",
  },
  "11": {
    title: "doc 11 — guide: run a kit that binds another fork (the alias shim)",
    path: "docs/04-user-docs/11-alias-shim-for-kits.md",
  },
  "12": {
    title: "doc 12 — study: the alias-shim compile half, run on both real kits",
    path: "docs/04-user-docs/12-alias-shim-compiled-both-real-kits.md",
  },
  "13": {
    title: "doc 13 — field note: two kits, one measured generation",
    path: "docs/04-user-docs/13-two-kits-one-generation-field-note.md",
  },
};

/** The five study docs the in-app study reader (T-39 decision (a)-lite) can
 * open as an excerpt dialog: the docs the prototype report's study modal
 * names (07/08/09/12/13). DOC_NUMBERS keeps the pre-reader name for the same
 * list (AboutNote + the doc rows it feeds). */
export const STUDY_DOC_NUMBERS = [7, 8, 9, 12, 13] as const;

export const DOC_NUMBERS: readonly number[] = STUDY_DOC_NUMBERS;

/** String-key membership for the study-reader triggers (doc nums arrive as
 * strings from the data layer / anchors). */
const STUDY_DOC_KEYS = new Set<string>(STUDY_DOC_NUMBERS.map((n) => String(n)));

export function isStudyDoc(num: number | string): boolean {
  return STUDY_DOC_KEYS.has(String(num));
}
