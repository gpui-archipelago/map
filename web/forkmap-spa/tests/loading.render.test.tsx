// T-39 — boot-screen render tests (increment 2 UX fix): loading is a real
// intermediate state with byte progress, never the failure box. T-33: the
// boot phase loads the committed manifest; the same screen renders the lazy
// phases a Changes/Journal view (release-row data) or the Alignment view
// (item index, T-33 increment 5) triggers.
//
// The copy under test is deliberately plain: it says what is loading and
// never names the files, schemas or export pipeline behind it.

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
    expect(html).toContain("Loading the map…");
    expect(html).not.toContain("boot-fill-indeterminate");
    expect(html).toContain("this is not an error");
  });

  test("fetch phase without a Content-Length is an indeterminate bar (never a lie about %)", () => {
    const html = render({ phase: "fetch", loaded: 0, total: null });
    expect(html).toContain("Downloading…");
    expect(html).toContain("boot-fill-indeterminate");
    expect(html).not.toContain("aria-valuenow=");
  });

  test("parse and validate phases name what the page is doing", () => {
    expect(render({ phase: "parse", loaded: 33_500_000, total: 33_500_000 })).toContain("Reading the data…");
    expect(render({ phase: "validate", loaded: 33_500_000, total: 33_500_000 })).toContain("Checking the data…");
  });

  test("a completed fetch never claims an error — the fatal box is a separate branch", () => {
    const html = render({ phase: "validate", loaded: 33_500_000, total: 33_500_000 });
    expect(html).not.toContain("could not render");
  });

  test("the copy never leaks file names, schemas or pipeline internals", () => {
    for (const kind of ["boot", "rows", "alignment"] as const) {
      const html = render({ phase: "fetch", loaded: 1, total: 2 }, kind);
      for (const leak of ["forkmap-", ".json", "gocar.forkmap", "T-33", "corpus", "bundle", "manifest"]) {
        expect(html).not.toContain(leak);
      }
    }
  });

  test("each lazy kind names what it is loading", () => {
    const rows = render({ phase: "fetch", loaded: 0, total: null }, "rows");
    expect(rows).toContain("Loading the release history…");
    expect(rows).toContain("this view reads every release");
    expect(rows).toContain("boot-fill-indeterminate");

    const alignment = render({ phase: "fetch", loaded: 0, total: null }, "alignment");
    expect(alignment).toContain("Loading the item list…");
    expect(alignment).toContain("item search needs the full item list");
  });

  test("byte progress with a Content-Length stays determinate on a lazy phase", () => {
    const html = render({ phase: "fetch", loaded: 500_000, total: 717_000 }, "alignment");
    expect(html).toContain("Downloading — 0.5 of 0.7 MB");
    expect(html).toContain('aria-valuenow="70"');
  });
});
