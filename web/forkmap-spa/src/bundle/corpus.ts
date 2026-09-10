// T-33 increment 4 — the Changes/Journal corpus views' data-access layer.
//
// The two corpus-diff views declare the *logical* data they render — per
// release its measuredness + item count + branch-base diff story (the feed),
// and a compared pair's bundle-shaped rows + resolved fn texts (the diff) —
// and this module satisfies those declarations from the export's current
// physical layout, caching as it goes. The views never name a data file, an
// ordinal or a payload schema; when the layout re-orgs again (the T-33
// increments' whole point: whole corpus → digest slice + per-key fragments →
// journal slice + per-release files → whatever follows), only this module's
// adapters change, never the .tsx views.
//
// The physical layout today (both files derived from the dataset by
// `export-fork-map`, RULE-7):
//   - data/forkmap-journal.json (schema gocar.forkmap.journal.v1) — per
//     provider stream, per release row its measuredness class + item-record
//     count, branch-base predecessor index and (base, row) diff counts: the
//     per-row facts the feed and the pair resolution read (the boot manifest
//     does not carry them);
//   - data/forkmap-release-###.json (schema gocar.forkmap.release.v1) — per
//     measured release row its own digest-level surface rows + resolved fn
//     signature texts, addressed by the row's flat position in the shared
//     (provider-major) row space the manifest's version lists define. A diff
//     of two releases fetches exactly two files (~0.4–1 MB at the current
//     corpus); the ~35 MB corpus and the ~15.7 MB fn-texts whole files are
//     never fetched by the runtime (they stay committed as the parity
//     anchors: deriveJournalSlice / deriveReleaseFile project them back into
//     the shapes below so the parity suite asserts every committed file).
//
// A never-measured row has NO release file — its absence IS the RULE-4
// marker and the journal slice names it (m = 0); the pair resolver never
// requests a file for such a row and reports the RULE-4 state instead.
//
// Honest copy that names the actual fetched files (LoadingScreen's "rows"
// phase, the pair-loading line) is supplied from here as constants, so the
// views can print it without hard-coding the layout.

import { useEffect, useState } from "react";
import type {
  FnTextsBundle,
  ForkmapBundle,
  ForkmapManifest,
  JournalRow,
  JournalSlice,
  ManifestProvider,
  ManifestVersionRow,
  ReleaseFile,
  ReleaseSurfaceRow,
  VersionRow,
} from "./types";
import { FN_TEXTS_SCHEMA, JOURNAL_SCHEMA, RELEASE_SCHEMA } from "./types";
import { BundleError, validateJournal, validateRelease } from "./validate";
import { branchBase, diffRows } from "./derive";
import { committedDataUrl } from "./dataUrls";

/** The pair-loading line the views print while a compared pair's rows are on
 * their way — the honest copy naming what is actually fetched, kept here so
 * a layout change edits this module, not the views. */
export const PAIR_LOADING_LINE =
  "Loading the compared releases' measured rows (data/forkmap-release-###.json)…";

// ---------------------------------------------------------------------------
// The logical view contract
// ---------------------------------------------------------------------------

/** Per-release row facts the corpus views render (T-33 increment 4): what the
 * collapsed feed and the pair resolution need per release that the manifest
 * does not carry — its measuredness class, item-record count and its diff
 * story against the branch-base predecessor. Logical: independent of the
 * physical layout the export delivers the facts through. */
export interface ReleaseFacts {
  vers: string;
  /** 0 = never-measured · 1 = measured-empty · 2 = measured (RULE-4's
   * null-vs-empty split). */
  m: 0 | 1 | 2;
  /** Item-record count of the measured surface (0 for m < 2). */
  n: number;
  /** The branch-base predecessor's vers (a stable against the previous
   * stable, a preview against the newest stable published before it), or
   * null when the release has no base (first of its branch line). */
  prevVers: string | null;
  /** Whether the (base, row) pair is a within-stream exact-copy republish
   * (both sides measured, identical item sets). */
  identical: boolean;
  /** The measured item-set counts vs the base — non-null only for a diffable
   * (both measured), non-identical pair. */
  counts: { rm: number; ad: number; rs: number } | null;
}

/** One provider stream of facts, aligned 1:1 with the manifest provider's
 * own version rows (the same release order both carry). */
export interface CorpusStream {
  id: string;
  facts: ReleaseFacts[];
}

/** The corpus views' loaded data: the manifest (metadata + rules) plus these
 * per-row facts — everything the Changes/Journal views render except the
 * measured rows of a specific pair, which arrive on demand (see
 * `useDiffPair`). */
export interface CorpusData {
  datasetSchema: string;
  datasetSyncedAt: string | null;
  /** Per provider stream, in the manifest's provider order. */
  streams: CorpusStream[];
}

export type CorpusLoadState =
  | { status: "idle" | "loading" | "error"; data: null; error: string | null }
  | { status: "ready"; data: CorpusData; error: null };

/** The measured rows of a compared pair, reconstructed to the bundle-shaped
 * rows the shared derivations read (surface from the release files, metadata
 * from the manifest), plus the pair's resolved fn signature texts. */
export interface PairRows {
  a: VersionRow;
  b: VersionRow;
  texts: FnTextsBundle | null;
}

export type PairState =
  | { status: "idle" | "loading"; rows: null; error: null; reason: null }
  | { status: "error"; rows: null; error: string; reason: null }
  | { status: "ready"; rows: PairRows | null; error: null; reason: string | null };

/** The collapsed-feed story line of one release row (T-33 increment 4):
 * first-of-branch / never-measured reason (same wording as `diffRows`'s
 * RULE-4 reason — A = the base) / identical / counts. `prev` is the branch
 * base's own facts (null when the release has no base). */
export interface ReleaseStory {
  kind: "first" | "unmeasured" | "identical" | "counts";
  reason?: string;
  counts?: { rm: number; ad: number; rs: number };
}

export function storyOf(facts: ReleaseFacts, prev: ReleaseFacts | null): ReleaseStory {
  if (!facts.prevVers || prev === null) {
    return { kind: "first" };
  }
  if (facts.m === 0) {
    return {
      kind: "unmeasured",
      reason: `Release B (${facts.vers}) was never measured — the map cannot diff it.`,
    };
  }
  if (prev.m === 0) {
    return {
      kind: "unmeasured",
      reason: `Release A (${prev.vers}) was never measured — the map cannot diff it.`,
    };
  }
  if (facts.identical) {
    return { kind: "identical" };
  }
  return { kind: "counts", counts: facts.counts ?? { rm: 0, ad: 0, rs: 0 } };
}

/** One release's facts by (provider, vers), or null when the corpus data
 * does not carry the row (a stale pair — guarded by the currency e2e). */
export function factsOf(data: CorpusData, providerId: string, vers: string): ReleaseFacts | null {
  return data.streams.find((s) => s.id === providerId)?.facts.find((f) => f.vers === vers) ?? null;
}

// ---------------------------------------------------------------------------
// Layout adapter: journal slice → CorpusData (loader + test seam)
// ---------------------------------------------------------------------------

/** The committed URL of the journal story slice (`forkmap-journal.json`). */
export const JOURNAL_URL = committedDataUrl("forkmap-journal.json");

let journalCached: Promise<JournalSlice> | null = null;

function loadJournalFile(): Promise<JournalSlice> {
  if (!journalCached) {
    journalCached = (async () => {
      const res = await fetch(JOURNAL_URL, { cache: "no-cache" });
      if (!res.ok) {
        throw new BundleError(`could not load ${JOURNAL_URL} (HTTP ${res.status})`);
      }
      return validateJournal(await res.json());
    })();
    // A failed load must not poison the cache for later navigations.
    journalCached.catch(() => {
      journalCached = null;
    });
  }
  return journalCached;
}

/** Project the journal slice into the views' logical facts against the boot
 * manifest's version rows (the slice's rows and the manifest's version rows
 * are the same list in the same order — both mirror the export's provider
 * rows). Also the render/parity suites' synchronous seam: feed it the
 * committed manifest + validated slice to build the exact `CorpusData` the
 * runtime would. */
export function buildCorpusData(manifest: ForkmapManifest, journal: JournalSlice): CorpusData {
  const byId = new Map(journal.streams.map((s) => [s.id, s.rows]));
  const streams: CorpusStream[] = manifest.providers.map((p) => {
    const rows = byId.get(p.id) ?? [];
    const rowByVers = new Map(rows.map((r) => [r.v, r]));
    const facts: ReleaseFacts[] = p.versions.map((metaRow) => {
      const r = rowByVers.get(metaRow.vers);
      const m = (r?.m ?? 2) as ReleaseFacts["m"];
      const n = r?.n ?? 0;
      let prevVers: string | null = null;
      if (r?.pr !== undefined) prevVers = p.versions[r.pr]?.vers ?? null;
      let identical = false;
      let counts: ReleaseFacts["counts"] = null;
      if (r?.d) {
        if ("id" in r.d) {
          identical = true;
        } else {
          counts = { rm: r.d.rm, ad: r.d.ad, rs: r.d.rs };
        }
      }
      return { vers: metaRow.vers, m, n, prevVers, identical, counts };
    });
    return { id: p.id, facts };
  });
  return {
    datasetSchema: manifest.dataset_schema,
    datasetSyncedAt: manifest.dataset_synced_at,
    streams,
  };
}

/** Fetch the corpus views' row data when `needed` becomes true (view-level
 * lazy fetch, module-cached per layout file). The Changes/Journal views
 * render their loading phase until it resolves; deep links into them land in
 * the loading state first (never a dead-end). The boot manifest is an input
 * (the per-row facts align to its version rows); the caller (App) holds it. */
export function useCorpusData(manifest: ForkmapManifest | null, needed: boolean): CorpusLoadState {
  const [state, setState] = useState<CorpusLoadState>({ status: "idle", data: null, error: null });
  useEffect(() => {
    if (!needed || !manifest) return;
    let cancelled = false;
    setState((s) => (s.status === "ready" ? s : { status: "loading", data: null, error: null }));
    loadJournalFile()
      .then((journal) => {
        if (!cancelled) {
          setState({ status: "ready", data: buildCorpusData(manifest, journal), error: null });
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setState({ status: "error", data: null, error: e instanceof Error ? e.message : String(e) });
          console.error("journal story slice load failed:", e instanceof Error ? e.message : e);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [manifest, needed]);
  return state;
}

// ---------------------------------------------------------------------------
// Pair resolver (Changes diff / Journal expanded entry)
// ---------------------------------------------------------------------------

/** The committed URL of one release file (`forkmap-release-<ordinal:03>.json`). */
export function releaseUrl(ordinal: number): string {
  return committedDataUrl(`forkmap-release-${String(ordinal).padStart(3, "0")}.json`);
}

/** The flat (provider-major) row-space ordinal of one release row — its
 * position in the shared row space the manifest's version lists define. */
export function releaseOrdinal(providers: ManifestProvider[], pi: number, vi: number): number {
  let ordinal = 0;
  for (let i = 0; i < pi; i++) ordinal += providers[i].versions.length;
  return ordinal + vi;
}

const releaseCache = new Map<number, Promise<ReleaseFile>>();

function loadReleaseFile(ordinal: number): Promise<ReleaseFile> {
  let cached = releaseCache.get(ordinal);
  if (!cached) {
    cached = (async () => {
      const url = releaseUrl(ordinal);
      const res = await fetch(url, { cache: "no-cache" });
      if (!res.ok) {
        throw new BundleError(`could not load ${url} (HTTP ${res.status})`);
      }
      return validateRelease(await res.json());
    })();
    // A failed load must not poison the cache for later navigations.
    cached.catch(() => {
      releaseCache.delete(ordinal);
    });
    releaseCache.set(ordinal, cached);
  }
  return cached;
}

/** Reconstruct one release file into a bundle-shaped `VersionRow` against its
 * manifest metadata row: the manifest row's metadata + the file's digest-level
 * surface records (expanded back into `SurfaceItem` shapes, cfg gates kept
 * only when recorded) — so `diffRows`, `signaturePair`, `cfgGatesOf` and the
 * row extras run unchanged over the loaded pair. */
export function rowFromRelease(metaRow: ManifestVersionRow, file: ReleaseFile): VersionRow {
  return {
    vers: metaRow.vers,
    yanked: metaRow.yanked,
    prerelease: metaRow.prerelease,
    rust_version: metaRow.rust_version,
    api_hash: metaRow.api_hash,
    facade: metaRow.facade,
    surface: file.s.map(([key, digest, ...cfg]) =>
      cfg.length > 0 ? { key, digest, cfg } : { key, digest },
    ),
  };
}

/** The sidecar-shaped fn-text subset of a diff pair — the two release files'
 * resolved fn-text rows rebuilt into an `FnTextsBundle` the shared
 * derivations (`signaturePair` / `fnTextAt` via `fnTextsOf`) resolve against
 * (the increment-3 `payloadSubsets` pattern applied to the row-level files).
 * Null when neither side's file resolves any text. */
export function releaseTexts(
  meta: { datasetSchema: string; datasetSyncedAt: string | null },
  aProviderId: string,
  aVers: string,
  aFile: ReleaseFile | null,
  bProviderId: string,
  bVers: string,
  bFile: ReleaseFile | null,
): FnTextsBundle | null {
  const textOf = (file: ReleaseFile | null): Record<string, string> | null =>
    file && Object.keys(file.f ?? {}).length > 0 ? (file.f as Record<string, string>) : null;
  const aTexts = textOf(aFile);
  const bTexts = textOf(bFile);
  if (!aTexts && !bTexts) return null;
  const byProvider = new Map<string, FnTextsBundle["providers"][number]>();
  const add = (id: string, vers: string, texts: Record<string, string> | null) => {
    if (!texts) return;
    let p = byProvider.get(id);
    if (!p) {
      p = { id, versions: [] };
      byProvider.set(id, p);
    }
    p.versions.push({ vers, fn_texts: texts });
  };
  add(aProviderId, aVers, aTexts);
  add(bProviderId, bVers, bTexts);
  return {
    schema: FN_TEXTS_SCHEMA,
    dataset_schema: meta.datasetSchema,
    dataset_synced_at: meta.datasetSyncedAt,
    providers: [...byProvider.values()],
  };
}

/** Fetch the two release files of a (provider, vers) pair and reconstruct the
 * rows the corpus views diff (module-cached per release file). A side whose
 * facts say never-measured (m = 0) resolves ready-without-rows and a RULE-4
 * reason (its absence IS the marker — no file is requested); any other
 * failure is a real error state (a missing file for a measured row is a
 * stale-serve condition the view surfaces, never an invented surface). */
export function useDiffPair(
  manifest: ForkmapManifest,
  data: CorpusData,
  a: { provider: string; vers: string },
  b: { provider: string; vers: string },
): PairState {
  const [state, setState] = useState<PairState>({ status: "idle", rows: null, error: null, reason: null });
  useEffect(() => {
    let cancelled = false;
    const aP = manifest.providers.find((p) => p.id === a.provider);
    const bP = manifest.providers.find((p) => p.id === b.provider);
    if (!aP || !bP) {
      setState({ status: "error", rows: null, error: "unknown pair side", reason: null });
      return;
    }
    const aVi = aP.versions.findIndex((r) => r.vers === a.vers);
    const bVi = bP.versions.findIndex((r) => r.vers === b.vers);
    if (aVi < 0 || bVi < 0) {
      setState({ status: "error", rows: null, error: "unknown pair row", reason: null });
      return;
    }
    const aFacts = factsOf(data, a.provider, a.vers);
    const bFacts = factsOf(data, b.provider, b.vers);
    if (aFacts?.m === 0 || bFacts?.m === 0) {
      const reason =
        aFacts?.m === 0
          ? `Release A (${a.vers}) was never measured — the map cannot diff it.`
          : `Release B (${b.vers}) was never measured — the map cannot diff it.`;
      setState({ status: "ready", rows: null, error: null, reason });
      return;
    }
    setState({ status: "loading", rows: null, error: null, reason: null });
    const aOrd = releaseOrdinal(manifest.providers, manifest.providers.indexOf(aP), aVi);
    const bOrd = releaseOrdinal(manifest.providers, manifest.providers.indexOf(bP), bVi);
    Promise.all([loadReleaseFile(aOrd), loadReleaseFile(bOrd)])
      .then(([fa, fb]) => {
        if (cancelled) return;
        const meta = { datasetSchema: manifest.dataset_schema, datasetSyncedAt: manifest.dataset_synced_at };
        const rows: PairRows = {
          a: rowFromRelease(aP.versions[aVi], fa),
          b: rowFromRelease(bP.versions[bVi], fb),
          texts: releaseTexts(meta, a.provider, a.vers, fa, b.provider, b.vers, fb),
          // Member vectors are not pair state (T-51): they resolve per key out
          // of the one shared, session-cached member map every surface reads.
        };
        setState({ status: "ready", rows, error: null, reason: null });
      })
      .catch((e) => {
        if (!cancelled) {
          setState({
            status: "error",
            rows: null,
            error: e instanceof Error ? e.message : String(e),
            reason: null,
          });
          console.error("release-file pair load failed:", e instanceof Error ? e.message : e);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [manifest, data, a.provider, a.vers, b.provider, b.vers]);
  return state;
}

// ---------------------------------------------------------------------------
// Parity mirror (RULE-7)
// ---------------------------------------------------------------------------

/** The exporter's per-release projection, reproduced over the committed
 * corpus bundle + fn-texts sidecar — the mirror the parity suite asserts
 * every committed release file against. Same algorithm as `export-fork-map`:
 * the release's digest-level surface rows (in corpus row order, empty cfg
 * dropped) + its resolved fn-text row. Null when the release row was never
 * measured (no file is emitted for it — RULE-4). Never called by the views;
 * its job is to prove each file is the dataset, computed another way. */
export function deriveReleaseFile(
  providerId: string,
  vers: string,
  bundle: ForkmapBundle,
  fnTexts: FnTextsBundle | null,
): ReleaseFile | null {
  const provider = bundle.providers.find((p) => p.id === providerId);
  const row = provider?.versions.find((v) => v.vers === vers);
  const surface = row?.surface;
  if (!provider || !row || surface === null || surface === undefined) return null;
  const f = fnTexts?.providers.find((p) => p.id === providerId)?.versions.find((v) => v.vers === vers)?.fn_texts;
  const out: ReleaseFile = {
    schema: RELEASE_SCHEMA,
    dataset_schema: bundle.dataset_schema,
    dataset_synced_at: bundle.dataset_synced_at,
    p: providerId,
    v: vers,
    n: surface.length,
    s: surface.map((item): ReleaseSurfaceRow =>
      item.cfg && item.cfg.length > 0 ? [item.key, item.digest, ...item.cfg] : [item.key, item.digest],
    ),
  };
  if (f) out.f = f;
  return out;
}

/** The exporter's journal derivation, reproduced over the committed corpus —
 * the mirror the parity suite asserts the committed slice against. Runs the
 * client's own `branchBase`/`diffRows` over the bundle rows (the same
 * semantics the exporter ported), so the slice's counts are the dataset
 * computed another way. Never called by the views. */
export function deriveJournalSlice(bundle: ForkmapBundle): JournalSlice {
  const streams = bundle.providers.map((p) => ({
    id: p.id,
    rows: p.versions.map((v, vi) => {
      const base = branchBase(p.versions, vi);
      const pr = base ? p.versions.indexOf(base) : undefined;
      const m: 0 | 1 | 2 =
        v.surface === null || v.surface === undefined ? 0 : v.surface.length === 0 ? 1 : 2;
      const row: JournalRow = { v: v.vers, m, n: m === 2 ? v.surface!.length : 0 };
      if (pr !== undefined) row.pr = pr;
      if (base) {
        const diff = diffRows(base, v);
        if (diff.ok) {
          row.d = diff.identical
            ? { id: 1 }
            : { rm: diff.removed.length, ad: diff.added.length, rs: diff.resigned.length };
        }
      }
      return row;
    }),
  }));
  return {
    schema: JOURNAL_SCHEMA,
    dataset_schema: bundle.dataset_schema,
    dataset_synced_at: bundle.dataset_synced_at,
    streams,
  };
}
