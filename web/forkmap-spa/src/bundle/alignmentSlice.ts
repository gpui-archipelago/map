// T-33 increment 5 — the Alignment index + per-key column fragments:
// loader + view helpers + parity mirrors.
//
// Since T-33 increment 5 the Alignment view's data comes from two
// export-derived files instead of the whole digest-state slice
// (data/forkmap-alignment.json, schema gocar.forkmap.alignment.v1 — which
// stays committed + emitted as the canonical column store + the parity
// anchor every mirror projects from, but leaves the runtime fetch graph):
//
//   - data/forkmap-align-index.json (schema gocar.forkmap.alignindex.v1,
//     ~0.7 MB at the current corpus) — every item key with its release-row
//     count in the type-ahead order, plus the per-stream never-measured
//     markers (RULE-4). Fetched when the Alignment view opens: the search
//     bar, kind pills and presets read it, and a key's position in its
//     `keys` list IS its ordinal in the shared addressing space the column
//     + payload buckets are split on.
//   - data/forkmap-column-###.json (schema gocar.forkmap.column.v1, 105
//     files, median ≈ 29 KB) — the digest-state slice's per-key tables
//     (digest pools in first-measured order + per-release present cells as
//     digest indexes) bucketed by item ordinal (`bucket = ordinal / 128`).
//     One bucket is fetched when an item is selected — the matrix + deck of
//     one symbol, never the whole ~3.5 MB column store.
//
// The full-corpus bundle is never fetched on any path (the Changes/Journal
// corpus views read the export-derived per-release row data instead —
// corpus.ts, T-33 increment 4); the boot manifest supplies the release rows
// (metadata). Option (c) end to end: the tables the view renders are
// precomputed at export by gocar code and asserted equal to the client
// derivations by the parity suite.
//
// RULE-7 stays intact: deriveAlignmentSlice reproduces the exporter's
// digest-state arithmetic over the full bundle (the committed slice anchor),
// and deriveAlignIndex / deriveColumnBuckets project that slice back into
// the index + bucket shapes so the parity suite can assert every committed
// file equals the client derivation — the files are the dataset, computed
// another way. The view's own numbers are computed from the loaded files.
//
// The index fetch is lazy like the other view payloads: it happens only when
// the Alignment view opens (deep links land in its loading state first —
// never a dead-end), is module-cached for the session, and reports
// byte-accurate streaming progress. Column buckets are plain module-cached
// fetches (small — no byte progress, like the payload buckets); a failed
// bucket is an honest error state for the item area, never an invented
// matrix. URLs are assembled from parts so no bundler treats the data files
// as build assets (see useBundle.ts for the why).

import { useEffect, useMemo, useState } from "react";
import type { ForkmapBundle, ForkmapManifest, VersionRow } from "./types";
import {
  ALIGN_INDEX_SCHEMA,
  ALIGNMENT_SCHEMA,
  COLUMN_BUCKET_KEYS,
  COLUMN_SCHEMA,
  type AlignIndex,
  type AlignmentItem,
  type AlignmentSlice,
  type ColumnBucket,
  type Provider,
} from "./types";
import { compareKeys, splitKey, type CorpusIndex } from "./derive";
import { BundleError, validateAlignIndex, validateColumnBucket } from "./validate";
import { fetchStreamingText, type LoadProgress } from "./useBundle";
import { committedDataUrl } from "./dataUrls";

/** The committed URL of the alignment item index
 * (`forkmap-align-index.json`, T-33 increment 5). */
export function alignIndexUrl(): string {
  return committedDataUrl("forkmap-align-index.json");
}

/** The committed URL of one column bucket (`forkmap-column-<bucket:03>.json`,
 * T-33 increment 5). */
export function columnUrl(bucket: number): string {
  return committedDataUrl(`forkmap-column-${String(bucket).padStart(3, "0")}.json`);
}

let cachedIndex: Promise<AlignIndex> | null = null;

function loadAlignIndex(onProgress: (p: LoadProgress) => void): Promise<AlignIndex> {
  if (!cachedIndex) {
    cachedIndex = (async () => {
      const url = alignIndexUrl();
      const text = await fetchStreamingText(url, onProgress);
      onProgress({ phase: "validate", loaded: text.length, total: text.length });
      return validateAlignIndex(JSON.parse(text));
    })();
    // A failed load must not poison the cache for later navigations.
    cachedIndex.catch(() => {
      cachedIndex = null;
    });
  }
  return cachedIndex;
}

export type AlignIndexState =
  | { status: "idle" | "loading" | "error"; index: null; error: string | null; progress: LoadProgress }
  | { status: "ready"; index: AlignIndex; error: null; progress: LoadProgress };

const IDLE: LoadProgress = { phase: "fetch", loaded: 0, total: null };
const IDLE_STATE: AlignIndexState = { status: "idle", index: null, error: null, progress: IDLE };

/** Fetch the alignment item index when `needed` becomes true (view-level lazy
 * fetch). The Alignment view renders its loading panel until it resolves;
 * deep links into it land in the loading state first (never a dead-end). */
export function useAlignIndex(needed: boolean): AlignIndexState {
  const [state, setState] = useState<AlignIndexState>(IDLE_STATE);
  useEffect(() => {
    if (!needed) return;
    let cancelled = false;
    const setProgress = (progress: LoadProgress) => {
      if (!cancelled) setState((s) => ({ ...s, progress }));
    };
    setState((s) =>
      s.status === "ready"
        ? s
        : { status: "loading", index: null, error: null, progress: s.progress ?? IDLE },
    );
    loadAlignIndex(setProgress)
      .then((index) => {
        if (!cancelled) setState((s) => ({ status: "ready", index, error: null, progress: s.progress }));
      })
      .catch((e) => {
        if (!cancelled) {
          setState({
            status: "error",
            index: null,
            error: e instanceof Error ? e.message : String(e),
            progress: IDLE,
          });
          console.error("alignment item index load failed:", e instanceof Error ? e.message : e);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [needed]);
  return state;
}

const columnBucketCache = new Map<number, Promise<ColumnBucket>>();

function loadColumnBucket(bucket: number): Promise<ColumnBucket> {
  let cached = columnBucketCache.get(bucket);
  if (!cached) {
    cached = (async () => {
      const url = columnUrl(bucket);
      const res = await fetch(url, { cache: "no-cache" });
      if (!res.ok) {
        throw new BundleError(`could not load ${url} (HTTP ${res.status})`);
      }
      return validateColumnBucket(await res.json());
    })();
    // A failed load must not poison the cache for later navigations.
    cached.catch(() => {
      columnBucketCache.delete(bucket);
    });
    columnBucketCache.set(bucket, cached);
  }
  return cached;
}

export type ItemColumnState =
  | { status: "idle" | "loading" | "error"; item: null; error: string | null }
  | { status: "ready"; item: AlignmentItem; error: null };

const COLUMN_IDLE: ItemColumnState = { status: "idle", item: null, error: null };

/** Fetch the selected item's digest-state table: resolve its ordinal from the
 * item index (a key's position in the type-ahead list — the same order the
 * exporter bucketed on), load its column bucket (module-cached per bucket),
 * and pick its record. A key the index carries always resolves: the bucket's
 * `items` are the slice's own records in order, so every indexed key rides
 * exactly one bucket. Loading is brief (median bucket ≈ 29 KB); a failed
 * bucket is an honest error the item area renders — never an invented
 * matrix. */
export function useItemColumn(index: AlignIndex, itemKey: string): ItemColumnState {
  const ordinals = useMemo(() => alignOrdinals(index), [index]);
  const [state, setState] = useState<ItemColumnState>(COLUMN_IDLE);
  useEffect(() => {
    const ordinal = ordinals.get(itemKey);
    if (ordinal === undefined) {
      // A key the index does not carry is never mounted by the view; nothing
      // to fetch or resolve.
      return;
    }
    let cancelled = false;
    setState({ status: "loading", item: null, error: null });
    loadColumnBucket(Math.floor(ordinal / COLUMN_BUCKET_KEYS))
      .then((bucket) => {
        if (cancelled) return;
        const rec = bucket.items.find((it) => it.k === itemKey) ?? null;
        if (rec === null) {
          setState({
            status: "error",
            item: null,
            error: `the column bucket for ${itemKey} does not carry it — stale index or bucket`,
          });
          return;
        }
        // Bucket records are the slice's own items (key text under `k`); the
        // view consumes them in the slice's `key` shape, so the record is
        // widened once here.
        setState({ status: "ready", item: { key: rec.k, ds: rec.ds, cells: rec.cells }, error: null });
      })
      .catch((e) => {
        if (cancelled) return;
        setState({ status: "error", item: null, error: e instanceof Error ? e.message : String(e) });
        console.error("column bucket load failed:", e instanceof Error ? e.message : e);
      });
    return () => {
      cancelled = true;
    };
  }, [ordinals, itemKey]);
  return state;
}

// ---------------------------------------------------------------------------
// Parity mirrors (RULE-7)
// ---------------------------------------------------------------------------

/** The exporter's digest-state derivation, reproduced over the full bundle —
 * the mirror the parity suite asserts the committed slice anchor against.
 * One pass over the corpus: per release row, each key's digests (sorted
 * within the row, like `itemVariants`), assigning pool indexes on first
 * measurement — so `ds` ends up in first-measured order and the cells carry
 * the row's digest indexes. Never called by the views (they read the index +
 * column buckets); its job is to prove the slice file is the dataset,
 * computed another way, and to be the input every fragment mirror projects
 * from. */
export function deriveAlignmentSlice(bundle: ForkmapBundle): AlignmentSlice {
  const streams = bundle.providers.map((p) => ({
    id: p.id,
    unmeasured: p.versions
      .map((v, vi) => (v.surface === null || v.surface === undefined ? vi : -1))
      .filter((vi) => vi >= 0),
  }));
  // key → { ds (insertion order == first-measured order), index, cells }
  const byKey = new Map<string, { ds: string[]; idx: Map<string, number>; cells: Array<[number, number, number[]]> }>();
  bundle.providers.forEach((p, pi) => {
    p.versions.forEach((v, vi) => {
      if (v.surface === null || v.surface === undefined) return;
      const rowKeys = new Map<string, Set<string>>();
      for (const item of v.surface) {
        let set = rowKeys.get(item.key);
        if (!set) {
          set = new Set();
          rowKeys.set(item.key, set);
        }
        set.add(item.digest);
      }
      for (const [key, digests] of rowKeys) {
        let rec = byKey.get(key);
        if (!rec) {
          rec = { ds: [], idx: new Map(), cells: [] };
          byKey.set(key, rec);
        }
        const idxs: number[] = [];
        for (const d of [...digests].sort()) {
          let i = rec.idx.get(d);
          if (i === undefined) {
            i = rec.ds.length;
            rec.ds.push(d);
            rec.idx.set(d, i);
          }
          idxs.push(i);
        }
        idxs.sort((a, b) => a - b);
        rec.cells.push([pi, vi, idxs]);
      }
    });
  });
  const items: AlignmentItem[] = [...byKey.entries()].map(([key, rec]) => ({
    key,
    ds: rec.ds,
    cells: rec.cells,
  }));
  items.sort((a, b) => compareKeys(a.key, b.key));
  return {
    schema: ALIGNMENT_SCHEMA,
    dataset_schema: bundle.dataset_schema,
    dataset_synced_at: bundle.dataset_synced_at,
    streams,
    items,
  };
}

/** The exporter's alignment-index derivation, reproduced over the committed
 * slice — the mirror the parity suite asserts `forkmap-align-index.json`
 * against: the slice's streams byte-equal, and every key + release-row count
 * in the slice's own type-ahead order. Never called by the views; its job is
 * to prove the index file is the slice's addressing authority, computed
 * another way. */
export function deriveAlignIndex(slice: AlignmentSlice): AlignIndex {
  return {
    schema: ALIGN_INDEX_SCHEMA,
    dataset_schema: slice.dataset_schema,
    dataset_synced_at: slice.dataset_synced_at,
    streams: slice.streams.map((s) => ({ id: s.id, unmeasured: [...s.unmeasured] })),
    keys: slice.items.map((item) => ({ k: item.key, n: item.cells.length })),
  };
}

/** The exporter's column-bucket derivation, reproduced over the committed
 * slice — the mirror the parity suite asserts every `forkmap-column-###.json`
 * against: the slice's items chunked by COLUMN_BUCKET_KEYS ordinals, records
 * byte-equal to the slice's own. Never called by the views; its job is to
 * prove each bucket file is the dataset, computed another way. */
export function deriveColumnBuckets(slice: AlignmentSlice): ColumnBucket[] {
  const nBuckets = Math.ceil(slice.items.length / COLUMN_BUCKET_KEYS);
  const buckets: ColumnBucket[] = Array.from({ length: nBuckets }, (_, b) => ({
    schema: COLUMN_SCHEMA,
    dataset_schema: slice.dataset_schema,
    dataset_synced_at: slice.dataset_synced_at,
    from: b * COLUMN_BUCKET_KEYS,
    items: [],
  }));
  slice.items.forEach((item, ordinal) => {
    buckets[Math.floor(ordinal / COLUMN_BUCKET_KEYS)].items.push({
      k: item.key,
      ds: item.ds,
      cells: item.cells,
    });
  });
  return buckets;
}

// ---------------------------------------------------------------------------
// View helpers over the manifest + index/column data
// ---------------------------------------------------------------------------

/** The type-ahead index over the alignment item index: every measured item
 * identity with the number of release rows carrying it (a release counts
 * once per key — a multi-digest row is one cell). Same numbers as
 * `buildIndex` over the full corpus, computed from the file the view loads. */
export function indexIndex(index: AlignIndex): CorpusIndex {
  const byKey = new Map<string, { key: string; kind: string; name: string; versions: number }>();
  for (const key of index.keys) {
    const [kind, name] = splitKey(key.k);
    byKey.set(key.k, { key: key.k, kind, name, versions: key.n });
  }
  const keys = index.keys.map((k) => k.k).sort(compareKeys);
  // T-46: the lowercase parallel list the type-ahead scan reads (see
  // CorpusIndex.search) — built once per index, never per keystroke.
  return { keys, search: keys.map((k) => k.toLowerCase()), byKey };
}

/** key → ordinal (position in the align-index's type-ahead `keys` list) —
 * the addressing space every column + payload bucket is split on, so the
 * client resolves a key's bucket from the index it already holds (deep links
 * load the index for the type-ahead; ordinal addressing adds nothing to
 * their path). */
export function alignOrdinals(index: AlignIndex): Map<string, number> {
  const m = new Map<string, number>();
  index.keys.forEach((key, ordinal) => m.set(key.k, ordinal));
  return m;
}

/** Synthesize the Alignment view's row set for one item: every provider's
 * release rows (metadata from the boot manifest, in the shared
 * provider/version order) with their `surface` reduced to the item's own
 * measured digest records — null for never-measured rows (RULE-4's marker,
 * from the index's per-stream `unmeasured` list), empty for measured rows
 * without the item, the item's digests where a cell exists. The result is
 * shaped exactly like full-bundle providers, so the shared derivations
 * (`itemVariants`, `digestPrevalence`, `streamCallouts`, `cellState`, …)
 * run unchanged over the selected item — the matrix, deck and popover read
 * the same facts they always read, from one ~29 KB column bucket instead of
 * the ~35 MB corpus or the ~3.5 MB slice. Returns null when the item record
 * is missing (an unknown hash never invents a matrix — RULE-7). */
export function alignmentColumn(
  manifest: ForkmapManifest,
  index: AlignIndex,
  item: AlignmentItem,
): Provider[] | null {
  if (!item || !item.key) return null;
  const cellDigests = new Map<string, string[]>();
  for (const [pi, vi, idxs] of item.cells) {
    cellDigests.set(`${pi}:${vi}`, idxs.map((i) => item.ds[i]));
  }
  return manifest.providers.map((p, pi) => {
    const unmeasured = new Set(index.streams[pi]?.unmeasured ?? []);
    const versions: VersionRow[] = p.versions.map((row, vi) => {
      let surface: VersionRow["surface"];
      if (unmeasured.has(vi)) {
        surface = null;
      } else {
        const digests = cellDigests.get(`${pi}:${vi}`);
        surface = digests ? digests.map((digest) => ({ key: item.key, digest })) : [];
      }
      return { ...row, surface };
    });
    return { ...p, versions };
  });
}
