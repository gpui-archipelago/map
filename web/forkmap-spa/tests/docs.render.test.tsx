// T-39 — the documents index (#/docs) render parity.
//
// The reader's own page, and the deep link the rest of the suite cites
// (#/docs?doc=07). Asserted here: every published document is listed and
// linked, a doc param opens the reader on that document (the padded and bare
// forms both), a param naming nothing published opens nothing, and the route
// parses. The reader's own behaviour lives in study.render.test.tsx /
// markdown.test.ts; the served artifact is checked by smoke.py.

import { describe, expect, test } from "bun:test";
import { renderToString } from "react-dom/server";
import { createElement } from "react";
import { DOCS } from "../src/content/docs";
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

describe("the documents index (#/docs)", () => {
  test("it lists every published document, each row a padded #/docs?doc= link", () => {
    const html = render({});
    expect(html).toContain('id="view-docs"');
    expect(html).toContain('id="docs-list"');
    // closed by default: no reader over the index
    expect(html).not.toContain('role="dialog"');
    for (const num of Object.keys(DOCS)) {
      const padded = num.padStart(2, "0");
      expect(html, `doc ${num} row`).toContain(`id="docs-row-${num}"`);
      expect(html, `doc ${num} title`).toContain(DOCS[num].title);
      expect(html, `doc ${num} href`).toContain(`href="#/docs?doc=${padded}"`);
      expect(html, `doc ${num} source path`).toContain(DOCS[num].path);
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
    expect(html).toContain('id="docs-list"');
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
      expect(html, `doc=${bad} list`).toContain('id="docs-list"');
      expect(html, `doc=${bad} no dialog`).not.toContain('role="dialog"');
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
