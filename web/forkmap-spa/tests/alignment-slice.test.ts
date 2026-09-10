// T-33 increments 2 + 5 — digest-state slice / item index / column-bucket
// parity tests.
//
// The Alignment view's data is the export-derived digest-state family:
//   - the committed forkmap-alignment.json digest-state slice (schema
//     gocar.forkmap.alignment.v1, the canonical column store + the parity
//     anchor — the runtime no longer fetches it since increment 5);
//   - the committed forkmap-align-index.json item index (schema
//     gocar.forkmap.alignindex.v1, what the view fetches on open: every key +
//     release-row count in the type-ahead order + the never-measured
//     markers);
//   - the committed forkmap-column-###.json column buckets (schema
//     gocar.forkmap.column.v1, one per-item digest table chunk, fetched per
//     selected item).
//
// These tests pin the split's honest guarantees (RULE-7 — the files are the
// dataset, computed another way):
//   - the slice validates, and its whole content equals the client derivation
//     over the full committed bundle (deriveAlignmentSlice);
//   - the item index validates and equals the client projection of the slice
//     (deriveAlignIndex), and its key list IS the corpus index (same keys in
//     the same type-ahead order, same per-key release counts as buildIndex);
//   - every committed column bucket validates and equals the client
//     re-bucketing of the slice (deriveColumnBuckets), records byte-equal to
//     the slice's own; ordinal addressing is exact (the index's position is
//     the slice's ordinal);
//   - validateAlignIndex / validateColumnBucket are shape-strict: a stale or
//     truncated file must fail loudly, never render a broken type-ahead or
//     matrix.
//
// deriveAlignmentSlice runs over the ~35 MB committed corpus once (a few
// seconds in bun) — the same order-of-magnitude the manifest parity suite's
// bundle walk costs, and the strongest parity assertion in the suite.

import { describe, expect, test } from "bun:test";
import { buildIndex, digestsOf, itemVariants } from "../src/bundle/derive";
import { deriveAlignIndex, deriveAlignmentSlice, deriveColumnBuckets, indexIndex } from "../src/bundle/alignmentSlice";
import {
  validateAlignIndex,
  validateAlignmentSlice,
  validateBundle,
  validateColumnBucket,
  BundleError,
} from "../src/bundle/validate";
import { COLUMN_BUCKET_KEYS } from "../src/bundle/types";
import type { ForkmapBundle } from "../src/bundle/types";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, "..", "..", "forkmap", "data");
const SLICE_PATH = join(DATA, "forkmap-alignment.json");
const INDEX_PATH = join(DATA, "forkmap-align-index.json");
const BUNDLE_PATH = join(DATA, "forkmap.json");

const slice = validateAlignmentSlice(JSON.parse(readFileSync(SLICE_PATH, "utf8")));
const index = validateAlignIndex(JSON.parse(readFileSync(INDEX_PATH, "utf8")));
const bundle: ForkmapBundle = validateBundle(JSON.parse(readFileSync(BUNDLE_PATH, "utf8")));

// Every committed column bucket, in ordinal order, validated.
const columnFiles = readdirSync(DATA)
  .filter((n) => /^forkmap-column-\d{3}\.json$/.test(n))
  .sort();
const committedColumns = columnFiles.map((n) => validateColumnBucket(JSON.parse(readFileSync(join(DATA, n), "utf8"))));

describe("the committed digest-state slice (T-33 increment 2)", () => {
  test("validates, and equals the client derivation over the full bundle (RULE-7)", () => {
    const derived = deriveAlignmentSlice(bundle);
    expect(slice.schema).toBe("gocar.forkmap.alignment.v1");
    expect(slice.dataset_schema).toBe(bundle.dataset_schema);
    expect(slice.dataset_synced_at).toBe(bundle.dataset_synced_at);
    // Deep equality with the derivation over the committed corpus: the file
    // IS the dataset's per-key digest state, computed another way.
    expect(slice).toEqual(derived);
  });

  test("its stream skeletons mirror the providers and RULE-4's measuredness split", () => {
    expect(slice.streams.map((s) => s.id)).toEqual(bundle.providers.map((p) => p.id));
    for (let pi = 0; pi < bundle.providers.length; pi++) {
      const want = bundle.providers[pi].versions
        .map((v, vi) => (v.surface === null || v.surface === undefined ? vi : -1))
        .filter((vi) => vi >= 0);
      expect(slice.streams[pi].unmeasured).toEqual(want);
    }
  });

  test("cells + pools cover the corpus exactly (multi-digest rows collapse into one cell)", () => {
    const cells = slice.items.reduce((n, i) => n + i.cells.length, 0);
    // The record count minus the cell count is exactly the extra digests of
    // rows measured under several digests at once (cfg variants / model
    // artifacts) — a release still counts once per key.
    const records = bundle.providers.reduce(
      (n, p) => n + p.versions.reduce((m, v) => m + (v.surface === null || v.surface === undefined ? 0 : v.surface.length), 0),
      0,
    );
    let extraDigests = 0;
    for (const p of bundle.providers) {
      for (const v of p.versions) {
        if (v.surface === null || v.surface === undefined) continue;
        const perKey = new Map<string, number>();
        for (const item of v.surface) perKey.set(item.key, (perKey.get(item.key) ?? 0) + 1);
        for (const n of perKey.values()) extraDigests += n - 1;
      }
    }
    expect(cells).toBeLessThanOrEqual(records);
    expect(records - cells).toBe(extraDigests);
  });

  test("the recorded blur generations keep their α = legacy, β = re-signed order", () => {
    const key = "fn:Window::blur";
    const item = slice.items.find((i) => i.key === key)!;
    // The pool IS the first-measured variant order the deck labels α, β, …
    expect(item.ds.length).toBeGreaterThan(0);
    expect(item.ds).toEqual(itemVariants(bundle, key).map((v) => v.digest));
    // Every cell's digest indexes address the item's own pool, and the cell
    // count is the corpus index's release-row count for the key.
    for (const [pi, vi, ds] of item.cells) {
      const row = bundle.providers[pi].versions[vi];
      const rowDigests = [...(digestsOf(row.surface, key) ?? [])];
      expect(ds).toEqual(rowDigests.map((d) => item.ds.indexOf(d)).sort((a, b) => a - b));
      for (const di of ds) expect(item.ds[di]).toBeTruthy();
    }
    expect(item.cells.length).toBe(buildIndex(bundle).byKey.get(key)!.versions);
  });
});

describe("the committed alignment item index (T-33 increment 5)", () => {
  test("validates, and equals the client projection of the slice (RULE-7)", () => {
    const derived = deriveAlignIndex(slice);
    expect(index.schema).toBe("gocar.forkmap.alignindex.v1");
    expect(index.dataset_schema).toBe(bundle.dataset_schema);
    expect(index.dataset_synced_at).toBe(bundle.dataset_synced_at);
    expect(index.streams).toEqual(slice.streams);
    expect(index).toEqual(derived);
  });

  test("its key list IS the corpus index (keys, order and per-key release counts)", () => {
    const fromBundle = buildIndex(bundle);
    const fromIndex = indexIndex(index);
    expect(fromIndex.keys).toEqual(fromBundle.keys);
    expect(fromIndex.byKey.size).toBe(fromBundle.byKey.size);
    for (const key of fromIndex.keys) {
      const a = fromIndex.byKey.get(key)!;
      const b = fromBundle.byKey.get(key)!;
      expect(a.versions, key).toBe(b.versions);
    }
  });

  test("its key order is the slice's ordinal authority (no hash spec in parity)", () => {
    expect(index.keys.map((k) => k.k)).toEqual(slice.items.map((i) => i.key));
    for (const [ordinal, key] of index.keys.entries()) {
      expect(key.n).toBe(slice.items[ordinal].cells.length);
    }
  });
});

describe("the committed column buckets (T-33 increment 5)", () => {
  test("there is one bucket per ordinal range, and every bucket validates", () => {
    expect(committedColumns.length).toBe(Math.ceil(slice.items.length / COLUMN_BUCKET_KEYS));
    for (const [bi, b] of committedColumns.entries()) {
      expect(b.schema).toBe("gocar.forkmap.column.v1");
      expect(b.from).toBe(bi * COLUMN_BUCKET_KEYS);
      expect(b.items.length).toBeGreaterThan(0);
      expect(b.items.length).toBeLessThanOrEqual(COLUMN_BUCKET_KEYS);
      expect(b.dataset_schema).toBe(bundle.dataset_schema);
      expect(b.dataset_synced_at).toBe(bundle.dataset_synced_at);
    }
  });

  test("every bucket equals the client re-bucketing of the slice (RULE-7)", () => {
    const derived = deriveColumnBuckets(slice);
    expect(derived.length).toBe(committedColumns.length);
    for (const [bi, want] of committedColumns.entries()) {
      expect(want).toEqual(derived[bi]);
    }
  });

  test("addressing is ordinal-only: every item sits in its slice-ordinal bucket, byte-equal to its slice record", () => {
    const byOrdinal = new Map(slice.items.map((item, ordinal) => [item.key, ordinal]));
    const seen = new Set<string>();
    for (const [bi, b] of committedColumns.entries()) {
      for (const item of b.items) {
        expect(seen.has(item.k), `${item.k} appears once across buckets`).toBe(false);
        seen.add(item.k);
        const ordinal = byOrdinal.get(item.k);
        expect(ordinal, `${item.k} is a measured slice key`).toBeDefined();
        const o = ordinal!;
        expect(Math.floor(o / COLUMN_BUCKET_KEYS)).toBe(bi);
        expect(o).toBeGreaterThanOrEqual(b.from);
        expect(o).toBeLessThan(b.from + COLUMN_BUCKET_KEYS);
        // The bucket record is the slice's own item (the slice stays the
        // canonical column store the runtime no longer fetches).
        const sliceItem = slice.items[o];
        expect(sliceItem.key).toBe(item.k);
        expect(item.ds).toEqual(sliceItem.ds);
        expect(item.cells).toEqual(sliceItem.cells);
      }
    }
    expect(seen.size).toBe(slice.items.length);
  });

  test("the recorded blur generations ride their own bucket intact", () => {
    const key = "fn:Window::blur";
    const ordinal = slice.items.findIndex((i) => i.key === key);
    const bucket = committedColumns[Math.floor(ordinal / COLUMN_BUCKET_KEYS)];
    const rec = bucket.items.find((i) => i.k === key)!;
    const sliceItem = slice.items[ordinal];
    // The bucket record is byte-equal to its slice record, and still holds the
    // corpus index's release-row count for the key.
    expect(rec.ds).toEqual(sliceItem.ds);
    expect(rec.cells).toEqual(sliceItem.cells);
    expect(rec.cells.length).toBe(buildIndex(bundle).byKey.get(key)!.versions);
  });
});

describe("the split's validators are shape-strict (T-33 increments 2 + 5)", () => {
  const sliceRaw = () => JSON.parse(readFileSync(SLICE_PATH, "utf8")) as Record<string, unknown>;
  const indexRaw = () => JSON.parse(readFileSync(INDEX_PATH, "utf8")) as Record<string, unknown>;
  const firstColumnRaw = () =>
    JSON.parse(readFileSync(join(DATA, columnFiles[0]), "utf8")) as Record<string, unknown>;

  test("a full bundle served at the slice URL fails loudly on its schema", () => {
    const full = JSON.parse(readFileSync(BUNDLE_PATH, "utf8")) as Record<string, unknown>;
    expect(() => validateAlignmentSlice(full)).toThrow(BundleError);
    expect(() => validateAlignmentSlice(full)).toThrow(/alignment schema must be/);
  });

  test("a slice served at the index URL (or wrong keys) fails loudly", () => {
    expect(() => validateAlignIndex(sliceRaw())).toThrow(/align index schema must be/);
    const wrongSchema = { ...indexRaw(), schema: "gocar.forkmap.alignment.v1" };
    expect(() => validateAlignIndex(wrongSchema)).toThrow(/align index schema must be/);
    const noKeys = { ...indexRaw(), keys: [] };
    expect(() => validateAlignIndex(noKeys)).toThrow(/non-empty array/);
    const dupKey = structuredClone(indexRaw());
    (dupKey.keys as Record<string, unknown>[]).push({ ...(dupKey.keys as Record<string, unknown>[])[0] });
    expect(() => validateAlignIndex(dupKey)).toThrow(/duplicate item key/);
    const zeroCount = structuredClone(indexRaw());
    ((zeroCount.keys as Record<string, unknown>[])[0].n as number) = 0;
    expect(() => validateAlignIndex(zeroCount)).toThrow(/positive release-row count/);
  });

  test("a slice (or bucket) served at a column URL fails loudly", () => {
    expect(() => validateColumnBucket(sliceRaw())).toThrow(/column schema must be/);
    const bucket = firstColumnRaw();
    const wrongFrom = { ...bucket, from: 1 };
    expect(() => validateColumnBucket(wrongFrom)).toThrow(/multiple of the .*-key bucket size/);
    expect(() => validateColumnBucket({ ...bucket, items: [] })).toThrow(/non-empty array/);
  });

  test("bad digest pools, cells or markers fail loudly (a broken matrix never renders)", () => {
    const shortDigest = structuredClone(sliceRaw());
    const items = shortDigest.items as Record<string, unknown>[];
    (items[0].ds as string[])[0] = "deadbeef";
    expect(() => validateAlignmentSlice(shortDigest)).toThrow(/64-hex/);

    const dupKey = structuredClone(sliceRaw());
    (dupKey.items as Record<string, unknown>[]).push({ ...(dupKey.items as Record<string, unknown>[])[0] });
    expect(() => validateAlignmentSlice(dupKey)).toThrow(/duplicate item key/);

    const badCell = structuredClone(sliceRaw());
    const first = (badCell.items as Record<string, unknown>[])[0];
    (first.cells as unknown[])[0] = [999, 0, [0]];
    expect(() => validateAlignmentSlice(badCell)).toThrow(/provider index out of bounds/);

    const unsortedCell = structuredClone(sliceRaw());
    const second = (unsortedCell.items as Record<string, unknown>[])[0];
    (second.cells as unknown[]).push([0, 0, [0]]); // (0,0) precedes the first cell
    expect(() => validateAlignmentSlice(unsortedCell)).toThrow(/ordered by \(provider, version\)/);

    const badUnmeasured = structuredClone(sliceRaw());
    (badUnmeasured.streams as Record<string, unknown>[])[0].unmeasured = [2, 1];
    expect(() => validateAlignmentSlice(badUnmeasured)).toThrow(/sorted and unique/);

    // The column bucket validator shares the pool/cell strictness.
    const col = firstColumnRaw();
    const colItems = col.items as Record<string, unknown>[];
    (colItems[0].ds as string[])[0] = "deadbeef";
    expect(() => validateColumnBucket(col)).toThrow(/64-hex/);
  });

  test("the index's type-ahead order is validated (a shuffled file never renders a wrong ordinal)", () => {
    const shuffled = structuredClone(indexRaw());
    const keys = shuffled.keys as Record<string, unknown>[];
    [keys[0], keys[1]] = [keys[1], keys[0]];
    expect(() => validateAlignIndex(shuffled)).toThrow(/out of type-ahead order/);
  });
});
