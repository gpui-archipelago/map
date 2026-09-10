// T-39 — corpus-wide counts (RULE-7: every shown number computed from the
// loaded bundle, mirroring main() in web/forkmap/app.js).

import { buildIndex } from "./derive";
import type { BundleCounts, ForkmapBundle } from "./types";

export function bundleCounts(bundle: ForkmapBundle): BundleCounts {
  const index = buildIndex(bundle);
  const counts: BundleCounts = {
    providers: bundle.providers.length,
    versions: bundle.providers.reduce((n, p) => n + p.versions.length, 0),
    items: bundle.providers.reduce(
      (n, p) =>
        n +
        p.versions.reduce((m, v) => m + (v.surface === null || v.surface === undefined ? 0 : v.surface.length), 0),
      0,
    ),
    keys: index.keys.length,
    facades: bundle.providers.reduce(
      (n, p) => n + p.versions.reduce((m, v) => m + (v.facade ? 1 : 0), 0),
      0,
    ),
  };
  return counts;
}
