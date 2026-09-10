// T-39 — Changes-view parity tests (increment 2).
//
// Pure-data assertions over the committed bundle mirroring what the Changes
// view renders (web/forkmap/check.py asserted the same stories in Python on
// the static site's derivations until the static renderer retired — the
// suite lives here now):
//   - pair resolution (resolveChanges/changesSide/defaultPair) — the RULE-6
//     contract the pickers, caption and deep links are built on;
//   - the three recorded-story quick links resolve to real, non-identical
//     deltas (RULE-1 semantics: same-fork stories stay changelogs, the
//     cross-fork one stays a snapshot-surface difference);
//   - id coverage: every `changes-*`/`view-changes` id the static app.js
//     binds must exist in the SPA's source, and honest-rule-1…7 must survive
//     in the AboutNote the Changes view renders (ids move with care).

import { describe, expect, test } from "bun:test";
import {
  changesPairValue,
  changesSide,
  defaultPair,
  namedPair,
  resolveChanges,
} from "../src/bundle/changes";
import { parse } from "../src/bundle/query";
import { changesLink } from "../src/routing";
import { diffRows, rulesFrom, splitKey, branchBase } from "../src/bundle/derive";
import type { ForkmapBundle, Provider, VersionRow } from "../src/bundle";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { STATIC_RENDERER_IDS } from "./fixtures/static-renderer-ids";

const HERE = dirname(fileURLToPath(import.meta.url));
const BUNDLE_PATH = join(HERE, "..", "..", "forkmap", "data", "forkmap.json");
const SRC = join(HERE, "..", "src");
const bundle: ForkmapBundle = JSON.parse(readFileSync(BUNDLE_PATH, "utf8"));

function providerMap(b: ForkmapBundle): Record<string, Provider> {
  return Object.fromEntries(b.providers.map((p) => [p.id, p]));
}

function row(provider: Provider, vers: string): VersionRow {
  const r = provider.versions.find((v) => v.vers === vers);
  if (!r) throw new Error(`no row ${provider.id} ${vers}`);
  return r;
}

describe("RULE-6 pair resolution (resolveChanges/defaultPair/changesSide)", () => {
  test("the default pair of every provider is the latest stable + its branch base, never a prerelease", () => {
    for (const p of bundle.providers) {
      expect(p.latest_stable, `${p.id} has latest_stable`).toBeTruthy();
      const latest = p.latest_stable!;
      const def = defaultPair(p);
      expect(def.b, `${p.id} default B is the latest stable`).toBe(latest);
      const bRow = row(p, def.b);
      expect(bRow.prerelease, `${p.id} default B never a prerelease`).toBe(false);
      if (def.a !== null) {
        // A is B's *branch* base (the previous stable of its line, or for a
        // preview the newest stable published before it) — never the raw
        // publish predecessor, so a backport's default diff is its own line.
        const bi = p.versions.findIndex((v) => v.vers === def.b);
        expect(bi).toBeGreaterThanOrEqual(0);
        expect(branchBase(p.versions, bi)?.vers).toBe(def.a);
        expect(def.a).not.toBe(def.b);
      }
    }
  });

  test("an empty hash resolves to the first provider's default pair (providers[0] anchor)", () => {
    const { a, b } = resolveChanges(bundle, {});
    expect(a.provider.id).toBe(bundle.providers[0].id);
    const def = defaultPair(bundle.providers[0]);
    expect(b.vers).toBe(def.b);
    if (def.a !== null) expect(a.vers).toBe(def.a);
    expect(bundle.providers[0].versions.some((v) => v.vers === b.vers)).toBe(true);
  });

  test("canonical deep links name real rows and win over defaults", () => {
    const { a, b } = resolveChanges(bundle, {
      a: "gpui-unofficial:1.16.3",
      b: "gpui-unofficial:1.17.2",
    });
    expect(a.provider.id).toBe("gpui-unofficial");
    expect(a.vers).toBe("1.16.3");
    expect(b.vers).toBe("1.17.2");
  });

  test("the v1 legacy ?p=…&a=…&b=… form still resolves (bare versions against the stream)", () => {
    const { a, b } = resolveChanges(bundle, { p: "kael", a: "0.1.2", b: "0.2.0" });
    expect(a.provider.id).toBe("kael");
    expect(a.vers).toBe("0.1.2");
    expect(b.vers).toBe("0.2.0");
    // changesSide resolves the bare version against the stream param.
    const side = changesSide("0.1.2", bundle, "kael");
    expect(side?.provider.id).toBe("kael");
  });

  test("an unnamed side falls back on its sibling's fork to that fork's RULE-6 pair", () => {
    // a-only deep link: B resolves to kael's latest stable.
    const { a, b } = resolveChanges(bundle, { a: "kael:0.2.0" });
    expect(a.vers).toBe("0.2.0");
    expect(b.provider.id).toBe("kael");
    const def = defaultPair(bundle.providers.find((p) => p.id === "kael")!);
    expect(b.vers).toBe(def.b);
    expect(b.vers).toBe("0.4.1");
  });

  test("a side naming an unknown fork/row is treated as absent (hash never invents rows)", () => {
    const kael = bundle.providers.find((p) => p.id === "kael")!;
    const { a, b } = resolveChanges(bundle, { a: "kael:0.9.9", b: "kael:0.2.0" });
    expect(b.vers).toBe("0.2.0");
    // The absent A falls back exactly like app.js: the anchor's default-pair
    // A (the row published before kael's latest stable) — never invented.
    const def = defaultPair(kael);
    expect(a.provider.id).toBe("kael");
    expect(a.vers).toBe(def.a ?? def.b);
  });

  test("namedPair mirrors the caption's deep-link test", () => {
    expect(namedPair({})).toBe(false);
    expect(namedPair({ p: "kael", a: "0.1.2", b: "0.2.0" })).toBe(true);
    expect(namedPair({ a: "kael:0.2.0" })).toBe(true);
    expect(namedPair({ b: "kael:0.2.0" })).toBe(true);
  });

  test("changesPairValue is the canonical <fork>:<vers> side value", () => {
    expect(changesPairValue("gpui-unofficial", "1.17.2")).toBe("gpui-unofficial:1.17.2");
    const kael = bundle.providers.find((p) => p.id === "kael")!;
    expect(changesPairValue(kael, "0.2.0")).toBe("kael:0.2.0");
  });
});

describe("recorded-story quick links render real deltas on the committed bundle", () => {
  test("uno 1.16.3 → 1.17.2 (same-stream changelog) removes the frame_trace_* fns and the rule's from-side", () => {
    const uno = providerMap(bundle)["gpui-unofficial"];
    const d = diffRows(row(uno, "1.16.3"), row(uno, "1.17.2"));
    expect(d.ok).toBe(true);
    if (!d.ok) return;
    expect(d.identical).toBe(false);
    const frameTrace = d.removed
      .filter(
        (k) => k.startsWith("fn:profiler::frame_trace_") || k.startsWith("fn:profiler::set_frame_trace_"),
      )
      .sort();
    expect(frameTrace).toEqual(["fn:profiler::frame_trace_enabled", "fn:profiler::set_frame_trace_enabled"]);
    // The removed-row annotation claims the confirmed successor only where
    // the rule's own measured to-transition matches this B side.
    const key = "fn:profiler::record_frame_timing";
    const rules = rulesFrom(bundle, key);
    expect(rules.length).toBe(1);
    expect(rules[0].transition.to.provider).toBe("gpui-unofficial");
    expect(rules[0].transition.to.version).toBe("1.17.2");
    expect(rules[0].transition.from.version).toBe("1.16.1");
  });

  test("kael 0.1.2 → 0.2.0 (same-stream changelog) re-signs AccessibilityNode", () => {
    const kael = providerMap(bundle)["kael"];
    const d = diffRows(row(kael, "0.1.2"), row(kael, "0.2.0"));
    expect(d.ok).toBe(true);
    if (!d.ok) return;
    expect(d.identical).toBe(false);
    expect(d.resigned.map((r) => r.key)).toContain("struct:accessibility::AccessibilityNode");
  });

  test("ce 0.2.2 vs uno 1.18.1 (cross-fork) is a real, non-identical snapshot-surface difference", () => {
    const pm = providerMap(bundle);
    const d = diffRows(row(pm["gpui-ce"], "0.2.2"), row(pm["gpui-unofficial"], "1.18.1"));
    expect(d.ok).toBe(true);
    if (!d.ok) return;
    expect(d.identical).toBe(false);
    // RULE-1: cross-fork deltas are item-level claims only — the surfaces
    // diverge and no whole-surface hash equality exists.
    expect(d.removed.length + d.added.length + d.resigned.length).toBeGreaterThan(0);
  });

  test("the kael preset's own story survives in the same-fork diff (0.1.1 → 0.1.2 unchanged)", () => {
    const kael = providerMap(bundle)["kael"];
    const d = diffRows(row(kael, "0.1.1"), row(kael, "0.1.2"));
    expect(d.ok).toBe(true);
    if (!d.ok) return;
    expect(d.identical).toBe(true);
  });
});

describe("recorded quick links are real deep links (per-side forks, T-35)", () => {
  test("same-fork quick links stamp one provider on both sides (v1 byte shape)", () => {
    const href = changesLink("kael", "0.1.2", "0.2.0");
    expect(href).toBe("#/changes?a=kael%3A0.1.2&b=kael%3A0.2.0");
    const { a, b } = resolveChanges(bundle, parse(href.split("?")[1]));
    expect(a.provider.id).toBe("kael");
    expect(b.provider.id).toBe("kael");
    expect(a.vers).toBe("0.1.2");
    expect(b.vers).toBe("0.2.0");
  });

  test("the cross-fork quick link names the B side's own fork — never a same-fork stamp", () => {
    // ce 0.2.2 vs uno 1.18.1: 1.18.1 is an unofficial release, so stamping
    // gpui-ce on the B side (the single-provider form) would make the link
    // unresolvable — regression guard for the T-35 quick-link bug.
    const href = changesLink("gpui-ce", "0.2.2", "1.18.1", "gpui-unofficial");
    const params = parse(href.split("?")[1]);
    expect(params.a).toBe("gpui-ce:0.2.2");
    expect(params.b).toBe("gpui-unofficial:1.18.1");
    expect(href).not.toContain("b=gpui-ce%3A1.18.1");
    const { a, b } = resolveChanges(bundle, params);
    expect(a.provider.id).toBe("gpui-ce");
    expect(a.vers).toBe("0.2.2");
    expect(b.provider.id).toBe("gpui-unofficial");
    expect(b.vers).toBe("1.18.1");
  });
});

describe("Changes view ids survive in the SPA source (id coverage tripwire)", () => {
  // The static check.py used to assert every id app.js binds exists in
  // index.html. Since the static renderer retired (T-39 increment 6) the
  // contract is the frozen snapshot in tests/fixtures/static-renderer-ids.ts:
  // the Changes view's ids (app.js bound `changes-*` + `view-changes`) must
  // exist in the SPA's JSX, and honest-rule-1…7 must live in the AboutNote
  // the Changes view renders — so the swap can never drop an id the
  // recorded stories / smoke rely on.
  const boundChangesIds = new Set<string>([...STATIC_RENDERER_IDS.changes]);
  expect(boundChangesIds.size).toBeGreaterThan(0);

  const spaSource = (rel: string) => readFileSync(join(SRC, rel), "utf8");
  const changesSrc = spaSource("views/ChangesView.tsx");
  for (const id of boundChangesIds) {
    expect(changesSrc, `id "${id}" exists in the ChangesView source`).toContain(`id="${id}"`);
  }

  const aboutSrc = spaSource("components/AboutNote.tsx");
  // AboutNote emits the ids from a template over SHORT_RULES (7 rows →
  // honest-rule-1…7 in the DOM); assert the generator + the row count so the
  // Changes view's rendered disclosure can never drop an id. (LandingView's
  // static honest-rule-1…7 literals are the other half of the tripwire.)
  expect(aboutSrc).toContain("honest-rule-${");
  expect(aboutSrc).toContain("SHORT_RULES.map");
  const ruleCount = aboutSrc.match(/strong: \"Rule \d+ —\"/g)?.length ?? 0;
  expect(ruleCount).toBe(7);
});

describe("delta rows group by kind and sort within (itemList semantics)", () => {
  test("keys keep the kind:name shape across the delta's added/removed/resigned sets", () => {
    // Exercise the derivations the diff sections render over a real delta.
    const kael = providerMap(bundle)["kael"];
    const d = diffRows(row(kael, "0.1.2"), row(kael, "0.2.0"));
    expect(d.ok).toBe(true);
    if (!d.ok) return;
    const all = [...d.removed, ...d.added, ...d.resigned.map((r) => r.key)];
    expect(all.length).toBeGreaterThan(0);
    for (const k of all) {
      expect(k).toMatch(/^[^:]+:.+$/);
      expect(splitKey(k)[1]).toBe(k.slice(k.indexOf(":") + 1));
    }
  });
});
