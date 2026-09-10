// T-39 — boot screen: the visible intermediate state between "no data yet"
// and "rendered". T-33: the page boots on the ~160 KB committed manifest, so
// the boot phase is brief; the same screen renders the *lazy* phases when a
// view first fetches its payload — the export-derived per-release row data
// the Changes/Journal corpus views open (T-33 increment 4: the journal story
// slice + the per-release payload files; the ~35 MB corpus + ~15.7 MB
// fn-texts whole files are no longer fetched by any view), or the ~0.7 MB
// export-derived alignment item index the Alignment view opens (T-33
// increment 5 — the selected item's digest column arrives as one small
// per-key fragment on selection, never the ~3.5 MB digest-state slice).
// Loading a view's data is also a real state, never the failure box (a
// failed load is an error, a slow one is not).

import type { LoadProgress } from "../bundle/useBundle";

function mb(bytes: number): string {
  return (bytes / 1_000_000).toFixed(1);
}

export function LoadingScreen({
  progress,
  kind = "boot",
}: {
  progress: LoadProgress;
  /** "boot" = the committed manifest (first paint); "rows" = the lazy
   * release-row data (the journal story slice + per-release files) a
   * Changes/Journal view triggered (T-33 increment 4); "alignment" = the
   * lazy alignment item index fetch the Alignment view triggered (T-33
   * increment 5). */
  kind?: "boot" | "rows" | "alignment";
}) {
  const determinate = progress.phase === "fetch" && progress.total !== null && progress.total > 0;
  const pct =
    determinate && progress.total !== null ? Math.min(100, Math.round((progress.loaded / progress.total) * 100)) : null;
  const title =
    kind === "rows"
      ? "Loading the release-row data…"
      : kind === "alignment"
        ? "Loading the item index…"
        : "Loading the fork-map data…";
  const eyebrow =
    kind === "rows"
      ? "this view renders measured item surfaces — the per-release row data is loading"
      : kind === "alignment"
        ? "the Alignment type-ahead reads the export-derived item index — it is loading"
        : "the data bundle is loading — this is not an error";
  const phaseLine = (p: LoadProgress): string => {
    if (kind === "rows") {
      if (p.phase === "parse") return "Parsing the release-row data JSON…";
      if (p.phase === "validate") {
        return "Validating the release-row data (schemas gocar.forkmap.journal.v1 / gocar.forkmap.release.v1)…";
      }
      return "Downloading the release-row data…";
    }
    if (kind === "alignment") {
      if (p.phase === "parse") return "Parsing the item index JSON…";
      if (p.phase === "validate") return "Validating the item index (schema gocar.forkmap.alignindex.v1)…";
      return p.total !== null
        ? `Downloading the item index — ${mb(p.loaded)} of ${mb(p.total)} MB`
        : "Downloading the item index…";
    }
    if (p.phase === "parse") return "Parsing the boot manifest JSON…";
    if (p.phase === "validate") return "Validating the committed boot manifest (schema gocar.forkmap.manifest.v1)…";
    return p.total !== null
      ? `Downloading the fork-map data — ${mb(p.loaded)} of ${mb(p.total)} MB`
      : "Downloading the fork-map data…";
  };
  const note =
    kind === "rows" ? (
      <p className="subnote boot-note">
        The map boots on the small committed manifest; a Changes/Journal view renders measured item surfaces (added /
        removed / re-signed rows, the release timeline), which live in the export-derived per-release row data: the
        journal story slice (<code>data/forkmap-journal.json</code>) plus one small per-release payload file (
        <code>data/forkmap-release-*.json</code>) per compared release — never the ~35 MB corpus whole file. A diff
        of two releases fetches exactly their two release files. A slow first read over plain HTTP is expected; if the
        fetch or validation fails you will see the failure box instead of this screen.
      </p>
    ) : kind === "alignment" ? (
      <p className="subnote boot-note">
        The Alignment type-ahead reads the export-derived <code>data/forkmap-align-index.json</code> item index (every
        measured item key + its release-row count — precomputed at export from the full corpus, schema
        gocar.forkmap.alignindex.v1), never the ~35 MB corpus. A selected item's digest column arrives as one small
        per-key fragment (<code>data/forkmap-column-*.json</code>) when the item is picked, and its resolved
        signatures, docstrings and source locations as one per-key payload fragment
        (<code>data/forkmap-payload-*.json</code>). A slow first read over plain HTTP is expected; if the fetch or
        validation fails you will see the failure box instead of this screen.
      </p>
    ) : (
      <p className="subnote boot-note">
        Every view on this page boots from the committed <code>data/forkmap-manifest.json</code> (the fork-map bundle
        minus the measured surfaces, with export-precomputed counts) — the same file the SPA's boot path always
        The Changes/Journal views fetch the export-derived per-release row data lazily when opened (the journal
        story slice + one small release file per compared release — the corpus whole file is never fetched), the
        Alignment view fetches its export-derived item index plus one small per-key column fragment + payload
        fragment per selected item. Nothing else is loaded at boot, and a slow first read over plain HTTP is
        expected; if the
        fetch or validation fails you will see the failure box instead of this screen.
      </p>
    );
  return (
    <section id="view-booting" className="view">
      <div className="wrap">
        <div className="panel boot-panel">
          <p className="view-eyebrow mono">{eyebrow}</p>
          <h1 className="boot-title">{title}</h1>
          <p className="boot-line" role="status">
            {phaseLine(progress)}
          </p>
          <div
            className="boot-track"
            role="progressbar"
            aria-label="bundle load progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct ?? undefined}
            aria-valuetext={determinate ? `${pct}%` : phaseLine(progress)}
          >
            <div
              className={pct === null ? "boot-fill boot-fill-indeterminate" : "boot-fill"}
              style={pct !== null ? { width: `${pct}%` } : undefined}
            />
          </div>
          {note}
        </div>
      </div>
    </section>
  );
}
