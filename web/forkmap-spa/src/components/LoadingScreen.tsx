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
//
// The copy says what is loading, in plain words — never the file names,
// schemas or export pipeline behind it.

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
      ? "Loading the release history…"
      : kind === "alignment"
        ? "Loading the item list…"
        : "Loading the map…";
  const eyebrow =
    kind === "rows"
      ? "this view reads every release, so it loads a little more data"
      : kind === "alignment"
        ? "item search needs the full item list, so it loads a little more data"
        : "this is not an error — the map is loading its data";
  const phaseLine = (p: LoadProgress): string => {
    if (p.phase === "parse") return "Reading the data…";
    if (p.phase === "validate") return "Checking the data…";
    return p.total !== null ? `Downloading — ${mb(p.loaded)} of ${mb(p.total)} MB` : "Downloading…";
  };
  const note = (
    <p className="subnote boot-note">
      {kind === "boot"
        ? "The map loads its data on the first visit. Views that need more fetch it as you open them."
        : kind === "rows"
          ? "The release history is a bigger download than the first load. It is fetched once and kept."
          : "The item list is fetched once, when you first search."}{" "}
      A slow connection just means a longer wait — if a download fails, you will see an error instead of this screen.
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
            aria-label="load progress"
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
