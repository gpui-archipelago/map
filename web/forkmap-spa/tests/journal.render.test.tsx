// T-39 — Journal view render parity (increment 3 / increment 4).
//
// Renders the actual JournalView (react-dom/server over the committed boot
// manifest + the export-derived corpus data — the same logical data the
// runtime resolves via the data-access layer, T-33 increment 4) and asserts
// the rendered markup: the stream select + hint, per-release entries whose
// je-vers links open the same-stream diff in Changes, the deep-link anchors +
// flags + compile badges + metas, the measured-story lines (first / identical
// measured surface / counts), the journal-honesty disclosure + honest-rule
// ids, and every journal-* id app.js binds in the DOM output.

import { describe, expect, test } from "bun:test";
import { renderToString } from "react-dom/server";
import { createElement } from "react";
import { JournalView } from "../src/views/JournalView";
import { loadCorpusData, loadManifest } from "./fixtures/corpus-fixtures";
import { STATIC_RENDERER_IDS } from "./fixtures/static-renderer-ids";

const manifest = loadManifest();
const { data } = loadCorpusData();

function renderJournal(params: Record<string, string>): string {
  return renderToString(createElement(JournalView, { manifest, data, params }));
}

describe("Journal view renders the stream feed (server render)", () => {
  test("the kael stream renders its entries with counts and deep links (0.2.0 story)", () => {
    const html = renderJournal({ s: "kael" });
    expect(html).toContain('id="view-journal"');
    // hint names the filtered stream
    expect(html).toContain(`1 stream · ${manifest.providers.find((p) => p.id === "kael")!.versions.length} releases, oldest-recorded first.`);
    // the 0.2.0 entry exists with its deep-link anchor
    expect(html).toContain('id="journal-entry-kael-0.2.0"');
    expect(html).toContain('href="#/journal?s=kael&amp;v=0.2.0"');
    // its je-vers opens the same-stream diff 0.1.2 → 0.2.0 in Changes
    expect(html).toContain('href="#/changes?a=kael%3A0.1.2&amp;b=kael%3A0.2.0"');
    // story counts vs the previous published release — from the per-release
    // facts the view renders (the export-precomputed diff counts).
    const kaelFacts = data.streams.find((s) => s.id === "kael")!.facts;
    const c = kaelFacts.find((f) => f.vers === "0.2.0")!.counts!;
    const total = c.rm + c.ad + c.rs;
    expect(html).toContain(`vs 0.1.2: `);
    if (c.rm) expect(html).toContain(`${c.rm} removed`);
    if (c.ad) expect(html).toContain(`${c.ad} added`);
    if (c.rs) expect(html).toContain(`${c.rs} re-signed`);
    // the item rows stay collapsed until expand (no je-items yet)
    expect(html).toContain(`show item rows (${total})`);
    expect(html).not.toContain('class="je-items"');
  });

  test("the same-fork feed only renders the filtered stream", () => {
    const html = renderJournal({ s: "kael" });
    expect(html).toContain(">kael (kael)</option>");
    expect(html).not.toContain("1.18.1");
    // other providers are still options in the select
    for (const p of manifest.providers) {
      expect(html).toContain(`>${p.id} (${p.package})</option>`);
    }
  });

  test("all-streams renders every stream with the bundle hint", () => {
    const html = renderJournal({});
    const nvers = manifest.providers.reduce((n, p) => n + p.versions.length, 0);
    expect(html).toContain(`All ${manifest.providers.length} streams · ${nvers} releases, oldest-recorded first.`);
    for (const p of manifest.providers) {
      expect(html).toContain(`<strong class="stream-name">${p.id}</strong>`);
    }
  });

  test("exact-copy and first-release stories render their honest lines", () => {
    const html = renderJournal({ s: "kael" });
    // 0.1.1 is the first recorded release (no self-diff link)
    expect(html).toContain("first recorded release of this stream");
    expect(html).toContain('id="journal-entry-kael-0.1.1"');
    // 0.1.1 → 0.1.2 carries the identical measured surface
    expect(html).toContain("identical measured surface to 0.1.1 — a within-stream exact-copy republish");
  });

  test("a flagged release renders its flag and the meta line carries the measured count", () => {
    const html = renderJournal({ s: "gpui" });
    expect(html).toContain('id="journal-entry-gpui-0.1.0-test"');
    expect(html).toContain("yanked · pre-release");
    expect(html).toContain("0 item records (measured empty)");
  });

  test("compile-verified entries render the RULE-5 badge with its evidence link", () => {
    const html = renderJournal({ s: "kael" });
    expect(html).toContain("compile-verified · rustc 1.97.1");
    expect(html).toContain("docs/04-user-docs/07-real-fork-compile-case-study.md");
    expect(html).toContain('id="journal-entry-kael-0.4.1"');
  });

  test("the journal honesty disclosure + honest-rule ids + every static-renderer-bound journal-* id exist", () => {
    const html = renderJournal({ s: "kael" });
    expect(html).toContain("Journal honesty specifics");
    expect(html).toContain("never interleaved by time across forks");
    for (let n = 1; n <= 7; n++) {
      expect(html, `honest-rule-${n}`).toContain(`id="honest-rule-${n}"`);
    }
    // The bound-id contract is the frozen snapshot of the retired static
    // renderer (tests/fixtures/static-renderer-ids.ts, T-39 increment 6).
    const boundIds = new Set<string>(STATIC_RENDERER_IDS.journal);
    for (const id of boundIds) {
      expect(html, `rendered id "${id}"`).toContain(`id="${id}"`);
    }
  });
});

describe("Journal view diff bases follow branches, not publish history", () => {
  test("uno 1.18.1 (a 1.18 backport published after 1.19.0-pre) diffs against 1.18.0, never the preview", () => {
    const html = renderJournal({ s: "gpui-unofficial" });
    // 1.18.1's branch predecessor is the previous *stable*, 1.18.0 — not its
    // raw publish predecessor, the preview 1.19.0-pre.
    expect(html).toContain('href="#/changes?a=gpui-unofficial%3A1.18.0&amp;b=gpui-unofficial%3A1.18.1"');
    expect(html).not.toContain('a=gpui-unofficial%3A1.19.0-pre&amp;b=gpui-unofficial%3A1.18.1');
    // And the story line names the stable base.
    expect(html).toContain(">vs 1.18.0: ");
    expect(html).not.toContain(">vs 1.19.0-pre: ");
  });

  test("uno 1.18.0 (stable) is diffed against the prior stable 1.17.2, not its byte-identical preview", () => {
    const html = renderJournal({ s: "gpui-unofficial" });
    expect(html).toContain('href="#/changes?a=gpui-unofficial%3A1.17.2&amp;b=gpui-unofficial%3A1.18.0"');
    expect(html).not.toContain('a=gpui-unofficial%3A1.18.0-pre&amp;b=gpui-unofficial%3A1.18.0');
  });

  test("a preview still diffs against the newest stable before it (its cut line)", () => {
    const html = renderJournal({ s: "gpui-unofficial" });
    // 1.19.0-pre previews 1.19; the line it was cut from is the newest stable
    // published before it, 1.18.0.
    expect(html).toContain('href="#/changes?a=gpui-unofficial%3A1.18.0&amp;b=gpui-unofficial%3A1.19.0-pre"');
    expect(html).toContain(">vs 1.18.0: ");
  });
});
