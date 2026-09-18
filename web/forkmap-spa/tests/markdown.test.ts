// T-39 — the doc reader's markdown rules (src/study/markdown.ts).
//
// The reader fetches each doc's own markdown at runtime and renders it. These
// tests hold the four rules that keep the rendered doc honest and
// self-contained: the doc's own H1 is dropped, headings get GFM slug ids (so
// the docs' cross-references resolve), links are measured against the
// published set (never a dead link), and raw HTML is escaped rather than
// interpreted.
//
// Asserted against the real docs where the real corpus is the point (the
// truncated anchors doc 08 ships, the unpublished targets docs 07/10 point at)
// and against synthetic input where it has no example.

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DOCS } from "../src/content/docs";
import {
  classifyDocLink,
  escapeHtml,
  plainTextFromHtml,
  renderDocMarkdown,
  slugify,
  stripDocTitle,
} from "../src/study/markdown";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..", ".."); // repo root (tests/ -> web/forkmap-spa -> web -> root)

const DOC_07 = DOCS["7"].path;
const DOC_08 = DOCS["8"].path;
const DOC_10 = DOCS["10"].path;
const DOC_12 = DOCS["12"].path;

function docMarkdown(num: string): string {
  return readFileSync(join(REPO, DOCS[num].path), "utf8");
}

describe("slugify / plainTextFromHtml / escapeHtml (the pure rules)", () => {
  test("slugify is GFM's rule: lowercase, punctuation dropped, spaces → hyphens", () => {
    expect(slugify("Question")).toBe("question");
    expect(slugify("platform_companion")).toBe("platform_companion"); // underscores survive
    expect(slugify("T-26 resolution (2026-09-07) — item-model v2: methods are checkable")).toBe(
      "t-26-resolution-2026-09-07--item-model-v2-methods-are-checkable",
    );
  });

  test("plainTextFromHtml reads the heading as the reader sees it", () => {
    expect(plainTextFromHtml("Verdict — <strong>partial</strong> → <code>resolved</code>")).toBe(
      "Verdict — partial → resolved",
    );
    expect(plainTextFromHtml("the task&#39;s note")).toBe("the task's note");
    expect(plainTextFromHtml("a &amp; b")).toBe("a & b");
  });

  test("escapeHtml renders markup as its own source text", () => {
    expect(escapeHtml('<script src="x">&</script>')).toBe(
      "&lt;script src=&quot;x&quot;&gt;&amp;&lt;/script&gt;",
    );
  });

  test("stripDocTitle drops only a leading H1", () => {
    expect(stripDocTitle("# 13 — Two UI kits running on one underlying engine\n\nlead\n")).toBe("\nlead\n");
    expect(stripDocTitle("intro\n\n# a late H1\n")).toBe("intro\n\n# a late H1\n");
  });
});

describe("classifyDocLink (every link measured against the published set)", () => {
  test("a sibling doc resolves relatively and by its ../04-user-docs/ form", () => {
    expect(classifyDocLink("11-using-third-party-ui-kits-with-alternative-gpui-forks.md", DOC_12)).toEqual({
      kind: "doc",
      num: "11",
      href: DOCS["11"].path,
    });
    expect(
      classifyDocLink("../04-user-docs/11-using-third-party-ui-kits-with-alternative-gpui-forks.md", DOC_12),
    ).toEqual({
      kind: "doc",
      num: "11",
      href: DOCS["11"].path,
    });
  });

  test("targets this mirror does not carry are not links at all", () => {
    // the two the real docs ship: doc 07's task pointer and doc 10's doc 14
    expect(classifyDocLink("../../tasks/archive/T-17-platform-companion-binding.md", DOC_07)).toEqual({
      kind: "plain",
    });
    expect(classifyDocLink("../04-user-docs/14-temporal-stability-loop.md", DOC_10)).toEqual({ kind: "plain" });
  });

  test("an in-doc anchor keeps the doc's own markdown as its href", () => {
    expect(classifyDocLink("#t-26-resolution-2026-09-07", DOC_08)).toEqual({
      kind: "anchor",
      slug: "t-26-resolution-2026-09-07",
      href: `${DOC_08}#t-26-resolution-2026-09-07`,
    });
  });

  test("http(s) and scheme URLs are external", () => {
    expect(classifyDocLink("https://github.com/gpui-archipelago/map", DOC_07)).toEqual({
      kind: "external",
      href: "https://github.com/gpui-archipelago/map",
    });
    expect(classifyDocLink("mailto:x@y.z", DOC_07)).toEqual({ kind: "external", href: "mailto:x@y.z" });
  });
});

describe("renderDocMarkdown (the four rules over marked)", () => {
  test("GFM tables and fenced code come out as stylable HTML", async () => {
    const html = await renderDocMarkdown(
      "| Config | Result |\n|---|---|\n| a | ✓ |\n\n```toml\nx = 1\n```\n",
      DOC_12,
    );
    expect(html).toContain("<table>");
    expect(html).toContain("<th>Config</th>");
    expect(html).toContain("✓");
    expect(html).toContain('<code class="language-toml">');
  });

  test("the doc's own H1 is dropped (the dialog title is the only title)", async () => {
    // The rule, on synthetic input: the first H1 goes, the rest stays.
    const html = await renderDocMarkdown(
      "# 13 — Field note\n\n## The setup\n\nbody\n",
      DOCS["13"].path,
    );
    expect(html).not.toContain("<h1");
    expect(html).toContain('<h2 id="the-setup">');
    // …and no published doc leaks an H1 into the reader.
    for (const num of Object.keys(DOCS)) {
      const doc = await renderDocMarkdown(docMarkdown(num), DOCS[num].path);
      expect(doc, `doc ${num} renders no H1`).not.toContain("<h1");
    }
  });

  test("every heading gets a slug id, deduped the GFM way", async () => {
    const html = await renderDocMarkdown("## Same\n\n## Same\n", DOC_07);
    expect(html).toContain('id="same"');
    expect(html).toContain('id="same-1"');
  });

  test("an in-doc anchor whose slug is only a prefix still lands (the reader's fallback)", async () => {
    // The reader matches an anchor exactly first, then by prefix
    // (StudyModal.scrollToAnchor) — a safety net for a doc whose anchor is
    // truncated. Exercised synthetically, so the rule has a test that does not
    // depend on any one doc's headings (the corpus used to ship two truncated
    // anchors; the authoring pass removed them).
    const html = await renderDocMarkdown(
      "## T-26 resolution (2026-09-07) — item-model v2: methods are checkable\n",
      DOCS["8"].path,
    );
    const ids = [...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
    expect(ids).toEqual(["t-26-resolution-2026-09-07--item-model-v2-methods-are-checkable"]);
    expect(ids[0]).not.toBe("t-26-resolution-2026-09-07"); // no exact match…
    expect(ids[0].startsWith("t-26-resolution-2026-09-07")).toBe(true); // …but the prefix matches
  });

  test("every in-doc anchor in the published docs resolves exactly", async () => {
    // A guard on the corpus: the prefix fallback above is a safety net, not
    // something a published doc should need. No doc ships an in-doc anchor
    // today, so this is silent until one does — and then it has to be exact.
    for (const num of Object.keys(DOCS)) {
      const html = await renderDocMarkdown(docMarkdown(num), DOCS[num].path);
      const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
      for (const anchor of html.matchAll(/data-anchor="([^"]+)"/g)) {
        expect(ids.has(anchor[1]), `doc ${num}: #${anchor[1]} has an exact heading`).toBe(true);
      }
    }
  });

  test("every relative .md link in the published docs resolves to a published doc", () => {
    // The other half of the same guard, on the corpus rather than the
    // renderer: the docs used to ship dead pointers (a task file, an
    // unpublished doc 14). A dead relative link degrades to plain text in the
    // reader — silently lost rather than broken — so it is caught here.
    for (const num of Object.keys(DOCS)) {
      for (const m of docMarkdown(num).matchAll(/\]\(([^)\s]*\.md)(?:#[^)]*)?\)/g)) {
        const href = m[1];
        if (/^[a-z][a-z0-9+.-]*:/i.test(href)) continue; // an external URL
        expect(classifyDocLink(href, DOCS[num].path).kind, `doc ${num}: ${href}`).toBe("doc");
      }
    }
  });

  test("a doc-to-doc link becomes an in-reader jump keeping its markdown href", async () => {
    const html = await renderDocMarkdown(
      "see [doc 11](11-using-third-party-ui-kits-with-alternative-gpui-forks.md)",
      DOC_12,
    );
    expect(html).toContain(`href="${DOCS["11"].path}"`);
    expect(html).toContain('data-doc="11"');
  });

  test("an unpublished target renders as text, never as a link", async () => {
    const html = await renderDocMarkdown(
      "filed as [T-17](../../tasks/archive/T-17-platform-companion-binding.md) and [doc 14](../04-user-docs/14-temporal-stability-loop.md)",
      DOC_07,
    );
    expect(html).not.toContain("<a ");
    expect(html).toContain("T-17");
    expect(html).toContain("doc 14");
  });

  test("an external link opens in a new tab", async () => {
    const html = await renderDocMarkdown("[crates.io](https://crates.io/crates/gpui)", DOC_07);
    expect(html).toContain('href="https://crates.io/crates/gpui"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  test("raw HTML is escaped, never interpreted", async () => {
    const html = await renderDocMarkdown(
      "<script>alert(1)</script>\n\ntext <img src=x onerror=y>\n",
      DOC_07,
    );
    // The markup survives as its own source text and no element is ever
    // created — the `onerror=` inside the escaped text is inert.
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("&lt;img src=x onerror=y&gt;");
  });

  test("every link in every real doc is one the reader can honour", async () => {
    // The whole published set: each href is either an external URL or a
    // published doc — never a relative .md the mirror does not carry (the
    // reader has no way to render one, and it would 404 in the artifact).
    for (const num of Object.keys(DOCS)) {
      const html = await renderDocMarkdown(docMarkdown(num), DOCS[num].path);
      for (const m of html.matchAll(/<a href="([^"]*)"/g)) {
        const href = m[1];
        const published = Object.values(DOCS).some((d) => href === d.path);
        const anchorInDoc = href.startsWith(`${DOCS[num].path}#`);
        expect(published || anchorInDoc || href.startsWith("http"), `doc ${num} → ${href}`).toBe(true);
      }
    }
  });

  test("each real doc renders a body with headings and no leftover markdown title", async () => {
    for (const num of Object.keys(DOCS)) {
      const html = await renderDocMarkdown(docMarkdown(num), DOCS[num].path);
      expect(html, `doc ${num} headings`).toContain("<h2");
      expect(html.length, `doc ${num} body length`).toBeGreaterThan(2000);
    }
  });
});
