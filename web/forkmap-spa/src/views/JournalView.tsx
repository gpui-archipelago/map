// T-39 — Journal view (the static site's view-journal + renderJournal, ported
// 1:1).
//
// Every published release of every fork, one continuous scroll — grouped per
// stream in the order the dataset recorded (crates.io publish order per
// stream; the bundle carries no publish dates, so streams are never
// interleaved by time). Each entry is that release's measured story against
// its *branch* predecessor — a stable against the previous stable (the stable
// backbone, by semver), a preview against the newest stable it previews: never
// against raw publish history, so a backport published after a newer line's
// preview is still diffed against its own line. Unmeasured (RULE-4, never an
// empty diff), identical measured surface (a within-stream exact-copy
// republish), or the added/removed/re-signed counts with the diff opened in
// Changes and the item rows expanded in place — every row linking into
// Alignment with the T-38 `back` round-trip (`#/journal?s=…&v=…` deep links
// flash their entry).
//
// T-33 increment 4: the view declares the logical data it renders — the boot
// manifest (metadata + rules) and the per-release row facts (`data`, from the
// corpus data-access layer). The collapsed feed renders entirely from those
// (never fetching per-release rows — the corpus read again would be); only an
// **expanded** entry requests its two releases' rows (`useDiffPair`, which
// reconstructs the bundle-shaped rows behind the layer), and the re-signed fn
// texts ride those rows. The view never names a data file or payload schema.
//
// T-53 copy pass: the bar carries the title and the two filters (stream, and
// all/stable releases), the essay above the feed is one footer note, each
// stream head is a section rule (fork — hairline — its facts, without the
// id/package stutter), and an entry is two tiers: identity + measured facts,
// then the delta beside its actions.

import { useEffect, useRef, useState } from "react";
import { AboutNote } from "../components/AboutNote";
import { StudyDocLink } from "../components/StudyDocLink";
import { ItemList, RemovedRowExtra, ResignedRowExtra } from "../components/rows";
import { compileStatus, diffRows } from "../bundle/derive";
import {
  PAIR_LOADING_LINE,
  storyOf,
  useDiffPair,
  type CorpusData,
  type ReleaseFacts,
} from "../bundle/corpus";
import { useTypeMembers } from "../bundle/keyPayload";
import type { ForkmapManifest, ManifestProvider, ManifestVersionRow, Side } from "../bundle/types";
import { changesLink, routeHash } from "../routing";

/** Thousands-separated counts (the site's numbers read as numbers). */
const num = (v: number) => v.toLocaleString("en-US");

/** One release's measured-record fact: never a count the measurement does not
 * carry (RULE-4 — 0 versus never-measured are different facts). */
function recordsLabel(facts: ReleaseFacts): string {
  if (facts.m === 0) return "not measured";
  if (facts.m === 1) return "0 items (empty)";
  return `${num(facts.n)} records`;
}

/** Flag badges of one release, the order the site renders them. */
function flagsOf(v: ManifestVersionRow): string[] {
  const out: string[] = [];
  if (v.prerelease) out.push("pre-release");
  if (v.yanked) out.push("yanked");
  return out;
}

/** The measured-story line of one release against its predecessor — rendered
 * from the per-release facts (the export-precomputed diff counts), never by
 * diffing whole surfaces in the browser. The entry's own actions (the
 * Changes diff, the item rows) live beside it, not inside it. */
function StoryLine({ facts, prevFacts }: { facts: ReleaseFacts; prevFacts: ReleaseFacts | null }) {
  const story = storyOf(facts, prevFacts);
  if (story.kind === "first") {
    const first =
      facts.m === 0 ? "Not measured — first recorded release" : "First recorded release of this stream";
    return <span className="je-first">{first}</span>;
  }
  if (story.kind === "unmeasured") {
    // RULE-4: never present an unmeasured release as an empty diff.
    return <span className="je-unmeasured">{story.reason}</span>;
  }
  if (story.kind === "identical") {
    return (
      <span
        className="je-same"
        title={
          "Identical (key,digest) item sets. Methods/assoc items of public types are measured since T-26, but derives, trait-interface items, external-crate members and cfg evaluation are not, so “identical” never means “fully compatible” (rules 1 and 3)."
        }
      >
        {`identical measured surface to ${prevFacts?.vers ?? ""} — a within-stream exact-copy republish`}
      </span>
    );
  }
  const c = story.counts ?? { rm: 0, ad: 0, rs: 0 };
  return (
    <>
      <span className="je-base">{`vs ${prevFacts?.vers ?? ""}:`}</span>
      {c.ad > 0 && <span className="count-added">{`+${num(c.ad)} added`}</span>}
      {c.rm > 0 && <span className="count-removed">{`−${num(c.rm)} removed`}</span>}
      {c.rs > 0 && <span className="count-resigned">{`${num(c.rs)} changed`}</span>}
    </>
  );
}

/** The lazy item rows of a diffable entry (built on first expand — the feed
 * stays light; the entry's two releases' row files are the only fetch). */
function EntryItems({
  manifest,
  data,
  provider,
  prevVers,
  vers,
  back,
}: {
  manifest: ForkmapManifest;
  data: CorpusData;
  provider: ManifestProvider;
  prevVers: string;
  vers: string;
  back: string;
}) {
  const pair = useDiffPair(
    manifest,
    data,
    { provider: provider.id, vers: prevVers },
    { provider: provider.id, vers: vers },
  );
  // T-51: member vectors ride the shared session-cached map, not the pair rows.
  // Called unconditionally, BEFORE the state early-returns below: this component
  // returns early for the loading/error/identical states, so a hook after those
  // returns would change the hook order between renders (the loading render vs
  // the resolved render) and React would throw "Rendered more hooks than during
  // the previous render" — exactly what happens on the first Journal diff open.
  const memberMap = useTypeMembers();
  if (pair.status === "idle" || pair.status === "loading") {
    return <p className="je-loading muted">{PAIR_LOADING_LINE}</p>;
  }
  if (pair.status === "error") {
    return (
      <p className="je-loading muted">{`This entry's rows could not be loaded — ${pair.error}`}</p>
    );
  }
  const rows = pair.rows;
  if (!rows) return null; // diffable entries always resolve two measured rows
  const prev = rows.a;
  const v = rows.b;
  const diff = diffRows(prev, v);
  if (!diff.ok || diff.identical) return null;
  const a: Side = { provider, vers: prevVers };
  const b: Side = { provider, vers };
  const texts = rows.texts;
  return (
    <div className="je-items">
      <p className="subnote">
        Added, removed or changed item rows vs the previous published release. A hash change means the signature moved
        of the measured contract (fn rows render the measured signature change where the key is a single signature
        on both sides; a member-bearing type row renders the measured pub members that moved — doc comments and
        private/pub(crate) members never re-sign a type, rule 2; a type alias and multi-signature fn keys stay
        digest-only).
      </p>
      {diff.removed.length > 0 && (
        <div className="delta-sec removed">
          <h4 className="item-kind-head">{`removed — ${diff.removed.length}`}</h4>
          <ItemList
            keys={diff.removed}
            cssClass="removed-row"
            rowExtra={(key) => (
              <RemovedRowExtra rules={manifest.rules} providerId={provider.id} bVers={vers} itemKey={key} crossFork={false} />
            )}
            back={back}
          />
        </div>
      )}
      {diff.added.length > 0 && (
        <div className="delta-sec added">
          <h4 className="item-kind-head">{`added — ${diff.added.length}`}</h4>
          <ItemList keys={diff.added} cssClass="added-row" back={back} />
        </div>
      )}
      {diff.resigned.length > 0 && (
        <div className="delta-sec resigned">
          <h4 className="item-kind-head">{`changed — ${diff.resigned.length}`}</h4>
          <ItemList
            keys={diff.resigned.map((r) => r.key)}
            cssClass="resigned-row"
            rowExtra={(key) => (
              <ResignedRowExtra texts={texts} memberMap={memberMap} aRow={prev} a={a} bRow={v} b={b} itemKey={key} />
            )}
            back={back}
          />
        </div>
      )}
    </div>
  );
}

/** One scroll entry per release; content stays collapsed until first expand. */
function EntryEl({
  manifest,
  data,
  provider,
  idx,
  facts,
  prevFacts,
  flash,
}: {
  manifest: ForkmapManifest;
  data: CorpusData;
  provider: ManifestProvider;
  idx: number;
  facts: ReleaseFacts;
  prevFacts: ReleaseFacts | null;
  flash: boolean;
}) {
  const metaRow = provider.versions[idx];
  const [open, setOpen] = useState(false);
  const flags = flagsOf(metaRow);
  const entryId = `journal-entry-${provider.id}-${facts.vers}`;
  const back = `journal?s=${provider.id}&v=${facts.vers}`; // return target for Alignment links
  const story = storyOf(facts, prevFacts);
  const total =
    story.kind === "counts"
      ? (story.counts?.rm ?? 0) + (story.counts?.ad ?? 0) + (story.counts?.rs ?? 0)
      : 0;
  const badge = compileStatus(provider, facts.vers);
  const diffHref = prevFacts ? changesLink(provider.id, prevFacts.vers, facts.vers) : null;

  return (
    <div className={`journal-entry${flags.length ? " journal-entry-flagged" : ""}${flash ? " je-flash" : ""}`} id={entryId}>
      {/* identity + the release's own measured facts, one tier */}
      <div className="je-head">
        <span className="je-ident">
          {diffHref ? (
            <a className="je-vers" href={diffHref} title={`open ${prevFacts!.vers} → ${facts.vers} in the Changes view`}>
              {facts.vers}
            </a>
          ) : (
            <span className="je-vers">{facts.vers}</span>
          )}
          {flags.map((f) => (
            <span key={f} className={`je-flag je-flag-${f === "yanked" ? "yanked" : "pre"}`}>
              {f}
            </span>
          ))}
          {badge.badge && badge.marker && (
            <span
              className="compile-badge"
              title="RULE-5: badge only where docs/07 compiled the real artifact; each badge links its evidence"
            >
              {`compile-verified · rustc ${badge.marker.toolchain}`}
              <StudyDocLink num={7} href={badge.marker.evidence}>
                {" evidence"}
              </StudyDocLink>
            </span>
          )}
        </span>
        <span className="je-facts mono">
          <span
            className="je-records"
            title="measured item records of this release's surface (RULE-4: 0 measured items and never-measured are different facts)"
          >
            {recordsLabel(facts)}
          </span>
          {metaRow.api_hash && (
            <span className="je-api" title="the release's whole-surface API hash: every measured item's signature">
              {`api: ${metaRow.api_hash.slice(0, 12)}…`}
            </span>
          )}
          {metaRow.rust_version && (
            <span title="declared toolchain floor of this version (advisory — doc 10)">
              {`rust-version ${metaRow.rust_version}`}
            </span>
          )}
          {metaRow.facade && (
            <span title="this release's facade shim table">
              {`facade: ${metaRow.facade.aliases.length} alias${metaRow.facade.aliases.length === 1 ? "" : "es"}, ${metaRow.facade.polyfills.length} polyfill${metaRow.facade.polyfills.length === 1 ? "" : "s"}`}
            </span>
          )}
          <span
            className="je-pos"
            title={`release ${idx + 1} of ${provider.versions.length} on this stream, in the dataset's recorded order`}
          >
            {`#${idx + 1} of ${provider.versions.length}`}
          </span>
          <a
            className="je-permalink"
            href={`#/journal?s=${provider.id}&v=${facts.vers}`}
            title="link to this release's journal entry"
            aria-label={`link to the ${provider.id} ${facts.vers} journal entry`}
          >
            <span aria-hidden="true">🔗</span>
          </a>
        </span>
      </div>
      {/* the delta + the entry's actions, one tier */}
      <div className="je-foot">
        <span className="je-story">
          <StoryLine facts={facts} prevFacts={prevFacts} />
        </span>
        {diffHref && (
          <span className="je-actions">
            <a className="je-action" href={diffHref} title={`open the ${prevFacts!.vers} → ${facts.vers} diff in the Changes view`}>
              <span aria-hidden="true">⇄ </span>Diff in Changes
            </a>
            {total > 0 && (
              <button
                type="button"
                className="je-action"
                aria-expanded={open}
                title={open ? "hide the item rows" : `list the ${num(total)} changed item rows of this entry`}
                onClick={() => setOpen(!open)}
              >
                {open ? "▴ hide items" : `▾ ${num(total)} items`}
              </button>
            )}
          </span>
        )}
      </div>
      {open && total > 0 && diffHref && (
        <EntryItems
          manifest={manifest}
          data={data}
          provider={provider}
          prevVers={prevFacts?.vers ?? ""}
          vers={facts.vers}
          back={back}
        />
      )}
    </div>
  );
}

/** One provider's contiguous stream block. `onlyStable` hides the previews
 * from the feed (the facts and the branch bases are untouched — a filtered
 * view hides rows, it never re-bases a diff). */
function StreamBlock({
  manifest,
  data,
  provider,
  flashVers,
  onlyStable,
}: {
  manifest: ForkmapManifest;
  data: CorpusData;
  provider: ManifestProvider;
  flashVers: string | null;
  onlyStable: boolean;
}) {
  const stream = data.streams.find((s) => s.id === provider.id);
  const factsByVers = new Map((stream?.facts ?? []).map((f) => [f.vers, f]));
  const p = provider;
  const rows = onlyStable ? p.versions.filter((r) => !r.prerelease) : p.versions;
  const meta = [
    `${p.versions.length} releases`,
    `latest stable: ${p.latest_stable ?? "—"}`,
    p.platform_companion ? `companion ${p.platform_companion.package}` : "pre-split",
  ].join(" · ");
  return (
    <section className="journal-stream">
      {/* A section rule, not a sentence: the fork, the hairline, its facts. */}
      <div className="journal-stream-head">
        <strong className="stream-name">{p.id}</strong>
        <span className="stream-rule" aria-hidden="true" />
        <span className="stream-meta mono">{meta}</span>
      </div>
      {rows.map((row) => {
        const vi = p.versions.indexOf(row);
        const facts = factsByVers.get(row.vers);
        if (!facts) return null; // facts come from the same export (currency e2e)
        const prevFacts = facts.prevVers ? (factsByVers.get(facts.prevVers) ?? null) : null;
        return (
          <EntryEl
            key={row.vers}
            manifest={manifest}
            data={data}
            provider={p}
            idx={vi}
            facts={facts}
            prevFacts={prevFacts}
            flash={row.vers === flashVers}
          />
        );
      })}
    </section>
  );
}

export function JournalView({
  manifest,
  data,
  params,
}: {
  manifest: ForkmapManifest;
  data: CorpusData;
  params: Record<string, string>;
}) {
  const s = params.s ?? "";
  const v = params.v ?? null;
  const onlyStable = params.st === "stable";
  const want = manifest.providers.filter((p) => !s || p.id === s);
  const visible = (p: ManifestProvider) =>
    onlyStable ? p.versions.filter((row) => !row.prerelease).length : p.versions.length;
  // The bar's own count: what the feed below actually holds, against what the
  // selected streams carry — never a total the reader cannot see.
  const all = want.reduce((n, p) => n + p.versions.length, 0);
  const shown = want.reduce((n, p) => n + visible(p), 0);
  const [flashVers, setFlashVers] = useState<string | null>(null);
  const feedRef = useRef<HTMLDivElement | null>(null);

  // T-38: a #/journal?s=…&v=… deep link scrolls to that release's entry and
  // flashes it (client-only — the server render never scrolls).
  useEffect(() => {
    if (!s || !v) return;
    const id = `journal-entry-${s}-${v}`;
    const target = document.getElementById(id);
    if (!target) return;
    target.scrollIntoView({ block: "start" });
    setFlashVers(v);
    const t = setTimeout(() => setFlashVers(null), 1800);
    return () => clearTimeout(t);
  }, [s, v]);

  const onStream = (value: string) => {
    const next: Record<string, string> = {};
    if (value) next.s = value;
    if (onlyStable) next.st = "stable";
    const hash = routeHash("journal", next);
    if (window.location.hash !== hash) window.location.hash = hash;
  };
  const onFilter = (value: string) => {
    const next: Record<string, string> = {};
    if (s) next.s = s;
    if (value) next.st = value;
    const hash = routeHash("journal", next);
    if (window.location.hash !== hash) window.location.hash = hash;
  };

  // The bar's own count: what the feed below actually holds, for the filters
  // that are on (never a total the reader cannot see).
  const hint = `${num(shown)}${shown === all ? "" : ` of ${num(all)}`} release${shown === 1 ? "" : "s"}${
    s ? ` in ${s}` : ` across ${manifest.providers.length} forks`
  }${onlyStable ? " · stable only" : ""}`;

  return (
    <section id="view-journal" className="view">
      <div className="wrap">
        {/* One line, like Changes / Alignment / Configure: the title rides the
            bar over a hairline and the two filters are the view's controls. */}
        <div className="controls picker journal-bar" id="journal-controls">
          <h1 className="journal-title">Journal</h1>
          <span className="ctl-label">Stream</span>
          <select
            id="journal-stream"
            value={s}
            onChange={(e) => onStream(e.target.value)}
            aria-label="filter the journal to one stream"
            title="filter the journal to one stream"
          >
            <option value="">{`all streams (${manifest.providers.length})`}</option>
            {manifest.providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id}
              </option>
            ))}
          </select>
          <span className="ctl-label">Filter</span>
          <select
            id="journal-filter"
            value={onlyStable ? "stable" : ""}
            onChange={(e) => onFilter(e.target.value)}
            aria-label="which releases the feed lists"
            title="which releases the feed lists"
          >
            <option value="">all releases</option>
            <option value="stable">stable only</option>
          </select>
          <span className="journal-count mono" id="journal-hint">
            {hint}
          </span>
        </div>

        <div id="journal-feed" ref={feedRef}>
          {want.map((p) => (
            <StreamBlock
              key={p.id}
              manifest={manifest}
              data={data}
              provider={p}
              flashVers={flashVers}
              onlyStable={onlyStable}
            />
          ))}
        </div>

        <p className="journal-note" id="journal-note">
          {"ℹ️ Releases are ordered chronologically within each stream and diffed against their stream predecessor."}
        </p>

        <div className="about-note" id="journal-about">
          <details className="journal-honesty" open>
            <summary>Journal honesty specifics</summary>
            <p className="subnote">
              Streams are grouped per fork in the order the dataset recorded (crates.io publish order per stream) —
              never interleaved by time across forks. Methods and associated items of public types are measured
              since T-26 and each entry carries its cfg gates as provenance; derives, trait-interface items,
              external-crate members and cfg evaluation stay outside the measured item model, so an empty or
              identical entry never means “nothing changed” beyond the measurement (rules 1 and 3).
            </p>
          </details>
          <AboutNote />
        </div>
      </div>
    </section>
  );
}
