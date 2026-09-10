// T-39 — study-reader excerpt rule (decision (a)-lite, recorded in the T-39
// task file): each of the five study docs (07/08/09/12/13) opens in an in-app
// dialog showing ONE paragraph — the doc's own opening, never a site-written
// summary — plus the outbound "read the full doc" link the static site always
// had. The extraction is deliberately mechanical so the generated
// src/study/study-excerpts.ts can be diff-checked against the live docs:
// `bun test` regenerates each excerpt from the repo markdown and compares it
// to the committed file, so a doc edit that moves its opening breaks the
// parity suite loudly — drift stays visible instead of silently diverging.
//
// Rule: the excerpt is the first paragraph under the doc's first "## "
// section heading (the doc's own opening section — e.g. "## Question"),
// inline markdown stripped to plain text. Leading **Status:** blocks and
// field-note front matter live before the first "## " and are skipped by
// construction.

import { DOCS, STUDY_DOC_NUMBERS } from "../content/docs";

/** The source paragraph: the non-empty lines after the first "## " heading,
 * joined until the next blank line (paragraph boundary). */
export function excerptParagraph(markdown: string): string {
  const lines = markdown.split("\n");
  let i = lines.findIndex((l) => l.startsWith("## "));
  if (i < 0) return "";
  i += 1;
  // Paragraphs sit a blank line below the heading — skip the gap, then take
  // the first non-empty block until the next blank line or heading.
  while (i < lines.length && lines[i].trim() === "") i += 1;
  const buf: string[] = [];
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "") break;
    if (line.startsWith("#")) break;
    buf.push(line.trim());
    i += 1;
  }
  return buf.join(" ").trim();
}

/** Inline markdown → plain text for the excerpt paragraph (code spans first,
 * so `` `[patch]` `` stays a literal "[patch]" and never parses as a link;
 * underscore emphasis is left alone — identifiers like platform_companion
 * must not lose characters). */
export function plainText(p: string): string {
  return (
    p
      // inline code spans: `x` or ``x`` -> x
      .replace(/`{1,3}([^`]*)`{1,3}/g, "$1")
      // image/link syntax: ![alt](url) / [label](url) -> alt / label
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      // reference-style links [label][ref] -> label
      .replace(/\[([^\]]*)\]\[[^\]]*\]/g, "$1")
      // asterisk emphasis: **strong** / *em* -> content (never underscores)
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/\s+/g, " ")
      .trim()
  );
}

/** The full extraction: markdown → excerpt paragraph → plain text. */
export function excerptFromDoc(markdown: string): string {
  return plainText(excerptParagraph(markdown));
}

/** Repo-root-relative source path of a study doc — the same site-relative path
 * the viewer's href uses (the generator script + the drift test read the live
 * docs from the repo root; the deployed viewer reads its own `docs/` mirror). */
export function excerptSourcePath(num: number | string): string {
  const doc = DOCS[String(num)];
  if (!doc) throw new Error(`excerptSourcePath: no doc ${num}`);
  return doc.path;
}

/** The study docs the reader covers (kept next to the rule so the generator,
 * the tests and the modal all agree on the five). */
export const EXCERPT_DOC_NUMBERS: readonly number[] = STUDY_DOC_NUMBERS;
