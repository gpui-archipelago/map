// T-39 — Changes view render parity (increment 2 / increment 4).
//
// Renders the actual ChangesView component (react-dom/server over the
// committed boot manifest + the export-derived corpus data, with the compared
// pair's rows injected from the committed per-release files — the same
// logical data the runtime resolves via the data-access layer, T-33 increment
// 4) for the recorded-story deep links and asserts the rendered markup: the
// same-fork stories render the changelog banner + their item rows, the
// cross-fork story renders the snapshot banner, the identical pair renders
// the exact-copy panel without the filter bar, a same-release hash renders
// the pick-a-different-releases hint, and the honest-rule ids + every
// changes-* id app.js binds exist in the DOM output of the view.

import { describe, expect, test } from "bun:test";
import { renderToString } from "react-dom/server";
import { createElement } from "react";
import { ChangesView } from "../src/views/ChangesView";
import { readyPair, readyPairFor } from "./fixtures/corpus-fixtures";
import { loadCorpusData, loadManifest } from "./fixtures/corpus-fixtures";
import { STATIC_RENDERER_IDS } from "./fixtures/static-renderer-ids";

const manifest = loadManifest();
const { data } = loadCorpusData();

function renderChanges(params: Record<string, string>): string {
  return renderToString(
    createElement(ChangesView, { manifest, data, params, pair: readyPairFor(manifest, params) }),
  );
}

describe("Changes view renders the recorded stories (server render)", () => {
  test("same-fork quick-link story: uno 1.16.3 → 1.17.2 renders the changelog banner + removed frame rows", () => {
    const html = renderChanges({ a: "gpui-unofficial:1.16.3", b: "gpui-unofficial:1.17.2" });
    expect(html).toContain('id="view-changes"');
    expect(html).toContain("Same-stream changelog.");
    expect(html).toContain("Removed (");
    // The removed rows render their kind chips with measured identities.
    expect(html).toContain("profiler::record_frame_timing");
    expect(html).toContain("frame_trace_enabled");
    expect(html).not.toContain("Snapshot difference — not a changelog.");
  });

  test("cross-fork story: ce 0.2.2 vs uno 1.18.1 renders the snapshot banner, never a changelog (RULE-1)", () => {
    const html = renderChanges({ a: "gpui-ce:0.2.2", b: "gpui-unofficial:1.18.1" });
    expect(html).toContain("Snapshot difference — not a changelog.");
    expect(html).not.toContain("Same-stream changelog.");
    expect(html).toContain("measured item differences between A and B");
  });

  test("the default pair (empty hash) renders a diffable default with the RULE-6 caption", () => {
    const html = renderChanges({});
    expect(html).toContain("Default pair —");
    expect(html).toContain("(rule 6: never a prerelease)");
    expect(html).toContain('id="changes-filter"');
    expect(html).toContain('id="changes-caption"');
  });

  test("the cross-fork quick link names uno on the B side (per-side forks, T-35)", () => {
    // Regression guard: the recorded story link must deep-link to ce 0.2.2 vs
    // uno 1.18.1 — stamping gpui-ce on B (the single-provider form) would
    // resolve to an unresolvable 1.18.1 and fall back to a same-release pair.
    const html = renderChanges({});
    expect(html).toContain("ce 0.2.2 vs uno 1.18.1 — cross-fork item-level comparison");
    expect(html).toContain("b=gpui-unofficial%3A1.18.1");
    expect(html).not.toContain("b=gpui-ce%3A1.18.1");
  });

  test("a deep link without an unnamed-side fallback renders the linked caption", () => {
    const html = renderChanges({ a: "kael:0.2.0" });
    expect(html).toContain("Linked comparison — resolved from the deep link");
  });

  test("an exact-copy pair renders the identical panel and hides the filter bar", () => {
    const html = renderChanges({ a: "gpui-unofficial:1.16.1", b: "gpui-unofficial:1.16.2" });
    expect(html).toContain("No measured item differences — these two releases carry the identical measured surface.");
    expect(html).not.toContain('id="changes-filter"');
  });

  test("a same-release hash renders the pick-a-different-releases hint", () => {
    const html = renderChanges({ a: "kael:0.2.0", b: "kael:0.2.0" });
    expect(html).toContain("Pick two different releases to diff.");
  });

  test("the yanked/pre-release flags ride the release chips and options", () => {
    // gpui 0.1.0-test is prerelease+yanked: the B release chip must flag it.
    const html = renderChanges({ a: "gpui:0.1.0", b: "gpui:0.1.0-test" });
    expect(html).toContain("(yanked, pre-release)");
  });

  test("honest-rule ids and every static-renderer-bound changes-* id exist in the rendered view", () => {
    const html = renderChanges({ a: "gpui-unofficial:1.16.3", b: "gpui-unofficial:1.17.2" });
    for (let n = 1; n <= 7; n++) {
      expect(html, `honest-rule-${n}`).toContain(`id="honest-rule-${n}"`);
    }
    // The bound-id contract is the frozen snapshot of the retired static
    // renderer (tests/fixtures/static-renderer-ids.ts, T-39 increment 6).
    const boundChangesIds = new Set<string>(STATIC_RENDERER_IDS.changes);
    for (const id of boundChangesIds) {
      expect(html, `rendered id "${id}"`).toContain(`id="${id}"`);
    }
  });
});

describe("Changes view's measured pairs come from the per-release files (T-33 increment 4)", () => {
  test("the injected pair's rows are the committed release files' own rows (blur's re-signature renders)", () => {
    const pair = readyPair(
      { provider: "gpui-unofficial", vers: "1.18.1" },
      { provider: "gpui-unofficial", vers: "1.19.0-pre" },
    );
    expect(pair.status).toBe("ready");
    const html = renderToString(
      createElement(ChangesView, {
        manifest,
        data,
        params: { a: "gpui-unofficial:1.18.1", b: "gpui-unofficial:1.19.0-pre" },
        pair,
      }),
    );
    // The re-signed blur row renders the measured before/after from the
    // release files' own resolved fn texts (no whole-file sidecar). React's
    // server render entity-encodes the `&` in the measured signatures.
    expect(html).toContain("fn Window::blur(&amp; mut self)");
    expect(html).toContain("fn Window::blur(&amp; mut self, &amp; mut App)");
  });
});
