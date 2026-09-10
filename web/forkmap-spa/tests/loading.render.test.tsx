// T-39 — boot-screen render tests (increment 2 UX fix): loading is a real
// intermediate state with byte progress, never the failure box. T-33: the
// boot phase loads the committed manifest; the same screen renders the lazy
// phases a Changes/Journal view (release-row data) or the Alignment view
// (item index, T-33 increment 5) triggers.

import { describe, expect, test } from "bun:test";
import { renderToString } from "react-dom/server";
import { createElement } from "react";
import { LoadingScreen } from "../src/components/LoadingScreen";
import type { LoadProgress } from "../src/bundle/useBundle";

function render(progress: LoadProgress, kind?: "boot" | "rows" | "alignment"): string {
  return renderToString(createElement(LoadingScreen, { progress, ...(kind ? { kind } : {}) }));
}

describe("LoadingScreen", () => {
  test("fetch phase with a Content-Length shows byte progress + a determinate bar", () => {
    const html = render({ phase: "fetch", loaded: 15_000_000, total: 33_500_000 });
    expect(html).toContain("15.0 of 33.5 MB");
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuenow="45"');
    expect(html).toContain("Loading the fork-map data…");
    expect(html).not.toContain("boot-fill-indeterminate");
    expect(html).toContain("this is not an error");
  });

  test("fetch phase without a Content-Length is an indeterminate bar (never a lie about %)", () => {
    const html = render({ phase: "fetch", loaded: 0, total: null });
    expect(html).toContain("Downloading the fork-map data…");
    expect(html).toContain("boot-fill-indeterminate");
    expect(html).not.toContain("aria-valuenow=");
  });

  test("parse and validate phases name what the page is doing", () => {
    expect(render({ phase: "parse", loaded: 33_500_000, total: 33_500_000 })).toContain(
      "Parsing the boot manifest JSON…",
    );
    expect(render({ phase: "validate", loaded: 33_500_000, total: 33_500_000 })).toContain(
      "Validating the committed boot manifest",
    );
  });

  test("a completed fetch never claims an error — the fatal box is a separate branch", () => {
    const html = render({ phase: "validate", loaded: 33_500_000, total: 33_500_000 });
    expect(html).not.toContain("could not render");
  });

  test("the rows kind renders the lazy release-row phase honestly (T-33 increment 4)", () => {
    const html = render({ phase: "fetch", loaded: 0, total: null }, "rows");
    expect(html).toContain("Loading the release-row data…");
    expect(html).toContain("Downloading the release-row data…");
    expect(html).toContain("per-release row data is loading");
    expect(html).toContain("boot-fill-indeterminate");
    expect(html).not.toContain("could not render");
    // The copy names the files actually fetched — and never the corpus whole
    // file (retired from the runtime fetch graph by increment 4).
    expect(html).toContain("forkmap-journal.json");
    expect(html).toContain("forkmap-release-*.json");
    expect(html).not.toContain("full-corpus");
    expect(render({ phase: "validate", loaded: 1, total: 1 }, "rows")).toContain(
      "Validating the release-row data (schemas gocar.forkmap.journal.v1 / gocar.forkmap.release.v1)",
    );
  });

  test("the alignment kind renders the lazy item-index phase honestly (T-33 increment 5)", () => {
    const html = render({ phase: "fetch", loaded: 0, total: null }, "alignment");
    expect(html).toContain("Loading the item index…");
    expect(html).toContain("Downloading the item index…");
    expect(html).toContain("item index — it is loading");
    expect(html).toContain("boot-fill-indeterminate");
    expect(html).not.toContain("could not render");
    // The copy names the files actually fetched — and never the whole
    // digest-state slice or the corpus (retired from the runtime fetch graph
    // by T-33 increment 5).
    expect(html).toContain("forkmap-align-index.json");
    expect(html).toContain("forkmap-column-*.json");
    expect(html).not.toContain("forkmap-alignment.json");
    expect(render({ phase: "validate", loaded: 1, total: 1 }, "alignment")).toContain(
      "Validating the item index (schema gocar.forkmap.alignindex.v1)",
    );
    // Byte progress with a Content-Length stays determinate for this phase.
    expect(render({ phase: "fetch", loaded: 500_000, total: 717_000 }, "alignment")).toContain(
      "Downloading the item index — 0.5 of 0.7 MB",
    );
    expect(render({ phase: "fetch", loaded: 500_000, total: 717_000 }, "alignment")).toContain(
      'aria-valuenow="70"',
    );
  });
});
