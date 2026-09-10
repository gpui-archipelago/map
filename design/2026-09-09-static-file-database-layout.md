# Fork-map data layout — the site as a static-file database (2026-09-09)

Review following T-33 increment 2 (the Alignment digest-state slice landed).
Prompt: the Alignment page has three major surfaces — the **search bar**
(type-ahead over a per-symbol index), the **per-symbol main view** (which
forks carry the symbol, under which digest variants, with docstrings), and
the **release popover** (a specific fork+version's measured declaration →
docs.rs / github.com + line numbers) — and each needs its own load strategy
(search: an index organized per kind/character; main: the bundle sliced per
symbol; popover: symbol payloads per fork). The honest summary of that
observation: **the fork-map site is a read-mostly database served as static
files**, and the layout decisions are database physical-design decisions
made under the constraint that every table is materialized at export
(deterministic, committed, parity-checked — RULE-7), never computed by the
browser from raw semantics.

This note reviews that framing against the measured corpus, names the access
patterns and the physical layers that serve them, and records the open
decisions. It is a direction review, not a changelog: the increments that
implement it are open (see T-33's remaining scope).

> **Updated by T-33 increment 3 (2026-09-09).** The item-box/popover layer
> (layer 4 above) is now implemented as **ordinal-bucketed per-key payload
> fragments**: `forkmap-payload-###.json` (`gocar.forkmap.payload.v1`), the
> whole-file sidecars' rows transposed per key over the shared
> (provider, version) row space, bucketed 128 keys/file by the alignment
> slice's item ordinal (bucket = ordinal / 128 — no hash spec to keep in
> parity; keys embed cfg provenance and are not URL-safe). An fn deep link's
> first visit measured **4 419 318 B** on the committed corpus (vs 39 524 799 B
> before the increment; slice 3.56 MB + one 383 KB bucket + assets — the
> whole-file fn/doc/source-loc sidecars are gone from the Alignment path),
> and pinning a cell adds no request (the payload is fetched on selection).
> The whole sidecars stay committed as the canonical row store + parity
> anchor (decisions 1–2 resolved for this layer).
>
> **Updated by T-33 increment 4 (2026-09-09).** Layer 5 (the row store) is
> now implemented as **per-release row files + an export-precomputed journal
> story slice**: `forkmap-release-###.json` (`gocar.forkmap.release.v1` —
> each measured release row's own digest-level surface rows + resolved fn
> texts, addressed by the row's flat position in the shared provider-major
> row space the manifest's version lists define) and `forkmap-journal.json`
> (`gocar.forkmap.journal.v1` — per release row its measuredness + item
> count + branch-base diff story, computed at export by the client
> diffRows/branchBase ported 1:1 in Rust). A Changes pair or a Journal
> expansion fetches exactly its two release files; the collapsed Journal
> feed renders from the slice alone (never per-release rows). The corpus and
> fn-texts whole files leave the runtime fetch graph (committed as the
> parity anchors); the changes doc-12 pair's first visit measured
> **1 224 638 B** (vs 51 356 511 B before) and a journal open **468 097 B**
> (vs 35 648 603 B before) on the committed corpus. The SPA renders the
> views' logical data through a corpus data-access layer (`bundle/corpus.ts`)
> so the views never name a file or schema (open decision 5 resolved for
> this layer).
>
> **Updated by T-33 increment 5 (2026-09-09).** Layers 2–3 (the search
> index + per-symbol columns) are now implemented as **the alignment item
> index + ordinal-bucketed per-key column fragments**: `forkmap-align-index.json`
> (`gocar.forkmap.alignindex.v1`, **716 879 B** raw / ~87 KB gzip — every key
> + release-row count in the type-ahead order + the never-measured markers,
> fetched when the Alignment view opens) and `forkmap-column-###.json`
> (`gocar.forkmap.column.v1`, 105 buckets × 128 ordinals ≈ 3.54 MB total,
> **median 29 288 B / max 75 180 B** — each item's digest pools + per-release
> cells, records byte-equal to the slice's, fetched per selected item and
> sharing the payload buckets' ordinal space so an item's column fragment
> and payload fragment ride the same bucket index). The whole digest-state
> slice stays committed + emitted as the canonical column store + parity
> anchor (mirrors project it into both new shapes; open decision 1 resolved
> for this layer as ordinal buckets, decision 3 resolved as keys + release
> counts in the type-ahead order, decision 2's text rows staying on the
> increment-3 payload fragments). An Alignment open's first visit measured
> **1 203 778 B** on the committed corpus (vs 4 035 785 B before the
> increment — the ~3.5 MB slice is absent from every request trace) and the
> fn blur deep link **1 619 011 B** (vs 4 419 318 B).

## The database, in one paragraph

The embedded dataset (registry truth + measured surfaces) is the source
database. `cargo gocar export-fork-map` is the **DB builder**: it
materializes, deterministically, the projections the site reads — and the
site (the SPA) is a **query engine over materialized projections**: it
fetches files, validates their shape, and runs the same pure derivations the
export ran (asserted equal by the parity suite), never new semantics. Every
file the site fetches is therefore one materialized view over the corpus,
chosen so that the bytes an interaction needs are the bytes it transfers.

That framing has been true since the static renderer; what the T-33
increments add is the realization that *one file per projection* was too
coarse. The measured gap between "the whole projection" and "one use of it"
is the design driver:

| Surface (access pattern) | Reads | Whole projection today | One use of it (measured) |
| --- | --- | --- | --- |
| Search / type-ahead | every key + per-key release count, resident for cross-kind substring search | inside `forkmap-alignment.json` (3 556 068 B); the index alone ≈ 716 532 B raw / 87 183 B gzip | the whole index (the index *is* the use) — 13 344 keys, 41.5 B average |
| Per-symbol matrix + digest-variant deck | one key's digest pool + per-release cells | inside the same slice (cells + pools ≈ 3 000 000 B) | `fn:Window::blur` = **870 B** raw / 314 B gzip; worst key 2 074 B; 12.4 cells/key average |
| Item-box fn texts + docstrings | one key's resolved rows | `forkmap-fn-texts.json` 15 702 380 B + `forkmap-doc-texts.json` 19 786 634 B | blur ≈ 1 837 B + 3 960 B (66 rows each) |
| Release popover source permalinks | one (release, key) measured declaration | `forkmap-source-locs.json` 31 388 978 B | blur ≈ 3 036 B across its 66 rows |
| Changes / Journal (corpus views) | whole measured surfaces of 2 releases (or a stream) | `forkmap.json` 35 187 631 B (surfaces ≈ 21 960 015 B) | two rows ≈ 0.2–1.8 MB each (median 240 278 B; largest 1 758 414 B) |

The over-fetch ratios: ~1× for the search index (it must be resident), but
~1 500–3 500× for the matrix column, ~7 000× for the item-box/popover
payloads, and only ~10–100× for whole-row surfaces (rows are naturally
chunky, which is why the corpus views are the *last* thing to slice). The
design conclusion: **separate the index from the columns, split the columns
and the text payloads per symbol, and leave the row store alone until
Changes/Journal need it**.

## The physical layout the review recommends

Four layers over `web/forkmap/data/` (all export-derived, deterministic,
compact where they are payloads, pretty where they are small metadata):

1. **Dictionary — `forkmap-manifest.json`** (161 063 B / 9 294 B gzip,
   landed T-33 increment 1). Release rows (metadata + measuredness lives in
   the sibling projections that need it), rules, templates, kit probes,
   export-precomputed counts. Resident: the page boots on it and Landing /
   Configure / header / footer read nothing else. This is the reference
   table every fragment's indexes point at.

2. **Search index — `forkmap-align-index.json`** (≈ 717 KB raw / ~87 KB gzip at
   the current corpus; **landed T-33 increment 5** as `gocar.forkmap.alignindex.v1`
   — the sorted key list with kind-split-on-the-client + per-key release
   count (rule actionability stays derivable from the resident manifest
   rules), plus the per-stream never-measured markers RULE-4 needs for the
   matrix synthesis). Fetched lazily when the Alignment view opens; it is
   what the combobox, the kind pills and the presets read — and the ordinal
   authority every column/payload bucket is addressed on.

   On the "directory organized per kind / per character combination"
   suggestion: at 13 344 keys the whole index is ~0.7 MB raw and must be
   resident for substring search across kinds anyway (a typed query may
   match any kind; kind is a filter over an already-searched list, not a
   partition the search can be scoped to). A per-kind or per-prefix
   directory of index shards only pays when the key space is an order of
   magnitude larger (or when the view must open with *zero* index bytes,
   which the ~90 KB gzip already makes a non-problem). The suggestion is
   recorded as the escape hatch, not the current plan; the *actual* waste
   — that the index shared a file with the columns — was closed by
   increment 5.

3. **Per-symbol columns — `forkmap-column-###.json`** (**landed T-33 increment
   5** as `gocar.forkmap.column.v1`): each bucket carries what the matrix +
   deck read for a range of symbols — digest pools in first-measured order
   (the α/β/γ… deck order) and per-release present cells as digest indexes
   (the current alignment slice's per-key tables, bucketed 128 keys/file by
   the shared item ordinal, 870 B–2 074 B per key today). A bucket is
   fetched when a symbol is selected (from search, a preset, a rule row, or
   a deep link) and cached in memory for the session. The digest-state
   slice is the transitional whole-column materialization the fragments
   project from — committed as the canonical column store + parity anchor
   since increment 5, never fetched by the runtime.

   Granularity decision (**resolved for this layer by increment 5**):
   ordinal-bucketed fragment files — 105 buckets × 128 keys ≈ median
   29 288 B / max 75 180 B per pick (the payload fragments' ordinal space +
   bucket width, so a selected item's column and payload fragments ride the
   same bucket index). One file per key = 13 344 small files and exact
   per-use bytes stays the fallback if hosts serve small files well. Key
   text is **not URL-safe** (some `use:` keys embed cfg provenance text —
   e.g.
   `use:worker_api::# [cfg (target_arch = "wasm32")] pub use web :: { … }`),
   so fragments are addressed by export-assigned ordinal — never by the raw
   key in the URL. A hash-bucket split (bucket resolvable from the key
   alone, so a deep-linked matrix costs no index fetch) remains the
   documented alternative to revisit with the T-32 real-host numbers.

4. **Per-symbol payload rows — fn texts / docstrings / source locations**,
   per key (blur ≈ 1.8 KB + 4.0 KB + 3.0 KB; today whole-file at 15.7 + 19.8
   + 31.4 MB). These replace the whole-file sidecars *for the Alignment
   view*: the item box reads one key's resolved signature/doc rows, the
   popover reads one (release, key) coordinate. Axis note: the popover is a
   **release-scoped** read (fork × version × key), and sig/doc/loc rows are
   already keyed by (release, key) in the sidecars — so the natural unit is
   the *per-key bundle with per-release rows*, not a per-(fork, symbol)
   file: the same keyed rows serve every release of every fork, and a
   per-fork split would duplicate them once per fork with no read that ever
   needs that subset. The Changes/Journal views (row-scoped readers) kept
   the whole-file sidecars until T-33 increment 4's row-level slicing landed
   (per-release row files + the journal story slice — layer 5 below and the
   top note), which carries the same per-row fn texts the sidecar resolved.

5. **Row store — whole surfaces** (`forkmap.json`), unchanged in plan: the
   Changes pair diff and the Journal stream are whole-row reads. The open
   work was *per-pair* serving (fetch only the two rows a diff names — two
   surfaces ≈ 0.2–1.8 MB — plus the row-keyed fn texts for resigned rows),
   which keeps the corpus off every path that is not actually diffing. —
   **Implemented by T-33 increment 4 (2026-09-09)** as per-release row
   files + the journal story slice (see the top note): the corpus whole
   file is no longer fetched by the runtime, and a two-row diff fetches
   exactly its two release files (~0.4–1 MB measured; the collapsed
   Journal feed renders the export-precomputed story slice, never
   per-release rows).

## What the layout buys (measured targets)

- Search view open: manifest (resident) + index ≈ 0.9 MB → **no column
  store on open** (today 4.04 MB). — **Landed T-33 increment 5**: an
  Alignment open measured **1 203 778 B** (index 716 879 B is the whole
  corpus payload on open).
- Matrix after picking a symbol: one fragment ≈ 1–2 KB (or one bucket if
  bucketed), never the 3.56 MB slice; a deep link resolves bucket-from-key.
  — **Landed T-33 increment 5**: the fn blur deep link measured
  **1 619 011 B** (index + column-052 32 517 B + payload-052 382 716 B +
  assets); a struct matrix story **1 283 188 B** (column-094 30 722 B).
- fn item box + popover: the key's text/loc rows ≈ 10 KB, replacing the
  66.9 MB of whole-file sidecars those renders trigger today. — **Landed
  T-33 increment 3** (per-key payload fragments).
- Budget check: every Alignment-path story lands far under the T-33
  ≥~4× (8.5 MB) first-visit budget; the whole-file sidecar story that was
  still over it (the fn deep link at 39.5 MB) closed at increment 3.

## Invariants that survive any of this

- Every file is a deterministic export artifact: byte-identical on no-change
  re-run, committed, covered by the bundle-currency e2e, and **parity
  checked** — the client mirror of each derivation (`deriveAlignmentSlice`
  and its siblings) reproduces the exporter's arithmetic over the committed
  corpus, so a fragment file is the dataset computed another way (RULE-7).
- The honest-display rules (1–7, `honest-rule-*` ids) are code paths in the
  views and do not move with the file layout; deep links always resolve
  loading-then-rendered (a missing fragment is a loading/fatal state, never
  an invented matrix); no new build step, framework, or runtime network
  dependency — still a folder a static host serves.
- The row index space (provider order × published release order) is shared
  by the manifest and every fragment; an index out of range is a shape
  error the validators reject before any render.

## Open decisions (recorded for the implementing increments)

1. **Fragment granularity** — **resolved for the column layer by T-33
   increment 5** (ordinal buckets, 128 keys/file — the payload fragments'
   ordinal space + bucket width); per-key files stay the fallback for the
   T-32 real-host small-file behavior, and a hash-bucket deep-link
   alternative remains documented (see layer 3).
2. **Where the text rows live** — **resolved by T-33 increment 3** (per-key
   payload bundles beside the sidecars, ordinal-bucketed; the sidecars stay
   the row store Changes/Journal access per-release).
3. **Index contents** — **resolved by T-33 increment 5**: the keys file
   carries the sorted key list + per-key release counts + the never-measured
   markers (kind splits on the client; rule actionability stays derivable
   from the resident manifest rules).
4. Caching (option (d), `?v=` keyed to `dataset_synced_at`) and compression
   (option (a), gzip/br at the T-32 host) apply to every layer.
5. Ordering — **resolved**: the item-box/popover payload split (increment
   3) closed the over-budget fn deep link; the Changes/Journal row slicing
   (increment 4) and the Alignment index/column split (increment 5) closed
   the remaining whole-file fetches; every layer is now export-derived
   fragments the runtime fetches per use.

*All numbers above are measured on the committed 2026-09-05 dataset
(166 292 item records · 165 971 present (release, key) cells · 13 344 keys ·
67 releases) over plain HTTP from this repository.*
