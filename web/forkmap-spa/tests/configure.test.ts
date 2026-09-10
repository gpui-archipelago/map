// T-39 — Configure-view parity tests (increment 4).
//
// Pure-data assertions over the committed bundle mirroring what the
// Configure view renders for a (provider, version, name) resolution — the
// RULE-6 defaults, the binding/scaffold finders, the curated note rows, the
// crate-name validator, and the hash→offer resolution of app.js render():
//   - id coverage: every `configure-*`/`view-configure` id app.js binds must
//     exist in the SPA's ConfigureView source.

import { describe, expect, test } from "bun:test";
import {
  CRATE_NAME_RE,
  DEFAULT_PROJECT_NAME,
  configureBindingFor,
  configureBindingsFor,
  configureScaffoldFor,
  defaultVersion,
  recommendedProviderId,
  resolvedProjectName,
  resolveConfigured,
  validCrateName,
} from "../src/bundle/configure";
import { providerFor } from "../src/bundle/changes";
import { compileStatus } from "../src/bundle/derive";
import type { ForkmapBundle } from "../src/bundle";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadBundle } from "./stories.test";
import { STATIC_RENDERER_IDS } from "./fixtures/static-renderer-ids";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "..", "src");

const bundle = loadBundle();

function bindingSetOf(b: ForkmapBundle, providerId: string) {
  return b.templates.bindings.find((s) => s.provider === providerId);
}

describe("crate-name validation (app.js CRATE_NAME_RE)", () => {
  test("letters/digits/-/_ after a leading letter are valid", () => {
    expect(CRATE_NAME_RE.test("gpui-app")).toBe(true);
    expect(validCrateName("gpui-app")).toBe(true);
    expect(validCrateName("my_app2-3")).toBe(true);
    expect(validCrateName("GpuiApp")).toBe(true);
  });

  test("leading digits, spaces, punctuation, empty and non-strings are invalid", () => {
    expect(validCrateName("1app")).toBe(false);
    expect(validCrateName("-app")).toBe(false);
    expect(validCrateName("_app")).toBe(false);
    expect(validCrateName("a b")).toBe(false);
    expect(validCrateName("bad-name!")).toBe(false);
    expect(validCrateName("")).toBe(false);
    expect(validCrateName(undefined)).toBe(false);
    expect(validCrateName(null)).toBe(false);
    expect(validCrateName(42)).toBe(false);
  });

  test("an invalid hash name resolves to the default project name", () => {
    expect(resolvedProjectName("my-app")).toBe("my-app");
    expect(resolvedProjectName("my app")).toBe(DEFAULT_PROJECT_NAME);
    expect(resolvedProjectName(undefined)).toBe(DEFAULT_PROJECT_NAME);
    expect(resolvedProjectName("9lives")).toBe(DEFAULT_PROJECT_NAME);
    expect(DEFAULT_PROJECT_NAME).toBe("gpui-app");
  });
});

describe("binding/scaffold finders mirror the version rows 1:1", () => {
  test("every provider has a bindings set and a scaffold, and bindings mirror rows", () => {
    for (const p of bundle.providers) {
      const set = configureBindingsFor(bundle, p.id);
      expect(set, `${p.id} bindings set`).not.toBeNull();
      expect(set!.entries.map((e) => e.vers)).toEqual(p.versions.map((v) => v.vers));
      expect(configureScaffoldFor(bundle, p.id), `${p.id} scaffold`).not.toBeNull();
      for (const e of set!.entries) {
        expect(e.cargo_toml, `${p.id} ${e.vers}`).toContain("{{project_name}}");
        expect(e.cargo_toml, `${p.id} ${e.vers} name-free template`).toContain(`name = "{{project_name}}"`);
      }
    }
  });

  test("the scaffold manifest is the latest-stable binding (one generator, two paths)", () => {
    for (const p of bundle.providers) {
      const scaffold = configureScaffoldFor(bundle, p.id)!;
      const latest = defaultVersion(p);
      expect(latest).toBe(p.latest_stable!);
      const binding = configureBindingFor(bundle, p.id, latest);
      expect(binding, `${p.id} default binding`).not.toBeNull();
      expect(scaffold.cargo_toml).toBe(binding!.cargo_toml);
    }
  });

  test("curated notes exist exactly on the documented unprobed rows (mirror check.py)", () => {
    for (const p of bundle.providers) {
      const set = bindingSetOf(bundle, p.id)!;
      for (const e of set.entries) {
        const want =
          p.id === "gpui-unofficial"
            ? semverLt(e.vers, [1, 12, 0]) // 0.230.x–1.11.x early era
            : p.id === "kael"
              ? e.vers === "0.1.1" || e.vers === "0.2.0" // docs/07 window edge 4
              : false;
        expect(Boolean(e.note), `${p.id} ${e.vers} curated note`).toBe(want);
      }
    }
  });
});

function semverLt(vers: string, want: [number, number, number]): boolean {
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(vers);
  if (!m) return false;
  const got: [number, number, number] = [Number(m[1]), Number(m[2]), Number(m[3])];
  for (let i = 0; i < 3; i++) {
    if (got[i] !== want[i]) return got[i] < want[i];
  }
  return false;
}

describe("Configure hash resolution (app.js render semantics)", () => {
  test("an empty hash renders the recommended provider's latest stable", () => {
    const r = resolveConfigured(bundle, {});
    expect(r.provider.id).toBe(recommendedProviderId(bundle));
    expect(recommendedProviderId(bundle)).toBe(bundle.recommended_provider!);
    expect(providerFor(bundle, bundle.recommended_provider!)).not.toBeNull();
    expect(r.vers).toBe(r.provider.latest_stable!);
    expect(r.name).toBe(DEFAULT_PROJECT_NAME);
  });

  test("a hash naming a real provider/row wins; unknown names fall back (never invented)", () => {
    const kael = providerFor(bundle, "kael")!;
    const r1 = resolveConfigured(bundle, { p: "kael", v: "0.2.0", name: "my-app" });
    expect(r1.provider.id).toBe("kael");
    expect(r1.vers).toBe("0.2.0");
    expect(r1.name).toBe("my-app");
    // an unknown version falls back to the RULE-6 default of the provider
    const r2 = resolveConfigured(bundle, { p: "kael", v: "9.9.9" });
    expect(r2.vers).toBe(kael.latest_stable!);
    // an unknown provider falls back to the recommended provider
    const r3 = resolveConfigured(bundle, { p: "no-such-fork" });
    expect(r3.provider.id).toBe(recommendedProviderId(bundle));
    // an invalid name in the hash resolves to the default
    const r4 = resolveConfigured(bundle, { p: "kael", name: "my app" });
    expect(r4.name).toBe(DEFAULT_PROJECT_NAME);
  });

  test("defaults are never yanked or prerelease (RULE-6); hash-named flagged rows win", () => {
    for (const p of bundle.providers) {
      const row = p.versions.find((v) => v.vers === defaultVersion(p))!;
      expect(row.yanked, `${p.id} default not yanked`).toBe(false);
      expect(row.prerelease, `${p.id} default not prerelease`).toBe(false);
    }
    // a deep link may name a flagged row for reading an era — it wins
    const r = resolveConfigured(bundle, { p: "gpui-ce", v: "0.3.2" });
    expect(r.vers).toBe("0.3.2");
    expect(bundle.providers.find((p) => p.id === "gpui-ce")!.versions.find((v) => v.vers === "0.3.2")!.yanked).toBe(
      true,
    );
  });
});

describe("RULE-5 marker stories the status panel renders", () => {
  test("the marker row is the only badged row, and the default offer badges only when it is that row", () => {
    for (const p of bundle.providers) {
      if (!p.compile_verified) continue;
      const marker = compileStatus(p, p.compile_verified.vers);
      expect(marker.badge, `${p.id} marker row is badged`).toBe(true);
      expect(marker.marker!.vers, `${p.id} marker vers`).toBe(p.compile_verified.vers);
      // RULE-6 defaults to the latest stable — a RULE-5 badge appears only when
      // the marker coincides with it (the corpus may move past the probe).
      const st = compileStatus(p, defaultVersion(p));
      expect(st.badge, `${p.id} default badge follows the marker`).toBe(defaultVersion(p) === p.compile_verified.vers);
    }
  });

  test("non-marker rows render the honest not-probed story (kael 0.2.0, gpui-ce 0.3.2, uno 1.17.0-pre)", () => {
    for (const [pid, vers] of [
      ["kael", "0.2.0"],
      ["gpui-ce", "0.3.2"],
      ["gpui-unofficial", "1.17.0-pre"],
    ] as const) {
      const p = providerFor(bundle, pid)!;
      const st = compileStatus(p, vers);
      expect(st.badge, `${pid} ${vers} not a marker`).toBe(false);
      expect(st.marker).toBeNull();
      // the warn box names the provider's own marker as the only probe
      expect(p.compile_verified).toBeDefined();
      expect(p.compile_verified!.vers).not.toBe(vers);
    }
  });
});

describe("Configure view ids survive in the SPA source (id coverage tripwire)", () => {
  // The static check.py used to assert every id app.js binds exists in
  // index.html. Since the static renderer retired (T-39 increment 6) the
  // contract is the frozen snapshot in tests/fixtures/static-renderer-ids.ts:
  // every `configure-*`/`view-configure` id app.js bound must exist in the
  // SPA's ConfigureView source.
  const boundConfigureIds = new Set<string>([...STATIC_RENDERER_IDS.configure]);
  expect(boundConfigureIds.size).toBeGreaterThan(0);

  const configureSrc = readFileSync(join(SRC, "views", "ConfigureView.tsx"), "utf8");
  for (const id of boundConfigureIds) {
    expect(configureSrc, `id "${id}" exists in the ConfigureView source`).toContain(`id="${id}"`);
  }
});
