// T-33 increment 3 — per-key payload fragments: loader + parity mirror +
// per-key subset reconstruction.
//
// The Alignment item box (resolved fn signatures + docstrings) and the
// release popover (measured source locations) read their rows from the
// export-derived per-key payload fragments (data/forkmap-payload-###.json,
// schema gocar.forkmap.payload.v1) instead of the whole-file
// fn-texts/doc-texts/source-locs sidecars (~15.7 + 19.8 + 31.4 MB): the
// exporter transposed those sidecars' (release, key) rows into a per-key
// layout addressed by the shared (provider, version) row space and bucketed
// by the item ordinal — position in the digest-state slice's type-ahead
// order, which the align-index file carries (T-33 increment 5) —
// `bucket = ordinal / 128`, so selecting an item fetches one bucket
// (~0.1–1 MB at the current corpus) — and pinning a cell never fetches
// anything more (its source rows rode the same bucket).
//
// RULE-7 stays intact: the fragments are derived from the dataset by the
// generating command (export-fork-map); the derivePayloadBuckets mirror
// below projects the committed whole-file sidecars into the fragment shape
// so the parity suite asserts the committed buckets equal that projection
// (the sidecars stay the canonical row store + the strongest anchor — no
// runtime view fetches them whole: the Changes/Journal corpus views read the
// export-derived per-release rows instead, T-33 increment 4); and the runtime
// reconstructs sidecar-shaped per-key subsets from a fragment — provider
// id/vers resolved via the boot manifest's rows, exactly like the column
// synthesis — so the shared derivations (`fnDigestTexts`, `itemDocStory`,
// `docTextsOf/At`, `srcLocsOf/At`) run unchanged over the loaded fragment.
//
// The fetch is lazy (on item selection), module-cached per bucket, and plain
// (no byte progress — a bucket is a fraction of the corpus/slice payloads);
// a failed load degrades to the honest digest-only / anchor-less states
// (never a dead-end box), and a key with no payload rows at all resolves to
// an empty record — its box and popover simply have no measured bytes.

import { useEffect, useMemo, useState } from "react";
import type {
  AlignIndex,
  AlignmentSlice,
  DocTextsBundle,
  FnTextsBundle,
  KeyPayload,
  PayloadBucket,
  Provider,
  SrcLocsBundle,
  KeyMemberVectors,
  TypeMembersBundle,
} from "./types";
import { DOC_TEXTS_SCHEMA, FN_TEXTS_SCHEMA, PAYLOAD_BUCKET_KEYS, SRC_LOCS_SCHEMA } from "./types";
import { alignOrdinals } from "./alignmentSlice";
import { BundleError, validateKeyPayload, validateTypeMembers } from "./validate";
import { committedDataUrl } from "./dataUrls";

/** The committed URL of one payload bucket (`forkmap-payload-<bucket:03>.json`). */
export function payloadUrl(bucket: number): string {
  return committedDataUrl(`forkmap-payload-${String(bucket).padStart(3, "0")}.json`);
}

const bucketCache = new Map<number, Promise<PayloadBucket>>();

function loadBucket(bucket: number): Promise<PayloadBucket> {
  let cached = bucketCache.get(bucket);
  if (!cached) {
    cached = (async () => {
      const url = payloadUrl(bucket);
      const res = await fetch(url, { cache: "no-cache" });
      if (!res.ok) {
        throw new BundleError(`could not load ${url} (HTTP ${res.status})`);
      }
      return validateKeyPayload(await res.json());
    })();
    // A failed load must not poison the cache for later navigations.
    cached.catch(() => {
      bucketCache.delete(bucket);
    });
    bucketCache.set(bucket, cached);
  }
  return cached;
}

export type KeyPayloadState =
  | { status: "idle" | "loading" | "error"; payload: null; error: string | null }
  | { status: "ready"; payload: KeyPayload | null; error: null };

const IDLE: KeyPayloadState = { status: "idle", payload: null, error: null };

/** key → item ordinal (position in the align-index's type-ahead key list —
 * the same order as the digest-state slice's `items`, the shared addressing
 * space every payload bucket is split on), so the client resolves a key's
 * bucket from the index it already holds (deep links load the index
 * for the type-ahead; ordinal addressing adds nothing to their path). */
export const keyOrdinals = alignOrdinals;

/** Fetch the selected item's payload rows: resolve its item ordinal from the
 * index, load its bucket (module-cached per bucket), and pick its record.
 * `payload` is null at ready only when the key has no payload rows at all
 * (nothing to render — its box and popover stay in the digest-only /
 * no-anchor states). */
export function useKeyPayload(index: AlignIndex, itemKey: string): KeyPayloadState {
  const ordinals = useMemo(() => keyOrdinals(index), [index]);
  const [state, setState] = useState<KeyPayloadState>(IDLE);
  useEffect(() => {
    const ordinal = ordinals.get(itemKey);
    if (ordinal === undefined) {
      // A key the index does not carry is never mounted by the view; nothing
      // to fetch or resolve.
      return;
    }
    let cancelled = false;
    setState({ status: "loading", payload: null, error: null });
    loadBucket(Math.floor(ordinal / PAYLOAD_BUCKET_KEYS))
      .then((bucket) => {
        if (cancelled) return;
        const rec = bucket.items.find((it) => it.k === itemKey) ?? null;
        setState({ status: "ready", payload: rec, error: null });
      })
      .catch((e) => {
        if (cancelled) return;
        setState({ status: "error", payload: null, error: e instanceof Error ? e.message : String(e) });
        console.error("payload bucket load failed:", e instanceof Error ? e.message : e);
      });
    return () => {
      cancelled = true;
    };
  }, [ordinals, itemKey]);
  return state;
}

// ---------------------------------------------------------------------------
// Parity mirror (RULE-7)
// ---------------------------------------------------------------------------

/** Project the whole-file sidecars into the per-key payload shape for one
 * key — the mirror's per-key step (and the render suite's way to feed an
 * item's committed rows without the whole file). Row indexes resolve against
 * `providers` (the full bundle in the parity suite — the shared row space),
 * exactly as the exporter transposed the sidecars. Null when the key has no
 * payload rows of any kind. */
export function projectKeyPayload(
  key: string,
  providers: Provider[],
  fnTexts: FnTextsBundle | null,
  docTexts: DocTextsBundle | null,
  srcLocs: SrcLocsBundle | null,
): KeyPayload | null {
  const d: Record<string, string> = {};
  const s: Record<string, string> = {};
  const l: Record<string, Array<[string, number, number]>> = {};
  providers.forEach((p, pi) => {
    const viOf = (vers: string) => p.versions.findIndex((row) => row.vers === vers);
    const fnp = fnTexts?.providers.find((x) => x.id === p.id);
    if (fnp) {
      for (const v of fnp.versions) {
        const vi = viOf(v.vers);
        if (vi < 0) continue;
        const text = v.fn_texts[key];
        if (text !== undefined) s[`${pi}:${vi}`] = text;
      }
    }
    const dp = docTexts?.providers.find((x) => x.id === p.id);
    if (dp) {
      for (const v of dp.versions) {
        const vi = viOf(v.vers);
        if (vi < 0) continue;
        const text = v.doc_texts[key];
        if (text !== undefined) d[`${pi}:${vi}`] = text;
      }
    }
    const lp = srcLocs?.providers.find((x) => x.id === p.id);
    if (lp) {
      for (const v of lp.versions) {
        const vi = viOf(v.vers);
        if (vi < 0) continue;
        const locs = v.source_locs[key];
        if (locs) l[`${pi}:${vi}`] = locs.map((loc) => [loc.file, loc.start, loc.end]);
      }
    }
  });
  const out: KeyPayload = { k: key };
  if (Object.keys(d).length > 0) out.d = d;
  if (Object.keys(s).length > 0) out.s = s;
  if (Object.keys(l).length > 0) out.l = l;
  return Object.keys(out).length > 1 ? out : null;
}

/** The exporter's fragment derivation, reproduced over the committed slice +
 * whole-file sidecars — the mirror the parity suite asserts every committed
 * bucket against. Same algorithm as `export-fork-map`'s transpose: the
 * sidecars' (release, key) rows land in per-key maps keyed on the shared row
 * space, then bucket by the slice's item ordinal. Never called by the views
 * (they read the committed buckets); its job is to prove each fragment file
 * is the dataset, computed another way. */
export function derivePayloadBuckets(
  slice: AlignmentSlice,
  providers: Provider[],
  fnTexts: FnTextsBundle,
  docTexts: DocTextsBundle,
  srcLocs: SrcLocsBundle,
): PayloadBucket[] {
  const nBuckets = Math.ceil(slice.items.length / PAYLOAD_BUCKET_KEYS);
  const buckets: PayloadBucket[] = Array.from({ length: nBuckets }, (_, b) => ({
    schema: "gocar.forkmap.payload.v1",
    dataset_schema: slice.dataset_schema,
    dataset_synced_at: slice.dataset_synced_at,
    from: b * PAYLOAD_BUCKET_KEYS,
    items: [],
  }));
  slice.items.forEach((item, ordinal) => {
    const rec = projectKeyPayload(item.key, providers, fnTexts, docTexts, srcLocs);
    if (!rec) return;
    buckets[Math.floor(ordinal / PAYLOAD_BUCKET_KEYS)].items.push(rec);
  });
  return buckets;
}

// ---------------------------------------------------------------------------
// Per-key subset reconstruction (view helpers)
// ---------------------------------------------------------------------------

/** A payload row key parsed into (provider index, version index), or null
 * when it is malformed (validators reject malformed rows up front; the guard
 * keeps a stale bucket from crashing a render). */
function parseRow(row: string): [number, number] | null {
  const i = row.indexOf(":");
  if (i <= 0) return null;
  const pi = Number(row.slice(0, i));
  const vi = Number(row.slice(i + 1));
  if (!Number.isInteger(pi) || !Number.isInteger(vi) || pi < 0 || vi < 0) return null;
  return [pi, vi];
}

export interface PayloadMeta {
  datasetSchema: string;
  datasetSyncedAt: string | null;
}

/** The sidecar-shaped per-key subsets a fragment's rows stand for (T-33
 * increment 3). */
export interface PayloadSubsets {
  /** Releases that resolve a signature text for the key (fn keys only). */
  fnTexts: FnTextsBundle | null;
  /** Releases that resolve a docstring for the key (fn keys only). */
  docTexts: DocTextsBundle | null;
  /** Releases that measure a declaration location for the key. */
  srcLocs: SrcLocsBundle | null;
}

const NONE: PayloadSubsets = { fnTexts: null, docTexts: null, srcLocs: null };

/** Reconstruct the bundle-shaped per-key subsets a fragment carries —
 * provider id/vers resolved via `providers` (the selected item's synthesized
 * column: the manifest's release rows in the shared row space — the same
 * resolution the column synthesis uses), so the shared derivations
 * (`fnDigestTexts`, `itemDocStory`, `docTextsOf/At`, `srcLocsOf/At`) run
 * unchanged over the subset. A row index out of the provider rows' range (a
 * stale bucket against a fresh manifest) is skipped — honest degrade, never
 * a crash; a fragment for a key with no rows of a kind reconstructs no
 * subset of that kind. */
export function payloadSubsets(
  record: KeyPayload | null,
  providers: Provider[],
  meta: PayloadMeta,
): PayloadSubsets {
  if (!record) return NONE;
  const versionAt = (pi: number, vi: number): string | null => providers[pi]?.versions[vi]?.vers ?? null;
  const fnTexts: FnTextsBundle = {
    schema: FN_TEXTS_SCHEMA,
    dataset_schema: meta.datasetSchema,
    dataset_synced_at: meta.datasetSyncedAt,
    providers: [],
  };
  const docTexts: DocTextsBundle = {
    schema: DOC_TEXTS_SCHEMA,
    dataset_schema: meta.datasetSchema,
    dataset_synced_at: meta.datasetSyncedAt,
    providers: [],
  };
  const srcLocs: SrcLocsBundle = {
    schema: SRC_LOCS_SCHEMA,
    dataset_schema: meta.datasetSchema,
    dataset_synced_at: meta.datasetSyncedAt,
    providers: [],
  };
  const fnByProvider = new Map<number, { id: string; versions: FnTextsBundle["providers"][number]["versions"] }>();
  const docByProvider = new Map<number, { id: string; versions: DocTextsBundle["providers"][number]["versions"] }>();
  const locByProvider = new Map<number, { id: string; versions: SrcLocsBundle["providers"][number]["versions"] }>();
  for (const [row, text] of Object.entries(record.s ?? {})) {
    const idx = parseRow(row);
    if (!idx) continue;
    const [pi, vi] = idx;
    const vers = versionAt(pi, vi);
    if (vers === null) continue;
    const id = providers[pi]!.id;
    let g = fnByProvider.get(pi);
    if (!g) {
      g = { id, versions: [] };
      fnByProvider.set(pi, g);
    }
    g.versions.push({ vers, fn_texts: { [record.k]: text } });
  }
  for (const [row, text] of Object.entries(record.d ?? {})) {
    const idx = parseRow(row);
    if (!idx) continue;
    const [pi, vi] = idx;
    const vers = versionAt(pi, vi);
    if (vers === null) continue;
    const id = providers[pi]!.id;
    let g = docByProvider.get(pi);
    if (!g) {
      g = { id, versions: [] };
      docByProvider.set(pi, g);
    }
    g.versions.push({ vers, doc_texts: { [record.k]: text } });
  }
  for (const [row, locs] of Object.entries(record.l ?? {})) {
    const idx = parseRow(row);
    if (!idx) continue;
    const [pi, vi] = idx;
    const vers = versionAt(pi, vi);
    if (vers === null) continue;
    const id = providers[pi]!.id;
    let g = locByProvider.get(pi);
    if (!g) {
      g = { id, versions: [] };
      locByProvider.set(pi, g);
    }
    g.versions.push({
      vers,
      source_locs: { [record.k]: locs.map(([file, start, end]) => ({ file, start, end })) },
    });
  }
  fnTexts.providers = [...fnByProvider.values()];
  docTexts.providers = [...docByProvider.values()];
  srcLocs.providers = [...locByProvider.values()];
  return {
    fnTexts: fnByProvider.size > 0 ? fnTexts : null,
    docTexts: docByProvider.size > 0 ? docTexts : null,
    srcLocs: locByProvider.size > 0 ? srcLocs : null,
  };
}

// ---------------------------------------------------------------------------
// Member vectors (T-51) — one shared, lazily-fetched map for every surface.
//
// T-50 put the member map in the per-key payload fragment. That is free for
// the Alignment view (one selected item) but wrong for the Changes/Journal
// pair diff, which needs every re-signed member-bearing key in the pair —
// 10-52 keys scattered across 6-13 fragments, ~1-2 MB in many round trips.
// The whole member file is 0.78 MB raw / 0.15 MB gzip — less than one payload
// bucket — and only 32 pairs in the corpus have any member re-sign at all, so
// one request for less data beats a smarter fetch pattern. It is also already
// committed: the canonical store + parity anchor.
//
// Loaded at most once per session, module-cached, only when a member-bearing
// key's delta is actually needed; a failed load degrades to the honest
// pub-only policy copy, never a dead end.
// ---------------------------------------------------------------------------

/** The committed URL of the normalized member map. */
export function typeMembersUrl(): string {
  return committedDataUrl("forkmap-type-members.json");
}

let typeMembersCache: Promise<TypeMembersBundle> | null = null;

/** Fetch (once, module-cached) and validate the normalized member map. */
export function loadTypeMembers(): Promise<TypeMembersBundle> {
  if (!typeMembersCache) {
    typeMembersCache = (async () => {
      const url = typeMembersUrl();
      const res = await fetch(url, { cache: "no-cache" });
      if (!res.ok) throw new BundleError(`could not load ${url} (HTTP ${res.status})`);
      return validateTypeMembers(await res.json());
    })();
    typeMembersCache.catch(() => {
      typeMembersCache = null;
    });
  }
  return typeMembersCache;
}

/** The shared member map, loaded lazily and module-cached — the one entry
 * point every surface uses (Alignment item, Changes/Journal pair, popover).
 * Returns null until it lands (and after a failure), which the consumers
 * render as the honest pub-only policy copy rather than an inference. */
export function useTypeMembers(): TypeMembersBundle | null {
  const [bundle, setBundle] = useState<TypeMembersBundle | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadTypeMembers()
      .then((b) => {
        if (!cancelled) setBundle(b);
      })
      .catch((e) => {
        console.error("member map load failed:", e instanceof Error ? e.message : e);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return bundle;
}

/** The member vectors (`digest -> segments`) a key carries, or null when it
 * carries none (a non-member-bearing kind, or a member-less type). The whole
 * story for the key — every digest it was ever measured under — which is what
 * lets any two of its releases be diffed. */
export function memberVectorsOf(
  bundle: TypeMembersBundle | null | undefined,
  key: string,
): KeyMemberVectors | null {
  const m = bundle?.vectors[key];
  return m && Object.keys(m).length > 0 ? m : null;
}
