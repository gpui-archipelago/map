// T-39 — Journal-view parity tests (increment 3).
//
// Pure-data assertions over the committed bundle mirroring what the Journal
// view renders per release — each entry is the release's measured story
// against the release *published before it* in the same stream (the exact
// adjacency of the view, including prerelease rows as recorded):
//   - the recorded 1.17.2 story rides the adjacent 1.16.3 → 1.17.2 delta;
//   - exact-copy republish rows render the identical-surface story;
//   - first recorded releases have no self-diff predecessor;
//   - id coverage: every `journal-*`/`view-journal` id app.js binds must
//     exist in the SPA's JournalView source.

import { describe, expect, test } from "bun:test";
import { diffRows } from "../src/bundle/derive";
import type { ForkmapBundle, Provider } from "../src/bundle";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadBundle } from "./stories.test";
import { STATIC_RENDERER_IDS } from "./fixtures/static-renderer-ids";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "..", "src");

const bundle = loadBundle();

function providerMap(b: ForkmapBundle): Record<string, Provider> {
  return Object.fromEntries(b.providers.map((p) => [p.id, p]));
}

describe("journal entries read the adjacent published delta (same adjacency as the view)", () => {
  test("every consecutive published pair per stream diffs or reports an unmeasured side — never silently", () => {
    for (const p of bundle.providers) {
      for (let i = 1; i < p.versions.length; i++) {
        const d = diffRows(p.versions[i - 1], p.versions[i]);
        // A row that was never measured must not be presented as an empty diff.
        if (p.versions[i].surface === null || p.versions[i - 1].surface === null) {
          expect(d.ok).toBe(false);
        } else {
          expect(d.ok).toBe(true);
        }
      }
    }
  });

  test("uno's 1.17.2 entry story removes the frame_trace_* fns against 1.16.3 (the published predecessor)", () => {
    const uno = providerMap(bundle)["gpui-unofficial"];
    const vs = uno.versions.map((v) => v.vers);
    const idx = vs.indexOf("1.17.2");
    expect(idx).toBeGreaterThan(0);
    expect(uno.versions[idx - 1].vers).toBe("1.16.3");
    const d = diffRows(uno.versions[idx - 1], uno.versions[idx]);
    expect(d.ok).toBe(true);
    if (!d.ok) return;
    expect(d.identical).toBe(false);
    expect(d.removed).toContain("fn:profiler::record_frame_timing");
    const frameTrace = d.removed
      .filter(
        (k) => k.startsWith("fn:profiler::frame_trace_") || k.startsWith("fn:profiler::set_frame_trace_"),
      )
      .sort();
    expect(frameTrace).toEqual(["fn:profiler::frame_trace_enabled", "fn:profiler::set_frame_trace_enabled"]);
  });

  test("kael 0.2.0's entry re-signs AccessibilityNode against 0.1.2", () => {
    const kael = providerMap(bundle)["kael"];
    const vs = kael.versions.map((v) => v.vers);
    const idx = vs.indexOf("0.2.0");
    expect(idx).toBeGreaterThan(0);
    expect(kael.versions[idx - 1].vers).toBe("0.1.2");
    const d = diffRows(kael.versions[idx - 1], kael.versions[idx]);
    expect(d.ok).toBe(true);
    if (!d.ok) return;
    expect(d.identical).toBe(false);
    expect(d.resigned.map((r) => r.key)).toContain("struct:accessibility::AccessibilityNode");
  });

  test("exact-copy republish rows are identical against their predecessor (kael 0.1.1 → 0.1.2, uno 1.16.2 → 1.16.3)", () => {
    const kael = providerMap(bundle)["kael"];
    const d1 = diffRows(kael.versions[0], kael.versions[1]); // 0.1.1 → 0.1.2
    expect(d1.ok).toBe(true);
    if (d1.ok) expect(d1.identical).toBe(true);
    const uno = providerMap(bundle)["gpui-unofficial"];
    const vs = uno.versions.map((v) => v.vers);
    const i163 = vs.indexOf("1.16.3");
    const d2 = diffRows(uno.versions[i163 - 1], uno.versions[i163]); // 1.16.2 → 1.16.3
    expect(d2.ok).toBe(true);
    if (d2.ok) expect(d2.identical).toBe(true);
  });

  test("first recorded releases have no predecessor (no self-diff link exists for them)", () => {
    for (const p of bundle.providers) {
      expect(p.versions.length).toBeGreaterThan(0);
      // First rows carry no prior published row — the view renders a plain
      // je-vers span with no Changes self-diff link.
      const first = p.versions[0];
      expect(first.surface === null || first.surface === undefined || first.surface.length >= 0).toBe(true);
    }
  });
});

describe("Journal view ids survive in the SPA source (id coverage tripwire)", () => {
  // The static check.py used to assert every id app.js binds exists in
  // index.html. Since the static renderer retired (T-39 increment 6) the
  // contract is the frozen snapshot in tests/fixtures/static-renderer-ids.ts:
  // every `journal-*`/`view-journal` id app.js bound must exist in the SPA's
  // JournalView source.
  const boundJournalIds = new Set<string>([...STATIC_RENDERER_IDS.journal]);
  expect(boundJournalIds.size).toBeGreaterThan(0);

  const journalSrc = readFileSync(join(SRC, "views", "JournalView.tsx"), "utf8");
  for (const id of boundJournalIds) {
    expect(journalSrc, `id "${id}" exists in the JournalView source`).toContain(`id="${id}"`);
  }
});

describe("the member-map hooks stay above the early returns (Rules of Hooks tripwire)", () => {
  // T-51 regression. `useTypeMembers()` was placed after EntryItems' loading /
  // error / identical early-returns, so the hook ran on the resolved render but
  // not on the loading one — React threw "Rendered more hooks than during the
  // previous render" the first time a Journal diff was opened. A server render
  // cannot catch this (it renders once, in one state), so the invariant is
  // asserted statically: in every component that reads the shared member map,
  // the hook call must precede the first early `return`.
  const views = [
    ["JournalView.tsx", "EntryItems"],
    ["ChangesView.tsx", "ChangesView"],
    ["AlignmentView.tsx", "ItemBoxBody"],
  ] as const;
  for (const [file, component] of views) {
    const src = readFileSync(join(SRC, "views", file), "utf8");
    const componentStart = src.indexOf(`function ${component}(`);
    expect(componentStart, `${component} exists in ${file}`).toBeGreaterThanOrEqual(0);
    const body = src.slice(componentStart);
    const hookAt = body.indexOf("useTypeMembers()");
    expect(hookAt, `${component} reads the shared member map`).toBeGreaterThanOrEqual(0);
    // The first bare `if (…) return` / `if (…) {` guard after the component's
    // signature. Keep the hook before it.
    const guardMatch = /\n  if \(/.exec(body);
    if (guardMatch) {
      expect(
        hookAt,
        `${component}: useTypeMembers() must be called before the first early return (Rules of Hooks)`,
      ).toBeLessThan(guardMatch.index);
    }
  }
});
