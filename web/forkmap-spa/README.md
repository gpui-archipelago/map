# forkmap-spa — the fork-map front end (T-39, the served implementation)

The React + Tailwind + Bun SPA over the committed fork-map data: the same
five views (Landing / Changes / Alignment / Configure / Journal) the static
`web/forkmap/` renderer first shipped, built with Bun + React + Tailwind v4.
Since T-39 increment 6 (2026-09-08) the static renderer is retired and this
SPA is what gets served; `web/forkmap/` now holds only the data bundle + the
design archive. **Since T-33 increment 1 (2026-09-09) the SPA boots on the
161 KB committed boot manifest** (`web/forkmap/data/forkmap-manifest.json` —
the bundle minus every measured surface, plus export-precomputed corpus
counts). **Since T-33 increment 4 (2026-09-09) the Changes/Journal corpus
views read the export-derived per-release row data** through a corpus
data-access layer (`src/bundle/corpus.ts`): the journal story slice
(`forkmap-journal.json`, schema gocar.forkmap.journal.v1 — per release row
its measuredness + item count + branch-base diff story) plus one
per-release payload file per compared release (`forkmap-release-###.json`,
schema gocar.forkmap.release.v1 — the release's own digest-level surface
rows + resolved fn texts) — the ~35 MB corpus and the ~15.7 MB fn-texts
whole files are never fetched by the runtime. **Since T-33 increments 2–5
(2026-09-09) the Alignment
view renders from the export-derived item index + per-key column
fragments** (`web/forkmap/data/forkmap-align-index.json`, schema
gocar.forkmap.alignindex.v1 — every key + release-row count + the
never-measured markers, ~0.7 MB, fetched when the view opens) and
(`web/forkmap/data/forkmap-column-###.json`, schema
gocar.forkmap.column.v1 — the selected item's digest pools + per-release
cells, ~29 KB median, fetched on selection); the whole digest-state slice
(`forkmap-alignment.json`, schema gocar.forkmap.alignment.v1, ~3.5 MB)
stays committed as the canonical column store + parity anchor and is never
fetched.
**Since T-33 increment 3 (2026-09-09) the item box + release popover read
per-key payload fragments** (`web/forkmap/data/forkmap-payload-###.json`,
schema gocar.forkmap.payload.v1 — the selected item's resolved fn
signatures / docstrings / measured source locations, one ~0.1–1 MB bucket
per item, fetched on selection), so the whole-file fn/doc/source-loc
sidecars no longer ride the Alignment path and pinning a cell adds no
request.

**Status (T-39 increments 1–6):** the toolchain + scaffold, the pure
derivation layer (ported 1:1 from the retired `web/forkmap/app.js`), the
hash-routing
shell with header/nav/footer, the Landing (Overview) port, the Changes view
port (pickers + swap + recorded-story quick links, pair caption,
snapshot-vs-changelog banners, delta filter, deep links), the
Alignment + Journal ports (type-ahead combobox + presets + dot matrix +
per-stream summary chips + the T-38 return chips; the one-scroll stream feed
with per-release stories and expandable item rows + deep-link flash), the
Configure port (provider/version pickers over `templates.bindings`, the
project-name field with live `{{project_name}}` resolution, the byte-resolved
`Cargo.toml` + scaffold `main.rs` with per-file copy buttons, RULE-5/6 status
boxes + v2 scope notes) and the study reader (decision (a)-lite: the five
study docs 07/08/09/12/13 open in an in-page excerpt dialog whose excerpt is
the doc's own opening, generated from the repo markdown and diff-checked at
are in with their parity tests green, and the
data-load state machine shows a real boot screen (byte progress) instead of
flashing a failure while the boot manifest loads — a Changes/Journal view
reads the export-derived per-release row data (the journal story slice +
one release file per compared release — the corpus whole file is never
fetched, T-33 increment 4, 2026-09-09), the Alignment view loads its
export-derived item index on open + one per-key column fragment per
selected item (T-33 increments 2–5, 2026-09-09 — the whole digest-state
slice leaves the runtime fetch graph)
and an item's resolved signatures/docstrings/source rows arrive as one
per-key payload fragment on selection (T-33 increment 3, 2026-09-09 — the
whole-file fn/doc/source-loc sidecars no longer ride the Alignment path,
and pinning a cell adds no request). **Since increment 6
(2026-09-08) this SPA is the served fork-map implementation**: the static
renderer (web/forkmap/{index.html,app.js,style.css,check.py}) was deleted;
`web/forkmap/` now holds the committed data bundle (fetched here at
runtime) + the design archive, and the retired renderer's bound ids are
frozen in `tests/fixtures/static-renderer-ids.ts` for the id-coverage
tripwires. T-39 closed 2026-09-08 (archived with its Outcome); the human
by-ear a11y pass (study reader, Configure copy live region, Alignment
combobox) is recorded there as the single open item.

## Commands

```bash
bun install        # deterministic install (bun.lock committed)
bun run dev        # vite dev server (web/forkmap-spa/)
bun run build      # deterministic production build → dist/ (byte-identical re-run)
bun test           # parity suite: recorded stories against the committed bundle
bunx tsc --noEmit  # typecheck
bun run check      # bun test + typecheck (the SPA gate)
bun run study:excerpts  # regenerate src/study/study-excerpts.ts from the five
                   # study docs (idempotent; the drift parity test compares)
python3 smoke.py   # served-artifact smoke: headless Chrome over plain HTTP
                   # (needs google-chrome + a prior `bun run build`; sandboxed
                   # shells must run it unsandboxed — Chrome needs sockets)
```

## Layout

```
src/
  main.tsx, App.tsx       entry + shell (load → validate → route)
  styles.css, styles/     Tailwind v4 @theme tokens (archipelago identity,
                          T-37) + component classes mirroring the static site
  routing.ts              hash-URL contract (#/, #/changes?a=…&b=…,
                          #/alignment?item=…&back=… — v1 deep links + the
                          T-38 back-param semantics)
  content/                curated doc links + the seven honest rules
  study/                  the study reader's excerpt pipeline (decision
                          (a)-lite): excerpt.ts (the extraction rule: first
                          paragraph under the doc's first "## " section,
                          inline markdown → plain text) + the GENERATED
                          study-excerpts.ts (regenerate: bun run study:excerpts;
                          the drift parity test diff-checks it against the
                          live docs)
  scripts/gen-study-excerpts.ts  excerpt generator (bun, stdlib only)
  components/             header, footer, loading/boot screen, AboutNote
                          (honest-rule-1…7), shared delta rows + rule lines
                          (Changes diff + Journal feed; Alignment rule box),
                          StudyModal + StudyDocLink (the study reader: study
                          doc rows open the excerpt dialog on a plain click;
                          non-study links stay plain outbound anchors)
  views/                  LandingView + ChangesView + AlignmentView + JournalView
                          + ConfigureView (all ported)
  bundle/                 the data layer
    types.ts              gocar.forkmap.v1 bundle types (validateBundle shape)
    validate.ts           1:1 port of app.js validateBundle (fail visibly)
    derive.ts             1:1 port of app.js pure derivations (diff/cell/
                          index/compileStatus/…)
    changes.ts            Changes pair resolution (RULE-6 defaults, deep-link
                          parsing — 1:1 port of app.js resolveChanges)
    configure.ts          Configure resolution (bindings/scaffold finders,
                          crate-name validation, RULE-6 defaults — 1:1 port
                          of app.js renderConfigure's resolution)
    counts.ts             corpus counts (header metrics + footer, RULE-7)
    alignmentSlice.ts     T-33 increments 2 + 5: the alignment item index +
                          per-key column loader — useAlignIndex (the type-ahead
                          key list, lazy + byte progress, fetched on view open),
                          useItemColumn (a selected item's digest column bucket,
                          module-cached), the parity mirrors (deriveAlignmentSlice
                          over the full bundle — the committed slice anchor;
                          deriveAlignIndex/deriveColumnBuckets over that slice —
                          asserted equal to the committed index + column buckets)
                          and the view helpers (indexIndex; alignOrdinals;
                          alignmentColumn: synthesize an item's per-release
                          digest column from its column record + the index's
                          streams + manifest rows, shaped like full-bundle
                          providers so the shared derivations run unchanged)
    keyPayload.ts         T-33 increment 3: the per-key payload fragments —
                          loader (useKeyPayload: resolve the selected key's
                          item ordinal from the align index, fetch its bucket,
                          module-cached),
                          the parity mirror (derivePayloadBuckets /
                          projectKeyPayload over the committed slice + whole
                          sidecars), and payloadSubsets: reconstruct the
                          sidecar-shaped per-key subsets a fragment's rows
                          stand for (fn/doc/source-loc) so the shared
                          derivations run unchanged
    corpus.ts             T-33 increment 4: the Changes/Journal corpus views'
                          data-access layer — the views declare logical data
                          (per-release row facts for the feed, a compared
                          pair's bundle-shaped rows + fn texts) and this
                          module satisfies it from the export's layout:
                          useCorpusData (journal story slice
                          forkmap-journal.json → buildCorpusData facts),
                          useDiffPair (two forkmap-release-###.json files →
                          rowFromRelease/releaseTexts reconstruction),
                          storyOf/factsOf (logical story helpers), the parity
                          mirrors (deriveJournalSlice / deriveReleaseFile over
                          the full corpus + fn sidecar) and the honest
                          PAIR_LOADING_LINE copy
    useBundle.ts          runtime fetch of the committed boot manifest
                          (forkmap/data/forkmap-manifest.json, T-33) with
                          byte-accurate load progress (boot screen)
    dataUrls.ts           the one place that knows the data URL namespace:
                          document-relative forkmap/data/… — the build mirrors
                          the committed bundle's runtime-fetched files into
                          dist/forkmap/data (lean: the whole-file parity
                          anchors stay repo-only), so the built artifact is
                          self-contained (vite.config.ts) and every data fetch
                          resolves inside it
  styles/views.css        shared view/chrome/panel/item-list classes
  styles/changes.css      Changes diff stage + filter + banner classes
  styles/alignment.css    Alignment combobox/preset/matrix/cell classes
  styles/journal.css      Journal stream/entry/story/expand classes
  styles/configure.css    Configure status/code-shell/copy/scope classes
  styles/study.css        study-reader dialog (overlay + excerpt panel)
tests/stories.test.ts     recorded-story parity tests (check.py's data
                          assertions, retired with the static renderer —
                          run against the SPA's own derivations)
tests/changes.test.ts     Changes pair-resolution + quick-link + id-coverage
                          parity tests
tests/changes.render.test.tsx  react-dom/server render of the Changes view
                          over the manifest + corpus data + release-file-built
                          pairs (story banners + ids + the re-signature render)
tests/alignment.test.ts   matrix/chip/index parity + id-coverage tests
 tests/alignment.render.test.tsx  react-dom/server render of the Alignment
                          view over the manifest + item index + the selected
                          item's committed column bucket (matrix
                          stories + return chips + ids + the column-loading
                          state; the full bundle stays
                          the oracle the assertions derive from)
 tests/alignment-slice.test.ts  T-33 increments 2 + 5 digest-state parity:
                          the committed forkmap-alignment.json equals the
                          client derivation over the full bundle; the
                          committed forkmap-align-index.json + every
                          forkmap-column-###.json equal the client projections
                          of the slice (the index's keys are the corpus index,
                          the buckets re-chunk the slice's own records), and
                          validateAlignmentSlice / validateAlignIndex /
                          validateColumnBucket strictness
tests/keyPayload.test.ts    T-33 increment 3 payload-fragment parity: every
                          committed forkmap-payload-###.json equals the
                          client derivation over the slice + whole sidecars
                          (RULE-7), the ordinal addressing is exact, the
                          runtime per-key subset reconstruction reproduces
                          the whole-sidecar derivations, and
                          validateKeyPayload strictness
tests/corpus.test.ts       T-33 increment 4 corpus-layer parity: every
                          committed forkmap-release-###.json equals the
                          client derivation over the corpus + fn sidecar, the
                          committed forkmap-journal.json equals the client
                          branchBase/diffRows derivation over every entry,
                          the runtime row reconstruction + logical facts
                          reproduce the corpus, and validateRelease /
                          validateJournal strictness
 tests/fixtures/corpus-fixtures.ts  T-33 increment 4 render-test seam: the
                          manifest + corpus data (buildCorpusData over the
                          committed journal slice) and ready diff pairs built
                          from the committed release files by the layer's own
                          adapters
tests/docTexts.test.ts    T-43 doc-texts derivations over the committed
                          forkmap-doc-texts.json sidecar (the promoted-Title
                          story + the variant doc-delta chips + the line
                          diff + validator strictness)
tests/manifest.test.ts    T-33 boot-manifest parity: the manifest's
                          export-precomputed counts equal the client
                          derivation over the full bundle; the boot slice
                          never carries surfaces and matches the bundle's
                          non-surface content; validateManifest strictness
tests/srcLocs.test.ts     T-44 source-location derivations over the committed
                          forkmap-source-locs.json sidecar (per-release
                          lookups, the docs.rs URL builder, the
                          sidecar↔surface consistency + the validator)
tests/journal.test.ts     adjacent-delta parity + id-coverage tests
tests/journal.render.test.tsx  react-dom/server render of the Journal view
                          (entry stories + deep links + ids)
tests/configure.test.ts   Configure resolution + curated-note parity +
                          id-coverage tests
tests/configure.render.test.tsx  react-dom/server render of the Configure
                          view (badge/warn/flag stories + resolved bytes)
tests/study.test.ts       study-reader excerpt parity (extraction rule,
                          committed-vs-live-doc drift check, id tripwires)
tests/study.render.test.tsx  react-dom/server render of the study reader
                          (open dialog structure, trigger affordance on
                          AboutNote/Landing/Alignment/Configure)
tests/loading.render.test.tsx  boot-screen render tests (progress states)
smoke.py                  served-artifact smoke (headless Chrome)
```

## Parity rules (do not break)

- **Derivations are a 1:1 port** of the retired `web/forkmap/app.js`;
  `web/forkmap/check.py` asserted the same semantics in Python until the
  static renderer retired (T-39 increment 6) — that suite now runs only
  here (`bun test`; recorded stories + render + id coverage). Move
  derivations only with a recorded diff against app.js (git history).
  Every number shown is derived from the dataset (RULE-7): the corpus
  counts ride the boot manifest, precomputed at export from the same data
  the full bundle carries and asserted equal to the client derivation by
  the parity suite (T-33).
- **honest-rule-1…7** ids survive in the rendered DOM 1:1 (id coverage is
  parity-asserted); the site never reads `api_epoch` and never compares
  whole surfaces across forks (RULE-1).
- **No runtime network**: Tailwind/utilities are built in (never the CDN
  script), fonts are local stacks (T-37). The only network the page makes is
  the data fetches from the host serving the built artifact — the build
  mirrors the committed bundle's runtime-fetched files into dist/forkmap/data
  (lean: whole-file parity anchors stay repo-only), so a deployed dist/
  alone is self-contained and the dev server serves the same namespace from
  the source tree (vite.config.ts).
- **The whole files are fetched by nothing at runtime**, never inlined into a
  chunk or content-hashed at build (see `dataUrls.ts` for why URLs are
  assembled from parts; they ride the dist mirror as bytes only). The page
  boots on the small committed manifest; a Changes/Journal
  view reads the export-derived per-release row data (T-33 increment 4: the
  journal story slice + one `forkmap-release-###.json` per compared
  release — two files for a diff, fetched via the corpus data-access layer
  `bundle/corpus.ts`, module-cached; a missing file for a measured row is a
  real error, a never-measured row resolves RULE-4 from the facts with no
  request) and the Alignment view loads the export-derived item index on
  open + one per-key column fragment per selected item (T-33 increments
  2–5). The slice/row files are compact-serialized at export on
  purpose: their raw sizes are the per-view first-visit payloads. Since
  T-33 increment 3 the Alignment item box + release popover read per-key
  payload fragments (`forkmap-payload-###.json` — one bucket
  per selected item, module-cached): a failed bucket degrades to the
  digest-only / anchor-less states (never a dead-end box), and the committed
  buckets equal the parity suite's projection of the whole sidecars
  (`tests/keyPayload.test.ts`) — the fragments are the dataset computed
  another way, exactly like the slice. The corpus + fn-texts whole files
  and the whole digest-state slice (`forkmap-alignment.json`) stay
  committed as the parity anchors only — the parity mirrors project them
  into the index + column bucket shapes the runtime reads
  (`tests/alignment-slice.test.ts`).
- The build is deterministic: re-runs are byte-identical (asset hashes are
  stable because the data files are copied verbatim into the output — never
  content-hashed into asset names or inlined into chunks). The built artifact
  is self-contained: the committed bundle's runtime-fetched files (boot
  manifest, journal slice, per-release rows, align index, column + payload
  buckets) are mirrored into dist/forkmap/data and every data fetch resolves
  document-relative against that copy
  (`dataUrls.ts`), so a deployment of dist/ alone boots with nothing else
  served (T-32's hosted shape). Views load lazily
  (route-level `React.lazy`), so the first paint never parses the other four
  views.
- **Study excerpts are a diff-checked snapshot**: the study reader's excerpt
  text is generated from the five study docs' openings
  (`bun run study:excerpts`) and the parity suite regenerates + compares, so
  a doc edit that moves an opening breaks `bun test` — the modal never
  silently quotes a stale opening.

## Increments (T-39 task file)

1. scaffold + token layer + shell/nav + Overview port — **landed**
2. Changes port (filter/presets/banners) — **landed** (+ the data-load
   boot screen fix: loading was rendered as a failure)
3. Alignment port (combobox/presets/matrix/summaries) + Journal port —
   **landed** (+ diffRows made linear in the surface sizes — outputs
   unchanged, same recorded numbers; the feed's per-entry diffs were
   quadratic in the port of app.js's scan-per-key diff)
4. Configure port + toast decision — **landed** (provider/version pickers
   over `templates.bindings`, project-name field with live resolution and
   hash commit on blur/Enter, byte-resolved Cargo.toml + scaffold main.rs
   with per-file copy buttons, RULE-5/6 status boxes + flags + binding-unit
   lines, v2 scope notes; the toast decision: **no detached toast** — the
   T-31 inline copy-flash stays and gained a polite aria-live region; a
   `configure.ts` resolution module ports app.js's defaults 1:1)
5. study-reader decision + build/determinism/parity hardening — **landed**
   (decision **(a)-lite**: the five study docs open in an in-page excerpt
   dialog; excerpts generated from the repo markdown by a mechanical rule
   and diff-checked against the live docs by the parity suite; route-level
   lazy views; `study:excerpts` + `check` scripts; `bun test` 106/106)
6. static-renderer retirement — **landed 2026-09-08** (the static renderer
   was deleted, `web/forkmap/design/` + the committed data bundle stay, the
   retired renderer's bound ids froze into `tests/fixtures/` for the
   id-coverage tripwires, and this SPA is the served implementation; the
   manual by-ear a11y pass — study reader, Configure copy live region,
   Alignment combobox — is the remaining open item, recorded in the T-39
   task Outcome)

## T-33 load-path increments (task file)

1. boot-manifest split — **landed 2026-09-09** (the SPA boots on
   `forkmap-manifest.json`; Landing/Configure/header/footer never fetch the
   corpus; `bun test` 197/197)
2. Alignment digest-state slice — **landed 2026-09-09** (the matrix /
   type-ahead / deck read `forkmap-alignment.json`; the corpus is never
   fetched on the Alignment path; `bun test` 206/206)
3. per-key payload fragments — **landed 2026-09-09** (the item box + release
   popover read one `forkmap-payload-###.json` bucket per selected item —
   fn/doc/source-loc whole files gone from the Alignment path, a pin adds no
   request; `bun test` 219/219)
4. Changes/Journal row-level serving — **landed 2026-09-09** (the corpus
   views read the journal story slice + one `forkmap-release-###.json` per
   compared release through the `bundle/corpus.ts` data-access layer — the
   corpus and fn-texts whole files are never fetched, and the views declare
   logical data so the next layout re-org edits the layer, not the views;
   the changes doc-12 pair lands at 1.22 MB (~42× below its 51.4 MB
   record) and a journal open at 0.47 MB (~76× below its 35.6 MB record);
   `bun test` 234/234)
5. Alignment search-index split + per-key column fragments — **landed
   2026-09-09** (the export splits the digest-state slice into the
   `forkmap-align-index.json` item index — the type-ahead key list + the
   never-measured markers, fetched on view open — and the
   `forkmap-column-###.json` per-key digest column buckets, fetched per
   selected item over the payload fragments' ordinal space; the item area
   shows an honest brief loading line until its column lands, a failed
   bucket is an error state, never an invented matrix; the whole
   `forkmap-alignment.json` slice leaves the runtime fetch graph (committed
   as the parity anchor); `#/alignment` lands at 1.20 MB (~3.4× below its
   4.04 MB record) and the fn blur deep link at 1.62 MB (~2.7× below its
   4.42 MB record); `bun test` 243/243)

## T-46 Alignment type-ahead increment (landed 2026-09-10)

Once the T-33 slicing took the Alignment path's *bytes* off the interface,
the search/list became the visible cost: a broad query matched thousands of
keys (`fn:` → 11 251) and the listbox rendered a DOM row for every match per
keystroke. `derive.ts` now exposes the type-ahead policy:
`ALIGN_SUGGEST_CAP` (100) + `alignmentSuggestionWindow` (a search-ordered
prefix + an honest more-count, RULE-7) and `ALIGN_MIN_QUERY` (2) +
`alignmentQuerySearchable`. `AlignmentView` renders only the window
(`shown`).map — arrows/Enter scan the DOM-resident rows with the T-38 aria
contract intact, the `more`-footer sits outside the listbox role, and a
1-char query (below the floor) shows an honest keep-typing hint instead of
scanning or dumping thousands of rows; `searchIndex` reads the
precomputed-lowercase `CorpusIndex.search`. `bun test` 247/247 + typecheck +
deterministic build green; the committed `scripts/measure-typeahead.ts`
records the before/after (`fn:` SSR-listbox proxy 11 251 rows / 218.2 ms →
100 rows / 1.8 ms).
