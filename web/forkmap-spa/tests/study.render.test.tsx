// T-39 — study-reader render parity (increment 5; design decision (a)-lite).
//
// Renders the actual study surfaces over the committed bundle and asserts the
// reader's SSR shape: the open dialog's structure (role/aria, ids, the
// verbatim excerpt, the outbound full-doc link + close), the trigger
// affordance on the five study doc rows (aria-haspopup="dialog" on AboutNote,
// the Landing doc rows + compile-badge/kit-probe evidence, the Alignment docs
// panel, the Configure RULE-5 evidence), and that non-study doc links stay
// plain outbound anchors. Interaction (click → open, Escape, focus
// round-trip) is exercised by the manual by-ear/keyboard pass recorded in the
// T-39 task Outcome; the smoke covers the affordance on the built artifact.

import { describe, expect, test } from "bun:test";
import { renderToString } from "react-dom/server";
import { createElement } from "react";
import { validateAlignIndex, validateManifest } from "../src/bundle/validate";
import type { ForkmapManifest } from "../src/bundle/types";
import { AboutNote } from "../src/components/AboutNote";
import { DocLink } from "../src/components/common";
import { StudyModal } from "../src/components/StudyModal";
import { StudyDocLink } from "../src/components/StudyDocLink";
import { DOCS, STUDY_DOC_NUMBERS } from "../src/content/docs";
import { resolveConfigured } from "../src/bundle/configure";
import { STUDY_EXCERPTS } from "../src/study/study-excerpts";
import { AlignmentView } from "../src/views/AlignmentView";
import { ConfigureView } from "../src/views/ConfigureView";
import { LandingView } from "../src/views/LandingView";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
// T-33: Landing + Configure render from the committed boot manifest and the
// Alignment view from the alignment item index — the same files the served
// app loads (metadata + export-precomputed counts + the type-ahead key list;
// the full bundle stays for the Changes/Journal views).
const MANIFEST_PATH = join(HERE, "..", "..", "forkmap", "data", "forkmap-manifest.json");
const ALIGN_INDEX_PATH = join(HERE, "..", "..", "forkmap", "data", "forkmap-align-index.json");

const manifest: ForkmapManifest = validateManifest(JSON.parse(readFileSync(MANIFEST_PATH, "utf8")));
const alignIndex = validateAlignIndex(JSON.parse(readFileSync(ALIGN_INDEX_PATH, "utf8")));
const counts = manifest.counts;

/** react-dom/server escapes text content (&quot;/&amp;/&#x27;/&lt;/&gt;) — decode so
 * assertions read like the rendered page. */
function text(html: string): string {
  return html
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x27;/g, "'");
}

function occurrences(haystack: string, needle: string): number {
  let n = 0;
  let i = haystack.indexOf(needle);
  while (i >= 0) {
    n += 1;
    i = haystack.indexOf(needle, i + 1);
  }
  return n;
}

describe("the open study dialog (server render)", () => {
  test("doc 07 renders the dialog role, ids, the verbatim excerpt and the outbound link", () => {
    const href = DOCS["7"].path;
    const html = text(renderToString(createElement(StudyModal, { num: "7", href, onClose: () => {} })));
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('aria-labelledby="study-modal-title"');
    // The ids are asserted as literals (not via a template) so the coverage
    // tripwire in study.test.ts can find them in this file.
    expect(html).toContain('id="study-modal"');
    expect(html).toContain('id="study-modal-kicker"');
    expect(html).toContain('id="study-modal-title"');
    expect(html).toContain('id="study-modal-excerpt"');
    expect(html).toContain('id="study-modal-note"');
    expect(html).toContain('id="study-modal-open"');
    expect(html).toContain('id="study-modal-close"');
    expect(html).toContain("doc 7 · study excerpt");
    expect(html).toContain(DOCS["7"].title);
    // the excerpt is the doc's own opening (drift parity lives in study.test.ts)
    expect(html).toContain(STUDY_EXCERPTS["7"]);
    expect(html).toContain("never compiled");
    // the full-doc anchor keeps the trigger's own href; Close is a button
    expect(html).toContain(`href="${href}"`);
    expect(html).toContain("Read the full doc");
    expect(html).toContain(">Close</button>");
  });

  test("a modal for a doc outside the five is impossible (no excerpt → nothing renders)", () => {
    const html = renderToString(createElement(StudyModal, { num: "10", href: "#", onClose: () => {} }));
    expect(html).toBe("");
  });
});

describe("the trigger affordance (study links announce the dialog; others stay plain)", () => {
  test("AboutNote's five study rows announce the dialog and keep their hrefs", () => {
    const html = renderToString(createElement(AboutNote));
    expect(occurrences(html, 'aria-haspopup="dialog"')).toBe(STUDY_DOC_NUMBERS.length);
    for (const num of STUDY_DOC_NUMBERS) {
      expect(html, `doc ${num} title`).toContain(DOCS[String(num)].title);
      expect(html, `doc ${num} href`).toContain(`href="${DOCS[String(num)].path}"`);
    }
  });

  test("a non-study DocLink renders exactly the plain anchor it always did", () => {
    const html = renderToString(createElement(DocLink, { num: "10" }));
    expect(html).toBe(`<a class="doc" href="${DOCS["10"].path}">${DOCS["10"].title}</a>`);
    expect(html).not.toContain("aria-haspopup");
  });

  test("StudyDocLink keeps its class/href/text and announces only for study docs", () => {
    const study = text(renderToString(createElement(StudyDocLink, { num: 9 })));
    expect(study).toContain(`<a class="doc" href="${DOCS["9"].path}" aria-haspopup="dialog">`);
    expect(study).toContain(DOCS["9"].title);
    expect(study).not.toContain("study-dialog"); // closed: no modal markup server-side
    const custom = text(renderToString(createElement(StudyDocLink, { num: 7, href: "docs/x.md" })));
    expect(custom).toContain('href="docs/x.md"');
  });
});

describe("the views render their study triggers over the committed bundle", () => {
  test("Landing: doc rows + compile-badge and kit-probe evidence announce the dialog", () => {
    const html = text(renderToString(createElement(LandingView, { manifest, counts })));
    expect(html).toContain('id="landing-link-doc07"');
    expect(html).toContain('id="landing-link-doc12"');
    expect(html).toContain('id="landing-link-doc13"');
    expect(occurrences(html, 'aria-haspopup="dialog"')).toBeGreaterThanOrEqual(5);
    // every compile-verified badge links its doc-07 evidence (RULE-5); the
    // badge row has its own class, so the count is independent of how many
    // other study links point at the same doc
    const marked = manifest.providers.filter((p) => p.compile_verified);
    expect(marked.length).toBeGreaterThan(0);
    expect(occurrences(html, 'class="badge"')).toBe(marked.length);
    for (const p of marked) {
      const m = p.compile_verified!;
      expect(html, `${p.id} badge version`).toContain(`<span class="badge-vers">${m.vers}</span>`);
      expect(occurrences(html, `href="${m.evidence}"`), `${p.id} evidence link`).toBeGreaterThanOrEqual(1);
    }
    expect(html).toContain(DOCS["7"].title);
  });

  test("Alignment: the docs panel rows (08/09/12/13) announce the dialog", () => {
    const html = renderToString(createElement(AlignmentView, { manifest, alignIndex, params: {} }));
    expect(html).toContain('id="alignment-docs"');
    expect(html).toContain('id="alignment-docs-body"');
    expect(occurrences(html, 'aria-haspopup="dialog"')).toBeGreaterThanOrEqual(4);
    expect(html).toContain(`href="${DOCS["8"].path}"`);
    expect(html).toContain(`href="${DOCS["13"].path}"`);
  });

  test("Configure: the RULE-5 evidence links announce the dialog", () => {
    const m = resolveConfigured(manifest, {}).provider.compile_verified!;
    const html = text(renderToString(createElement(ConfigureView, { manifest, params: {} })));
    expect(html).toContain(`href="${m.evidence}"`);
    expect(html).toContain(DOCS["7"].title);
    expect(html).toContain('aria-haspopup="dialog"');
  });
});
