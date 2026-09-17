// T-39 — the doc reader's markdown rules.
//
// The evidence docs are the repo's own markdown (`docs/04-user-docs/*.md`),
// copied verbatim into `dist/docs` by the build. The reader fetches the `.md`
// at runtime and renders it with marked (GFM) under four deliberate rules:
//
//   1. The doc's own leading H1 is dropped — the dialog title already carries
//      it, and rendering both would print the same line twice.
//   2. Every heading gets a GFM-style slug id. marked emits none, and the docs
//      link each other by anchor (doc 08 → `#t-26-resolution-2026-09-07`), so
//      without ids those links would go nowhere. Two of the docs' own anchors
//      are truncated and match no full slug; the reader follows anchors by
//      prefix (StudyModal.scrollToAnchor), so they land on the section anyway.
//   3. Links are classified against the published doc set (classifyDocLink).
//      A doc-to-doc link becomes an in-reader jump; an http(s) link opens in a
//      new tab; and a link whose target this mirror does not carry — doc 07
//      points at `../../tasks/archive/…`, doc 10 at a `doc 14` that was never
//      published — renders as plain text. The reader never offers a link that
//      would 404.
//   4. Raw HTML is escaped, never interpreted. No doc contains any today (each
//      `<Foo>` in them sits inside a code span, which marked escapes itself),
//      so this is hardening: the reader cannot be a script-injection path, and
//      a doc that did contain markup would show it verbatim, not execute it.
//
// Every rule is a pure function here, so the parity suite asserts them
// directly (tests/markdown.test.ts). The parser itself is the one lazy piece:
// renderDocMarkdown imports marked on first use, so a 44 KB parser never
// enters the entry chunk for an affordance most visits never open.

import type { RendererObject, Tokens } from "marked";
import { DOCS } from "../content/docs";

/** GFM's heading-slug rule (github-slugger's core): lowercase, drop every
 * character that is not a word character, a space or a hyphen, then spaces →
 * hyphens. Deliberately untrimmed — GFM does not trim. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\- ]+/g, "")
    .replace(/ /g, "-");
}

/** The plain text of an inline-HTML fragment — the heading as the reader sees
 * it. Tags go, and the five entities marked emits are decoded, so
 * `Verdict — **partial**` slugs from the visible words rather than its
 * markup. */
export function plainTextFromHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/** Raw HTML rendered as its own source text (rule 4). */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** What a doc link points at, once measured against the published set.
 *
 * `doc` and `anchor` keep a real `href` (the markdown the link names) so a
 * modifier-click still opens the source in a new tab, exactly like the study
 * triggers do; a plain click is handled in the reader instead. */
export type DocLink =
  | { kind: "doc"; num: string; href: string }
  | { kind: "anchor"; slug: string; href: string }
  | { kind: "external"; href: string }
  | { kind: "plain" };

const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/** Resolve a relative href against the directory holding `fromPath`, without a
 * DOM: the URL parser does the `..`/`.` work, and the leading slash comes off
 * so the result matches the site-relative shape DOCS paths have. */
function resolveDocPath(fromPath: string, href: string): string {
  const from = new URL(fromPath, "https://doc.invalid/");
  return new URL(href, from).pathname.replace(/^\//, "");
}

/** The doc number published at `path`, or null. */
function publishedDoc(path: string): string | null {
  for (const [num, doc] of Object.entries(DOCS)) {
    if (doc.path === path) return num;
  }
  return null;
}

/** Measure a markdown href against the published docs (rule 3). A fragment
 * stays an in-document anchor; an absolute/scheme URL is external; anything
 * else resolves against the current doc's directory and either names a
 * published doc or is not a link we can honour.
 *
 * A `#fragment` on a doc-to-doc link is dropped: no doc uses one today, and
 * the reader has no cross-document scroll (see StudyModal). */
export function classifyDocLink(href: string, fromPath: string): DocLink {
  const raw = href.trim();
  if (raw.startsWith("#")) {
    return { kind: "anchor", slug: raw.slice(1), href: `${fromPath}${raw}` };
  }
  if (raw.startsWith("//") || SCHEME.test(raw)) return { kind: "external", href: raw };
  const target = raw.startsWith("/") ? raw.slice(1) : resolveDocPath(fromPath, raw.split("#")[0]);
  const num = publishedDoc(target);
  if (num) return { kind: "doc", num, href: DOCS[num].path };
  return { kind: "plain" };
}

/** The marked renderer for one document: rules 1-4 bound to `fromPath` (link
 * targets resolve relative to it) with a per-document slug counter, so
 * repeated headings get GFM's `-1`/`-2` suffixes. */
export function docRenderer(fromPath: string): RendererObject {
  const seen = new Map<string, number>();
  const uniqueSlug = (text: string): string => {
    const base = slugify(text);
    const n = seen.get(base);
    seen.set(base, (n ?? 0) + 1);
    return n === undefined ? base : `${base}-${n}`;
  };
  return {
    heading(token: Tokens.Heading) {
      const inner = this.parser.parseInline(token.tokens);
      return `<h${token.depth} id="${uniqueSlug(plainTextFromHtml(inner))}">${inner}</h${token.depth}>\n`;
    },
    link(token: Tokens.Link) {
      const inner = this.parser.parseInline(token.tokens);
      const title = token.title ? ` title="${escapeHtml(token.title)}"` : "";
      const link = classifyDocLink(token.href, fromPath);
      switch (link.kind) {
        case "doc":
          return `<a href="${link.href}" data-doc="${link.num}"${title}>${inner}</a>`;
        case "anchor":
          return `<a href="${link.href}" data-anchor="${link.slug}"${title}>${inner}</a>`;
        case "external":
          return `<a href="${link.href}" target="_blank" rel="noopener noreferrer"${title}>${inner}</a>`;
        case "plain":
          return inner;
      }
    },
    html(token: Tokens.HTML | Tokens.Tag) {
      return escapeHtml(token.text);
    },
  };
}

/** The doc without its own leading H1 (rule 1). Only the first non-blank line
 * is considered, so an H1 further down — a doc using `#` as a section level —
 * is left alone. */
export function stripDocTitle(markdown: string): string {
  const lines = markdown.split("\n");
  const first = lines.findIndex((line) => line.trim() !== "");
  if (first >= 0 && lines[first].startsWith("# ")) lines.splice(first, 1);
  return lines.join("\n");
}

let markedModule: Promise<typeof import("marked")> | null = null;

/** Render one doc's markdown to HTML (rules 1-4 above). An isolated Marked
 * instance per call: `marked.use` mutates global state, and each document
 * needs its own slug counter. */
export async function renderDocMarkdown(markdown: string, fromPath: string): Promise<string> {
  markedModule ??= import("marked");
  const { Marked } = await markedModule;
  const parser = new Marked({ gfm: true, renderer: docRenderer(fromPath) });
  return parser.parse(stripDocTitle(markdown));
}
