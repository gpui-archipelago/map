// T-39 — Alignment view (the static site's view-alignment + renderAlignment,
// ported 1:1). T-40 (2026-09-08) added the Alignment-Inspector affordances
// (kind quick-filter pills with bundle-computed counts, per-rule recipe copy,
// the release-inspector dock); T-41 (2026-09-08) refined them per the UX
// review (web/forkmap/design/2026-09-08-alignment-inspector-review.md):
//  1. streams that never carried the item collapse into one honest summary
//     row (expand renders every dot — the dots stay the whole story, rule 1),
//  2. the dock rides a sticky second column beside the matrix on wide
//     viewports instead of sitting below it,
//  3. the kind pills live inside the suggestion dropdown (only visible while
//     the type-ahead list is open — no more “pills under the active item”),
//  4. a re-signed cell's dock readout shows the previous row's digests and,
//     where the T-34 sidecar resolves a single-variant fn key, the measured
//     signature texts before → after (digest-only with the reason otherwise).
// T-42 (2026-09-08) brings the design mock's digest-variant axis in as the
// dedesigned form of its “digest variants deck” (see the T-42 task):
//  5. a present cell's dot is colored by the measured digest it carries —
//     α β γ… label the item's distinct digests in first-measured order — so
//     a color change within a stream IS a re-signature and cross-fork digest
//     parity is visible at a glance; the status word stays in every dot's
//     tooltip/aria-label and the dock (rule 1), and rows measured under
//     several digests at once render a two-swatch split dot,
//  6. the six-status legend is replaced by a compact digest-variant legend
//     (one chip per measured digest, click to isolate — every other dot
//     dims) + the three neutral states, and the view copy reads in that
//     vocabulary — no deck cards, no invented variant names/signatures: the
//     measured facts (digest, first measured release, N releases · M forks)
//     are computed from the loaded bundle (RULE-7).
//
// T-43 (2026-09-09) adds the doc-string half — the promotion & delta
// pipeline over the lazy doc-texts sidecar (data/forkmap-doc-texts.json,
// schema gocar.forkmap.doctexts.v1, the T-34 pattern's doc sibling):
//  7. an fn item whose releases resolve a doc renders that docstring ONCE
//     under the item title — the promoted Title of the direction's rule 1.
//     Invariant items (one text across every release: blur's sentence) show
//     their one text; diverging items show the baseline (first measured)
//     text and the caption reports the measured divergence,
//  8. a digest-variant whose releases carry one uniform docstring that
//     differs from the baseline renders a measured doc-delta chip on its
//     card (baseline → variant line diff — added/removed doc lines only,
//     RULE-7: the chip's bytes are measured, never a summary phrase),
//  9. the release is the doc's unit — the sidecar resolves per release, and
//     docs that drift WITHIN a digest (doc edits that never re-sign; a
//     digest spanning texts) get no variant-level doc and no chip; non-fn
//     items stay digest-only (rule 2, decision 1(a)). Doc bytes are never on
//     the boot path: the sidecar loads only when an fn item renders.
//
// T-44 (2026-09-09) replaces the inspection dock with the cell-anchored
// **release popover** (the release-telemetry direction, see the T-44 task):
// 10. the static dock column is gone — the matrix owns the stage and a
//     pinned cell floats a contextual popover over it (getBoundingClientRect
//     + clamps + a vertical flip near the bottom), rendering only the
//     release-unique facts: channel + status flags (RULE-6), the
//     stream-transition status, the measured declaration source location as
//     a docs.rs permalink (lazy source-locs sidecar, decision 2(a) — RULE-7),
//     and the Changes/Journal exit ramps. Digest + signature + invariant doc
//     live type-level on the deck once (the duplication-trap readout is
//     gone); no cell pinned renders nothing (no inert placeholder).
//
// T-33 increment 2 (2026-09-09) re-bases the view's corpus data on the
// **digest-state slice** (export-derived per-key digest tables, precomputed at
// export, option (c)) plus the boot manifest's release rows; the ~35 MB full
// corpus is never fetched on the Alignment path. Every derivation below runs
// unchanged over the loaded data (RULE-7: the parity suite asserts the
// committed files equal the client derivations over the full bundle).
//
// T-33 increment 5 (2026-09-09) splits that slice into the bytes each
// interaction reads: the **item index** (data/forkmap-align-index.json,
// schema gocar.forkmap.alignindex.v1 — the type-ahead key list + release-row
// counts + per-stream never-measured markers, fetched when the view opens,
// ~0.7 MB at the current corpus) and **per-key column fragments**
// (data/forkmap-column-###.json, schema gocar.forkmap.column.v1 — one item's
// digest pool + per-release cells, bucketed by the shared item ordinal, one
// ~29 KB median bucket fetched per selected item). The view synthesizes each
// item's per-release digest column from its column fragment + the index's
// streams + the manifest rows; the whole forkmap-alignment.json slice stays
// committed + emitted as the canonical column store + parity anchor but
// leaves the runtime fetch graph. A selected item's area shows an honest
// brief loading line until its column bucket lands (never a dead-end), and a
// failed bucket is an error state — never an invented matrix.
//
// T-33 increment 3 (2026-09-09) re-bases the item-box/popover payload rows
// on **per-key payload fragments** (`forkmap-payload-###.json`, schema
// gocar.forkmap.payload.v1): the resolved fn signatures (T-42 chips), the
// docstrings (T-43 Title/chips) and the measured source locations (T-44
// popover anchors) — the rows the whole-file fn/doc/source-loc sidecars
// used to serve — now ride one bucket per selected item (the key's slice
// ordinal → bucket), so an fn item's box no longer pulls the 15.7 + 19.8 MB
// sidecars and pinning a cell never pulls the 31.4 MB source-locs file. The
// whole sidecars stay committed + emitted (the canonical row store the
// fragments project from, and the Changes/Journal consumers' payload); the
// parity suite projects them into the fragment shape and asserts equality.
// Deep links land in the slice's loading state first (loading-then-rendered),
// and the item's payload rows degrade to the digest-only / anchor-less
// states until their bucket lands.
//
// Interaction is click-to-pin, never hover-to-pin — an explicit split that
// keeps the dense matrix scrubbable without the hover trap (a cursor raised
// toward a popover link crossing dead air would otherwise dismiss it mid-
// click, and feathering over dozens of dots while reaching the search bar
// would flash popovers across the viewport). Layer 1 (ambient, zero layout
// shift): hovering/focusing a dot just enlarges it (CSS transform) and the
// native `title` tooltip disclosures its status; no heavy UI mounts. Layer 2
// (inspection): an explicit click — or Space/Enter activation of the focused
// button — docks that cell (the .docked ring) and mounts the popover, whose
// links/text survive unhurried; the aria-expanded on the pinned cell mirrors
// the popup state. FSM: IDLE → PINNED(cell) on activation; PINNED(A) →
// PINNED(B) by activating B (seamless re-pin — no close-then-open); PINNED →
// IDLE on activating the pinned cell again, Escape (which returns focus to
// the launching cell), a click outside the cells + popover, or the
// ✕ (aria-label="Dismiss").
//
// Type all or part of an item identity over the measured corpus (the T-38
// combobox: aria listbox + keyboard navigation, ported from app.js), pick a
// recorded-story preset chip, and read the per-fork release matrix — every
// release's cell carries its measured signature's color, with per-stream
// summary chips naming first re-signs/removals (T-38, additive to the dots —
// RULE-1: the dots stay the whole story). State lives in the hash exactly
// like the static site (`#/alignment?item=…&back=…`): the item box renders
// what the hash names (never inventing an item the index lacks — RULE-7),
// and a `back` target renders the T-38 return chip so every deep link
// round-trips. The docs panel below names where each class of change is
// documented.

import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { AboutNote } from "../components/AboutNote";
import { KindChip } from "../components/common";
import { ReleasePopover } from "../components/ReleasePopover";
import { RuleLine } from "../components/rows";
import { alignmentColumn, indexIndex, useItemColumn } from "../bundle/alignmentSlice";
import {
  memberVectorsOf,
  payloadSubsets,
  useKeyPayload,
  useTypeMembers,
  type KeyPayloadState,
} from "../bundle/keyPayload";
import {
  ALIGNMENT_PRESETS,
  VARIANT_PALETTE,
  alignmentPills,
  alignmentQuerySearchable,
  alignmentSuggestionWindow,
  branchBase,
  cellState,
  digestPrevalence,
  digestsOf,
  filterAlignmentKeys,
  fnDigestTexts,
  itemDocChips,
  itemDocStory,
  itemVariants,
  isMemberBearingKind,
  ruleActionableKeys,
  ruleCopyPayload,
  rulesFrom,
  rulesTo,
  searchIndex,
  splitKey,
  streamCallouts,
  streamPartition,
  variantRef,
  variantMemberStats,
  variantSteps,
} from "../bundle/derive";
import type {
  AlignmentPill,
  CellState,
  CorpusIndex,
  DigestPrevalenceMap,
  DocDeltaChip,
  DockCell,
  ItemDocStory,
  ItemVariant,
  VariantMemberStat,
} from "../bundle/derive";
import type {
  AlignmentItem,
  AlignIndex,
  ForkmapManifest,
  KeyPayload,
  Provider,
  VersionRow,
} from "../bundle/types";
import { parseViewTarget, routeHash, targetLabel } from "../routing";
import { StudyDocLink } from "../components/StudyDocLink";

const DOC_BLURBS: string[] = ["8", "9", "12", "13"];

const LEGEND: [string, string][] = [
  ["same", "present (unchanged)"],
  ["changed", "re-signed (digest changed)"],
  ["added", "appears here"],
  ["removed", "removed here"],
  ["absent", "absent"],
  ["unknown", "not measured"],
];

/** The neutral-state legend entries kept under the digest-variant chips —
 * the states whose dot is NOT a variant color (they never carry a digest). */
const NEUTRAL_LEGEND: [CellState, string][] = [
  ["removed", "removed here"],
  ["absent", "absent"],
  ["unknown", "not measured"],
];

/** State → legend phrase (the popover's status readout uses the same
 * vocabulary as the legend — T-40). */
const PHRASES = Object.fromEntries(LEGEND) as Record<CellState, string>;

const EMPTY_HINT =
  "Pick an item above (or a preset) to render its fork matrix — e.g. struct:accessibility::AccessibilityNode or fn:Window::blur.";

/** yanked / pre-release / stable — the flag text of a release row. */
function flagText(v: VersionRow): string {
  return v.yanked ? "yanked" : v.prerelease ? "pre-release" : "stable";
}

function cellLabel(p: Provider, v: VersionRow, st: string): string {
  return `${p.id} ${v.vers} (${flagText(v)}): ${st}`;
}

/** One matrix strip: stream head + arch tag + T-38 summary chips + the dot
 * row (one cell per release, in the stream's own published order). The cells
 * are focusable buttons (T-40): activating one (click, or Space/Enter on the
 * focused button) docks its record and the T-44 release popover floats over
 * it; hovering/focusing alone enlarges the dot and relies on the native
 * `title` tooltip for the instant readout (the click-vs-hover split — no
 * hover-to-pin in a dense grid). T-42: a present cell's dot color is the
 * measured digest variant it carries (see VariantLegend) — a color change
 * within a stream is a re-signature, and every cell keeps its status word in
 * the tooltip/aria-label/popover. */
function MatrixStream({
  provider,
  itemKey,
  variants,
  isolated,
  pinned,
  onToggleCell,
}: {
  provider: Provider;
  itemKey: string;
  variants: ItemVariant[];
  /** The isolated digest-variant index (T-42): all other present dots dim. */
  isolated: number | null;
  /** The pinned (docked) matrix cell — which release mounts the popover. */
  pinned: DockCell | null;
  /** Activate a cell (click / Enter / Space): pin it, or unpin when it is the
   * currently pinned cell (the click-vs-hover FSM — see the view header). */
  onToggleCell: (cell: DockCell) => void;
}) {
  const p = provider;
  const companion = p.platform_companion ?? null;
  const callouts = streamCallouts(p, itemKey);
  const all = p.versions;
  // Pre-releases are *previews* of a not-yet-shipped stable: they render
  // separately from the stable line, and their digest variants must never
  // become steps of the stable variant run — a preview's new variant between
  // two stables must not make a later backport look like a regression to
  // legacy.
  const stableRows = all.map((row, i) => ({ row, i })).filter((x) => !x.row.prerelease);
  const previewRows = all.map((row, i) => ({ row, i })).filter((x) => x.row.prerelease);
  const stableVers = stableRows.map((x) => x.row);
  const anyPresent = callouts.present;
  const stableRun = variantSteps(stableVers, variants, itemKey);
  const stableFirstRemoved =
    stableRows.find(({ row, i }) => cellState(itemKey, branchBase(all, i), row) === "removed") ?? null;
  const letters = (indexes: number[]) => indexes.map((i) => variants[i].label).join("+");
  const chips: { cls: string; txt: string; swatch?: number; title?: string }[] = [];
  if (!anyPresent) {
    chips.push({ cls: "absent", txt: "— never measured on this stream" });
  } else if (stableRun.present === 0) {
    chips.push({
      cls: "variant",
      txt: "only in a preview — not yet on the stable line",
    });
  } else {
    const seq = stableRun.steps
      .map((s, i) => (i === 0 ? letters(s.indexes) : `${letters(s.indexes)} (${s.vers})`))
      .join(" → ");
    const noun = previewRows.length > 0 ? "stable release" : "release";
    const prefix = `${stableRun.present} ${noun}${stableRun.present === 1 ? "" : "s"}`;
    chips.push({
      cls: "variant",
      txt:
        stableRun.steps.length === 1
          ? `${prefix} · Variant ${letters(stableRun.steps[0].indexes)}`
          : `${prefix} · ${seq}`,
      swatch: stableRun.steps[0].indexes[0] % VARIANT_PALETTE,
      title:
        stableRun.steps.length === 1
          ? "stable releases carrying the item — the letter names its digest variant (legend above); pre-release previews are separate"
          : "stable releases carrying the item · letters are the digest variants (legend above) · each switch names the stable where it happened · pre-release previews are separate",
    });
  }
  if (stableRun.present > 0 && stableFirstRemoved) {
    chips.push({ cls: "removed", txt: `✕ first removed at ${stableFirstRemoved.row.vers}` });
  }
  // One matrix cell (a release's button) — shared by the stable line and the
  // separate preview group. Diff state is against the release's branch base
  // (`branchBase`), never the raw publish predecessor.
  const renderCell = (row: VersionRow, i: number) => {
    const prev = branchBase(all, i);
    const st = cellState(itemKey, prev, row);
    const label = cellLabel(p, row, st);
    const ds = row.surface === null || row.surface === undefined ? null : digestsOf(row.surface, itemKey);
    const digests = ds ? [...ds].sort() : [];
    const prevDs = st === "changed" && prev ? digestsOf(prev.surface, itemKey) : null;
    const prevDigests = prevDs ? [...prevDs].sort() : [];
    // T-42: the digest-variant identity of the cell — the measured signatures
    // it carries ([] when the row has no digest of the key).
    const cellVariants = variants.filter((x) => digests.includes(x.digest));
    const isPresent = st === "added" || st === "same" || st === "changed";
    const dimmed = isolated !== null && !cellVariants.some((x) => x.index === isolated);
    const active = pinned !== null && pinned.providerId === p.id && pinned.vers === row.vers;
    let title = label;
    if (cellVariants.length > 0) {
      const refs = cellVariants.map((x) => `${x.label} ${x.shortDigest}…`).join(" + ");
      title += `\nmeasured digest variant${cellVariants.length > 1 ? "s" : ""}: ${refs}`;
      if (prevDigests.length > 0) {
        const prevRefs = prevDigests.map((d) => variantRef(variants, d) ?? `${d.slice(0, 8)}…`).join(" + ");
        title += `\ndiff base: ${prevRefs}`;
      }
    }
    const swatches = [...new Set(cellVariants.map((x) => x.index % VARIANT_PALETTE))];
    const cls = `cell ${
      !isPresent
        ? st === "unknown"
          ? "cell-unknown"
          : st === "removed"
            ? "cell-removed"
            : "cell-absent"
        : swatches.length > 1
          ? "cell-dvm"
          : `cell-dv${swatches[0] ?? 0}`
    }${dimmed ? " is-dimmed" : ""}${row.yanked ? " flag-yanked" : ""}${row.prerelease ? " flag-pre" : ""}${active ? " docked" : ""}`;
    const multiStyle =
      isPresent && swatches.length > 1
        ? {
            background: `linear-gradient(135deg, var(--dv${swatches[0]}) 0%, var(--dv${swatches[0]}) 46%, var(--dv${swatches[1]}) 54%, var(--dv${swatches[1]}) 100%)`,
          }
        : undefined;
    const cell: DockCell = {
      providerId: p.id,
      vers: row.vers,
      flagTxt: flagText(row),
      state: st,
      phrase: PHRASES[st],
      digests,
      prevVers: prev ? prev.vers : null,
      prevDigests: prevDigests.length > 0 ? prevDigests : null,
    };
    const variantAria = cellVariants.length > 0 ? ` — variant ${cellVariants.map((x) => x.label).join(" + ")}` : "";
    return (
      <button
        key={row.vers}
        type="button"
        className={cls}
        style={multiStyle}
        title={title}
        aria-label={label + variantAria}
        aria-haspopup="dialog"
        aria-expanded={active}
        aria-controls="release-popover"
        aria-describedby={active ? "release-popover-status" : undefined}
        data-cell-provider={p.id}
        data-cell-vers={row.vers}
        data-variants={cellVariants.map((x) => String(x.index)).join(",")}
        onClick={() => onToggleCell(cell)}
      />
    );
  };
  const cols = (n: number) => (n > 20 ? `repeat(10, var(--cell))` : `repeat(${Math.max(n, 1)}, var(--cell))`);
  return (
    <div className="stream">
      <div className="stream-head">
        <strong className="stream-name">{p.id}</strong>
        <span className="muted">{` ${p.versions.length} releases`}</span>
        <span
          className={`arch-tag ${companion ? "post" : "pre"} mono`}
          title={companion ? `post-split · companion ${companion.package} — this lineage split off and republishes under its own crates.io package` : "pre-split · self-contained — one lineage, published before the fork split"}
        >
          {companion ? "post" : "pre"}
        </span>
      </div>
      <div className="stream-summary">
        {chips.map((c) => (
          <span key={c.txt} className={`sum-chip ${c.cls}`} title={c.title}>
            {c.swatch !== undefined && <span className={`cell cell-dv${c.swatch}`} aria-hidden="true" />}
            {c.txt}
          </span>
        ))}
      </div>
      <div className="stream-row" style={{ gridTemplateColumns: cols(stableVers.length) }}>
        {stableRows.map(({ row, i }) => renderCell(row, i))}
      </div>
      {previewRows.length > 0 && (
        <div className="stream-previews">
          <div className="stream-previews-label mono">pre-release previews — not on the stable line</div>
          <div className="stream-row" style={{ gridTemplateColumns: cols(previewRows.length) }}>
            {previewRows.map(({ row, i }) => renderCell(row, i))}
          </div>
        </div>
      )}
    </div>
  );
}

/** The T-41 “dead strip” collapse: streams where the item was never measured
 * fold into one summary row (ids + computed release count, rule-4 wording)
 * with an expand toggle that renders their full dot rows — every cell stays
 * reachable, the dots stay the whole story (rule 1). */
function AbsentStreams({
  absent,
  itemKey,
  variants,
  isolated,
  pinned,
  onToggleCell,
}: {
  absent: Provider[];
  itemKey: string;
  variants: ItemVariant[];
  isolated: number | null;
  pinned: DockCell | null;
  onToggleCell: (cell: DockCell) => void;
}) {
  const [show, setShow] = useState(false);
  const totalRows = absent.reduce((n, p) => n + p.versions.length, 0);
  const unmeasured = absent.reduce(
    (n, p) => n + p.versions.filter((v) => v.surface === null || v.surface === undefined).length,
    0,
  );
  return (
    <div className="absent-streams" id="alignment-absent">
      <button
        type="button"
        className="absent-toggle"
        aria-expanded={show}
        onClick={() => setShow((s) => !s)}
      >
        <span aria-hidden="true" className="absent-caret">
          {show ? "▾" : "▸"}
        </span>
        <span className="absent-text">
          {`never measured on ${absent.map((p) => p.id).join(" · ")} — absent across ${totalRows} recorded release${totalRows === 1 ? "" : "s"}`}
        </span>
        <span
          className="absent-action mono"
          title={
            unmeasured > 0
              ? `${unmeasured} unmeasured row${unmeasured === 1 ? "" : "s"} excluded — rule 4 (an “absent” dot means the release was measured without the item)`
              : undefined
          }
        >
          {show ? "hide" : "show"}
        </span>
      </button>
      {show &&
        absent.map((p) => (
          <MatrixStream
            key={p.id}
            provider={p}
            itemKey={itemKey}
            variants={variants}
            isolated={isolated}
            pinned={pinned}
            onToggleCell={onToggleCell}
          />
        ))}
    </div>
  );
}

/** The kind quick-filter pill row (T-40), now living inside the suggestion
 * dropdown (T-41): it is only visible while the type-ahead list is open, so
 * it can never read as a filter over the active matrix item. Exported so the
 * parity suite can render it over the committed bundle. */
export function KindPills({
  pills,
  active,
  onPick,
}: {
  pills: AlignmentPill[];
  active: string;
  onPick: (filter: string) => void;
}) {
  return (
    <div className="kind-row" id="alignment-kinds">
      <span className="preset-label mono" title="filter the suggestions by kind">
        kind
      </span>
      <span className="kind-pills">
        {pills.map((p) => (
          <button
            key={p.filter}
            type="button"
            className={`kind-pill${active === p.filter ? " active" : ""}${p.bolt ? " bolt" : ""}`}
            aria-pressed={active === p.filter}
            title={
              p.filter === "rule"
                ? "items a confirmed migration rule touches (from-side or to-side of the rule store); counts computed from the loaded item index"
                : p.filter === "all"
                  ? "all measured item identities — count computed from the loaded item index"
                  : `only ${p.label} identities — count computed from the loaded item index`
            }
            onClick={() => onPick(p.filter)}
          >
            {p.bolt && <span aria-hidden="true">⚡ </span>}
            {p.label}
            <span className="kind-pill-count">{p.count.toLocaleString("en-US")}</span>
          </button>
        ))}
      </span>
    </div>
  );
}

/** The T-42 digest-variant legend (the dedesigned replacement for the design
 * mock's digest-variants deck — see the T-42 task): one compact chip per
 * distinct measured digest of the item — swatch + α/β/γ label, plus the
 * digest (or, for fn variants whose text the T-34 sidecar resolves, the
 * measured signature itself) — with the first-measured and prevalence facts
 * (N releases · M forks, computed from the loaded bundle, RULE-7) in the
 * chip's tooltip; the three neutral states (removed here / absent / not
 * measured) follow, and a quiet note explains the dot code. Clicking a chip
 * isolates that digest: every dot that does not carry it dims (aria-pressed
 * toggle; the dots stay focusable and the dock readout is unchanged). The
 * legend only renders measured digests — chips never invent a signature
 * (rule 2: type texts stay digest-only; fn texts resolve only through the
 * sidecar's (key, digest) → text records, never inferred). */
export function VariantLegend({
  variants,
  prevalence,
  texts,
  docChips,
  memberStats,
  baseVariant,
  onSelectBase,
  isolated,
  onToggle,
}: {
  variants: ItemVariant[];
  prevalence: DigestPrevalenceMap;
  /** The item's resolved fn texts by digest (lazy sidecar) — a resolvable
   * variant card shows the measured signature; types, multi-digest-row and
   * unresolved digests stay digest-only (rule 2). */
  texts: Map<string, string> | null;
  /** The measured doc-delta chips (T-43): one per digest-variant whose
   * uniform docstring differs from the item's baseline doc title doc — the
   * card chip shows the measured line diff vs that baseline (never the
   * duplicated full text). */
  docChips?: DocDeltaChip[];
  /** The per-variant member stats (T-49), in variant order — null for a
   * non-member-bearing kind or while the shared member map loads. */
  memberStats?: VariantMemberStat[] | null;
  /** The variant index the member deltas are computed against (T-49), or null
   * before a base is chosen. */
  baseVariant?: number | null;
  onSelectBase?: (index: number) => void;
  isolated: number | null;
  onToggle: (index: number) => void;
}) {
  const wide = variants.length > VARIANT_PALETTE;
  // The panel renders for any member-bearing key the caller asks about, even
  // when nothing resolved yet — that is the honest "still loading / no single
  // set" state, distinct from a non-member-bearing kind (which never renders
  // the panel at all).
  const hasMembers = !!memberStats;
  // The T-43 chip tooltip: the variant's own docstring + the measured
  // line diff vs the item baseline — added/removed doc lines only (RULE-7).
  const docDeltaNote = (chip: DocDeltaChip): string => {
    const lines = [
      ...chip.diff.removed.map((l) => `- ${l}`),
      ...chip.diff.added.map((l) => `+ ${l}`),
    ];
    return `the releases of this digest-variant read their own docstring:\n\n${chip.doc}\n\nmeasured change vs the item's baseline docstring:\n${lines.join("\n")}`;
  };
  return (
    <section className="deck" id="alignment-variants" aria-label="measured digest variants">
      <div className="deck-head">
        <h3>Measured digest variants</h3>
        <span className="deck-sub mono">
          {wide ? "letters keep counting past ω — colors repeat past the 8th variant · " : ""}
          {"digest parity is measured (rules 1 & 2)"}
        </span>
      </div>
      <div className="deck-grid">
        {variants.map((v) => {
          const count = prevalence.get(v.digest);
          const swatch = v.index % VARIANT_PALETTE;
          const text = texts ? texts.get(v.digest) : undefined;
          const first = v.firstSeen ? `${v.firstSeen.providerId} ${v.firstSeen.vers}` : "";
          const stat = memberStats?.find((m) => m.digest === v.digest);
          const isBase = baseVariant === v.index;
          return (
            <button
              key={v.digest}
              type="button"
              className={`var-card${isolated === v.index ? " isolated" : ""}`}
              aria-pressed={isolated === v.index}
              title={`${isolated === v.index ? "clear the isolate — show every release" : `isolate releases carrying ${v.label} in the forks below`} · first measured at ${first}`}
              onClick={() => onToggle(v.index)}
            >
              <span className="var-card-head">
                <span className={`cell cell-dv${swatch}`} aria-hidden="true" />
                <strong>{`Variant ${v.label}`}</strong>
                <code className="var-digest mono" title={`blake3 64-hex: ${v.digest}`}>
                  {v.shortDigest}
                </code>
              </span>
              {text !== undefined && <code className="var-sig mono">{text}</code>}
              {stat && memberStatLine(stat, isBase)}
              {docChips && (() => {
                const chip = docChips.find((c) => c.digest === v.digest);
                if (!chip) return null;
                return (
                  <span className="doc-delta mono" title={docDeltaNote(chip)}>
                    doc delta
                    <span className="doc-delta-count">{`-${chip.diff.removed.length} +${chip.diff.added.length}`}</span>
                  </span>
                );
              })()}
              {count && (
                <span className="var-card-stats">
                  <span className="stat-pill mono" title="release rows whose measured surface carries this exact digest">
                    <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
                      <path d="M2.5 5 8 2.5 13.5 5 8 7.5 2.5 5Z" />
                      <path d="M2.5 8 8 10.5 13.5 8" />
                      <path d="M2.5 11 8 13.5 13.5 11" />
                    </svg>
                    {`${count.releases} release${count.releases === 1 ? "" : "s"}`}
                  </span>
                  <span className="stat-pill mono" title="distinct forks carrying this exact digest">
                    <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
                      <circle cx="5" cy="3.5" r="1.6" />
                      <circle cx="11" cy="3.5" r="1.6" />
                      <path d="M5 5.1v2.2a2.6 2.6 0 0 0 2.6 2.6 2.6 2.6 0 0 1 2.6 2.6v.4" />
                      <path d="M11 5.1v2.2" />
                      <path d="M5 10.6v2" />
                      <circle cx="5" cy="13.5" r="1.6" />
                    </svg>
                    {`${count.forks.length} fork${count.forks.length === 1 ? "" : "s"}`}
                  </span>
                  {!wide && count.forks.length > 0 && (
                    <span className="var-forks muted" title={count.forks.join(", ")}>
                      {count.forks.join(" · ")}
                    </span>
                  )}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {hasMembers && (
        <MemberPanel
          variants={variants}
          stats={memberStats!}
          baseVariant={baseVariant ?? null}
          onSelectBase={onSelectBase}
        />
      )}
    </section>
  );
}

/** The member-count line of one variant card (T-49): `members 11 (+1)`, or the
 * explicit honest states — a measured-empty vector reads `members 0`, and a
 * vector that did not resolve (multi-digest key, or the map still loading)
 * reads `members —` with the reason, never a fabricated 0. The shift is against
 * the previous variant in the deck's own first-measured order. */
function memberStatLine(stat: VariantMemberStat, isBase: boolean) {
  if (stat.count === null) {
    return (
      <span
        className="var-members muted"
        title="no single member set was measured for this digest — the releases carrying it are measured under more than one digest, so no one vector is honest"
      >
        {"members —"}
      </span>
    );
  }
  const shift = stat.shift;
  return (
    <span className="var-members" title={`measured pub-member segments of this digest's contract${shift === null ? "" : ` · ${shift >= 0 ? "+" : ""}${shift} vs the previous variant in the deck's order`}`}>
      {`members ${stat.count}`}
      {shift !== null && shift !== 0 && (
        <span className={`member-shift mono${shift > 0 ? " up" : " down"}`}>
          {`(${shift >= 0 ? "+" : ""}${shift})`}
        </span>
      )}
      {isBase && <span className="member-base-tag mono">{"base"}</span>}
    </span>
  );
}

/** The member projection of a member-bearing type, as a comparative panel
 * (T-49). Listing every variant's full vector is not viable — a trait is 100+
 * segments (`trait:Styled` is 118–125) across up to 20 variants — so the panel
 * shows the *delta* against one chosen base variant (default: the first
 * measured), and expands to the actual measured segments on demand. The
 * segments are the analyzer's own strings, byte-identical to the sidecar's
 * (RULE-7): the panel never reconstructs, abbreviates or infers a member.
 * Private/`pub(crate)` members and doc comments never enter the projection
 * (honest rule 2), so a private-only change shows no delta at all. */
function MemberPanel({
  variants,
  stats,
  baseVariant,
  onSelectBase,
}: {
  variants: ItemVariant[];
  stats: VariantMemberStat[];
  baseVariant: number | null;
  onSelectBase?: (index: number) => void;
}) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const resolved = stats.filter((s) => s.vector !== null);
  const base = baseVariant !== null ? stats.find((s) => s.digest === variants[baseVariant]?.digest) : undefined;
  // A multi-digest key has no single member set — state it, never pick one.
  const ambiguous = stats.filter((s) => s.count === null);
  return (
    <div className="member-panel" id="alignment-members">
      <div className="deck-head">
        <h3>Member contract</h3>
        <span className="deck-sub mono">
          {"consumer-visible pub members only — doc comments and private/pub(crate) members never re-sign a type (honest rule 2)"}
        </span>
      </div>
      {resolved.length === 0 ? (
        <p className="subnote">
          {"No member vector resolved for this type's measured digests — the shared member map is still loading, or the key is measured under more than one digest per release (no single member set is honest)."}
        </p>
      ) : (
        <>
          <div className="member-base-row">
            <span className="muted">{"base variant — every other variant is diffed against it: "}</span>
            {variants.map((v) => {
              const s = stats.find((x) => x.digest === v.digest);
              if (!s || s.vector === null) return null;
              const isBase = base?.digest === v.digest;
              return (
                <button
                  key={v.digest}
                  type="button"
                  className={`member-base-chip mono${isBase ? " selected" : ""}`}
                  aria-pressed={isBase}
                  onClick={() => onSelectBase?.(v.index)}
                  title={`diff every other variant against ${v.label} (${v.shortDigest}…)`}
                >
                  {`${v.label} · ${s.count}`}
                </button>
              );
            })}
          </div>
          {base && (
            <div className="member-deltas">
              {variants.map((v) => {
                const s = stats.find((x) => x.digest === v.digest);
                if (!s) return null;
                const delta =
                  base.digest === v.digest ? null : variantMemberDeltaFor(base.vector!, s.vector);
                const isOpen = expanded === v.index;
                const total = delta ? delta.removed.length + delta.added.length : 0;
                return (
                  <div key={v.digest} className="member-delta-row">
                    <span className="member-delta-head">
                      <span className={`cell cell-dv${v.index % VARIANT_PALETTE}`} aria-hidden="true" />
                      <strong>{`Variant ${v.label}`}</strong>
                      <code className="mono muted">
                        {s.count === null ? "members —" : `members ${s.count}`}
                      </code>
                      {base.digest === v.digest ? (
                        <span className="muted">{" · the base"}</span>
                      ) : delta === null ? (
                        <span className="muted">{" · the measured member set is identical to the base"}</span>
                      ) : (
                        <>
                          <span className="muted">{" vs base: "}</span>
                          <span className="stat-pill mono">{`−${delta.removed.length} +${delta.added.length}`}</span>
                          <button
                            type="button"
                            className="member-toggle mono"
                            aria-expanded={isOpen}
                            onClick={() => setExpanded(isOpen ? null : v.index)}
                          >
                            {isOpen ? "hide" : `show ${total}`}
                          </button>
                        </>
                      )}
                    </span>
                    {isOpen && delta && (
                      <span className="member-delta-segs">
                        {delta.removed.map((seg) => (
                          <code className="member-seg member-removed" key={`-${seg}`}>{`− ${seg}`}</code>
                        ))}
                        {delta.added.map((seg) => (
                          <code className="member-seg member-added" key={`+${seg}`}>{`+ ${seg}`}</code>
                        ))}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
      {ambiguous.length > 0 && (
        <p className="subnote">
          {`${ambiguous.length} of ${stats.length} variants carry no single member set (measured under more than one digest per release) — those variants show no count and no delta.`}
        </p>
      )}
      <p className="subnote">
        {"Member counts include only members a downstream consumer can name. A variant's count is the measured segment count of its own vector; the shift is against the previous variant in the deck's first-measured order, which is not a cross-stream chronology (rule 1)."}
      </p>
    </div>
  );
}

/** The measured set difference of two member vectors directly (T-49) — used
 * where both sides are already resolved, so no digest address is needed. Same
 * operation and ordering as `typeMemberDelta`. */
function variantMemberDeltaFor(
  from: string[],
  to: string[] | null | undefined,
): { removed: string[]; added: string[] } | null {
  if (!to) return null;
  const fromSet = new Set(from);
  const toSet = new Set(to);
  const removed = from.filter((seg) => !toSet.has(seg));
  const added = to.filter((seg) => !fromSet.has(seg));
  if (removed.length === 0 && added.length === 0) return null;
  return { removed, added };
}

/** The dot-state legend above the fork matrix: the three neutral dot states
 * (removed here / absent / not measured), the pre/post split tags and a
 * hover "?" with the dot code. The variant deck above carries the digest
 * identity; this row explains the states a dot itself can be in. */
function DotLegend() {
  return (
    <div className="legend dot-legend" id="alignment-dot-legend">
      {NEUTRAL_LEGEND.map(([cls, word]) => (
        <span key={cls} className="legend-entry">
          <span className={`cell cell-${cls}`} />
          <span>{word}</span>
        </span>
      ))}
      <span className="legend-sep" aria-hidden="true">
        ·
      </span>
      <span className="legend-entry">
        <span
          className="arch-tag pre mono"
          title="pre-split · self-contained — one lineage, published before the fork split"
        >
          pre
        </span>
        <span>pre-split</span>
      </span>
      <span className="legend-entry">
        <span
          className="arch-tag post mono"
          title="post-split — this lineage republishes under its own crates.io package (the companion crate is named in the stream head tooltip)"
        >
          post
        </span>
        <span>post-split</span>
      </span>
      <span
        className="legend-info mono"
        aria-hidden="true"
        title="dot color = the measured digest it carries · a color change within a stream is a re-signature"
      >
        ?
      </span>
    </div>
  );
}


/** The T-43 hero docstring — the Title half of the promotion pipeline: an
 * fn item whose releases resolve a doc renders its measured docstring ONCE
 * under the item title. Invariant items show their one text; diverging
 * items show the baseline (the first measured release's text — the same
 * corpus anchor the α/β… variant labels use) and the caption reports the
 * measured divergence. Every byte is resolved from the doc-texts sidecar
 * (RULE-7 — never inferred, never carried past a removal); the per-variant
 * measured deltas ride the deck cards (VariantLegend's doc chips). */
function ItemDocTitle({ itemKey, story }: { itemKey: string; story: ItemDocStory }) {
  if (story.docs.length === 0) return null;
  const doc = story.docs[0];
  const n = story.docReleases;
  const bare = story.bareReleases;
  let cap: string;
  if (story.docs.length === 1) {
    cap =
      bare === 0
        ? `one docstring · measured on all ${n} release${n === 1 ? "" : "s"}`
        : `one docstring · measured on ${n} of ${n + bare} release${n + bare === 1 ? "" : "s"} — ${bare} carry no doc comment`;
  } else {
    cap = `${story.docs.length} docstrings across ${n} release${n === 1 ? "" : "s"} · the first measured (${story.anchor!.providerId} ${story.anchor!.vers}) anchors this title`;
  }
  return (
    <div className="item-doc" id="alignment-item-doc">
      <p
        className="item-doc-text"
        title={`the measured docstring of ${itemKey} — resolved from the item's payload fragment (schema gocar.forkmap.payload.v1; the doc-texts sidecar's rows projected per key)`}
      >
        {doc}
      </p>
      <p
        className="item-doc-cap mono"
        title="docstrings are measured per release — an fn's doc change never re-signs (its digest excludes doc comments), so only these resolved bytes tell the doc story (rule 7)"
      >
        {cap}
      </p>
    </div>
  );
}

/** The rendered item: kind-chip head + identity note + confirmed-rule box
 * (each rule row carries its T-40 copy-recipe control), then the T-42
 * digest-variant legend and the matrix+dock stage (T-41: streams that
 * carried the item first — the never-measured streams collapse — and the
 * release-inspector dock beside the matrix on wide viewports).
 *
 * T-33 increment 5: the item's digest-state table is no longer part of a
 * resident slice — it arrives as one per-key column bucket when the item is
 * selected. Until it lands the item area shows an honest brief loading line
 * (the matrix + deck need the digest state; there is nothing digest-only to
 * degrade to); a failed bucket is an error state, never an invented matrix.
 * The render tests inject the committed column record via `itemColumn` so
 * the recorded stories render server-side. */
function ItemBox({
  manifest,
  index,
  alignIndex,
  itemKey,
  itemColumn,
  payload,
}: {
  /** The boot manifest (T-33): the release rows the matrix walks + rules. */
  manifest: ForkmapManifest;
  /** The type-ahead index over the align-index (the suggestion counts + the
   * kind pills read it — built once by the Alignment view). */
  index: CorpusIndex;
  /** The alignment item index (T-33 increment 5): the ordinal authority the
   * column + payload buckets are addressed on, the never-measured markers
   * (RULE-4) and the dataset provenance. */
  alignIndex: AlignIndex;
  itemKey: string;
  /** The selected key's preloaded digest-state table (T-33 increment 5 —
   * render tests inject the committed column record so the promoted
   * matrix/deck render server-side; the runtime app leaves it undefined and
   * the lazy column bucket hook supplies it). */
  itemColumn?: AlignmentItem | null;
  /** The selected key's preloaded payload fragment (T-33 increment 3 —
   * render tests inject the committed record so the promoted Title/chips/
   * source anchors render server-side; the runtime app leaves it undefined
   * and the lazy bucket hook supplies it). */
  payload?: KeyPayload | null;
}) {
  const [dock, setDock] = useState<DockCell | null>(null);
  // The isolated digest-variant (T-42): null = no isolation — the legend
  // chip toggle dims every dot that does not carry the digest.
  const [isolated, setIsolated] = useState<number | null>(null);
  // A new item (deep link / preset) clears the pin and any isolation — the
  // pinned/dimmed state belongs to the previous matrix otherwise.
  useEffect(() => {
    setDock(null);
    setIsolated(null);
  }, [itemKey]);
  // T-33 increment 5: this item's digest-state table arrives as one per-key
  // column bucket (~29 KB median at the current corpus), fetched on
  // selection for EVERY item. The injected `itemColumn` prop (render tests)
  // wins while present; otherwise the lazy hook supplies the committed
  // record.
  const colState = useItemColumn(alignIndex, itemKey);
  const item = itemColumn !== undefined ? itemColumn : colState.status === "ready" ? colState.item : null;
  // T-33 increment 3: the item's payload rows (resolved fn signatures,
  // docstrings, source locations) arrive as one per-key payload fragment —
  // the selected key's bucket, fetched on selection for EVERY item (fn or
  // not: a non-fn item's bucket carries its source rows, so pinning a cell
  // never waits and never fetches more). Until the bucket lands the item
  // renders digest-only (no signatures, no Title, no source anchor) — the
  // honest pre-fetch state, never a placeholder. The injected `payload` prop
  // (render tests) wins while present; otherwise the lazy hook supplies the
  // committed record.
  const payloadState = useKeyPayload(alignIndex, itemKey);

  if (!item) {
    if (colState.status === "error") {
      return (
        <div className="panel item-column-state" role="alert">
          <p className="mono">This item's digest column could not be loaded — the matrix needs it.</p>
          <p className="subnote" id="item-column-error">
            {colState.error}
          </p>
        </div>
      );
    }
    // Loading (or the tests' explicit no-column override): the matrix reads
    // the per-key column bucket, so there is nothing to render until it
    // lands — an honest brief state, never a dead-end and never an invented
    // digest.
    return (
      <div className="panel item-column-state" role="status">
        <p className="mono">Loading this item's digest column…</p>
        <p className="subnote">
          The matrix reads one small per-key fragment (<code>data/forkmap-column-*.json</code>) when an item is
          selected — never the whole digest-state file.
        </p>
      </div>
    );
  }

  return (
    <ItemBoxBody
      manifest={manifest}
      index={index}
      alignIndex={alignIndex}
      item={item}
      itemKey={itemKey}
      payload={payload}
      payloadState={payloadState}
      dock={dock}
      setDock={setDock}
      isolated={isolated}
      setIsolated={setIsolated}
    />
  );
}

/** The item box's digest data path: the selected item's synthesized
 * per-release column + the payload fragment's subsets feed every shared
 * derivation below (RULE-7 — they run unchanged over the loaded column,
 * never the ~35 MB corpus). Mounted only when the item's column record is
 * ready (ItemBox gates on it), so its hooks are unconditional. */
function ItemBoxBody({
  manifest,
  index,
  alignIndex,
  item,
  itemKey,
  payload,
  payloadState,
  dock,
  setDock,
  isolated,
  setIsolated,
}: {
  manifest: ForkmapManifest;
  index: CorpusIndex;
  alignIndex: AlignIndex;
  item: AlignmentItem;
  itemKey: string;
  payload?: KeyPayload | null;
  payloadState: KeyPayloadState;
  dock: DockCell | null;
  setDock: Dispatch<SetStateAction<DockCell | null>>;
  isolated: number | null;
  setIsolated: Dispatch<SetStateAction<number | null>>;
}) {
  const rec = index.byKey.get(itemKey)!;
  // T-33 increment 2/5: this item's per-release digest column, synthesized
  // from its column fragment + the align-index's streams + the manifest's
  // release rows — shaped exactly like full-bundle providers, so every
  // derivation below runs unchanged over the loaded column (never the ~35 MB
  // corpus, never the ~3.5 MB slice). Non-null by construction: ItemBox
  // mounts the body only with a column record the index carries.
  const columns = useMemo(() => alignmentColumn(manifest, alignIndex, item)!, [manifest, alignIndex, item]);
  // The view's data object for the shared derivations: the synthesized
  // key-column providers + the manifest's rule store (the confirmed rules
  // are byte-identical to the full bundle's — RULE-7).
  const bundle = useMemo(() => ({ providers: columns, rules: manifest.rules }), [columns, manifest]);
  const fromRules = rulesFrom(bundle, itemKey);
  const toRules = rulesTo(bundle, itemKey);
  // Per-item digest prevalence, computed once per matrix (the deck cards
  // render it per digest-variant): a pure scan over the loaded column
  // (RULE-7 — asserted equal to the corpus derivation by parity).
  const prevalence = useMemo(() => digestPrevalence(bundle, itemKey), [bundle, itemKey]);
  // T-42: the item's distinct measured digests, in first-measured order —
  // the α/β/γ… the legend chips, cell dots and popover share.
  const variants = useMemo(() => itemVariants(bundle, itemKey), [bundle, itemKey]);
  // T-41: streams that ever carried the item render first; never-measured
  // streams collapse below.
  const { present, absent } = useMemo(() => streamPartition(bundle.providers, itemKey), [bundle.providers, itemKey]);
  const payloadRecord =
    (payload !== undefined
      ? payload
      : payloadState.status === "ready" && payloadState.payload?.k === itemKey
        ? payloadState.payload
        : null) ?? null;
  // The fragment's rows reconstruct sidecar-shaped per-key subsets (provider
  // id/vers resolved via the synthesized column's manifest rows — exactly
  // like the column synthesis), so the shared derivations below run
  // unchanged over the loaded fragment. A key with no rows reconstructs
  // nothing: its box and popover stay digest-only / anchor-less.
  const payloadMeta = useMemo(
    () => ({ datasetSchema: alignIndex.dataset_schema, datasetSyncedAt: alignIndex.dataset_synced_at }),
    [alignIndex],
  );
  const subsets = useMemo(
    () => payloadSubsets(payloadRecord, columns, payloadMeta),
    [payloadRecord, columns, payloadMeta],
  );
  // T-47 decision 2b / T-51: the member vectors come from one shared,
  // lazily-fetched map (module cached, so this is at most one request per
  // session and typically none — the Changes/Journal pair path needs the same
  // map, which is why it is not carried per item). A failed load degrades to
  // the pub-only policy copy in the popover.
  const memberMap = useTypeMembers();
  const isFn = splitKey(itemKey)[0] === "fn";
  // T-49: the deck's per-variant member stats + the base-variant delta, off the
  // same shared map the Changes/Journal rows read (no extra request).
  const memberStats = useMemo(
    () =>
      isMemberBearingKind(itemKey)
        ? variantMemberStats(variants, memberVectorsOf(memberMap, itemKey))
        : null,
    [itemKey, variants, memberMap],
  );
  const [memberBase, setMemberBase] = useState<number | null>(null);
  // The item's measured doc story + per-variant deltas (T-43), resolved
  // from the fragment's doc rows: the hero Title reads the story, the deck
  // cards read the chips. Null for non-fn items (types/consts stay
  // digest-only — decision 1(a)) and while the fragment has not loaded.
  const docStory = useMemo(
    () => (isFn && subsets.docTexts ? itemDocStory(bundle, itemKey, subsets.docTexts) : null),
    [isFn, subsets.docTexts, bundle, itemKey],
  );
  const docChips = useMemo(() => (docStory ? itemDocChips(docStory) : []), [docStory]);
  // The chip-level digest → measured text map (T-42), rebuilt when the
  // fragment lands: pure rows+fragment resolution, exact per the T-34
  // invariant (equal digest ⇒ byte-equal text).
  const digestTexts = useMemo(
    () => (isFn && subsets.fnTexts ? fnDigestTexts(subsets.fnTexts, bundle.providers, itemKey) : null),
    [isFn, subsets.fnTexts, bundle, itemKey],
  );
  // T-44: the popover's docs.rs source permalink reads the fragment's
  // source rows — fetched on item selection (above), so a pin adds no new
  // request. Until the bucket lands the popover renders no anchor — the
  // honest pre-fetch state.
  const locs = subsets.srcLocs;
  const onDismiss = () => setDock(null);
  // The FSM's activation transition (IDLE→PINNED, PINNED→PINNED by re-pin,
  // and PINNED→IDLE by re-activating the pinned cell) — MatrixStream cells
  // fire it on click / Space / Enter.
  const toggleCell = (cell: DockCell) => {
    setDock((cur) =>
      cur !== null && cur.providerId === cell.providerId && cur.vers === cell.vers ? null : cell,
    );
  };
  return (
    <>
      <div className="panel item-head">
        <div className="item-title">
          <KindChip item={itemKey} />
        </div>
        {docStory && docStory.docs.length > 0 && <ItemDocTitle itemKey={itemKey} story={docStory} />}
      </div>
      <VariantLegend
        variants={variants}
        prevalence={prevalence}
        texts={digestTexts}
        docChips={docChips}
        memberStats={memberStats}
        baseVariant={memberBase}
        onSelectBase={setMemberBase}
        isolated={isolated}
        onToggle={(i) => setIsolated((cur) => (cur === i ? null : i))}
      />
      <div className="hero-stats" aria-label="item stats">
        <span className="stat-pill mono" title="release rows whose measured surface includes this item — of the whole dataset">
          <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
            <path d="M2.5 5 8 2.5 13.5 5 8 7.5 2.5 5Z" />
            <path d="M2.5 8 8 10.5 13.5 8" />
            <path d="M2.5 11 8 13.5 13.5 11" />
          </svg>
          {`${rec.versions} of ${manifest.counts.versions} releases`}
        </span>
        <span className="stat-pill mono" title="forks in the dataset — which of them carry it is the fork matrix below">
          <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
            <circle cx="5" cy="3.5" r="1.6" />
            <circle cx="11" cy="3.5" r="1.6" />
            <path d="M5 5.1v2.2a2.6 2.6 0 0 0 2.6 2.6 2.6 2.6 0 0 1 2.6 2.6v.4" />
            <path d="M11 5.1v2.2" />
            <path d="M5 10.6v2" />
            <circle cx="5" cy="13.5" r="1.6" />
          </svg>
          {`${manifest.counts.providers} forks`}
        </span>
        <span className="stat-pill mono" title="distinct measured digests of this item — α β γ… label them in first-measured order">
          <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
            <circle cx="3.5" cy="3.5" r="1.3" />
            <circle cx="12.5" cy="3.5" r="1.3" />
            <circle cx="8" cy="12.5" r="1.3" />
            <path d="M3.5 4.8v2.4a2.2 2.2 0 0 0 2.2 2.2h1.6" />
            <path d="M12.5 4.8v2.4a2.2 2.2 0 0 1-2.2 2.2h-1.6" />
          </svg>
          {`${variants.length} variant${variants.length === 1 ? "" : "s"}`}
        </span>
      </div>
      {(fromRules.length > 0 || toRules.length > 0) && (
        <div
          className="rule-box"
          title="a rule is a recipe, not an attestation — a human confirmed the successor; dataset vouching ≠ compile vouching (doc 09). The copy control puts the dataset payload (rule id + measured from/to keys + transition provenance) on your clipboard."
        >
          <strong>Confirmed migration rules</strong>
          {fromRules.map((r) => (
            <RuleLine key={r.id} rule={r} context="removed → " copy={ruleCopyPayload(r)} />
          ))}
          {toRules.map((r) => (
            <RuleLine key={r.id} rule={r} context="← successor of" copy={ruleCopyPayload(r)} />
          ))}
        </div>
      )}
      <DotLegend />
      <div className="matrix-stage">
        <div className="matrix">
          {present.map((p) => (
            <MatrixStream
              key={p.id}
              provider={p}
              itemKey={itemKey}
              variants={variants}
              isolated={isolated}
              pinned={dock}
              onToggleCell={toggleCell}
            />
          ))}
          {absent.length > 0 && (
            <AbsentStreams
              absent={absent}
              itemKey={itemKey}
              variants={variants}
              isolated={isolated}
              pinned={dock}
              onToggleCell={toggleCell}
            />
          )}
        </div>
        {/* T-44: the release popover replaces the inspection dock — it renders
            only while a cell is pinned (no inert placeholder) and floats over
            the matrix, anchored to the active cell. */}
        {dock && (
          <ReleasePopover
            bundle={bundle}
            itemKey={itemKey}
            cell={dock}
            variants={variants}
            locs={locs}
            memberMap={memberMap}
            onDismiss={onDismiss}
          />
        )}
      </div>
    </>
  );
}

export function AlignmentView({
  manifest,
  alignIndex,
  params,
  payload,
  itemColumn,
}: {
  /** The boot manifest (T-33): release metadata + rules + counts — the rows
   * the matrix walks; its counts are the hero-stats' denominators. */
  manifest: ForkmapManifest;
  /** The alignment item index (T-33 increment 5): the type-ahead key list
   * with per-key release counts + the per-stream never-measured markers —
   * the file the view fetches on open. The matrix data for the selected
   * item rides one per-key column bucket, fetched on selection. */
  alignIndex: AlignIndex;
  params: Record<string, string>;
  /** The selected item's preloaded payload fragment (T-33 increment 3) —
   * undefined in the runtime app (the lazy bucket hook fetches it); the
   * render-parity suite injects the committed record to assert the promoted
   * Title/chips/source anchors over the real data. */
  payload?: KeyPayload | null;
  /** The selected item's preloaded digest-state table (T-33 increment 5) —
   * undefined in the runtime app (the lazy column bucket hook fetches it);
   * the render-parity suite injects the committed record to assert the
   * matrix/deck over the real data. */
  itemColumn?: AlignmentItem | null;
}) {
  const index = useMemo(() => indexIndex(alignIndex), [alignIndex]);
  const selectedKey = params.item && index.byKey.has(params.item) ? params.item : null;
  const [query, setQuery] = useState(selectedKey ?? "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [kindFilter, setKindFilter] = useState("all");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const actionable = useMemo(() => ruleActionableKeys(manifest), [manifest]);
  const pills = useMemo(() => alignmentPills(index, actionable), [index, actionable]);
  // T-46: the search runs only once the query clears the measured min-query
  // floor (every 1-char query over the committed corpus is a browse — 0 of 26
  // narrow enough to be a target; see ALIGN_MIN_QUERY in derive.ts), so a
  // 1-char keystroke neither scans 13 344 keys nor opens a thousands-row
  // list. Below the floor the dropdown shows an honest keep-typing hint,
  // never a no-match claim.
  const searchable = alignmentQuerySearchable(query);
  const searched = useMemo(
    () => (alignmentQuerySearchable(query) ? searchIndex(index, query) : []),
    [index, query],
  );
  const matches = useMemo(
    () => filterAlignmentKeys(kindFilter, searched, actionable),
    [kindFilter, searched, actionable],
  );
  // T-46: the listbox renders a bounded window over the full match set plus
  // an honest more-row (alignmentSuggestionWindow) — keyboard/aria scan the
  // visible window and Enter selects within it; the full set still drives the
  // no-match state and the window's more-count (RULE-7: derived).
  const { shown, more } = useMemo(
    () => alignmentSuggestionWindow(searchable ? matches : []),
    [searchable, matches],
  );

  // A new hash item (deep link, preset pick, or a row link from another view)
  // drives the input text + a closed list + the all filter; the matrix
  // renders from params.
  useEffect(() => {
    setQuery(selectedKey ?? "");
    setOpen(false);
    setActive(-1);
    setKindFilter("all");
  }, [selectedKey]);

  // Close the list on outside clicks (app.js document listener).
  useEffect(() => {
    const onClick = (ev: MouseEvent) => {
      const t = ev.target as Node;
      if (panelRef.current && !panelRef.current.contains(t)) {
        setOpen(false);
        setActive(-1);
      }
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  // Keep the active option in view while arrowing (app.js scrollIntoView).
  useEffect(() => {
    if (!open || active < 0) return;
    document.getElementById(`align-opt-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const selectItem = (key: string) => {
    setQuery(key);
    setOpen(false);
    setActive(-1);
    // Preserve a back target when one brought us here (T-38 round-trip).
    const next: Record<string, string> = { item: key };
    if (params.back) next.back = params.back;
    const hash = routeHash("alignment", next);
    if (window.location.hash !== hash) window.location.hash = hash;
  };

  /** A quick-filter pill: re-narrow the (open) suggestion list — the pills
   * live inside the dropdown, so they only ever act on the suggestions. */
  const onKindClick = (filter: string) => {
    setKindFilter(filter);
    setActive(-1);
  };

  const onKeyDown = (ev: React.KeyboardEvent<HTMLInputElement>) => {
    if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
      ev.preventDefault();
      // Arrow-scan the rendered window only — the rows that exist in the DOM
      // (T-46: a match set beyond the window has no rows to move into; the
      // more-row says to keep typing).
      const rows = shown;
      if (!rows.length) return;
      const delta = ev.key === "ArrowDown" ? 1 : -1;
      const next = active < 0 ? (delta > 0 ? 0 : rows.length - 1) : active + delta;
      setOpen(true);
      setActive((next + rows.length) % rows.length);
    } else if (ev.key === "Enter") {
      ev.preventDefault();
      if (active >= 0 && shown[active]) {
        selectItem(shown[active]);
      } else if (shown.length) {
        selectItem(shown[0]);
      }
    } else if (ev.key === "Escape") {
      setOpen(false);
      setActive(-1);
    }
  };

  const backTarget = params.back ? parseViewTarget(params.back) : null;
  const showBack = backTarget !== null && backTarget.view !== "landing" && backTarget.view !== "alignment";

  const presetKeys = ALIGNMENT_PRESETS.filter((k) => index.byKey.has(k));

  const kindLabel = pills.find((p) => p.filter === kindFilter)?.label ?? kindFilter;
  const noMatchText =
    kindFilter === "all"
      ? "no item matches — try a kind prefix (fn:, struct:) or part of a name"
      : kindFilter === "rule"
        ? "no item with a migration recipe matches"
        : `no ${kindLabel} items match`;

  const typed = query.trim().length > 0;
  // T-46 honest floor state: below the min-query length the search has not
  // run, so the dropdown says so instead of claiming “no item matches”.
  const floorHint =
    "keep typing — the search starts at 2+ characters (a kind prefix like fn: or part of a name)";
  // T-46 honest window state (RULE-7): the visible rows are the first of the
  // full match set and the more-row says exactly how many rows exist beyond
  // them — the list never pretends it is complete.
  const moreText = `first ${shown.length} of ${(shown.length + more).toLocaleString("en-US")} shown — ${more.toLocaleString("en-US")} more match this; keep typing to narrow`;

  return (
    <section id="view-alignment" className={`view${selectedKey ? " has-item" : ""}`}>
      <div className="wrap">
        <div className="align-band">
          <div className="view-head">
            <p className="view-eyebrow mono">{`fork map / alignment inspector · item index schema ${alignIndex.schema} (export-derived from gocar.forkmap.v1)`}</p>
            <h1>Cross-Fork API Longevity &amp; Digest Parity</h1>
          </div>

          <div className="panel picker align-search" id="alignment-search-panel" ref={panelRef}>
            <label className="ctl search-ctl" id="alignment-search-label">
              <span className="visually-hidden">Search measured items</span>
              <span className="search-box">
                <svg className="search-ico" aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <circle cx="7" cy="7" r="4.4" />
                  <path d="M10.5 10.5 14 14" />
                </svg>
                <input
                  id="alignment-query"
                  ref={inputRef}
                  type="search"
                  placeholder="type an item — e.g. Window::blur, record_frame_timing, accessibility::…"
                  autoComplete="off"
                  spellCheck={false}
                  role="combobox"
                  aria-autocomplete="list"
                  aria-expanded={open}
                  aria-controls="alignment-suggest"
                  aria-activedescendant={active >= 0 && open ? `align-opt-${active}` : ""}
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setActive(-1);
                    setOpen(e.target.value.trim().length > 0);
                  }}
                  onKeyDown={onKeyDown}
                />
                <kbd className="search-kbd" aria-hidden="true">
                  /
                </kbd>
              </span>
            </label>
            {/* The suggestion dropdown (T-41: the kind pills are a toolbar in
                its header — visible only while the list is open, so they never
                read as a filter over the selected matrix item). */}
            <div className="suggest-panel" hidden={!open}>
              <KindPills pills={pills} active={kindFilter} onPick={onKindClick} />
              <div id="alignment-suggest" className="suggest" role="listbox" hidden={!open}>
                {open && typed && !searchable && <div className="suggest-none">{floorHint}</div>}
                {open && searchable && shown.length === 0 && <div className="suggest-none">{noMatchText}</div>}
                {open &&
                  shown.map((key, i) => (
                    <button
                      key={key}
                      type="button"
                      className={`suggest-row${active === i ? " active" : ""}`}
                      id={`align-opt-${i}`}
                      role="option"
                      aria-selected={active === i}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => selectItem(key)}
                    >
                      <KindChip item={key} />
                      <span className="suggest-count">
                        {`${index.byKey.get(key)!.versions} release${index.byKey.get(key)!.versions === 1 ? "" : "s"}`}
                      </span>
                    </button>
                  ))}
              </div>
              {open && more > 0 && (
                <p className="suggest-more mono" id="alignment-suggest-more">
                  {moreText}
                </p>
              )}
            </div>
            <div className="preset-row" id="alignment-presets" hidden={presetKeys.length === 0}>
              <span className="preset-label mono" title="recorded-story items">
                presets
              </span>
              <span id="alignment-preset-chips" className="preset-chips">
                {presetKeys.map((k) => (
                  <button key={k} type="button" className="preset-chip mono" onClick={() => selectItem(k)}>
                    {k}
                  </button>
                ))}
              </span>
            </div>
            <p className="ctl-hint" id="alignment-hint">
              {!selectedKey && EMPTY_HINT}
            </p>
          </div>
        </div>

        <p className="align-back-row" id="alignment-back" hidden={!showBack}>
          {showBack && backTarget && (
            <a
              className="back-chip mono"
              href={`#/${params.back}`}
              aria-label={`Return to the ${targetLabel(manifest, backTarget)} view`}
            >
              {`← return to ${targetLabel(manifest, backTarget)}`}
            </a>
          )}
        </p>

        <div id="alignment-item">
          {selectedKey && (
            <ItemBox
              manifest={manifest}
              index={index}
              alignIndex={alignIndex}
              itemKey={selectedKey}
              itemColumn={itemColumn}
              payload={payload}
            />
          )}
        </div>

        <div className="panel" id="alignment-docs">
          <h2>Where this class of change is documented</h2>
          <div id="alignment-docs-body">
            {DOC_BLURBS.map((n) => (
              <div key={n} className="doc-row">
                <StudyDocLink num={n} />
              </div>
            ))}
          </div>
        </div>

        <div className="about-note" id="alignment-about">
          <AboutNote />
        </div>
      </div>
    </section>
  );
}
