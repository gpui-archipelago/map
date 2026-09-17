// T-39 — site footer: provenance only. The honest display rules live with
// the data (the AboutNote on each view); the footer states what generated
// the page and when that data was synced. T-33: the page boots
// on the committed manifest (schema gocar.forkmap.manifest.v1); the
// Changes/Journal views read the export-derived per-release row data
// (corpus.ts, T-33 increment 4) and the Alignment view fetches its
// export-derived digest-state slice (T-33 increment 2); the counts are
// export-precomputed corpus numbers the manifest carries (RULE-7:
// dataset-derived by the generating command — never typed here).

import type { ForkmapManifest } from "../bundle";

export function Footer({ manifest }: { manifest: ForkmapManifest }) {
  return (
    <footer className="site-footer">
      <div className="wrap">
        <p className="footer-tag mono">gpui-archipelago — every fork is an island. Here they can find each other.</p>
        <p id="footer-provenance">
          Built from the gocar dataset by <code>cargo gocar export-fork-map</code>, synced{" "}
          {manifest.dataset_synced_at ?? "never"}.
        </p>
      </div>
    </footer>
  );
}
