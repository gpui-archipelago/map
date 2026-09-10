// T-39 — site footer: provenance only. The honest display rules live with
// the data (the AboutNote on each view); the footer states what generated
// the page and the dataset numbers it was built from. T-33: the page boots
// on the committed manifest (schema gocar.forkmap.manifest.v1); the
// Changes/Journal views read the export-derived per-release row data
// (corpus.ts, T-33 increment 4) and the Alignment view fetches its
// export-derived digest-state slice (T-33 increment 2); the counts are
// export-precomputed corpus numbers the manifest carries (RULE-7:
// dataset-derived by the generating command — never typed here).

import type { BundleCounts, ForkmapManifest } from "../bundle";
import { FORKMAP_SCHEMA } from "../bundle/types";

export function Footer({ manifest, counts }: { manifest: ForkmapManifest; counts: BundleCounts }) {
  return (
    <footer className="site-footer">
      <div className="wrap">
        <p className="footer-tag mono">gpui-archipelago — every fork is an island. Here they can find each other.</p>
        <p id="footer-provenance">
          Generated from the dataset by <code>cargo gocar export-fork-map</code> (boot manifest {manifest.schema} over
          the {FORKMAP_SCHEMA} corpus bundle, data as of {manifest.dataset_synced_at ?? "an unsynced dataset"}).
          {counts.providers} providers · {counts.versions} published versions · {counts.items.toLocaleString("en-US")}{" "}
          measured item records across {counts.keys.toLocaleString("en-US")} item identities · {counts.facades} versions
          carrying facade shim tables.
        </p>
      </div>
    </footer>
  );
}
