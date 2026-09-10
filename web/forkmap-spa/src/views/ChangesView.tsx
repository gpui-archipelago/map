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
  releaseFlagsSuffix,
  resolveChanges,
  rowFor,
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
import { changesLink, routeHash } from "../routing";

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

function DiffHead({ a, b, aRow, bRow, crossFork }: { a: Side; b: Side; aRow: ManifestVersionRow; bRow: ManifestVersionRow; crossFork: boolean }) {
  const chip = (side: string, sideObj: Side, row: ManifestVersionRow) =>
    `${side} · ${crossFork ? sideObj.provider.id + " " : ""}${row.vers}${releaseFlagsSuffix(row)}`;
  return (
    <div className="diff-head">
      <span className="release-chip">{chip("A", a, aRow)}</span>
      <span> → </span>
      <span className="release-chip">{chip("B", b, bRow)}</span>
    </div>
  );
}

/** The two delta-nature banners (RULE-1): cross-fork = snapshot-surface
 * difference (no lineage edge), same-stream = changelog with a lineage edge. */
function DiffBanner({ a, b, crossFork }: { a: Side; b: Side; crossFork: boolean }) {
  return crossFork ? (
    <div className="diff-kind-note snapshot">
      <strong>Snapshot difference — not a changelog. </strong>
      {`Release A (${a.provider.id}) and release B (${b.provider.id}) are different forks with no lineage edge between these releases, so this delta is a snapshot-surface difference: each row compares the two snapshots' measured items as-is. Within-stream changelogs (and confirmed rule successors) live in the Journal and in diffs of two releases of one fork.`}
    </div>
  ) : (
    <div className="diff-kind-note changelog">
      <strong>Same-stream changelog. </strong>
      {"Release A and release B are two releases of one fork, so this delta reads as this stream's measured history (the same adjacency the Journal renders) and a confirmed successor may be claimed where the rule store has one."}
    </div>
  );
}

/** The per-side count line of the compared pair. The measuredness class +
 * item-record count come from the per-release row facts (the manifest does
 * not carry them); the flags/api_hash/facade text come from the manifest's
 * own release rows (metadata — never the corpus). */
function DiffMeta({ data, a, b }: { data: CorpusData; a: Side; b: Side }) {
  const metaOf = (side: Side): { row: ManifestVersionRow | null; m: number; n: number } => ({
    row: rowFor(side.provider, side.vers),
    m: factsOf(data, side.provider.id, side.vers)?.m ?? 2,
    n: factsOf(data, side.provider.id, side.vers)?.n ?? 0,
  });
  const aMeta = metaOf(a);
  const bMeta = metaOf(b);
  const countText = (m: number, n: number) => (m === 0 ? "not measured" : `${n} item records`);
  const facadeText = (side: Side, row: ManifestVersionRow | null) => {
    const f = row?.facade;
    return f
      ? `${side.vers}: ${f.aliases.length} alias${f.aliases.length === 1 ? "" : "es"}, ${f.polyfills.length} polyfill${f.polyfills.length === 1 ? "" : "s"} in its facade table`
      : `${side.vers}: none`;
  };
  return (
    <div className="diff-meta muted">
      <span>{`A: ${countText(aMeta.m, aMeta.n)} · B: ${countText(bMeta.m, bMeta.n)}`}</span>
      {(aMeta.row?.rust_version || bMeta.row?.rust_version) && (
        <span>
          {` · declared rust-version: A ${aMeta.row?.rust_version ?? "—"} / B ${bMeta.row?.rust_version ?? "—"} (declared, not an attestation)`}
        </span>
      )}
      <span>{` · api_hash A ${(aMeta.row?.api_hash ?? "").slice(0, 12)}… / B ${(bMeta.row?.api_hash ?? "").slice(0, 12)}…`}</span>
      {(aMeta.row?.facade || bMeta.row?.facade) && (
        <span>{` · facade shims — ${facadeText(a, aMeta.row)} / ${facadeText(b, bMeta.row)}`}</span>
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

  const flagsPresent = releaseFlags(aRow).length > 0 || releaseFlags(bRow).length > 0;

  const kindOptions = [...kinds].sort((x, y) => kindRank(x) - kindRank(y));
  return (
    <>
      <div className="panel diff-filter" id="changes-filter">
        <span className="ff-label mono" aria-hidden="true">
          filter delta
        </span>
        <input
          id="changes-filter-search"
          type="search"
          placeholder="search item identities — kind:name or a name fragment"
          autoComplete="off"
          spellCheck={false}
          aria-label="filter delta rows by text"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
        />
        <select id="changes-filter-kind" aria-label="filter delta rows by kind" value={effKind} onChange={(e) => onKind(e.target.value)}>
          <option value="">all kinds</option>
          {kindOptions.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
        <button
          id="changes-filter-clear"
          type="button"
          className="mono"
          onClick={() => {
            onSearch("");
            onKind("");
          }}
        >
          clear filter
        </button>
        <span className="ff-note mono" id="changes-filter-note">
          {noteText}
        </span>
      </div>

      <div className="panel diff-stage" id="changes-diff">
        <DiffHead a={a} b={b} aRow={aRow} bRow={bRow} crossFork={crossFork} />
        <DiffBanner a={a} b={b} crossFork={crossFork} />
        <DiffMeta data={data} a={a} b={b} />
        <div className="diff-stage-body">
          <p className="diff-summary">
            <span>{`${vis} measured item differences between A and B${vis !== full ? ` (of ${full})` : ""}:`}</span>
            <span className="counts-bar">
              <span className="count-chip count-removed">{`${removed.length} removed`}</span>
              <span className="count-chip count-added">{`${added.length} added`}</span>
              <span className="count-chip count-resigned">{`${resignedKeys.length} re-signed`}</span>
            </span>
          </p>
          {vis === 0 ? (
            <p className="empty-hint">
              {active
                ? "no rows match the filter — clear it to see the full delta."
                : "no measured item differences to list."}
            </p>
          ) : (
            <>
              {removed.length > 0 && (
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
              {added.length > 0 && (
                <div className="delta-sec added">
                  <h3>{`Added (${added.length})`}</h3>
                  <ItemList keys={added} cssClass="added-row" back={back} />
                </div>
              )}
              {resignedKeys.length > 0 && (
                <div className="delta-sec resigned">
                  <h3>{`Re-signed (${resignedKeys.length})`}</h3>
                  <p className="subnote">
                    {"Re-signed = the identity survived while its measured contract changed. fn-like rows render the measured signature change where the key is a single signature on both sides (texts resolved from the dataset's recorded emissions); a member-bearing type row renders the measured pub members that moved (struct/enum/union/trait — private/pub(crate) members and doc comments never re-sign a type, honest rule 2); a type alias and multi-signature fn keys stay digest-only."}
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
/** The resolved pair's diff outcome area: the delta head/banner/meta, then
 * the honest outcome — identical, or the filterable list (a measured pair is
 * always diffable; RULE-4 unmeasured pairs never reach here). */
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
        <DiffHead a={a} b={b} aRow={aRow} bRow={bRow} crossFork={crossFork} />
        <DiffBanner a={a} b={b} crossFork={crossFork} />
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

  const go = (next: Record<string, string>) => {
    const hash = routeHash("changes", next);
    if (window.location.hash !== hash) window.location.hash = hash;
  };

  const { a, b } = resolveChanges(manifest, params);
  const named = namedPair(params);
  const aRow = rowFor(a.provider, a.vers);
  const bRow = rowFor(b.provider, b.vers);
  const sameRelease = a.provider === b.provider && a.vers === b.vers;
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
          <DiffHead a={a} b={b} aRow={aRow} bRow={bRow} crossFork={a.provider !== b.provider} />
          <DiffBanner a={a} b={b} crossFork={a.provider !== b.provider} />
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
        <div className="view-head">
          <p className="view-eyebrow mono">what changed between any two releases of any fork(s)</p>
          <h1>
            Changes <span className="view-tag mono">item-set deltas between releases</span>
          </h1>
          <p className="lede">
            Every measured item added, removed or re-signed between the two releases you pick. Same fork: a stream
            changelog. Different forks: a <strong>snapshot-surface difference</strong> (no lineage edge — labeled as
            such; rule rows informational only, never “the successor”). The caption below the pickers names how the
            pair was chosen; each row links into the Alignment view.
          </p>
        </div>

        <div className="controls panel picker" id="changes-controls">
          <div className="pair">
            <label className="ctl">
              <span>A · fork</span>
              <select id="changes-a-provider" value={a.provider.id} onChange={(e) => onAProv(e.target.value)}>
                {manifest.providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {`${p.id} (${p.package})`}
                  </option>
                ))}
              </select>
            </label>
            <label className="ctl">
              <span>A · release</span>
              <select id="changes-a" value={a.vers} onChange={(e) => onAVers(e.target.value)}>
                {a.provider.versions.map((v) => (
                  <option key={v.vers} value={v.vers}>
                    {optionLabel(v)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button id="changes-swap" className="swap-btn mono" type="button" title="swap A and B" onClick={swap}>
            ⇄ swap
          </button>
          <div className="pair">
            <label className="ctl">
              <span>B · fork</span>
              <select id="changes-b-provider" value={b.provider.id} onChange={(e) => onBProv(e.target.value)}>
                {manifest.providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {`${p.id} (${p.package})`}
                  </option>
                ))}
              </select>
            </label>
            <label className="ctl">
              <span>B · release</span>
              <select id="changes-b" value={b.vers} onChange={(e) => onBVers(e.target.value)}>
                {b.provider.versions.map((v) => (
                  <option key={v.vers} value={v.vers}>
                    {optionLabel(v)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="ctl-hint" id="changes-hint">
            <div className="quick">
              <span className="muted">recorded stories: </span>
              <a className="quick-link" href={changesLink("gpui-unofficial", "1.16.3", "1.17.2")}>
                uno 1.16.3 → 1.17.2 removes the frame_trace_* fns
              </a>
              <a className="quick-link" href={changesLink("kael", "0.1.2", "0.2.0")}>
                kael 0.1.2 → 0.2.0 re-signs AccessibilityNode
              </a>
              <a className="quick-link" href={changesLink("gpui-ce", "0.2.2", "1.18.1", "gpui-unofficial")}>
                ce 0.2.2 vs uno 1.18.1 — cross-fork item-level comparison
              </a>
              <span className="muted"> — or pick any two releases of any forks below.</span>
            </div>
          </div>
        </div>

        <p className="pair-caption mono" id="changes-caption" aria-live="polite">
          {named
            ? "Linked comparison — resolved from the deep link; an unnamed side falls back to resolver defaults (rule 6)."
            : `Default pair — ${a.vers} is the release published before ${b.vers}, the latest stable of ${a.provider.id} (rule 6: never a prerelease). Pick any two releases to diff.`}
        </p>

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

        {rowsBody}

        <div className="about-note" id="changes-about">
          <AboutNote />
        </div>
      </div>
    </section>
  );
}
