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

import { useEffect, useRef, useState } from "react";
import { AboutNote } from "../components/AboutNote";
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

/** Flag words of one release, the order the site renders them. */
function flagNote(v: ManifestVersionRow): string | null {
  if (v.yanked && v.prerelease) return "yanked · pre-release";
  if (v.yanked) return "yanked";
  if (v.prerelease) return "pre-release";
  return null;
}

/** The measured-story line of one release against its predecessor — rendered
 * from the per-release facts (the export-precomputed diff counts), never by
 * diffing whole surfaces in the browser. */
function StoryLine({ provider, facts, prevFacts }: { provider: ManifestProvider; facts: ReleaseFacts; prevFacts: ReleaseFacts | null }) {
  const story = storyOf(facts, prevFacts);
  if (story.kind === "first") {
    const first =
      facts.m === 0 ? "not measured — first recorded release" : "first recorded release of this stream";
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
  const mk = (n: number, cls: string, label: string) => (n ? <span className={cls}>{`${n} ${label}`}</span> : null);
  return (
    <>
      <span className="je-counts">
        {`vs ${prevFacts?.vers ?? ""}: `}
        {mk(c.rm, "count-removed", "removed")}
        <span>{" · "}</span>
        {mk(c.ad, "count-added", "added")}
        <span>{" · "}</span>
        {mk(c.rs, "count-resigned", "re-signed")}
      </span>
      <a className="doc" href={changesLink(provider.id, prevFacts?.vers ?? "", facts.vers)}>
        open this diff in Changes
      </a>
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
        Added / removed / re-signed item rows vs the previous published release. A digest change is a re-signature
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
          <h4 className="item-kind-head">{`re-signed — ${diff.resigned.length}`}</h4>
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
  const flag = flagNote(metaRow);
  const entryId = `journal-entry-${provider.id}-${facts.vers}`;
  const back = `journal?s=${provider.id}&v=${facts.vers}`; // return target for Alignment links
  const story = storyOf(facts, prevFacts);
  const total =
    story.kind === "counts"
      ? (story.counts?.rm ?? 0) + (story.counts?.ad ?? 0) + (story.counts?.rs ?? 0)
      : 0;

  const metaParts = [
    `${idx + 1} of ${provider.versions.length} on this stream`,
    facts.m === 0 ? "not measured" : facts.m === 1 ? "0 item records (measured empty)" : `${facts.n} item records`,
  ];
  if (metaRow.api_hash) metaParts.push(`api_hash ${metaRow.api_hash.slice(0, 12)}…`);
  if (metaRow.rust_version) metaParts.push(`declared rust-version ${metaRow.rust_version}`);
  if (metaRow.facade) {
    metaParts.push(
      `facade shims: ${metaRow.facade.aliases.length} alias${metaRow.facade.aliases.length === 1 ? "" : "es"}, ${metaRow.facade.polyfills.length} polyfill${metaRow.facade.polyfills.length === 1 ? "" : "s"}`,
    );
  }
  const badge = compileStatus(provider, facts.vers);

  return (
    <div className={`journal-entry${flag ? " journal-entry-flagged" : ""}${flash ? " je-flash" : ""}`} id={entryId}>
      <div className="je-head">
        {prevFacts ? (
          <a
            className="je-vers"
            href={changesLink(provider.id, prevFacts.vers, facts.vers)}
            title={`open ${prevFacts.vers} → ${facts.vers} in the Changes view`}
          >
            {facts.vers}
          </a>
        ) : (
          <span className="je-vers">{facts.vers}</span>
        )}
        <a className="je-anchor mono" href={`#/journal?s=${provider.id}&v=${facts.vers}`} title="link to this release's journal entry">
          link
        </a>
        {flag && <span className="je-flag">{flag}</span>}
        {badge.badge && badge.marker && (
          <span
            className="compile-badge"
            title="RULE-5: badge only where docs/07 compiled the real artifact; each badge links its evidence"
          >
            {`compile-verified · rustc ${badge.marker.toolchain}`}
            <a className="doc" href={badge.marker.evidence}>
              {" evidence"}
            </a>
          </span>
        )}
        <span className="je-meta muted">{metaParts.join(" · ")}</span>
      </div>
      <div className="je-story">
        <StoryLine provider={provider} facts={facts} prevFacts={prevFacts} />
      </div>
      {story.kind === "counts" && total > 0 && (
        <>
          <button type="button" className="je-toggle" onClick={() => setOpen(!open)}>
            {open ? "hide item rows" : `show item rows (${total})`}
          </button>
          {open && (
            <EntryItems
              manifest={manifest}
              data={data}
              provider={provider}
              prevVers={prevFacts?.vers ?? ""}
              vers={facts.vers}
              back={back}
            />
          )}
        </>
      )}
    </div>
  );
}

/** One provider's contiguous stream block. */
function StreamBlock({
  manifest,
  data,
  provider,
  flashVers,
}: {
  manifest: ForkmapManifest;
  data: CorpusData;
  provider: ManifestProvider;
  flashVers: string | null;
}) {
  const stream = data.streams.find((s) => s.id === provider.id);
  const factsByVers = new Map((stream?.facts ?? []).map((f) => [f.vers, f]));
  const p = provider;
  return (
    <section className="journal-stream">
      <div className="journal-stream-head">
        <strong className="stream-name">{p.id}</strong>
        <span className="muted">{` ${p.package} · ${p.versions.length} releases · latest stable ${p.latest_stable ?? "—"}`}</span>
        {p.platform_companion ? (
          <span className="muted">{` · companion ${p.platform_companion.package}`}</span>
        ) : (
          <span className="muted"> · pre-split (self-contained)</span>
        )}
      </div>
      {p.versions.map((row, vi) => {
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
  const want = manifest.providers.filter((p) => !s || p.id === s);
  const all = manifest.providers.reduce((n, p) => n + p.versions.length, 0);
  const shown = want.reduce((n, p) => n + p.versions.length, 0);
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
    const hash = routeHash("journal", value ? { s: value } : {});
    if (window.location.hash !== hash) window.location.hash = hash;
  };

  const hint =
    shown === all
      ? `All ${manifest.providers.length} streams · ${shown} releases, oldest-recorded first.`
      : `${want.length} stream · ${shown} releases, oldest-recorded first.`;

  return (
    <section id="view-journal" className="view">
      <div className="wrap">
        <div className="view-head">
          <p className="view-eyebrow mono">the release timeline — every release of every fork, one scroll</p>
          <h1>
            Journal <span className="view-tag mono">every release of every fork, one continuous scroll</span>
          </h1>
          <p className="lede">
            Every published release of every fork, oldest-recorded first within each stream. Each entry is that
            release’s measured story against its branch predecessor — the previous stable for a stable release (so a
            backport published after a newer line’s preview is diffed against its own line), the newest stable it
            previews for a pre-release. Or “identical measured surface” for a within-stream exact-copy republish.
            Entries expand to the item rows themselves (added / removed / re-signed), each linking into Alignment.
          </p>
          <p className="lede muted">
            Honesty notes: the bundle carries no publish dates, so streams are never interleaved by time — the
            journal is grouped per fork in the order the dataset recorded. An empty or identical entry never means
            “nothing changed” beyond the measurement (rules 1 and 3).
          </p>
        </div>

        <div className="controls panel picker">
          <label className="ctl">
            <span>Stream</span>
            <select
              id="journal-stream"
              value={s}
              onChange={(e) => onStream(e.target.value)}
              aria-label="filter the journal to one stream"
            >
              <option value="">all streams</option>
              {manifest.providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {`${p.id} (${p.package})`}
                </option>
              ))}
            </select>
          </label>
          <div className="ctl-hint" id="journal-hint">
            {hint}
          </div>
        </div>

        <div id="journal-feed" ref={feedRef}>
          {want.map((p) => (
            <StreamBlock key={p.id} manifest={manifest} data={data} provider={p} flashVers={flashVers} />
          ))}
        </div>

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
