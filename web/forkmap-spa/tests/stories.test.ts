// T-39 — recorded-story parity tests.
//
// The recorded stories web/forkmap/check.py used to assert on the committed
// bundle (they are renderer-agnostic data assertions) run here against the
// SPA's own TypeScript derivations. check.py retired with the static
// renderer (T-39 increment 6, 2026-09-08) — this suite is now the canonical
// recorded-story assertions, over the committed ../forkmap/data/forkmap.json
// exactly like the app reads it at runtime.

import { describe, expect, test } from "bun:test";
import {
  ALIGNMENT_PRESETS,
  buildIndex,
  cellState,
  compileStatus,
  diffRows,
  splitKey,
  surfacesIdentical,
  validateBundle,
} from "../src/bundle";
import type { ForkmapBundle, Provider, VersionRow } from "../src/bundle";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
export const BUNDLE_PATH = join(HERE, "..", "..", "forkmap", "data", "forkmap.json");
export function loadBundle(): ForkmapBundle {
  const raw: unknown = JSON.parse(readFileSync(BUNDLE_PATH, "utf8"));
  return validateBundle(raw);
}

const bundle = loadBundle();

function providerMap(b: ForkmapBundle): Record<string, Provider> {
  return Object.fromEntries(b.providers.map((p) => [p.id, p]));
}

function row(provider: Provider, vers: string): VersionRow | undefined {
  return provider.versions.find((v) => v.vers === vers);
}

describe("bundle schema + shape (validateBundle)", () => {
  test("validates the committed bundle without problems", () => {
    expect(bundle.schema).toBe("gocar.forkmap.v1");
    expect(bundle.providers.length).toBeGreaterThan(0);
    expect(bundle.dataset_schema).toBeTruthy();
    expect(bundle.rules).toBeInstanceOf(Array);
    expect(bundle.kit_probes).toBeInstanceOf(Array);
    expect(bundle.templates.scaffold.length).toBeGreaterThan(0);
    expect(bundle.templates.bindings.length).toBeGreaterThan(0);
  });

  test("bindings mirror the version rows 1:1 per provider", () => {
    for (const p of bundle.providers) {
      const set = bundle.templates.bindings.find((b) => b.provider === p.id);
      expect(set, `${p.id} has a bindings set`).toBeTruthy();
      expect(set!.entries.map((e) => e.vers)).toEqual(p.versions.map((v) => v.vers));
      expect(bundle.templates.scaffold.some((s) => s.provider === p.id)).toBe(true);
    }
  });

  test("rejects a mismatched schema loudly", () => {
    expect(() => validateBundle({ ...bundle, schema: "gocar.forkmap.v0" })).toThrow(/schema/);
  });
});

describe("item identity + digest format (flat kind:name; blake3 64-hex)", () => {
  test("every surface item is kind:name with a 64-hex digest, no repeated pairs", () => {
    for (const p of bundle.providers) {
      for (const v of p.versions) {
        if (!v.surface) continue;
        const seen = new Set<string>();
        for (const item of v.surface) {
          const k = item.key;
          expect(k, `${p.id} ${v.vers} key`).toMatch(/^[^:]+:.+$/);
          expect(item.digest, `${p.id} ${v.vers} digest`).toMatch(/^[0-9a-f]{64}$/);
          const pair = `${k}\u0000${item.digest}`;
          expect(seen.has(pair), `${p.id} ${v.vers} duplicate pair ${k}`).toBe(false);
          seen.add(pair);
        }
      }
    }
  });

  test("splitKey mirrors the app.js semantics", () => {
    expect(splitKey("fn:Window::blur")).toEqual(["fn", "Window::blur"]);
    // A leading or trailing ":" (or no ":") leaves the key whole under "?"
    // — splitKey is a fallback; real keys always pass the kind:name check.
    expect(splitKey(":bad")).toEqual(["?", ":bad"]);
    expect(splitKey("bad:")).toEqual(["?", "bad:"]);
    expect(splitKey("bad")).toEqual(["?", "bad"]);
  });
});

describe("recorded story: uno 1.17.2 removes the frame_trace_* fns", () => {
  test("the adjacent published delta drops both toggles + the seed rule's from-side", () => {
    const uno = providerMap(bundle)["gpui-unofficial"];
    const vs = uno.versions.map((v) => v.vers);
    const idx = vs.indexOf("1.17.2");
    expect(idx).toBeGreaterThan(0);
    const a = uno.versions[idx - 1];
    expect(a.vers).toBe("1.16.3");
    const d = diffRows(a, uno.versions[idx]);
    expect(d.ok).toBe(true);
    if (!d.ok) return;
    const frameTrace = d.removed
      .filter(
        (k) => k.startsWith("fn:profiler::frame_trace_") || k.startsWith("fn:profiler::set_frame_trace_"),
      )
      .sort();
    expect(frameTrace).toEqual(["fn:profiler::frame_trace_enabled", "fn:profiler::set_frame_trace_enabled"]);
    expect(d.removed).toContain("fn:profiler::record_frame_timing");
    expect(row(uno, "1.17.2")!.surface!.some((i) => i.key === "fn:profiler::record_frame_event")).toBe(true);
  });
});

describe("recorded story: kael 0.2.0 re-signs AccessibilityNode", () => {
  test("0.1.1 present, 0.1.2 same, 0.2.0 re-signed", () => {
    const kael = providerMap(bundle)["kael"];
    const vs = kael.versions.map((v) => v.vers);
    const key = "struct:accessibility::AccessibilityNode";
    const i02 = vs.indexOf("0.2.0");
    const states = kael.versions.slice(0, i02 + 1).map((v, i) => cellState(key, i > 0 ? kael.versions[i - 1] : null, v));
    expect(["added", "same"]).toContain(states[0]);
    expect(states[1]).toBe("same");
    expect(states[2]).toBe("changed");
    const d = diffRows(row(kael, "0.1.2")!, row(kael, "0.2.0")!);
    expect(d.ok).toBe(true);
    if (d.ok) expect(d.resigned.map((r) => r.key)).toContain(key);
  });
});

describe("story: gpui-ce 0.2.2 vs uno — whole-interface divergence, item-level sharing", () => {
  test("two-way item-level divergence, never whole-surface equality", () => {
    const pm = providerMap(bundle);
    const ce = row(pm["gpui-ce"], "0.2.2")!;
    const uno = row(pm["gpui-unofficial"], "1.18.1")!;
    const ceKeys = new Set(ce.surface!.map((i) => i.key));
    const unoKeys = new Set(uno.surface!.map((i) => i.key));
    const shared = [...ceKeys].filter((k) => unoKeys.has(k));
    expect(shared.length).toBeGreaterThan(0);
    expect([...ceKeys].some((k) => !unoKeys.has(k))).toBe(true);
    expect([...unoKeys].some((k) => !ceKeys.has(k))).toBe(true);
    // api_hash lives on the row in the export bundle (check.py compares it).
    expect(ce.api_hash).toBeDefined();
    expect(uno.api_hash).toBeDefined();
    expect(ce.api_hash).not.toBe(uno.api_hash);
  });
});

describe("alignment presets are recorded-story items present in the measured corpus (T-38)", () => {
  test("every preset key is measured somewhere; index counts versions per key", () => {
    const measured = new Set<string>();
    for (const p of bundle.providers) {
      for (const v of p.versions) {
        if (v.surface === null) continue;
        for (const i of v.surface) measured.add(i.key);
      }
    }
    for (const k of ALIGNMENT_PRESETS) {
      expect(measured.has(k), `preset ${k} measured`).toBe(true);
    }
    const index = buildIndex(bundle);
    for (const k of ALIGNMENT_PRESETS) {
      const rec = index.byKey.get(k);
      expect(rec, `preset ${k} in index`).toBeTruthy();
      expect(rec!.versions).toBeGreaterThan(0);
    }
  });
});

describe("RULE-1: no cross-fork epoch badge can exist", () => {
  test("no surface-identical group spans two forks; api_hash equality stays within a stream", () => {
    const bySurface = new Map<string, [string, string][]>();
    const byHash = new Map<string, [string, string][]>();
    for (const p of bundle.providers) {
      for (const v of p.versions) {
        if (v.surface === null) continue;
        const sig = v.surface
          .map((i) => `${i.key}\u0000${i.digest}`)
          .sort()
          .join("\u0001");
        bySurface.set(sig, [...(bySurface.get(sig) ?? []), [p.id, v.vers]]);
        if (v.api_hash) {
          const h = v.api_hash;
          byHash.set(h, [...(byHash.get(h) ?? []), [p.id, v.vers]]);
        }
      }
    }
    for (const [sig, members] of bySurface) {
      const pids = new Set(members.map(([pid]) => pid));
      expect(pids.size, `surface group ${sig.slice(0, 24)}… spans forks`).toBe(1);
    }
    for (const [h, members] of byHash) {
      const pids = new Set(members.map(([pid]) => pid));
      expect(pids.size, `api_hash group ${h.slice(0, 12)}… spans forks`).toBe(1);
      // within a stream, api_hash equality means surface equality too
      const pid = members[0][0];
      const prov = providerMap(bundle)[pid];
      const sigs = new Set(
        members.map(([, vers]) =>
          row(prov, vers)!.surface!
            .map((i) => `${i.key}\u0000${i.digest}`)
            .sort()
            .join("\u0001"),
        ),
      );
      expect(sigs.size, `${pid}: api_hash-equal rows with differing surfaces`).toBe(1);
    }
  });
});

describe("recorded T-25 exact-copy rows still render as identical within-stream pairs", () => {
  test.each([
    ["gpui-unofficial", "1.16.1", "1.16.2"],
    ["gpui-unofficial", "1.16.2", "1.16.3"],
    ["kael", "0.4.0", "0.4.1"],
    // gpui-pre 0.3.1 ≡ 0.3.2 under the v2 model too; 0.3.2 ≡ 0.3.3 *split*
    // when T-26 started measuring impl methods — honest vectors, not "fixed".
    ["gpui-pre", "0.3.1", "0.3.2"],
  ])("%s %s vs %s identical measured surface + api_hash", (pid, a, b) => {
    const prov = providerMap(bundle)[pid];
    const ra = row(prov, a)!;
    const rb = row(prov, b)!;
    const d = diffRows(ra, rb);
    expect(d.ok).toBe(true);
    if (d.ok) expect(d.identical).toBe(true);
    expect(surfacesIdentical(ra.surface!, rb.surface!)).toBe(true);
    expect(ra.api_hash).toBe(rb.api_hash);
  });
});

describe("configurator discipline (T-31 / UC-10)", () => {
  test("defaults are latest stable and bindings pin the exact fork line", () => {
    for (const p of bundle.providers) {
      expect(p.latest_stable, `${p.id} latest_stable`).toBeTruthy();
      const set = bundle.templates.bindings.find((b) => b.provider === p.id)!;
      const defaultEntry = set.entries.find((e) => e.vers === p.latest_stable);
      expect(defaultEntry, `${p.id} binding for default ${p.latest_stable}`).toBeTruthy();
      const scaffold = bundle.templates.scaffold.find((s) => s.provider === p.id)!;
      expect(scaffold.cargo_toml).toBe(defaultEntry!.cargo_toml);
      expect(defaultEntry!.cargo_toml).toContain("{{project_name}}");
      const companion = p.platform_companion;
      for (const e of set.entries) {
        expect(e.cargo_toml).toContain(`gpui = { package = "${p.package}", version = "=${e.vers}" }`);
        expect(e.cargo_toml).toContain(`min-version = "${e.vers}"`);
        if (!companion) {
          expect(e.cargo_toml).not.toContain("gpui-platform");
        } else {
          const want = companion.pin === "mirror" ? e.vers : (companion.pin as { fixed: string }).fixed;
          expect(e.cargo_toml).toContain(`gpui-platform = { package = "${companion.package}", version = "=${want}"`);
        }
      }
    }
  });

  test("compile-verified claims exist only on marker rows (RULE-5)", () => {
    for (const p of bundle.providers) {
      for (const v of p.versions) {
        const st = compileStatus(p, v.vers);
        const m = p.compile_verified;
        const wantBadge = m !== undefined && m.vers === v.vers;
        expect(st.badge, `${p.id} ${v.vers} badge`).toBe(wantBadge);
        if (st.badge && st.marker) expect(st.marker.evidence).toBeTruthy();
      }
      if (p.compile_verified) {
        // RULE-5: the marker names a row the provider actually publishes (the
        // badge's `compileStatus` match above already ties it to that row — the
        // marker need not be the latest stable, which moves with the corpus).
        expect(
          p.versions.some((v) => v.vers === p.compile_verified!.vers),
          `${p.id} marker names a published row`,
        ).toBe(true);
      }
    }
  });
});
