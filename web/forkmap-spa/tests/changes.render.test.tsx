// T-39 — Changes view render parity (increment 2 / increment 4).
//
// Renders the actual ChangesView component (react-dom/server over the
// committed boot manifest + the export-derived corpus data, with the compared
// pair's rows injected from the committed per-release files — the same
// logical data the runtime resolves via the data-access layer, T-33 increment
// 4) for the recorded-story deep links and asserts the rendered markup: the
// same-fork stories render the changelog glyph + their item rows, the
// cross-fork story renders the snapshot glyph, the identical pair renders
// the exact-copy panel without the filter drawer, a same-release hash renders
// the pick-a-different-releases hint, the pair steppers offer a step only
// where the stream has one, and the honest-rule ids + every changes-* id
// app.js binds exist in the DOM output of the view.

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
  test("recorded story: uno 1.16.3 → 1.17.2 renders the changelog word + removed frame rows", () => {
    const html = renderChanges({ a: "gpui-unofficial:1.16.3", b: "gpui-unofficial:1.17.2" });
    expect(html).toContain('id="view-changes"');
    expect(html).toContain("Changelog.");
    expect(html).toContain("Removed (");
    // The removed rows render their kind chips with measured identities.
    expect(html).toContain("profiler::record_frame_timing");
    expect(html).toContain("frame_trace_enabled");
    expect(html).not.toContain("Snapshot comparison.");
  });

  test("cross-fork story: ce 0.2.2 vs uno 1.18.1 renders the snapshot word, never a changelog (RULE-1)", () => {
    const html = renderChanges({ a: "gpui-ce:0.2.2", b: "gpui-unofficial:1.18.1" });
    expect(html).toContain("Snapshot comparison.");
    expect(html).not.toContain("Changelog.");
    expect(html).toContain("measured item differences");
  });

  test("the default pair (empty hash) renders a diffable default with the RULE-6 caption", () => {
    const html = renderChanges({});
    expect(html).toContain("Default pair —");
    expect(html).toContain("(rule 6: never a prerelease)");
    expect(html).toContain('id="changes-filter"');
    expect(html).toContain('id="changes-caption"');
  });

  test("the pair steppers walk one stream's own history, and only where there is one", () => {
    // gpui 0.2.1 → 0.2.2 is the default pair, mid-line: it can step back, but
    // it is the tip of that line, so there is nothing later to shift to.
    const mid = renderChanges({ a: "gpui:0.2.1", b: "gpui:0.2.2" });
    expect(mid).toContain('id="changes-step-prev"');
    expect(mid).toContain('id="changes-step-next"');
    expect(mid).not.toMatch(/id="changes-step-prev"[^>]*disabled/);
    expect(mid).toMatch(/id="changes-step-next"[^>]*disabled/);
    // The stream's first stable has no earlier pair to shift to (nor later).
    const first = renderChanges({ a: "gpui:0.1.0", b: "gpui:0.2.0" });
    expect(first).toMatch(/id="changes-step-prev"[^>]*disabled/);
    expect(first).not.toMatch(/id="changes-step-next"[^>]*disabled/);
    // A cross-fork pair has no shared lineage to walk: no steppers at all,
    // rather than a dead control row.
    const cross = renderChanges({ a: "gpui-ce:0.2.2", b: "gpui-unofficial:1.18.1" });
    expect(cross).not.toContain('id="changes-step-prev"');
    expect(cross).not.toContain('id="changes-step-next"');
  });

  test("a deep link without an unnamed-side fallback renders the linked caption", () => {
    const html = renderChanges({ a: "kael:0.2.0" });
    expect(html).toContain("Linked comparison — resolved from the deep link");
  });

  test("an exact-copy pair renders the identical panel and no filter drawer", () => {
    const html = renderChanges({ a: "gpui-unofficial:1.16.1", b: "gpui-unofficial:1.16.2" });
    expect(html).toContain("No measured item differences — these two releases carry the identical measured surface.");
    expect(html).not.toContain('id="changes-filter"');
  });

  test("a same-release hash renders the pick-a-different-releases hint", () => {
    const html = renderChanges({ a: "kael:0.2.0", b: "kael:0.2.0" });
    expect(html).toContain("Pick two different releases to diff.");
  });

  test("a same-fork pair renders the filter drawer collapsed and the count chips as switches", () => {
    const html = renderChanges({ a: "gpui-unofficial:1.16.3", b: "gpui-unofficial:1.17.2" });
    // The drawer keeps its id (the static renderer bound it) but starts hidden,
    // and the summary row's toggle is what opens it.
    expect(html).toMatch(/id="changes-filter"[^>]*hidden/);
    expect(html).toContain('id="changes-filter-toggle"');
    expect(html).toContain('aria-expanded="false"');
    // The three counts are pressable section switches, all shown by default.
    expect(html).toContain('class="count-chip count-removed"');
    expect(html).toContain('aria-pressed="true"');
    // No banner box: the delta's nature is the one word that names it on the
    // facts line, with the pair's counts and api hashes on that same line.
    expect(html).not.toContain("diff-kind-note");
    expect(html).toContain("diff-nature");
    expect(html).toContain("records (api ");
  });

  test("one package picker while both sides diff one fork, two when they do not", () => {
    // The common case: one package, two A/B badge anchors, one fork control.
    const one = renderChanges({ a: "gpui-unofficial:1.16.3", b: "gpui-unofficial:1.17.2" });
    expect(one).toContain(">package<");
    expect(one).toMatch(/id="changes-b-provider"[^>]*hidden/);
    expect(one).toContain('class="diff-marker mono"');
    expect(one).not.toContain('class="pair-side mono"');
    expect(one).toContain("⑂ Fork");
    // A cross-fork pair keeps both fork pickers (and the toggle says so).
    const two = renderChanges({ a: "gpui-ce:0.2.2", b: "gpui-unofficial:1.18.1" });
    expect(two).not.toMatch(/id="changes-b-provider"[^>]*hidden/);
    expect(two).toMatch(/id="changes-fork-scope"[^>]*aria-pressed="true"/);
  });

  test("the yanked/pre-release flags ride the release pickers", () => {
    // gpui 0.1.0-test is prerelease+yanked: its picker option must flag it.
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
