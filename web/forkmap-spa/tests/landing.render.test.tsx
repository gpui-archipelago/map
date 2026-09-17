// T-54 — the landing / map overview.
//
// The page earns the tab's name: the six forks as ONE table (package,
// latest stable, releases, the latest stable's measured records,
// architecture, and the two actions a reader wants next), the four tools
// under the nav's own names, and one provenance card. Rendered over the
// committed bundle with the corpus facts injected — the same bytes the
// runtime hook resolves.

import { describe, expect, test } from "bun:test";
import { renderToString } from "react-dom/server";
import { createElement } from "react";
import { LandingView } from "../src/views/LandingView";
import type { CorpusData } from "../src/bundle/corpus";
import { loadCorpusData, loadManifest } from "./fixtures/corpus-fixtures";

const manifest = loadManifest();
const { data } = loadCorpusData();

const num = (v: number) => v.toLocaleString("en-US");

/** react-dom/server escapes text content (&quot;/&amp;/&#x27;/&lt;/&gt;) and separates
 * adjacent expressions with <!-- --> markers — decode/strip so assertions read
 * like the rendered page. */
function text(html: string): string {
  return html
    .replace(/<!-- -->/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x27;/g, "'");
}

function render(facts: CorpusData | null = data): string {
  return text(renderToString(createElement(LandingView, { manifest, data: facts })));
}

/** The latest stable's facts for one fork, from the injected corpus slice. */
function latestFacts(id: string) {
  const p = manifest.providers.find((x) => x.id === id)!;
  const f = data.streams.find((s) => s.id === id)?.facts.find((x) => x.vers === p.latest_stable);
  if (!f) throw new Error(`no facts for ${id} ${p.latest_stable}`);
  return f;
}

describe("the landing renders the forks, the tools and the provenance (server render)", () => {
  test("the hero states the map's premise without a second layer of throat-clearing", () => {
    const html = render();
    expect(html).toContain('id="view-landing"');
    expect(html).toContain("<h1>The GPUI fork map</h1>");
    expect(html).toContain("published on crates.io under six package names");
    // the eyebrow, the quote card and the duplicated stats strip are gone
    expect(html).not.toContain("hero-eyebrow");
    expect(html).not.toContain("hero-quote");
    expect(html).not.toContain('id="data-facts"');
  });

  test("one table carries every fork's latest stable, releases, measured items, architecture and actions", () => {
    const html = render();
    expect(html).toContain('id="fork-table"');
    for (const p of manifest.providers) {
      // the identity + the registry's own description
      expect(html).toContain(`<span class="fork-name mono">${p.id}</span>`);
      expect(html).toContain(`<span class="fork-desc">${p.description}</span>`);
      // latest stable + release count
      expect(html).toContain(`<span class="fork-vers mono">${p.latest_stable}</span>`);
      expect(html).toContain(`title="${p.versions.length} published releases on the registry">${p.versions.length}</td>`);
      // the measured items column reads the facts (RULE-7), never a guess
      const f = latestFacts(p.id);
      expect(html).toContain(`<td title="item records measured in ${p.latest_stable}">${num(f.n)}</td>`);
      // architecture: the dataset's own split marker + the companion package
      const c = p.platform_companion ?? null;
      expect(html).toContain(`<span class="arch-tag ${c ? "post" : "pre"} mono">${c ? "post-split" : "pre-split"}</span>`);
      if (c) expect(html).toContain(`<span class="fork-note mono">${c.package}</span>`);
      // both actions, pointed at this fork
      expect(html).toContain(`href="#/changes?p=${p.id}"`);
      expect(html).toContain(`href="#/configure?p=${p.id}"`);
    }
    // the table's kicker counts the corpus's own release flags
    const pre = manifest.providers.reduce((n, p) => n + p.versions.filter((v) => v.prerelease).length, 0);
    const yanked = manifest.providers.reduce((n, p) => n + p.versions.filter((v) => v.yanked).length, 0);
    expect(html).toContain(`${manifest.counts.versions} releases · ${pre} pre-release · ${yanked} yanked`);
  });

  test("before the facts land the items column says so — never a fabricated number", () => {
    const html = render(null);
    expect(html).toContain('title="the measured facts are still loading">…</td>');
    expect(html).not.toContain(num(latestFacts("gpui").n));
  });

  test("an unmeasured latest stable reads not measured, not zero (RULE-4)", () => {
    const empty: CorpusData = {
      datasetSchema: data.datasetSchema,
      datasetSyncedAt: data.datasetSyncedAt,
      streams: data.streams.map((s) => ({
        id: s.id,
        facts: s.facts.map((f) => ({ ...f, m: 0 as const, n: 0 })),
      })),
    };
    const html = render(empty);
    expect(html).toContain(">not measured</td>");
    expect(html).not.toContain(">0</td>");
  });

  test("the four tools wear the nav's own names", () => {
    const html = render();
    expect(html).toContain("Tools & workbenches");
    for (const [name, href, go] of [
      ["Changes", "#/changes", "Open Changes →"],
      ["Alignment", "#/alignment", "Search a symbol →"],
      ["Configure", "#/configure", "Scaffold a project →"],
      ["Journal", "#/journal", "Open the feed →"],
    ]) {
      expect(html).toContain(`<span class="card-title">${name}</span>`);
      expect(html).toContain(`<span class="card-go">${go}</span>`);
      expect(html).toContain(`href="${href}"`);
    }
    // …not the old second vocabulary
    expect(html).not.toContain("What changed");
    expect(html).not.toContain("Who carries it");
    expect(html).not.toContain("Release timeline");
  });

  test("the provenance card carries the sources, the evidence and the bundle", () => {
    const html = render();
    expect(html).toContain('id="landing-provenance"');
    expect(html).toContain('id="data-layers"');
    expect(html).toContain('id="compile-badges"');
    expect(html).toContain('id="kit-probes"');
    expect(html).toContain('id="data-bundle"');
    expect(html).toContain(`<code id="data-schema">${manifest.schema}</code>`);
    expect(html).toContain(manifest.dataset_synced_at!);
    expect(html).toContain('id="landing-link-doc07"');
    expect(html).toContain('id="landing-link-doc12"');
    expect(html).toContain('id="landing-link-doc13"');
    // every fork's compile evidence, and the two kit checks
    for (const p of manifest.providers) {
      const m = p.compile_verified!;
      expect(html).toContain(`<span class="badge-vers">${m.vers}</span>`);
      expect(html).toContain(`href="${m.evidence}"`);
    }
    for (const kp of manifest.kit_probes) expect(html).toContain(`${kp.kit} ${kp.kit_version}`);
    // the honesty rules are the same collapsed disclosure every view carries
    expect(html).toContain('id="landing-about"');
    for (let n = 1; n <= 7; n++) expect(html, `honest-rule-${n}`).toContain(`id="honest-rule-${n}"`);
  });
});
