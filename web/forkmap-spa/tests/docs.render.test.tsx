// T-39 — the documents index (#/docs) render parity.
//
// The reader's own page, and the deep link the rest of the suite cites
// (#/docs?doc=07). Asserted here: every published document has a row — its
// topic and source path, its status, and the claim and points the index
// annotates it with — a doc param opens the reader on that document (the
// padded and bare forms both), and a param naming nothing published opens
// nothing. The annotations are asserted *from the data* (DOC_INDEX), never as
// pinned prose, so rewriting the docs does not have to touch this file. The
// reader's own behaviour lives in study.render.test.tsx / markdown.test.ts;
// the served artifact is checked by smoke.py.

import { describe, expect, test } from "bun:test";
import { renderToString } from "react-dom/server";
import { createElement } from "react";
import { DOCS, docTopic } from "../src/content/docs";
import { DOC_INDEX, SUITE_TAKEAWAYS } from "../src/content/docIndex";
import { parseHash } from "../src/routing";
import { STUDY_EXCERPTS } from "../src/study/study-excerpts";
import { DocsIndexView } from "../src/views/DocsIndexView";

const render = (params: Record<string, string>) =>
  renderToString(createElement(DocsIndexView, { params }));

/** react-dom/server escapes text content (&quot;/&amp;/&#x27;/&lt;/&gt;) — decode so
 * assertions read like the rendered page (the excerpt carries quotes). */
function text(html: string): string {
  return html
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x27;/g, "'");
}

/** The page's text: tags and react's node separators dropped, entities decoded.
 * The index's prose is plain text with `backticked` identifiers the view renders
 * as <code>, so a point reads continuously once the tags are gone. */
function plain(html: string): string {
  return text(html.replace(/<!--[\s\S]*?-->/g, "").replace(/<[^>]+>/g, ""));
}

const unbacktick = (s: string) => s.replace(/`/g, "");

describe("the documents index (#/docs)", () => {
  test("it lists every published document, each row a padded #/docs?doc= link", () => {
    const html = render({});
    expect(html).toContain('id="view-docs"');
    expect(html).toContain('id="docs-index"');
    // closed by default: no reader over the index
    expect(html).not.toContain('role="dialog"');
    for (const num of Object.keys(DOCS)) {
      const padded = num.padStart(2, "0");
      expect(html, `doc ${num} row`).toContain(`id="docs-row-${num}"`);
      expect(plain(html), `doc ${num} topic`).toContain(docTopic(num));
      expect(html, `doc ${num} href`).toContain(`href="#/docs?doc=${padded}"`);
      expect(html, `doc ${num} source path`).toContain(DOCS[num].path);
    }
  });

  test("every row is annotated with its status, claim and points (from the data)", () => {
    const html = render({});
    const page = plain(html);
    for (const num of Object.keys(DOCS)) {
      const entry = DOC_INDEX[num];
      expect(entry, `doc ${num} has an index entry`).toBeDefined();
      expect(page, `doc ${num} status`).toContain(entry.status);
      if (entry.note) expect(page, `doc ${num} status note`).toContain(entry.note);
      expect(page, `doc ${num} finding`).toContain(unbacktick(entry.finding));
      for (const point of entry.points) {
        expect(page, `doc ${num} point`).toContain(unbacktick(point));
      }
    }
  });

  test("the suite-wide takeaways render under the table", () => {
    const html = render({});
    expect(html).toContain('id="docs-suite"');
    const page = plain(html);
    for (const takeaway of SUITE_TAKEAWAYS) {
      expect(page, `suite: ${takeaway.title}`).toContain(takeaway.title);
      expect(page, `suite body: ${takeaway.title}`).toContain(unbacktick(takeaway.body));
    }
  });

  test("every row is a linkable href, so a document has a URL", () => {
    const html = render({});
    const links = [...html.matchAll(/href="#\/docs\?doc=(\d+)"/g)].map((m) => m[1]);
    expect(links.length).toBe(Object.keys(DOCS).length);
    expect(new Set(links).size).toBe(links.length); // no duplicates
  });

  test("?doc=07 opens the reader on that document (the site's cited link)", () => {
    const html = text(render({ doc: "07" }));
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('data-doc="7"');
    expect(html).toContain(DOCS["7"].title);
    // the pre-fetch layer is the doc's own opening excerpt
    expect(html).toContain(STUDY_EXCERPTS["7"]);
    // …and the index is still behind it
    expect(html).toContain('id="docs-index"');
  });

  test("the bare form resolves too (#/docs?doc=7), and the open row is marked", () => {
    const html = render({ doc: "7" });
    expect(html).toContain('data-doc="7"');
    expect(html).toContain('aria-current="true"');
  });

  test("a param naming nothing published opens nothing (the index still renders)", () => {
    for (const bad of ["99", "0", "cli", "-1", "", "seven"]) {
      const html = render({ doc: bad });
      expect(html, `doc=${bad} title`).toContain("Documents");
      expect(html, `doc=${bad} table`).toContain('id="docs-index"');
      expect(html, `doc=${bad} no dialog`).not.toContain('role="dialog"');
    }
  });
});

describe("the index data", () => {
  test("covers exactly the published set", () => {
    expect(Object.keys(DOC_INDEX).sort((a, b) => Number(a) - Number(b))).toEqual(
      Object.keys(DOCS).sort((a, b) => Number(a) - Number(b)),
    );
  });

  test("every entry carries a status, a claim and at least one point", () => {
    for (const [num, entry] of Object.entries(DOC_INDEX)) {
      expect(entry.status, `doc ${num} status`).not.toBe("");
      expect(entry.finding, `doc ${num} finding`).not.toBe("");
      expect(entry.points.length, `doc ${num} points`).toBeGreaterThan(0);
    }
  });
});

describe("the route", () => {
  test("#/docs parses to the docs view, with and without a doc param", () => {
    expect(parseHash("/docs")).toEqual({ view: "docs", params: {} });
    expect(parseHash("/docs?doc=07")).toEqual({ view: "docs", params: { doc: "07" } });
    expect(parseHash("/docs?doc=7")).toEqual({ view: "docs", params: { doc: "7" } });
  });
});
