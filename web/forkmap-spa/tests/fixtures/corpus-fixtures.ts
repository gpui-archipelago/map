// T-33 increment 4 — corpus-view test fixtures.
//
// The Changes/Journal render tests feed the views the same logical data the
// runtime resolves: the boot manifest + the export-derived corpus data (built
// by the data-access layer's `buildCorpusData` over the committed journal
// slice), and — for a compared pair — `PairState` rows reconstructed from the
// committed per-release files by the layer's own pure adapters
// (`rowFromRelease` / `releaseTexts`), so the rendered diff is the exact
// bytes the runtime fetches, never a hand-built double. The full corpus
// bundle stays the oracle elsewhere (the parity suite).

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveChanges } from "../../src/bundle/changes";
import {
  buildCorpusData,
  releaseOrdinal,
  releaseTexts,
  rowFromRelease,
  type CorpusData,
  type PairState,
} from "../../src/bundle/corpus";
import type { ForkmapManifest, JournalSlice, ReleaseFile } from "../../src/bundle/types";
import { validateJournal, validateManifest, validateRelease } from "../../src/bundle/validate";

const HERE = dirname(fileURLToPath(import.meta.url));
export const DATA = join(HERE, "..", "..", "..", "forkmap", "data");

function load<T>(name: string, validate: (raw: unknown) => T): T {
  return validate(JSON.parse(readFileSync(join(DATA, name), "utf8")));
}

/** The committed boot manifest. */
export function loadManifest(): ForkmapManifest {
  return load("forkmap-manifest.json", validateManifest);
}

/** The committed journal story slice. */
export function loadJournal(): JournalSlice {
  return load("forkmap-journal.json", validateJournal);
}

/** The manifest + the logical corpus data the views render with. */
export function loadCorpusData(): { manifest: ForkmapManifest; data: CorpusData } {
  const manifest = loadManifest();
  return { manifest, data: buildCorpusData(manifest, loadJournal()) };
}

/** The committed per-release file of one (provider, vers) row, addressed by
 * its flat row-space ordinal — the same resolution the runtime loaders use. */
export function loadReleaseFile(manifest: ForkmapManifest, providerId: string, vers: string): ReleaseFile | null {
  const pi = manifest.providers.findIndex((p) => p.id === providerId);
  if (pi < 0) return null;
  const vi = manifest.providers[pi].versions.findIndex((r) => r.vers === vers);
  if (vi < 0) return null;
  const ordinal = releaseOrdinal(manifest.providers, pi, vi);
  return load(`forkmap-release-${String(ordinal).padStart(3, "0")}.json`, validateRelease);
}

/** A ready `PairState` for a measured pair, built from the committed release
 * files by the layer's own adapters — the seam the Changes render tests
 * inject (the runtime view resolves the same shape via `useDiffPair`). Each
 * side names its own provider (cross-fork pairs included). */
export function readyPair(a: { provider: string; vers: string }, b: { provider: string; vers: string }): PairState {
  const manifest = loadManifest();
  const aFile = loadReleaseFile(manifest, a.provider, a.vers);
  const bFile = loadReleaseFile(manifest, b.provider, b.vers);
  if (!aFile || !bFile) throw new Error(`release files missing for ${a.provider} ${a.vers} → ${b.provider} ${b.vers}`);
  const aP = manifest.providers.find((p) => p.id === a.provider)!;
  const bP = manifest.providers.find((p) => p.id === b.provider)!;
  const aVi = aP.versions.findIndex((r) => r.vers === a.vers);
  const bVi = bP.versions.findIndex((r) => r.vers === b.vers);
  const meta = { datasetSchema: manifest.dataset_schema, datasetSyncedAt: manifest.dataset_synced_at };
  return {
    status: "ready",
    rows: {
      a: rowFromRelease(aP.versions[aVi], aFile),
      b: rowFromRelease(bP.versions[bVi], bFile),
      texts: releaseTexts(meta, a.provider, a.vers, aFile, b.provider, b.vers, bFile),
      // Member vectors are not pair state (T-51): the render suites inject the
      // shared member map explicitly where a member delta is asserted, so the
      // default is the honest not-loaded state.
    },
    error: null,
    reason: null,
  };
}

/** The ready pair a Changes route resolves to (defaults included), for the
 * render tests that assert the resolved diff. */
export function readyPairFor(
  manifest: ForkmapManifest,
  params: Record<string, string>,
): PairState {
  const { a, b } = resolveChanges(manifest, params);
  return readyPair({ provider: a.provider.id, vers: a.vers }, { provider: b.provider.id, vers: b.vers });
}
