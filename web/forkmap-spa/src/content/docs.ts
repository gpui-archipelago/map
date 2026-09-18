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
    title: "doc 07 — Switching a Hello World app between real GPUI forks",
    path: "docs/04-user-docs/07-real-fork-compile-case-study.md",
  },
  "8": {
    title: "doc 08 — Checking real application code with the compatibility report",
    path: "docs/04-user-docs/08-used-api-report-on-real-code.md",
  },
  "9": {
    title: "doc 09 — Testing automated migration and compatibility shims on real code",
    path: "docs/04-user-docs/09-migrate-and-facade-on-real-code.md",
  },
  "10": {
    title: "doc 10 — Auditing third-party UI kits and Rust compiler requirements",
    path: "docs/04-user-docs/10-kit-and-toolchain-floors.md",
  },
  "11": {
    title: "doc 11 — Using third-party UI kits with alternative GPUI forks",
    path: "docs/04-user-docs/11-alias-shim-for-kits.md",
  },
  "12": {
    title: "doc 12 — Verifying the alias shim with real UI kits",
    path: "docs/04-user-docs/12-alias-shim-compiled-both-real-kits.md",
  },
  "13": {
    title: "doc 13 — Two UI kits running on one underlying engine",
    path: "docs/04-user-docs/13-two-kits-one-generation-field-note.md",
  },
};

/** A document's title without its `doc NN — ` label. The titles carry the label
 * because the documents cite themselves that way; a place that already shows
 * the number in a column of its own (the index) reads better without it. */
export function docTopic(num: number | string): string {
  return DOCS[String(num)].title.replace(/^doc \d+ — /, "");
}

/** The five study docs the prototype report's study modal names
 * (07/08/09/12/13) — the curated list AboutNote and the doc rows render.
 * DOC_NUMBERS keeps the older name for the same list. This is now a
 * *curation* set, not the reader's gate: the reader opens any published doc
 * (see hasReader). */
export const STUDY_DOC_NUMBERS = [7, 8, 9, 12, 13] as const;

export const DOC_NUMBERS: readonly number[] = STUDY_DOC_NUMBERS;

/** String-key membership for the study-reader triggers (doc nums arrive as
 * strings from the data layer / anchors). */
const STUDY_DOC_KEYS = new Set<string>(STUDY_DOC_NUMBERS.map((n) => String(n)));

export function isStudyDoc(num: number | string): boolean {
  return STUDY_DOC_KEYS.has(String(num));
}

/** Whether the in-app reader can open this doc (T-39 reader pass): every doc
 * in the published set, not just the five studies. Docs 10/11 are linked
 * exactly like the studies are, and "a plain click keeps you in the page"
 * should not depend on which doc a link happens to name — the two used to
 * behave differently for no reason a reader could see. */
export function hasReader(num: number | string): boolean {
  return Boolean(DOCS[String(num)]);
}
