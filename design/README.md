# Fork-map design reference

| File | What it is | Status |
| --- | --- | --- |
| `2026-09-07-archipelago-mock.html` | Visual redesign direction for the fork-map site — "gpui-archipelago" identity (sand/coral/ocean/island palette, Source Sans 3 + JetBrains Mono type, sticky header + tab nav, hero overview with four workflow cards) | **consumed by T-37 (2026-09-07)** — kept verbatim as the direction/diff reference; the task file records the deltas (tokens ported to hand-written CSS, type resolved to local stacks, mock literals dropped for bundle-computed numbers) |
| `2026-09-07-ux-redesign-report.md` | UX/UI redesign write-up — "the fork map as an interactive, developer-focused SPA" (nav + diff ergonomics + alignment + configure + archipelago design language + honesty claims) | **reference paste (2026-09-07)** — kept verbatim; it is a *hybrid* of shipped features and mock direction, not a changelog (see “Reading the report honestly” below); its mock-only items fed T-38's scope |
| `2026-09-07-archipelago-tailwind-prototype-report.md` | Architecture & UX refinement report — “Raw CLI Export → Tailwind Prototype” (stateful SPA shell, Tailwind design system, toast, in-app study reader, per-view deltas) | **consumed by T-39 (2026-09-07/08)** — kept verbatim; its “current version” column predates T-30…T-38 (much already ships), and it proposes the framework/build rearchitecture (React + Tailwind + Bun) — see “Reading the tailwind prototype report honestly” below |
| `2026-09-08-alignment-inspector-mock.html` | Alignment-view redesign mock — “Alignment Inspector”: kind-filter search pills, item identity hero + prevalence badge, migration-recipe “bridge” with Copy fix, a hover-cell telemetry dock, honest-provenance drawer | **consumed by T-40 (2026-09-08)** — kept verbatim as the direction/diff reference; the task file records the deltas (kind pills + recipe copy + inspection dock shipped data-driven in the SPA; the mock's six-item registry is invented data (digests/prevalence/streams are hand-written literals, some self-contradictory) and it labels digests “SHA-256” (they are blake3) — see “Reading the alignment-inspector mock honestly” below |
| `2026-09-08-alignment-inspector-review.md` | UX review of the T-40 Alignment-Inspector output — four friction areas (absent “dead strips”, dock distance, pill-vs-query role ambiguity, missing re-signature detail) + an actionable-directives table | **consumed by T-41 (2026-09-08)** — kept verbatim as the direction/diff reference; the task file records the shipped-vs-claimed audit and the decisions (absent-stream collapse, side-by-side sticky dock rail, pills moved into the suggestion dropdown, dock signature deltas from the T-34 sidecar where the data records them; the review's semver-band “epoch segmentation” and its `bounds: Bounds<Pixels>` struct explanation were not adopted — see “Reading the alignment-inspector review honestly” below |
| `2026-09-09-static-file-database-layout.md` | Data-layout review following T-33 increment 2 — the fork-map site as a read-mostly **database served as static files**: four access patterns with measured whole-file vs per-use byte costs (search index ≈ 0.7 MB; per-symbol matrix fragments 0.9–2.1 KB; per-key text/loc payload rows ≈ 9 KB vs 66.9 MB whole; whole-row surfaces for Changes/Journal), the layered physical layout that serves them, and the open granularity decisions | **consumed by T-33 increments 3–4 (2026-09-09)** — the text/loc layer ships as per-key payload fragments and the row store ships as per-release files + the journal story slice (see the top note + “Reading the static-file database layout review honestly” below); the search-index split + per-key column fragments landed with increment 5 (2026-09-09) — the review's end state is fully implemented, and T-33 closed 2026-09-10 |

## Reading the mock honestly

The mock is a **direction artifact, not a drop-in replacement**. It was saved
verbatim so the redesign task (T-37) and its reviewers can diff against it;
before any of it ships, these gaps must be reconciled (they are the task's
decision points):

- **Hardcoded data.** `FORK_DATA`, `DATASET_REMOVED/ADDED/RESIGNED`,
  `JOURNAL_ENTRIES` and the header counts ("168 diff", per-version item
  counts, the journal's six entries) are baked into the page. The real site
  is a dumb renderer over `data/forkmap.json` (RULE-7: every claim traces to
  the dataset; the site computes nothing the export did not). None of these
  constants may survive as literals — some numbers here do not match the
  committed bundle (e.g. the journal's six highlighted entries vs the real
  67-release stream, per-release item counts, the preset's "168 diff").
- **Runtime network.** Tailwind and Google Fonts load from CDNs. The site's
  v1 boundary is *no runtime network* (T-29/T-30; T-32's acceptance keeps it
  in production). The palette/type *tokens* are the design; they must be
  ported to hand-written CSS (`style.css`) and locally available fonts, not
  fetched.
- **View regressions vs the shipped site.** The mock's Alignment view shows
  one per-fork status row; the shipped view is a full per-fork × per-release
  matrix with re-signature dots and first-removal callouts — a redesign must
  not lose that. The mock's Changes A/B pairing (per-side fork + version,
  snapshot-difference banner for cross-fork pairs, recorded-story presets)
  matches what the site ships since T-35; the same-fork confirmed-rule rows
  and the RULE-1..7 ids (`honest-rule-*`) stay code paths.
- **Structure.** The mock is one HTML file with inline JS under new ids
  (`diff-fork-a`, `matrix-fork-rows`, …) and no `app.js` split. The shipped
  site kept its logic in `app.js` (headless-checkable, exports pure
  derivations for node) — the redesign should restyle that structure, not
  abandon it (see T-37's acceptance: every id `app.js` binds must still
  exist; `web/forkmap/check.py` greps stay green). Note (2026-09-08): that
  structure was retired with the static renderer — the T-39 SPA keeps the
  same derivations as TS modules and the id contract frozen in its test
  fixtures.

## Reading the report honestly

The report is a **claims document, not a changelog**: it mixes (a) features
that ship, (b) mock-only features that do **not**, and (c) phrasing that
overstates shipped behavior. Audit recorded 2026-09-07 (verified against
`web/forkmap/` before filing — the shipped-vs-claimed diff):

**Shipped as described:** sticky nav with active states; the swap button;
the recorded-story quick links (uno 1.16.3 → 1.17.2, kael 0.1.2 → 0.2.0);
the ocean changelog / amber snapshot nature banners (T-37, RULE-1); inline
alignment links per diff row that pre-fill the query; byte-exact Configure
files with copy buttons; the archipelago palette; compile badges with
rustc-version evidence links; the truth-layers matrix.

**Mock-only / not shipped (with reasons):** nav “visual diff counts” and the
“168 diff” preset (mock literals — RULE-7: numbers must be computed from the
bundle, and a nav diff chip was deliberately not built); the in-app study /
honest-rules **modal** (would duplicate doc content into the page and break
the no-runtime-network boundary; the site links the committed docs instead
and keeps honest-rule ids in the DOM); the Changes **search + kind filter**;
the Alignment per-fork **status cards** (the shipped view keeps the full dot
matrix — RULE-1 — mock’s one-row-per-fork simplification was not adopted);
the copy **toast** (ship: inline button flash); the “uno 1.14.2 → ce 0.2.2”
preset chip (not a recorded story in the data).

**Overstated phrasing:** “Rendered in Source Sans 3 / JetBrains Mono” (local
stacks only — those faces when installed, then system; nothing is fetched);
“replaced generic dark-mode styling” (the v1 site was light with a dark
header strip); “led to dead ends” for `../../docs/…` links (they resolve when
the repo is served; they 404 on a standalone deploy — a T-32 concern);
“SPA” (the site is still a no-build static page with hash routing).

The mock-only items that are honest, data-driven enhancements were folded
into T-38 (Changes live search/kind filter with computed counters; Alignment
per-fork summary rows that supplement — never replace — the matrix).

## Reading the tailwind prototype report honestly

Direction for T-39 (the React + Tailwind + Bun rearchitecture). Two classes of
caveat, recorded 2026-09-07:

**The “current version” column is stale.** It describes the pre-T-30 CLI HTML
export. Since T-30…T-38 the shipped site already has: hash-routed views with a
sticky branded header + data-driven metrics (T-37); swap + recorded-story
presets + cross-fork quick link; live search/kind filter with visible-count
chips (T-38); ocean/amber RULE-1 banners; per-row alignment deep links and
back-param return chips; combobox presets + aria (T-38); journal stream
selector, `.je-same` republish notes, expandable rows and deep links; the
full dot matrix with per-fork summary chips and architecture tags (T-38);
compile badges with evidence links; the truth-layers table; `honest-rule-1..7`
ids in DOM and code. The genuinely new content of this report: the
**framework/build rearchitecture itself**, the **in-app study reader**
(modal decision), **toast** feedback, and richer per-cell tooltip / layout
treatments.

**Factual slips the task must not inherit:** digests are **blake3**
64-hex (check.py asserts it) — never restate them as “SHA-256”; the “168
diff”, “28 releases” and similar figures are hardcoded literals and must be
computed from the bundle (RULE-7); the “uno 1.14.2 → ce 0.2.2” preset is not
a recorded story in the data; the `.je-same` example (gpui-ce 0.3.3 ≡ 0.3.2)
must be verified against the dataset's real exact-copy pairs (uno 1.16.1–
1.16.3, kael 0.4.0/0.4.1, gpui-pre 0.3.1/0.3.2) before any UI claims it;
“empty text search” / “manual copy buttons with no feedback” predate T-38
(the combobox + copy-flash ship). The modal/”no-runtime-network” tension and
the new-build-step-vs-no-build boundary are T-39 decision points, recorded
in the task file.

Provenance: user-provided write-up on 2026-09-07, committed verbatim as the
direction reference for T-39 (no edits, no corrections — this note is the
reading guide; the task file owns the decisions).

## Reading the alignment-inspector mock honestly

An Alignment-view redesign mock, user-provided on 2026-09-08 and committed
verbatim (no edits) as the direction for T-40 (backlog at filing, landed
the same day — see the decision record below). Audit recorded
2026-09-08 against the shipped Alignment view (static `web/forkmap/` +
`web/forkmap-spa/`, T-38 + T-39 increments 1–5):

**Already shipped (layout differs, meaning is there):** type-ahead item
search over the measured identities with keyboard navigation (aria listbox)
and recorded-story preset chips; the per-fork × per-release dot matrix with
present / re-signed / added / removed / absent / not-measured states and
per-stream first-removal / first-re-sign callouts + summary chips (RULE-1:
the dots stay the whole story); per-cell hover tooltips carrying the digest
text + yanked/pre flags; the selected item's head with measured-in counts;
the confirmed-rule box (from → to, provenance, doc-09 link) and the honest
“no successor” note; the docs panel (08/09/12/13); the AboutNote honest-rules
drawer with the honest-rule-1…7 ids; T-38 return chips. Since T-39
increment 5 the study-doc rows open the in-page excerpt dialog.

**Mock-only (the deltas T-40 scopes):** the kind-filter pills
(All / fn / structs / ⚡ “Has Migration Recipe”) over the search
suggestions; the “active item” breadcrumb; the hero identity band layout;
the migration-recipe visual “bridge” card + **Copy fix** button; the
persistent **inspect dock** bound to the hovered cell (fork·version channel,
status, canonical digest, “exact N-fork match”); the detached **toast**.

**Factual slips the task must not inherit:**

- **“SHA-256” is a mislabel everywhere it appears.** Item digests are blake3
  64-hex (repo invariant — `check.py` and the parity suites assert it). The
  mock's “Canonical SHA-256 Parameter-Type Digest (RULE-2)” string must
  become “blake3” or the honest “not a digest provider” wording.
- **The six-item `API_REGISTRY` is invented data** (RULE-7 forbids literals):
  the `canonicalDigest` values, prevalence fractions, descriptions, and the
  per-stream introduced/dropped/absent sets are hand-written, not computed
  from the bundle. Tells: `Hsla::alpha` lists `ce` as introduced 0.3.2 *and*
  dropped 0.2.2 (dropped before introduced on one stream — impossible);
  `Window::blur`'s recipe anchors at “uno 1.14.2” — not a recorded rule
  version (the measured re-signature is uno 1.18.1 → 1.19.0-pre / gpui-pre
  0.3.3, docs/12; the T-38-era “1.14.2” preset was already flagged as not a
  recorded story); recipe ids like `gpui-unofficial-1.17.2-01` are invented
  (real rule ids come from the rule store); call-shape snippets like
  `AccessibilityNode::new(role, id)` → `new(role, id, bounds)` are invented
  (the dataset records measured keys + digests, never call shapes).
- **Counts must come from the bundle**: “Search 13,344 items” and “6 streams
  · 67 recorded releases” happen to match the dataset but must be computed
  from the loaded bundle, never placeholders.
- **The provenance drawer is incomplete**: it lists RULE-1/2/4/5 only.
  Shipped AboutNote carries all seven rules as code paths with ids
  (`honest-rule-1…7`); a redesign keeps that complete set.
- **The detached toast + `execCommand` copy conflict with the T-39 toast
  decision (2026-09-08)**: inline copy-flash + a visually-hidden polite
  aria-live region per action — no detached toast. Any copy affordance reuses
  that pattern.
- **Tailwind CDN + Google Fonts are runtime network** — design-only, exactly
  like the other mocks; a real implementation builds Tailwind in and uses
  local font stacks.

The honest, data-driven deltas are scoped in [T-40](../../tasks/archive/T-40-alignment-inspector-redesign.md)
(filed 2026-09-08, landed the same day in the maintained SPA
`web/forkmap-spa/` — T-39's static-renderer retirement gate passed the
same day, so the served implementation is the SPA; see the decision record
below).

## Reading the alignment-inspector review honestly

A UX review of the shipped T-40 Alignment Inspector, user-provided on
2026-09-08 and committed verbatim (no edits) as the T-41 direction. Audit
recorded 2026-09-08 against the shipped SPA + the committed bundle:

- **The friction observations are accurate.** Verified on the data:
  `struct:accessibility::AccessibilityNode` is measured on kael only (the
  fifth of six providers) — the other five streams render 60 absent cells
  (7+3+44+4+2) with kael and the dock pushed below them; the cited kael
  digests (`74d0f36f…` → `31d435b3…`) are the real 0.1.2 → 0.2.0 values;
  the kind pills do sit beneath the active query while acting only on the
  type-ahead suggestions.
- **Two claims need correcting (never inherited).** (1) The dock does not
  display a from → to hash *difference* — each hover/focus pins one row's
  digest(s); a diff only emerges by comparing two cells. (2) The
  “mandatory bounds parameter” explanation of the AccessibilityNode
  re-signature is not in the dataset: struct canonical text (incl. doc
  comments) is deliberately never recorded (rule 2 — the mock's
  `new(role, id, bounds)` snippet was already flagged invented), so no
  “bounds: Bounds<Pixels> added to constructor” note can ship as data.
  The honest form of the re-signature ask is the T-34 sidecar's measured
  before/after text where a re-signature is a single-variant `fn:` key.
- **Not adopted: the “epoch segmentation” dividers.** The review's bands
  (0.23x, 1.0–1.2, 1.7–1.16, 1.17+) do not match the uno row set (there
  is no 1.3–1.6; 1.13.1 publishes *before* 1.12.0 — publish order is not
  monotonic in semver), they are not measured epochs (rule 1: epochs are
  exact-copy-only within a stream), and semver bands would imply a scale
  the site must never weigh. The dead strips that motivated the dividers
  collapse instead (T-41).
- The “SHA-256/blake3” wording in §3.2 is a slip — digests are blake3
  everywhere in the shipped code (grep-guarded).

The adopted, data-driven deltas are scoped in [T-41](../../tasks/archive/T-41-alignment-inspector-review.md)
and landed 2026-09-08 (absent-stream collapse, side-by-side sticky dock
rail ≥1100px, kind pills moved into the suggestion dropdown, dock
signature deltas + previous-row digests for changed cells); the decisions
and reasons are recorded in that task's Outcome.

## Alignment-Inspector mock — decision record (2026-09-08, T-40)

T-40 landed the three honest deltas in `web/forkmap-spa/` (the served SPA;
the static tree is retired, so no second implementation was kept in sync).
Ship-vs-mock record (details + Outcome in the task file):

- **Kind pills shipped data-driven**: All + the two largest measured kinds +
  the ⚡ “has a migration recipe” pill, counts computed from the loaded
  bundle (RULE-7 — the mock's “Search 13,344 items” line is not shipped as a
  literal; today the derived numbers happen to read All 13,344 · fn 11,251 ·
  struct 1,315 · ⚡ 2). The ⚡ lookup is the rule store's from/to keys — the
  same lookup the confirmed-rule box uses, never a registry. The mock's
  “active item” breadcrumb and the hero identity band were not adopted as-is
  (the shipped view already names the selected item in the item head; a
  second breadcrumb was redundant) — the item-head layout was not rebuilt.
- **Recipe copy shipped**: each confirmed-rule row in the Alignment rule box
  carries a copy control putting a comment-only payload on the clipboard
  (rule id + measured from/to keys + measured transition provenance — all
  dataset; decision (a) in the task). The mock's call-shape snippets and
  detached toast were not adopted: the dataset holds no call shapes, and the
  T-39 toast decision (inline copy-flash + polite aria-live region, no
  detached toast) was kept.
- **The inspection dock shipped**: the hovered/focused matrix cell's
  channel / status / blake3 digests / “N measured releases across M forks
  carry this exact digest” (pure `digestPrevalence` over the bundle, stated
  as an item-level match — never a whole-surface or epoch claim, rule 1).
  Cells are focusable buttons with an aria-describedby story so the dock is
  not hover-only; the mock's “Canonical SHA-256 … Digest” wording became
  “blake3 64-hex” (or the honest granularity note) everywhere.
- **Not adopted**: the mock's four-rule provenance drawer (the shipped
  AboutNote keeps all seven honest-rule ids), its prevalence/stream
  literals, its invented rule ids/transitions, and its code-snippet bridges.
- The by-ear/keyboard manual a11y pass (dock focus story, copy
  announcement) is queued with the T-39 manual-pass queue.

**2026-09-09 (T-44): the inspection dock was superseded.** The release
popover that replaced it (the direction is the T-44 thread/, not archived
verbatim here — its decisive claims are quoted + audited in the T-44 task
file) kept the type-vs-token split this mock + review + digest-variants
direction collectively converged on, and added what the dock never had: a
real measured source-permalink column (`forkmap-source-locs.json`). The
mock's hover-dock + the review's side-by-side rail + T-42's deck chips are
the historical forms; the served Alignment view now floats a contextual
popover over a pinned cell with the release-unique facts + exit ramps while
the deck owns the digest/signature/doc type-level. See
[tasks/T-44-…](../../tasks/archive/T-44-release-telemetry-popover.md).

## Reading the digest-variants redesign direction honestly (T-42)

A user-supplied redesign direction on 2026-09-08 (“dedesign the Alignment
inspector to include variants and reduce visual clutter”; an
“Alignment Inspector — Measured Digest Variants” mock in the gpui-archipelago
style) — supplied in the T-42 thread and **not committed verbatim here**
(the archive keeps byte-exact copies only; recorded so no future audit
mistakes the absent file for a deletion). Its decisive layout claims, audited
2026-09-08 against the shipped SPA + the committed bundle:

- **The variant axis is honest and adopted (T-42).** Distinct measured
  digests labeled α β γ… in first-measured order over the corpus; present
  cells' dots colored by the digest they carry — a color change within a
  stream IS the re-signature, and cross-fork digest parity (the mock's
  headline: gpui-pre + uno 1.19.0-pre share the re-signed signature while
  five forks run the legacy one) is visible at a glance. Verified against
  the bundle: doc-12's blur generations (61 rows · 5 forks α a07c1800… vs
  5 rows · 2 forks β bdc56592…), kael's AccessibilityNode α→δ across 0.1.x–
  0.4.x.
- **Mock-only (never inherited):** the deck cards' *names* (“Legacy
  Baseline (0-arg context)”), the *type* call-shape signatures
  (`AccessibilityNode::new(role, id, bounds)` — the dataset records keys +
  digests, never type text; rule 2), all prevalence/parity literals, and the
  “66 of 67 releases · 6 of 6 forks” style fractions — RULE-7 (counts
  computed), the same audit the T-40 mock got.
- **Corpus realism the mock never saw:** keys measure up to 20 distinct
  digests (`struct:Window`) and 321 rows carry one key under several digests
  at once (cfg-variant / model artifacts) — the shipped design cycles the
  8-swatch palette past the 8th variant, splits multi-digest cells, and
  states the granularity (rule 2).

## Digest-variants decision record (2026-09-08, T-42)

T-42 landed the dedesigned variant axis in `web/forkmap-spa/` (the served
SPA). Ship-vs-direction record (details + Outcome in the task file):

- **Dot color = measured digest** (identity), not status — the mock's
  central grammar. Status words live on in every dot's tooltip/aria-label,
  the per-stream chips (“~ first re-signed at …”) and the dock; the
  six-status legend is gone, replaced by the variant chips + three neutral
  states + one quiet note.
- **Chips, not deck cards**: one compact chip per digest (swatch + letter +
  digest), isolation on click (`aria-pressed`); counts + first-measured in
  the chip tooltip. No variant names, no type snippets.
- **Signatures by hex**: an fn item's chips render the measured signature
  (`α · fn Window::blur(& mut self)`) resolved from the committed T-34
  sidecar (lazy fetch on fn-item selection; exact by the equal-digest
  invariant) — the user's “why not show the signatures the dock already
  has” follow-up. Type digests stay textless (rule 2).
- The by-ear/keyboard manual pass (chip toggle announcement, dimmed-state
  focus order) is queued with the recorded manual-a11y queue.

## Reading the static-file database layout review honestly

The review is a **direction document written the day T-33 increment 2
landed** — it generalizes from what the digest-state slice proved (the
export can materialize the projections a view reads) into a layered file
layout. Read it as direction, with these caveats:

- Its byte numbers are measured on the committed 2026-09-05 corpus at rest
  (plus the like-for-like served-route numbers recorded in the T-33 task
  Outcome); per-use figures like “blur's matrix fragment = 870 B” are the
  bytes of the data alone, not a served request (HTTP overhead, one of the
  hashed buckets, or a compressed transfer would change them).
- The recommended end state (index file + per-symbol fragments + keyed
  text/loc payloads) **supersedes the shape increment 2 shipped**: the
  committed `forkmap-alignment.json` is described inside the review as a
  transitional whole-column materialization, not the destination. Since T-33
  increment 3 (2026-09-09) the text/loc layer of that end state is
  **implemented** as ordinal-bucketed per-key payload fragments
  (`forkmap-payload-###.json`, 128 keys/file — see the review's top note and
  the T-33 task Outcome); since T-33 increment 4 (2026-09-09) the
  Changes/Journal row slicing (layer 5) is **implemented** too — per-release
  row files + the export-precomputed journal story slice
  (`forkmap-release-###.json` / `forkmap-journal.json`), with the corpus and
  fn-texts whole files retired from the runtime fetch graph and the SPA
  views reading logical data through a corpus data-access layer
  (`web/forkmap-spa/src/bundle/corpus.ts`); since T-33 increment 5
  (2026-09-09) the search-index split + per-symbol column fragments (layers
  2–3) are **implemented** as the alignment item index
  (`forkmap-align-index.json`, the type-ahead key list + never-measured
  markers) + ordinal-bucketed per-key column fragments
  (`forkmap-column-###.json` — the slice's own per-key tables, byte-equal
  records, 128 keys/file on the payload fragments' ordinal space), and the
  whole digest-state slice joins the corpus + fn-texts whole files off the
  runtime fetch graph (committed as the parity anchor).
- It defers real decisions (bucket vs per-key files, where the text rows
  live, whether keys carry their counts) to the implementing increments and
  to T-32's real-host numbers; treat those as open, and re-measure before
  adopting. Increment 3 resolved the first two for the payload rows
  (ordinal-bucketed fragments beside the committed row-store sidecars),
  increment 4 resolved the row-store serving (flat-ordinal per-release files
  beside the committed whole files, the journal feed precomputed at export)
  and increment 5 resolved the index/column layer for the current corpus
  (keys + counts in the type-ahead order, ordinal-bucketed columns sharing
  the payload buckets' width) with the measured numbers recorded in the
  T-33 Outcome.
