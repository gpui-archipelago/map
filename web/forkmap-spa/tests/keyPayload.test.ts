// T-33 increment 3 — per-key payload fragment parity tests.
//
// The committed forkmap-payload-###.json buckets are the item-box/popover
// payload the Alignment view renders from (the resolved fn signatures,
// docstrings and source locations of one selected item, transposed from the
// whole-file sidecars and bucketed by the digest-state slice's item ordinal
// — option (c); the view never fetches the ~15.7 + 19.8 + 31.4 MB sidecar
// trio on the Alignment path). These tests pin the split's honest
// guarantees:
//   - every committed bucket validates, and its whole content equals the
//     client derivation over the committed slice + whole-file sidecars
//     (derivePayloadBuckets — the exporter's transpose reproduced in TS,
//     RULE-7: same data, computed another way);
//   - the addressing is ordinal-only: bucket = slice ordinal / 256, `from`
//     = bucket × 256, keys unique, no sidecar row lost or invented;
//   - the runtime reconstruction (payloadSubsets — the fragment's rows
//     rebuilt into sidecar-shaped per-key subsets against the manifest's
//     row space) reproduces the whole-sidecar derivations exactly
//     (fnDigestTexts, itemDocStory over blur/FileWatcher/story items);
//   - validateKeyPayload is shape-strict: a stale or truncated file must
//     fail loudly, never render half-truths beside resolved digest state.

import { describe, expect, test } from "bun:test";
import { buildIndex, fnDigestTexts, itemDocStory } from "../src/bundle/derive";
import type { ItemDocStory } from "../src/bundle/derive";
import { derivePayloadBuckets, payloadSubsets } from "../src/bundle/keyPayload";
import { alignmentColumn, deriveAlignIndex } from "../src/bundle/alignmentSlice";
import {
  validateAlignmentSlice,
  validateBundle,
  validateDocTexts,
  validateFnTexts,
  validateKeyPayload,
  validateManifest,
  validateSrcLocs,
} from "../src/bundle/validate";
import { PAYLOAD_BUCKET_KEYS } from "../src/bundle/types";
import type {
  DocTextsBundle,
  FnTextsBundle,
  ForkmapBundle,
  ForkmapManifest,
  PayloadBucket,
} from "../src/bundle/types";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, "..", "..", "forkmap", "data");
const load = <T,>(name: string, validate: (raw: unknown) => T): T =>
  validate(JSON.parse(readFileSync(join(DATA, name), "utf8")));

const bundle: ForkmapBundle = load("forkmap.json", validateBundle);
const manifest: ForkmapManifest = load("forkmap-manifest.json", validateManifest);
const slice = load("forkmap-alignment.json", validateAlignmentSlice);
const fnTexts: FnTextsBundle = load("forkmap-fn-texts.json", validateFnTexts);
const docTexts: DocTextsBundle = load("forkmap-doc-texts.json", validateDocTexts);
const srcLocs = load("forkmap-source-locs.json", validateSrcLocs);
// The type-members sidecar (T-51) is not a payload input any more — it is
// delivered as one shared map and validated in its own suite.

// Every committed bucket, in ordinal order, validated.
const bucketFiles = readdirSync(DATA)
  .filter((n) => /^forkmap-payload-\d{3}\.json$/.test(n))
  .sort();
const committed: PayloadBucket[] = bucketFiles.map((n) => load(n, validateKeyPayload));

describe("the committed payload buckets (T-33 increment 3)", () => {
  test("there is one bucket per slice-ordinal range, and every bucket validates", () => {
    expect(committed.length).toBe(Math.ceil(slice.items.length / PAYLOAD_BUCKET_KEYS));
    for (const [bi, b] of committed.entries()) {
      expect(b.schema).toBe("gocar.forkmap.payload.v1");
      expect(b.from).toBe(bi * PAYLOAD_BUCKET_KEYS);
      expect(b.items.length).toBeLessThanOrEqual(PAYLOAD_BUCKET_KEYS);
      expect(b.dataset_schema).toBe(bundle.dataset_schema);
      expect(b.dataset_synced_at).toBe(bundle.dataset_synced_at);
    }
  });

  test("every bucket equals the client derivation over the slice + whole sidecars (RULE-7)", () => {
    const derived = derivePayloadBuckets(slice, bundle.providers, fnTexts, docTexts, srcLocs);
    expect(derived.length).toBe(committed.length);
    for (const [bi, want] of committed.entries()) {
      expect(want).toEqual(derived[bi]);
    }
  });

  test("addressing is ordinal-only: every item sits in its key's slice-ordinal bucket", () => {
    const byOrdinal = new Map(slice.items.map((item, ordinal) => [item.key, ordinal]));
    const seen = new Set<string>();
    for (const [bi, b] of committed.entries()) {
      for (const item of b.items) {
        expect(seen.has(item.k), `${item.k} appears once across buckets`).toBe(false);
        seen.add(item.k);
        const ordinal = byOrdinal.get(item.k);
        expect(ordinal, `${item.k} is a measured slice key`).toBeDefined();
        const o = ordinal!;
        expect(Math.floor(o / PAYLOAD_BUCKET_KEYS)).toBe(bi);
        expect(o).toBeGreaterThanOrEqual(b.from);
        expect(o).toBeLessThan(b.from + PAYLOAD_BUCKET_KEYS);
        // d/s rows only ever name fn keys; re-export keys never resolve.
        if (item.d || item.s) expect(item.k.startsWith("fn:")).toBe(true);
        expect(item.k.startsWith("use:")).toBe(false);
      }
    }
    // Keys with any payload row == the slice keys the whole-file sidecars carry
    // (an independent derivation of the exporter's transpose, not a snapshot).
    const sidecarKeys = new Set<string>();
    for (const p of fnTexts.providers) {
      for (const v of p.versions) for (const k of Object.keys(v.fn_texts)) sidecarKeys.add(k);
    }
    for (const p of docTexts.providers) {
      for (const v of p.versions) for (const k of Object.keys(v.doc_texts)) sidecarKeys.add(k);
    }
    for (const p of srcLocs.providers) {
      for (const v of p.versions) for (const k of Object.keys(v.source_locs)) sidecarKeys.add(k);
    }
    expect(seen.size).toBe(slice.items.filter((i) => sidecarKeys.has(i.key)).length);
    expect(seen.size).toBeLessThan(slice.items.length);
  });

  test("the recorded story rows ride the fragments (blur α/β sigs + doc, the doc removal, struct locs)", () => {
    const item = (key: string) => {
      const ordinal = slice.items.findIndex((i) => i.key === key);
      const b = committed[Math.floor(ordinal / PAYLOAD_BUCKET_KEYS)];
      return b.items.find((i) => i.k === key) ?? null;
    };
    const blur = item("fn:Window::blur")!;
    expect(blur.s).toBeDefined();
    expect(blur.d).toBeDefined();
    expect(blur.l).toBeDefined();
    const uno = bundle.providers.findIndex((p) => p.id === "gpui-unofficial");
    const viOf = (provider: number, vers: string) =>
      bundle.providers[provider].versions.findIndex((v) => v.vers === vers);
    expect(blur.s![`${uno}:${viOf(uno, "1.18.1")}`]).toBe("fn Window::blur(& mut self)");
    expect(blur.s![`${uno}:${viOf(uno, "1.19.0-pre")}`]).toBe("fn Window::blur(& mut self, & mut App)");
    expect(blur.d![`${uno}:${viOf(uno, "1.19.0-pre")}`]).toBe(
      "Remove focus from all elements within this context's window.",
    );
    expect(blur.l![`${uno}:${viOf(uno, "1.19.0-pre")}`]).toEqual([["window.rs", 2081, 2094]]);
    // The doc removal: gpui-ce 0.3.2/0.3.3 carry no d row for the demoted key.
    const ce = bundle.providers.findIndex((p) => p.id === "gpui-ce");
    const bg = item("fn:BackgroundExecutor::new")!;
    expect(bg.d![`${ce}:${viOf(ce, "0.3.2")}`]).toBeUndefined();
    expect(bg.d![`${ce}:${viOf(ce, "0.3.3")}`]).toBeUndefined();
    expect(bg.d![`${ce}:${viOf(ce, "0.2.2")}`]).toContain("Creates a new BackgroundExecutor");
    // A struct key carries its measured declaration rows, never d/s rows.
    const win = item("struct:Window")!;
    expect(win.d).toBeUndefined();
    expect(win.s).toBeUndefined();
    expect(win.l![`${uno}:${viOf(uno, "1.19.0-pre")}`]).toBeDefined();
  });
});

describe("payloadSubsets reconstructs sidecar-shaped per-key subsets (RULE-7)", () => {
  // The runtime path: the item's synthesized column (manifest rows in the
  // shared row space) + the fragment's record → subsets the shared
  // derivations read. Each derivation must equal its whole-sidecar result.
  // The column is synthesized the way the view synthesizes it — from the
  // align-index (mirror-derived from the committed slice here; asserted
  // equal to the committed file by the alignment parity suite) + the item's
  // digest-state table.
  const alignIndex = deriveAlignIndex(slice);
  const itemOf = (key: string) => slice.items.find((i) => i.key === key)!;
  const columnOf = (key: string) => alignmentColumn(manifest, alignIndex, itemOf(key))!;
  const bundleOf = (key: string) => ({ providers: columnOf(key), rules: manifest.rules });
  const meta = { datasetSchema: slice.dataset_schema, datasetSyncedAt: slice.dataset_synced_at };
  const subsetsOf = (key: string) => {
    const ordinal = slice.items.findIndex((i) => i.key === key);
    const rec = committed[Math.floor(ordinal / PAYLOAD_BUCKET_KEYS)].items.find((i) => i.k === key) ?? null;
    return payloadSubsets(rec, columnOf(key), meta);
  };
  const expectStoryEqual = (fromFragment: ItemDocStory, fromWhole: ItemDocStory) => {
    expect(fromFragment.docs).toEqual(fromWhole.docs);
    expect(fromFragment.docReleases).toBe(fromWhole.docReleases);
    expect(fromFragment.bareReleases).toBe(fromWhole.bareReleases);
    expect(fromFragment.anchor).toEqual(fromWhole.anchor);
    expect([...fromFragment.variantDoc.entries()]).toEqual([...fromWhole.variantDoc.entries()]);
  };

  test("blur: the fragment's fn/doc subsets reproduce the whole-sidecar chips, Title and signatures", () => {
    const key = "fn:Window::blur";
    const subsets = subsetsOf(key);
    expect(subsets.fnTexts).not.toBeNull();
    expect(subsets.docTexts).not.toBeNull();
    // The deck's signatures (digest → measured text) match the whole sidecar.
    const fromFragment = fnDigestTexts(subsets.fnTexts, columnOf(key), key);
    const fromWhole = fnDigestTexts(fnTexts, columnOf(key), key);
    expect(fromFragment.size).toBe(2);
    expect([...fromFragment.entries()]).toEqual([...fromWhole.entries()]);
    // The doc story (Title caption + counts) matches the whole sidecar.
    expectStoryEqual(itemDocStory(bundleOf(key), key, subsets.docTexts), itemDocStory(bundleOf(key), key, docTexts));
  });

  test("a within-digest doc divergence (register_url_scheme) and the doc removal survive the transpose", () => {
    const urlScheme = "fn:App::register_url_scheme";
    const u = subsetsOf(urlScheme);
    const storyU = itemDocStory(bundleOf(urlScheme), urlScheme, u.docTexts);
    expect(storyU.docs.length).toBe(2);
    expectStoryEqual(storyU, itemDocStory(bundleOf(urlScheme), urlScheme, docTexts));
    const bg = "fn:BackgroundExecutor::new";
    const b = subsetsOf(bg);
    expectStoryEqual(itemDocStory(bundleOf(bg), bg, b.docTexts), itemDocStory(bundleOf(bg), bg, docTexts));
  });

  test("a type key reconstructs loc rows only — no d/s subsets (decision 1(a))", () => {
    const subsets = subsetsOf("struct:Window");
    expect(subsets.fnTexts).toBeNull();
    expect(subsets.docTexts).toBeNull();
    expect(subsets.srcLocs).not.toBeNull();
  });

  test("the popover's source rows resolve through the reconstructed src subset", () => {
    const key = "fn:Window::blur";
    const subsets = subsetsOf(key);
    const uno = columnOf(key).find((p) => p.id === "gpui-unofficial")!;
    const pv = subsets.srcLocs!.providers.find((x) => x.id === uno.id)!;
    const row = pv.versions.find((v) => v.vers === "1.19.0-pre")!;
    expect(row.source_locs[key]).toEqual([{ file: "window.rs", start: 2081, end: 2094 }]);
  });

  test("a key with no payload rows resolves an empty record (digest-only render)", () => {
    const withRows = new Set<string>();
    for (const b of committed) for (const i of b.items) withRows.add(i.k);
    const bare = buildIndex(bundle).keys.filter((k) => !withRows.has(k));
    expect(bare.length).toBeGreaterThan(0);
    const subsets = payloadSubsets(null, columnOf(bare[0]), meta);
    expect(subsets.fnTexts).toBeNull();
    expect(subsets.docTexts).toBeNull();
    expect(subsets.srcLocs).toBeNull();
  });
});

describe("validateKeyPayload is shape-strict (T-33 increment 3)", () => {
  // The validator tests need a row-rich bucket: pick the first committed
  // file carrying both a d row (fn docs) and an l row (source locations).
  const rowRich = committed.findIndex(
    (b) => b.items.some((i) => i.d) && b.items.some((i) => i.l),
  );
  const raw = () =>
    JSON.parse(readFileSync(join(DATA, bucketFiles[rowRich]), "utf8")) as Record<string, unknown>;

  test("a slice or sidecar served at a bucket URL fails loudly on its schema", () => {
    expect(() => validateKeyPayload(slice as unknown as Record<string, unknown>)).toThrow(
      /payload schema must be/,
    );
    expect(() => validateKeyPayload(fnTexts as unknown as Record<string, unknown>)).toThrow(
      /payload schema must be/,
    );
  });

  test("a wrong `from`, malformed rows or out-of-kind maps fail loudly", () => {
    const badFrom = { ...raw(), from: 1 };
    expect(() => validateKeyPayload(badFrom)).toThrow(/multiple of the 128-key bucket size/);
    const badRow = structuredClone(raw());
    const items = badRow.items as Record<string, unknown>[];
    const withMap = items.find((i) => i.d ?? i.s)!;
    const map = (withMap.d ?? withMap.s) as Record<string, unknown>;
    const rowKey = Object.keys(map)[0];
    map[`x${rowKey}`] = Object.values(map)[0];
    expect(() => validateKeyPayload(badRow)).toThrow(/row key "x/);
    const badLoc = structuredClone(raw());
    const litem = (badLoc.items as Record<string, unknown>[]).find((i) => i.l)!;
    const lmap = litem.l as Record<string, unknown>;
    const locKey = Object.keys(lmap)[0];
    (lmap[locKey] as unknown[][])[0] = ["window.rs", 5, 2];
    expect(() => validateKeyPayload(badLoc)).toThrow(/\.end must be >= start/);
  });

  test("duplicate keys and row-less items fail loudly (a broken box never renders)", () => {
    const dup = structuredClone(raw());
    const items = dup.items as Record<string, unknown>[];
    items.push({ ...items[0] });
    expect(() => validateKeyPayload(dup)).toThrow(/duplicate item key/);
    const empty = structuredClone(raw());
    const items2 = empty.items as Record<string, unknown>[];
    items2.push({ k: "fn:no_rows" });
    expect(() => validateKeyPayload(empty)).toThrow(/carries no rows/);
    expect(() => validateKeyPayload({ ...raw(), items: [] })).not.toThrow();
  });

  test("loc tuples must be [file, start, end] triples", () => {
    const bad = structuredClone(raw());
    const litem = (bad.items as Record<string, unknown>[]).find((i) => i.l)!;
    const lmap = litem.l as Record<string, unknown>;
    const locKey = Object.keys(lmap)[0];
    lmap[locKey] = [["window.rs", 1]];
    expect(() => validateKeyPayload(bad)).toThrow(/must be \[file, start, end\]/);
  });
});
