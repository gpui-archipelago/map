// T-39 — Changes view (the static site's view-changes, ported 1:1).
//
// The item-set delta between any two releases of any forks: pickers + swap +
// recorded-story quick links, the pair caption (T-38) that names how the pair
// was chosen, per-provider release detail, the snapshot-vs-changelog banner
// (RULE-1: cross-fork deltas are snapshot-surface differences, never
// changelogs, and rule rows there are informational only), the T-38 delta
// filter (text + kind with visible-count chips), and the kind-grouped rows
// whose alignment links carry the `back` round-trip.
//
// State lives in the hash exactly like the static site (`#/changes?a=…&b=…`,
// canonical `<fork>:<vers>` sides; the v1 `?p=<fork>&a=…&b=…` form still
// parses): every rendered pair stays linkable. The filter text/kind are local
// UI state — they survive pair changes within the view (as in app.js) and
// reset when the view remounts; a kind selection resets to "all kinds" when
// the new delta has no rows of it (fillKinds' fallback).
//
// T-33 increment 4: the view declares the logical data it renders — the boot
// manifest (metadata + rules), the per-release row facts (`data`, from the
// corpus data-access layer) and the compared pair's rows (`useDiffPair`,
// reconstructed from the export's per-release files behind the layer) — and
// never names a data file or payload schema, so a future layout re-org edits
// the layer, not this view. A never-measured side resolves ready-without-rows
// (RULE-4: its absence IS the marker — no file is requested). The re-signed
// fn texts ride the pair's own rows; no whole-file sidecar is fetched.

import { useEffect, useState } from "react";
import { AboutNote } from "../components/AboutNote";
import { ItemList, ProviderLine, RemovedRowExtra, ResignedRowExtra } from "../components/rows";
import {
  changesPairValue,
  defaultPair,
  namedPair,
  providerFor,
  releaseFlags,
  resolveChanges,
  rowFor,
  stepPair,
} from "../bundle/changes";
import { diffRows, kindRank, splitKey } from "../bundle/derive";
import type { DiffOk } from "../bundle/derive";
import {
  PAIR_LOADING_LINE,
  factsOf,
  useDiffPair,
  type CorpusData,
  type PairState,
} from "../bundle/corpus";
import { useTypeMembers } from "../bundle/keyPayload";
import type { FnTextsBundle, ForkmapManifest, ManifestVersionRow, Side, TypeMembersBundle, VersionRow } from "../bundle/types";
import { routeHash } from "../routing";

/** `<vers> (yanked, pre-release)` option label — RULE-6 flags shown, never
 * hidden. */
function optionLabel(v: ManifestVersionRow): string {
  const flags = releaseFlags(v);
  return flags.length ? `${v.vers} (${flags.join(", ")})` : v.vers;
}

/** The current pair as a T-38 `back` target ("changes?a=…&b=…", no "#/"). */
function backTarget(a: Side, b: Side): string {
  return `changes?a=${changesPairValue(a.provider.id, a.vers)}&b=${changesPairValue(b.provider.id, b.vers)}`;
}

function DiffNature({ a, b, crossFork }: { a: Side; b: Side; crossFork: boolean }) {
  // Whether the pair is one fork or two is the whole claim (RULE-1: cross-fork
  // deltas are snapshot comparisons, never changelogs), stated as the one word
  // that names it — the full sentence rides the accessible name and tooltip.
  const note = crossFork
    ? `Snapshot comparison. Two different forks — ${a.provider.id} and ${b.provider.id} — with no shared lineage, so each row just compares the two releases item by item. For a fork's own history, see the Journal.`
    : `Changelog. Two releases of ${a.provider.id}, so this is that fork's own history — the same adjacency the Journal renders.`;
  return (
    <span className="diff-nature mono" role="img" aria-label={note} title={note}>
      {crossFork ? "snapshot" : "changelog"}
    </span>
  );
}

/** The pair's facts line: the delta's nature glyph, then each side's measured
 * item count with its api hash. The count comes from the per-release row facts
 * (the manifest does not carry them); the api_hash/facade text come from the
 * manifest's own release rows (metadata — never the corpus). */
function DiffMeta({ data, a, b }: { data: CorpusData; a: Side; b: Side }) {
  const metaOf = (side: Side): { row: ManifestVersionRow | null; m: number; n: number } => ({
    row: rowFor(side.provider, side.vers),
    m: factsOf(data, side.provider.id, side.vers)?.m ?? 2,
    n: factsOf(data, side.provider.id, side.vers)?.n ?? 0,
  });
  const aMeta = metaOf(a);
  const bMeta = metaOf(b);
  const sideFact = (side: "A" | "B", row: ManifestVersionRow | null, m: number, n: number) =>
    `${side}: ${m === 0 ? "not measured" : `${n.toLocaleString()} records`}${
      row?.api_hash ? ` (api ${row.api_hash.slice(0, 6)}…)` : ""
    }`;
  const facadeText = (row: ManifestVersionRow | null) => {
    const f = row?.facade;
    return f
      ? `${f.aliases.length} alias${f.aliases.length === 1 ? "" : "es"}, ${f.polyfills.length} polyfill${f.polyfills.length === 1 ? "" : "s"}`
      : "none";
  };
  return (
    <div className="diff-meta muted">
      <DiffNature a={a} b={b} crossFork={a.provider !== b.provider} />
      <span>{`${sideFact("A", aMeta.row, aMeta.m, aMeta.n)} · ${sideFact("B", bMeta.row, bMeta.m, bMeta.n)}`}</span>
      {(aMeta.row?.rust_version || bMeta.row?.rust_version) && (
        <span>
          {` · declared rust-version: A ${aMeta.row?.rust_version ?? "—"} / B ${bMeta.row?.rust_version ?? "—"} (declared, not an attestation)`}
        </span>
      )}
      {(aMeta.row?.facade || bMeta.row?.facade) && (
        <span>{` · facade shims — A ${facadeText(aMeta.row)} / B ${facadeText(bMeta.row)}`}</span>
      )}
    </div>
  );
}

/** The listable diff: the T-38 filter bar + the counts-bar summary + the
 * kind-grouped sections (their rows link into Alignment with `back`). */
function ListableDiff({
  manifest,
  data,
  a,
  b,
  aRow,
  bRow,
  crossFork,
  texts,
  members,
  diff,
  back,
  search,
  kind,
  onSearch,
  onKind,
}: {
  manifest: ForkmapManifest;
  data: CorpusData;
  a: Side;
  b: Side;
  aRow: VersionRow;
  bRow: VersionRow;
  crossFork: boolean;
  texts: FnTextsBundle | null;
  members: TypeMembersBundle | null;
  diff: DiffOk;
  back: string;
  search: string;
  kind: string;
  onSearch: (v: string) => void;
  onKind: (v: string) => void;
}) {
  const kinds = new Set<string>();
  for (const key of [...diff.removed, ...diff.added, ...diff.resigned.map((r) => r.key)]) {
    kinds.add(splitKey(key)[0]);
  }
  const kindsKey = [...kinds].sort().join("\u0000");
  // fillKinds' fallback (app.js): a kind selection survives only while the
  // current delta still has rows of it; otherwise the select resets to all.
  useEffect(() => {
    if (kind && !kinds.has(kind)) onKind("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kindsKey]);
  const effKind = kinds.has(kind) ? kind : "";

  const matches = (key: string): boolean => {
    if (effKind) {
      const [k] = splitKey(key);
      if (k !== effKind) return false;
    }
    const q = search.trim().toLowerCase();
    return !q || key.toLowerCase().includes(q);
  };

  const removed = diff.removed.filter(matches);
  const added = diff.added.filter(matches);
  const resignedKeys = diff.resigned.map((r) => r.key).filter(matches);
  const full = diff.removed.length + diff.added.length + diff.resigned.length;
  const vis = removed.length + added.length + resignedKeys.length;
  const active = Boolean(effKind || search.trim());

  const note: string[] = [];
  if (effKind) note.push(`kind: ${effKind}`);
  if (search.trim()) note.push(`text: “${search.trim()}”`);
  const noteText = note.length ? `filtering by ${note.join(" · ")}` : "";

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  // The drawer stages its two fields: Apply commits them, Clear resets them.
  const [draftKind, setDraftKind] = useState("");
  const [draftSearch, setDraftSearch] = useState("");
  // The three count chips are section switches: pressing one hides that whole
  // section, so the delta can be read one kind of change at a time.
  const [showRemoved, setShowRemoved] = useState(true);
  const [showAdded, setShowAdded] = useState(true);
  const [showChanged, setShowChanged] = useState(true);

  const flagsPresent = releaseFlags(aRow).length > 0 || releaseFlags(bRow).length > 0;

  const hiddenCount = (showRemoved ? 0 : removed.length) + (showAdded ? 0 : added.length) + (showChanged ? 0 : resignedKeys.length);
  // How many of the drawer's fields are doing something — the bar's count.
  const appliedFilters = (effKind ? 1 : 0) + (search.trim() ? 1 : 0);

  const openFilter = () => {
    setDraftKind(effKind);
    setDraftSearch(search);
    setIsFilterOpen(true);
  };
  const applyDraft = () => {
    onKind(draftKind);
    onSearch(draftSearch);
  };
  const clearFilter = () => {
    setDraftKind("");
    setDraftSearch("");
    onKind("");
    onSearch("");
  };

  const statusChip = (cls: string, n: number, label: string, on: boolean, toggle: () => void) => (
    <button
      type="button"
      className={`count-chip ${cls}`}
      aria-pressed={on}
      title={`${on ? "hide" : "show"} ${label} rows`}
      onClick={toggle}
    >
      {`${n} ${label}`}
      {on && <span aria-hidden="true"> ✓</span>}
    </button>
  );

  const kindOptions = [...kinds].sort((x, y) => kindRank(x) - kindRank(y));
  return (
    <>
      <div className="panel diff-stage" id="changes-diff">
        <DiffMeta data={data} a={a} b={b} />
        <div className="diff-stage-body">
          <p className="diff-summary">
            <span>{`${vis} measured item differences${vis !== full ? ` (of ${full})` : ""}:`}</span>
            <span className="counts-bar">
              {statusChip("count-removed", removed.length, "removed", showRemoved, () => setShowRemoved((v) => !v))}
              {statusChip("count-added", added.length, "added", showAdded, () => setShowAdded((v) => !v))}
              {statusChip("count-resigned", resignedKeys.length, "changed", showChanged, () => setShowChanged((v) => !v))}
            </span>
            <button
              id="changes-filter-toggle"
              type="button"
              className="filter-toggle mono"
              aria-expanded={isFilterOpen}
              aria-controls="changes-filter"
              onClick={() => (isFilterOpen ? setIsFilterOpen(false) : openFilter())}
            >
              {`🔍 Filter${appliedFilters ? ` (${appliedFilters})` : ""}`}
            </button>
          </p>
          {/* The drawer unrolls directly under the button that toggles it, so the
              counts stay above their controls and the toolbar never moves — and
              it stays in the DOM either way (an id the static renderer bound
              must never vanish). */}
          <div className="panel diff-filter" id="changes-filter" hidden={!isFilterOpen}>
            <div className="ff-head">
              <span className="ff-title mono">filter identifiers</span>
              <button
                id="changes-filter-close"
                type="button"
                className="ff-x mono"
                aria-label="close the filter"
                title="close the filter"
                onClick={() => setIsFilterOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="ff-body">
              <label className="ctl">
                <span className="ctl-label mono" aria-hidden="true">
                  kind
                </span>
                <select
                  id="changes-filter-kind"
                  aria-label="filter delta rows by kind"
                  value={draftKind}
                  onChange={(e) => setDraftKind(e.target.value)}
                >
                  <option value="">all kinds</option>
                  {kindOptions.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </label>
              <label className="ctl">
                <span className="ctl-label mono" aria-hidden="true">
                  match name / symbol
                </span>
                <input
                  id="changes-filter-search"
                  type="search"
                  placeholder="e.g. measure_all"
                  autoComplete="off"
                  spellCheck={false}
                  aria-label="filter delta rows by name"
                  value={draftSearch}
                  onChange={(e) => setDraftSearch(e.target.value)}
                />
              </label>
              <button id="changes-filter-clear" type="button" className="mono" onClick={clearFilter}>
                Clear
              </button>
              <button id="changes-filter-apply" type="button" className="mono" onClick={applyDraft}>
                Apply
              </button>
              <span className="ff-note mono" id="changes-filter-note">
                {noteText}
              </span>
            </div>
          </div>
          {vis === 0 ? (
            <p className="empty-hint">
              {active
                ? "no rows match the filter — clear it to see the full delta."
                : "no measured item differences to list."}
            </p>
          ) : hiddenCount === vis ? (
            <p className="empty-hint">{"every row is hidden by the chips above — press one to show its rows."}</p>
          ) : (
            <>
              {showRemoved && removed.length > 0 && (
                <div className="delta-sec removed">
                  <h3>{`Removed (${removed.length})`}</h3>
                  <ItemList
                    keys={removed}
                    cssClass="removed-row"
                    rowExtra={(key) => (
                      <RemovedRowExtra
                        rules={manifest.rules}
                        providerId={b.provider.id}
                        bVers={b.vers}
                        itemKey={key}
                        crossFork={crossFork}
                      />
                    )}
                    back={back}
                  />
                </div>
              )}
              {showAdded && added.length > 0 && (
                <div className="delta-sec added">
                  <h3>{`Added (${added.length})`}</h3>
                  <ItemList keys={added} cssClass="added-row" back={back} />
                </div>
              )}
              {showChanged && resignedKeys.length > 0 && (
                <div className="delta-sec resigned">
                  <h3>{`Changed (${resignedKeys.length})`}</h3>
                  <p className="subnote">
                    {"Changed means the name is still there but its signature moved — doc comments and private members don't count."}
                  </p>
                  <ItemList
                    keys={resignedKeys}
                    cssClass="resigned-row"
                    rowExtra={(key) => (
                      <ResignedRowExtra texts={texts} memberMap={members} aRow={aRow} a={a} bRow={bRow} b={b} itemKey={key} />
                    )}
                    back={back}
                  />
                </div>
              )}
            </>
          )}
          {flagsPresent && (
            <p className="flag-note">
              One side of this comparison is yanked or a prerelease. A prerelease is never a stable choice and the
              resolver never selects one as a floor; yanked rows should not be bound (honest rule 6).
            </p>
          )}
        </div>
      </div>
    </>
  );
}
/** The resolved pair's diff outcome area: the facts line, then the honest
 * outcome — identical, or the filterable list (a measured pair is always
 * diffable; RULE-4 unmeasured pairs never reach here). */
function DiffReady({
  manifest,
  data,
  a,
  b,
  aRow,
  bRow,
  texts,
  members,
  back,
  search,
  kind,
  onSearch,
  onKind,
}: {
  manifest: ForkmapManifest;
  data: CorpusData;
  a: Side;
  b: Side;
  aRow: VersionRow;
  bRow: VersionRow;
  texts: FnTextsBundle | null;
  members: TypeMembersBundle | null;
  back: string;
  search: string;
  kind: string;
  onSearch: (v: string) => void;
  onKind: (v: string) => void;
}) {
  const crossFork = a.provider !== b.provider;
  const diff = diffRows(aRow, bRow);
  if (!diff.ok) return null; // release-file rows are measured; type guard only
  if (diff.identical) {
    return (
      <div className="panel diff-stage" id="changes-diff">
        <DiffMeta data={data} a={a} b={b} />
        <div className="delta-identical">
          {crossFork ? (
            <>
              <strong>No measured item differences — two releases of different forks carrying the identical measured surface.</strong>
              <p className="subnote">
                Rule 1: equal surfaces stay within a stream — in the committed data no two releases of different forks
                share an identical surface, so if this renders either the dataset changed or this is the exceptional
                case. Identical measured item records never imply full compatibility: derives, trait-interface items,
                external-crate members and cfg evaluation are outside the measured item model (honest rule 3).
              </p>
            </>
          ) : (
            <>
              <strong>No measured item differences — these two releases carry the identical measured surface.</strong>
              <p className="subnote">
                In this data that happens exactly for within-stream exact-copy republishes (epochs are exact-copy-only
                within a stream — honest rule 1). Methods and associated items of public types are measured since
                T-26, but derives, trait-interface items, external-crate members and cfg evaluation are not, so
                “identical” never means “fully compatible” (honest rule 3).
              </p>
            </>
          )}
        </div>
      </div>
    );
  }
  return (
    <ListableDiff
      manifest={manifest}
      data={data}
      a={a}
      b={b}
      aRow={aRow}
      bRow={bRow}
      crossFork={crossFork}
      texts={texts}
      members={members}
      diff={diff}
      back={back}
      search={search}
      kind={kind}
      onSearch={onSearch}
      onKind={onKind}
    />
  );
}

/** The data the view renders with, threaded through the component tree. */
export function ChangesView({
  manifest,
  data,
  params,
  pair,
}: {
  manifest: ForkmapManifest;
  data: CorpusData;
  params: Record<string, string>;
  /** Test seam (increment 4): a pre-resolved pair state — the render tests
   * feed release-file-built rows; the runtime view never passes it. */
  pair?: PairState;
}) {
  // Filter state is local UI state: it survives pair changes within the view
  // (static site behavior) and resets when the view remounts.
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("");
  // The fork pickers are one package until asked otherwise: revealing the
  // second one is how a snapshot comparison (two forks) is built by hand.
  const [splitFork, setSplitFork] = useState(false);

  const go = (next: Record<string, string>) => {
    const hash = routeHash("changes", next);
    if (window.location.hash !== hash) window.location.hash = hash;
  };

  const { a, b } = resolveChanges(manifest, params);
  const named = namedPair(params);
  const aRow = rowFor(a.provider, a.vers);
  const bRow = rowFor(b.provider, b.vers);
  const sameRelease = a.provider === b.provider && a.vers === b.vers;
  const sameFork = a.provider === b.provider;
  // Cross-fork pairs (deep links, or the fork control below) always show both
  // fork pickers; same-fork pairs show the one package picker until split.
  const pickForks = splitFork || !sameFork;
  const back = backTarget(a, b);
  const loaded = useDiffPair(
    manifest,
    data,
    { provider: a.provider.id, vers: a.vers },
    { provider: b.provider.id, vers: b.vers },
  );
  // T-51: the pair diff needs every re-signed member-bearing key's vectors —
  // 10-52 keys read off the two surfaces — so it reads the one shared member
  // map (module-cached; at most one request per session) instead of fetching
  // per-key fragments, which would cost 6-13 buckets for more bytes than the
  // whole file. Fetched only once a pair is open; a failed load leaves the
  // rows on the honest pub-only policy copy.
  const memberMap = useTypeMembers();
  // The injected pair (tests) or the layer's own state.
  const pairState: PairState = pair ?? loaded;

  const onAProv = (value: string) => {
    const prov = providerFor(manifest, value);
    if (!prov) return;
    const def = defaultPair(prov);
    // Converging on the other side's fork at its default latest → take its
    // branch base, so the pair stays diffable (RULE-6 default pair).
    const aVers = b.provider === prov && b.vers === def.b ? (def.a ?? def.b) : def.b;
    go({ a: changesPairValue(prov, aVers), b: changesPairValue(b.provider.id, b.vers) });
  };
  const onBProv = (value: string) => {
    const prov = providerFor(manifest, value);
    if (!prov) return;
    const def = defaultPair(prov);
    const aVers = a.provider === prov && a.vers === def.b ? (def.a ?? def.b) : a.vers;
    go({ a: changesPairValue(a.provider.id, aVers), b: changesPairValue(prov.id, def.b) });
  };
  const onAVers = (value: string) =>
    go({ a: changesPairValue(a.provider.id, value), b: changesPairValue(b.provider.id, b.vers) });
  const onBVers = (value: string) =>
    go({ a: changesPairValue(a.provider.id, a.vers), b: changesPairValue(b.provider.id, value) });
  const swap = () =>
    go({ a: changesPairValue(b.provider.id, b.vers), b: changesPairValue(a.provider.id, a.vers) });

  // ≠ fork reveals the second fork picker (the snapshot comparison is a
  // deliberate act); = fork folds a cross-fork pair back to one stream — B
  // takes A's fork at that stream's default pair, so the result stays diffable.
  const onForkScope = () => {
    if (sameFork) setSplitFork((v) => !v);
    else onBProv(a.provider.id);
  };
  const forkScopeTitle = !sameFork
    ? `two forks on screen — press to compare one fork again (B returns to ${a.provider.id}'s default pair)`
    : splitFork
      ? "hide the second fork picker"
      : "compare a different fork — a snapshot difference, never a changelog";

  // Walking the stream's own history: both sides step together, one branch
  // step at a time. A cross-fork pair has no shared lineage to walk, so it gets
  // no steppers at all; a pair at either end of a stream shows that direction
  // disabled.
  const walkable = sameFork ? a.provider : null;
  const steps = walkable
    ? { prev: stepPair(walkable, { a: a.vers, b: b.vers }, -1), next: stepPair(walkable, { a: a.vers, b: b.vers }, 1) }
    : { prev: null, next: null };
  const goStep = (next: { a: string; b: string } | null) => {
    if (!next || !walkable) return;
    go({ a: changesPairValue(walkable, next.a), b: changesPairValue(walkable, next.b) });
  };
  const stepTitle = (dir: -1 | 1, target: { a: string; b: string } | null) => {
    const way = dir === -1 ? "earlier" : "later";
    return target
      ? `both sides ${way}: ${target.a} → ${target.b}`
      : `no ${way} release pair in ${a.provider.id}`;
  };

  // The pair rows' diff body: loading/error states print the data layer's own
  // honest copy of what is fetched (the whole corpus is never part of this
  // path — T-33 increment 4).
  const rowsBody = (() => {
    if (!aRow || !bRow || sameRelease) {
      return (
        <div className="panel diff-stage" id="changes-diff">
          <p className="empty-hint">Pick two different releases to diff.</p>
        </div>
      );
    }
    if (pairState.status === "idle" || pairState.status === "loading") {
      return (
        <div className="panel diff-stage" id="changes-diff">
          <p className="empty-hint">{PAIR_LOADING_LINE}</p>
        </div>
      );
    }
    if (pairState.status === "error") {
      return (
        <div className="panel diff-stage" id="changes-diff">
          <div className="delta-unmeasured">
            <p>{`This diff could not render its data — ${pairState.error}`}</p>
            <p className="subnote">
              A measured release's row file is part of the committed export; a failed load is a stale-serve condition.
            </p>
          </div>
        </div>
      );
    }
    if (!pairState.rows) {
      // RULE-4: a never-measured side — its absence IS the marker (facts
      // m = 0); the pair is never presented as an empty diff.
      return (
        <div className="panel diff-stage" id="changes-diff">
          <DiffMeta data={data} a={a} b={b} />
          <div className="delta-unmeasured">
            <p>{pairState.reason ?? "An unmeasured release cannot be diffed."}</p>
            <p className="subnote">“Not measured” is never the same as “nothing changed” (honest rule 4).</p>
          </div>
        </div>
      );
    }
    return (
      <DiffReady
        manifest={manifest}
        data={data}
        a={a}
        b={b}
        aRow={pairState.rows.a}
        bRow={pairState.rows.b}
        texts={pairState.rows.texts}
        members={memberMap}
        back={back}
        search={search}
        kind={kind}
        onSearch={setSearch}
        onKind={setKind}
      />
    );
  })();

  return (
    <section id="view-changes" className="view">
      <div className="wrap">
        <div className="controls picker" id="changes-controls">
          <h1 className="changes-title">Changes</h1>
          {/* One package while both sides diff one fork; looking at two forks
              is a deliberate step (the row's fork control) or arrives as a
              deep link — never two identical pickers side by side. */}
          <div className="pair">
            {sameFork ? (
              <span className="ctl-label mono" aria-hidden="true">
                package
              </span>
            ) : (
              <span className="diff-marker mono" aria-hidden="true">
                A
              </span>
            )}
            <label className="ctl">
              <select
                id="changes-a-provider"
                aria-label={sameFork ? "package — both sides diff this fork" : "A · fork"}
                title={sameFork ? "both sides diff this fork" : "A's fork"}
                value={a.provider.id}
                onChange={(e) => onAProv(e.target.value)}
              >
                {manifest.providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {`${p.id}${p.package === p.id ? "" : ` (${p.package})`}`}
                  </option>
                ))}
              </select>
            </label>
            <span className="diff-marker mono" aria-hidden="true" hidden={sameFork}>
              B
            </span>
            <label className="ctl">
              <select
                id="changes-b-provider"
                aria-label="B · fork"
                title="B's fork"
                hidden={sameFork}
                value={b.provider.id}
                onChange={(e) => onBProv(e.target.value)}
              >
                {manifest.providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {`${p.id}${p.package === p.id ? "" : ` (${p.package})`}`}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="pair">
            <span className="diff-marker mono" aria-hidden="true">
              A
            </span>
            <label className="ctl">
              <select id="changes-a" aria-label="A · release" title={optionLabel(aRow ?? a.provider.versions[0])} value={a.vers} onChange={(e) => onAVers(e.target.value)}>
                {a.provider.versions.map((v) => (
                  <option key={v.vers} value={v.vers}>
                    {optionLabel(v)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button id="changes-swap" className="swap-btn mono" type="button" aria-label="swap A and B" title="swap A and B" onClick={swap}>
            ⇄
          </button>
          <div className="pair">
            <span className="diff-marker mono" aria-hidden="true">
              B
            </span>
            <label className="ctl">
              <select id="changes-b" aria-label="B · release" title={optionLabel(bRow ?? b.provider.versions[0])} value={b.vers} onChange={(e) => onBVers(e.target.value)}>
                {b.provider.versions.map((v) => (
                  <option key={v.vers} value={v.vers}>
                    {optionLabel(v)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button
            id="changes-fork-scope"
            type="button"
            className="fork-scope mono"
            aria-pressed={pickForks}
            title={forkScopeTitle}
            onClick={onForkScope}
          >
            ⑂ Fork
          </button>
          {/* One step of the stream's stable backbone, both sides at once.
              Only where there is one: a cross-fork pair has no shared lineage
              to walk, so the steppers are absent rather than dead, and a pair
              at either end of a stream shows that direction disabled. */}
          {walkable && (
            <span className="stepper-group" role="group" aria-label="step the pair through the stream">
              <button
                id="changes-step-prev"
                type="button"
                className="mono"
                disabled={!steps.prev}
                title={stepTitle(-1, steps.prev)}
                onClick={() => goStep(steps.prev)}
              >
                ‹ prev
              </button>
              <button
                id="changes-step-next"
                type="button"
                className="mono"
                disabled={!steps.next}
                title={stepTitle(1, steps.next)}
                onClick={() => goStep(steps.next)}
              >
                next ›
              </button>
            </span>
          )}
        </div>

        <div id="changes-hint">
          <p className="pair-caption mono visually-hidden" id="changes-caption" aria-live="polite">
            {named
              ? "Linked comparison — resolved from the deep link; an unnamed side falls back to resolver defaults (rule 6)."
              : `Default pair — ${a.vers} is the release published before ${b.vers}, the latest stable of ${a.provider.id} (rule 6: never a prerelease). Pick any two releases to diff.`}
          </p>
        </div>



        {rowsBody}

        <div className="about-note" id="changes-about">
          <AboutNote />
        </div>
        {/* The fork facts collapse; the chips above are the pair display. */}
        <details className="pair-drawer" id="changes-pair-drawer">
          <summary className="pair-drawer-summary">fork facts</summary>
        <div className="panel release-panel" id="changes-release-detail">
          {a.provider !== b.provider ? (
            <div className="provider-lines">
              <div className="provider-line">
                <span className="muted">A </span>
                <ProviderLine provider={a.provider} />
              </div>
              <div className="provider-line">
                <span className="muted">B </span>
                <ProviderLine provider={b.provider} />
              </div>
            </div>
          ) : (
            <ProviderLine provider={a.provider} />
          )}
        </div>
        </details>
      </div>
    </section>
  );
}
