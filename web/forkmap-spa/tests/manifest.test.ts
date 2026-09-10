// T-33 — boot-manifest parity tests.
//
// The committed forkmap-manifest.json is the slice the SPA boots on (the
// bundle minus every measured surface, plus export-precomputed corpus
// counts). These tests pin the split's honest guarantees:
//   - the manifest validates and its counts equal the client derivation over
//     the full committed bundle (bundleCounts/buildIndex — the arithmetic the
//     exporter precomputed, asserted equal here, RULE-7);
//   - the boot slice never carries surfaces, and its non-surface content is
//     the full bundle's content (same data, split at export — never a second
//     source of truth);
//   - validateManifest is shape-strict: a full bundle served at the manifest
//     URL (rows carrying `surface`) fails loudly, never renders half-truths.

import { describe, expect, test } from "bun:test";
import { bundleCounts } from "../src/bundle/counts";
import { buildIndex } from "../src/bundle/derive";
import { validateBundle, validateManifest, BundleError } from "../src/bundle/validate";
import type { ForkmapBundle } from "../src/bundle/types";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, "..", "..", "forkmap", "data");
const MANIFEST_PATH = join(DATA, "forkmap-manifest.json");
const BUNDLE_PATH = join(DATA, "forkmap.json");

const manifest = validateManifest(JSON.parse(readFileSync(MANIFEST_PATH, "utf8")));
const bundle: ForkmapBundle = validateBundle(JSON.parse(readFileSync(BUNDLE_PATH, "utf8")));

describe("the committed boot manifest (T-33)", () => {
  test("validates, and its export-precomputed counts equal the client derivation over the full bundle", () => {
    const want = bundleCounts(bundle);
    expect(manifest.counts).toEqual(want);
    expect(manifest.counts.keys).toBe(buildIndex(bundle).keys.length);
  });

  test("never carries a measured surface, and matches the bundle's non-surface content", () => {
    for (const p of manifest.providers) {
      for (const v of p.versions) {
        expect(v).not.toHaveProperty("surface");
      }
    }
    expect(manifest.schema).toBe("gocar.forkmap.manifest.v1");
    expect(manifest.dataset_synced_at).toBe(bundle.dataset_synced_at);
    expect(manifest.dataset_schema).toBe(bundle.dataset_schema);
    expect(manifest.contract).toBe(bundle.contract);
    expect(manifest.recommended_provider).toBe(bundle.recommended_provider);
    expect(manifest.rules).toEqual(bundle.rules);
    expect(manifest.templates).toEqual(bundle.templates);
    expect(manifest.kit_probes).toEqual(bundle.kit_probes);
    // Providers + version rows match the bundle's minus `surface`, row by row.
    expect(manifest.providers.length).toBe(bundle.providers.length);
    for (let i = 0; i < bundle.providers.length; i++) {
      const bp = bundle.providers[i];
      const mp = manifest.providers[i];
      expect(mp.id).toBe(bp.id);
      expect(mp.versions.length).toBe(bp.versions.length);
      for (let j = 0; j < bp.versions.length; j++) {
        const bv = bp.versions[j];
        const mv = mp.versions[j];
        const { surface: _omit, ...meta } = bv;
        expect(mv).toEqual(meta);
      }
    }
  });

  test("the boot slice still satisfies the configurator mirror (bindings == version rows)", () => {
    // validateManifest already enforces it; assert the consequence a viewer
    // relies on: every version row the pickers offer has binding bytes.
    for (const p of manifest.providers) {
      const set = manifest.templates.bindings.find((s) => s.provider === p.id);
      expect(set, `${p.id} binding set`).toBeTruthy();
      expect(set!.entries.map((e) => e.vers)).toEqual(p.versions.map((v) => v.vers));
    }
  });
});

describe("validateManifest is shape-strict (T-33)", () => {
  test("a full bundle served at the manifest URL fails loudly on its schema", () => {
    const full = JSON.parse(readFileSync(BUNDLE_PATH, "utf8")) as Record<string, unknown>;
    expect(() => validateManifest(full)).toThrow(BundleError);
    expect(() => validateManifest(full)).toThrow(/manifest schema must be/);
  });

  test("a manifest-shaped file whose rows carry surfaces fails loudly (stale boot config)", () => {
    const m = JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as Record<string, unknown>;
    const providers = m.providers as Record<string, unknown>[];
    const row = (providers[0].versions as Record<string, unknown>[])[0];
    (row as Record<string, unknown>).surface = [];
    expect(() => validateManifest(m)).toThrow(BundleError);
    expect(() => validateManifest(m)).toThrow(/never carries surfaces/);
  });

  test("missing counts or a wrong schema fails loudly", () => {
    const m = JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as Record<string, unknown>;
    const noCounts = { ...m, counts: undefined };
    expect(() => validateManifest(noCounts)).toThrow(/counts missing/);
    const wrongSchema = { ...m, schema: "gocar.forkmap.v1" };
    expect(() => validateManifest(wrongSchema)).toThrow(/manifest schema must be/);
  });
});
