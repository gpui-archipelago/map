// T-39 — app shell: load + validate the committed boot manifest, hash-route
// the five views, render header + view + footer. A load/validation failure
// shows the same fatal box the static site does (fail visibly, never
// partially).
//
// T-33: the boot payload is the ~160 KB committed manifest
// (forkmap-manifest.json — the bundle minus every measured surface, plus
// export-precomputed counts), so Landing / Configure / the header metrics
// paint before any full-corpus payload arrives. The two corpus-diff views
// (Changes / Journal) fetch the export-derived per-release row data (T-33
// increment 4 — the journal story slice forkmap-journal.json, plus one small
// forkmap-release-###.json per compared release, fetched by the views); the
// ~35 MB corpus and the ~15.7 MB fn-texts whole files are never fetched by
// the runtime. The Alignment view fetches the export-derived item index
// (T-33 increment 5 — forkmap-align-index.json, ~0.7 MB, the type-ahead key
// list) on open and one small per-key column fragment
// (forkmap-column-###.json) per selected item; the whole digest-state slice
// (forkmap-alignment.json, ~3.5 MB) leaves the runtime fetch graph. All
// lazy loads have a real loading phase; deep links resolve
// loading-then-rendered, never a dead-end fatal on a partial load.

import { lazy, Suspense } from "react";
import { useAlignIndex } from "./bundle/alignmentSlice";
import { useCorpusData } from "./bundle/corpus";
import { useBundle } from "./bundle/useBundle";
import type { LoadProgress } from "./bundle/useBundle";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import { LoadingScreen } from "./components/LoadingScreen";
import { useHashRoute } from "./hooks/useHashRoute";

// Route-level lazy views (the report's lazy-loads bullet + the T-33 perf
// budget): each view ships as its own chunk and loads on first visit, so the
// first paint never parses the other four views. The per-release row data
// fetch is lazy too (only a Changes/Journal view triggers it); loading is a
// state, and the chunk fallback below is inert because Suspense only sits
// over the mounted view.
const LandingView = lazy(() => import("./views/LandingView").then((m) => ({ default: m.LandingView })));
const ChangesView = lazy(() => import("./views/ChangesView").then((m) => ({ default: m.ChangesView })));
const AlignmentView = lazy(() => import("./views/AlignmentView").then((m) => ({ default: m.AlignmentView })));
const ConfigureView = lazy(() => import("./views/ConfigureView").then((m) => ({ default: m.ConfigureView })));
const JournalView = lazy(() => import("./views/JournalView").then((m) => ({ default: m.JournalView })));

/** The views that render measured item rows — the only ones that need the
 * export-derived per-release row data (T-33 increment 4: the journal story
 * slice, which every corpus view reads for per-row measuredness/counts). The
 * Alignment view renders per-key digest state from the item index + per-key
 * column fragments instead (T-33 increment 5). */
const CORPUS_VIEWS = new Set(["changes", "journal"]);

/** The release-row files are small; their loading phase is an indeterminate
 * bar (never a lie about %). */
const ROWS_LOADING: LoadProgress = { phase: "fetch", loaded: 0, total: null };

function Fatal({ detail }: { detail: string }) {
  return (
    <div className="wrap" style={{ paddingTop: 48, paddingBottom: 48 }}>
      <div id="fatal" className="fatal">
        <p>
          <strong>This page could not render its data.</strong>
        </p>
        <p id="fatal-detail">{detail}</p>
        <p>
          If you opened this file directly from the filesystem (<code>file://</code>), browsers refuse the data
          fetch — serve this directory over plain HTTP instead:
        </p>
        <pre>
          python3 -m http.server 8000
          {"\n# then open http://localhost:8000/web/forkmap-spa/dist/"}
        </pre>
      </div>
    </div>
  );
}

export function App() {
  const { status, bundle: manifest, error, progress } = useBundle();
  const route = useHashRoute();
  const needsRows = CORPUS_VIEWS.has(route.view);
  const rows = useCorpusData(manifest, needsRows);
  const alignIndex = useAlignIndex(route.view === "alignment");

  // Boot: the manifest is a real intermediate state, never a failure — a slow
  // first read shows byte progress, and the boot slice is small enough that
  // this phase is brief.
  if (status === "loading") {
    return <LoadingScreen progress={progress} />;
  }
  if (status === "error" || !manifest) {
    return <Fatal detail={error ?? "no boot manifest loaded"} />;
  }
  const counts = manifest.counts;

  // The corpus views render from the manifest + the logical release-row data
  // (T-33 increment 4): each view then requests its compared releases' rows
  // (a pair on the Changes view, an expanded entry's two releases on the
  // Journal view) — the whole corpus and fn-texts files are never fetched.
  // Deep links land in the loading state first (loading-then-rendered, never
  // a dead-end on a partial load).
  const corpusView = needsRows ? (
    rows.status === "loading" || rows.status === "idle" ? (
      <LoadingScreen kind="rows" progress={ROWS_LOADING} />
    ) : rows.status === "error" || !rows.data ? (
      <Fatal detail={rows.status === "error" && rows.error ? rows.error : "no release-row data loaded"} />
    ) : (
      <Suspense fallback={null}>
        {route.view === "changes" && <ChangesView manifest={manifest} data={rows.data} params={route.params} />}
        {route.view === "journal" && <JournalView manifest={manifest} data={rows.data} params={route.params} />}
      </Suspense>
    )
  ) : null;

  // Alignment renders from the item index (T-33 increment 5): the type-ahead
  // reads the key list + counts the index file carries; the selected item's
  // matrix data arrives as one per-key column bucket, fetched by the view on
  // selection. The ~35 MB corpus and the whole digest-state slice are never
  // fetched on this path. Deep links into an item land in the loading state
  // first (loading-then-rendered, never a dead-end).
  const alignmentView =
    route.view === "alignment" ? (
      alignIndex.status === "loading" || alignIndex.status === "idle" ? (
        <LoadingScreen kind="alignment" progress={alignIndex.progress} />
      ) : alignIndex.status === "error" || !alignIndex.index ? (
        <Fatal detail={alignIndex.status === "error" && alignIndex.error ? alignIndex.error : "no alignment item index loaded"} />
      ) : (
        <Suspense fallback={null}>
          <AlignmentView manifest={manifest} alignIndex={alignIndex.index} params={route.params} />
        </Suspense>
      )
    ) : null;

  const lightView =
    route.view === "landing" || route.view === "configure" ? (
      <Suspense fallback={null}>
        {route.view === "landing" && <LandingView manifest={manifest} counts={counts} />}
        {route.view === "configure" && <ConfigureView manifest={manifest} params={route.params} />}
      </Suspense>
    ) : null;

  const body = corpusView ?? alignmentView ?? lightView;

  return (
    <>
      <a className="skip" href="#main">
        skip to content
      </a>
      <Header manifest={manifest} counts={counts} view={route.view} />
      <main id="main">{body}</main>
      <Footer manifest={manifest} counts={counts} />
      <noscript>
        <p className="noscript">
          This page needs JavaScript to load and validate <code>forkmap/data/forkmap-manifest.json</code> (the
          build's own mirror of the committed bundle — and, for the Changes / Journal views, the export-derived
          per-release row data; for Alignment, the export-derived
          item index + per-key column fragments) and render the views.
        </p>
      </noscript>
    </>
  );
}
