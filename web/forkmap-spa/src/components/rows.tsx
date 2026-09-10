// T-39 — delta row components (ported 1:1 from web/forkmap/app.js).
//
// ProviderLine (release-detail), RuleLine/NoSuccessorNote/RemovedRowExtra
// (removed-row annotations shared by the Changes diff and the Journal feed:
// the confirmed rule for the rule's own measured transition, related rules
// for other transitions, or an honest "no successor" note — rules 1/3), and
// ItemList (the kind-grouped row list whose rows deep-link into Alignment,
// carrying the T-38 `back` round-trip). A cross-fork pair (no lineage edge)
// can never claim "the successor" — its rule rows are informational only,
// attributed to the rule's own stream.
//
// DOM class names survive from the static site so recorded stories and the
// parity story stay meaningful across the swap.

import type { ReactNode } from "react";
import { DOCS } from "../content/docs";
import { alignmentLink } from "../routing";
import { cfgGatesOf, digestAt, kindRank, rulesFrom, signaturePair, singleVariantPair, splitKey, typeMemberDelta } from "../bundle/derive";
import type { FnTextsBundle, ManifestProvider, Rule, Side, TypeMembersBundle, VersionRow } from "../bundle/types";
import { memberVectorsOf } from "../bundle/keyPayload";
import { DocLink, KindChip } from "./common";
import { CopyButton } from "./CopyButton";
import { StudyDocLink } from "./StudyDocLink";

/** A provider's summary line (name + latest stable + description + repo +
 * T-17 platform-companion era + RULE-5 compile badge). Typed on the manifest
 * provider (metadata only), which both the full bundle and the boot manifest
 * satisfy (T-33). */
export function ProviderLine({ provider }: { provider: ManifestProvider }) {
  const m = provider.compile_verified;
  return (
    <div className="provider-line">
      <span className="provider-name">{provider.package}</span>
      {provider.latest_stable && <span className="muted"> · latest stable {provider.latest_stable}</span>}
      {provider.description && <span className="muted"> — {provider.description}</span>}
      {provider.repository && (
        <a className="muted" href={provider.repository}>
          {" repository"}
        </a>
      )}
      {provider.platform_companion ? (
        <span className="muted">
          {` · post-split: bind with platform companion ${provider.platform_companion.package} (features ${provider.platform_companion.features?.join(", ")})`}
        </span>
      ) : (
        <span className="muted"> · pre-split: self-contained</span>
      )}
      {m && (
        <span
          className="compile-badge"
          title="RULE-5: badge only where docs/07 compiled the real artifact; each badge links its evidence"
        >
          {`compile-verified ${m.vers} on rustc ${m.toolchain}`}
          <StudyDocLink num={7} href={m.evidence}>{` — ${DOCS[7].title}`}</StudyDocLink>
        </span>
      )}
    </div>
  );
}

/** One confirmed-rule row (context label + chips + provenance, doc 09 link).
 * The Alignment rule box passes `copy` (a recipe payload — T-40) to add the
 * copy control; the Changes/Journal rule rows pass none and stay unchanged. */
export function RuleLine({ rule, context, copy }: { rule: Rule; context: string; copy?: string }) {
  return (
    <div className="rule-line">
      <span className="rule-label">{context}</span>
      <KindChip item={rule.from.key} />
      <span> → </span>
      <KindChip item={rule.to.key} />
      <span className="muted">
        {` · confirmed rule ${rule.id} — measured ${rule.transition.from.provider} ${rule.transition.from.version} → ${rule.transition.to.provider} ${rule.transition.to.version}`}
      </span>
      <span className="muted">
        <DocLink num={9} />
      </span>
      {copy !== undefined && (
        <CopyButton className="rule-copy" text={copy} label="copy recipe" announce="recipe copied" />
      )}
    </div>
  );
}

/** The honest "no successor in the rule store" note (rules 1/3). */
export function NoSuccessorNote() {
  return (
    <span className="muted">
      {"no confirmed successor in the rule store — a break a human must map (derives, trait-interface items, external-crate members and cfg evaluation stay outside the measured model); "}
      <DocLink num={9} />
    </span>
  );
}

/** The digest-only re-signature note every non-renderable row shares: fn
 * digests are parameter-type (a name rename never re-signs), a type's digest
 * covers its consumer-visible pub members only (T-47 — doc comments and
 * private/`pub(crate)` members never re-sign a type), and the map never dumps
 * unmeasured text. */
function DigestOnlyNote({ why }: { why?: string }) {
  return (
    <span className="muted">
      {`re-signature — digest changed (fn digests are parameter-type; a type's digest covers its consumer-visible pub members only — doc comments and private/pub(crate) members never re-sign it${why ? `, ${why}` : ""}). `}
    </span>
  );
}

/** The measured pub-member delta of a re-signed type row (T-47 decision 2b):
 * the member segments that left / arrived between the two rows, a set
 * difference of the analyzer's own digest segments — measured, never a
 * reconstruction (honest rule 2/7). */
function MemberDeltaNote({ removed, added }: { removed: string[]; added: string[] }) {
  return (
    <span className="row-extra member-delta">
      <span className="muted">{"re-signature — measured pub members that moved: "}</span>
      {removed.map((seg) => (
        <code className="member-seg member-removed" key={`-${seg}`}>{`− ${seg}`}</code>
      ))}
      {added.map((seg) => (
        <code className="member-seg member-added" key={`+${seg}`}>{`+ ${seg}`}</code>
      ))}
      <span className="muted">{" (consumer-visible members only — honest rule 2)"}</span>
    </span>
  );
}

/** A re-signed row's measured before/after signature (T-34): the canonical
 * fn text resolved from the lazy sidecar, stated verbatim for single-variant
 * keys; cfg gates stay provenance notes beside it. Every other resigned row
 * (types — their canonical text includes doc comments; multi-variant fn
 * keys; unresolved texts) keeps the digest-only treatment with its reason. */
export function ResignedRowExtra({
  texts,
  memberMap,
  aRow,
  a,
  bRow,
  b,
  itemKey,
}: {
  texts: FnTextsBundle | null;
  /** The shared type-member map (`key -> digest -> segments`, T-51) — one
   * session-cached file for every surface. Sliced to `itemKey` here; null
   * while the map loads or if it failed to load, so a re-signed type states
   * the pub-only policy instead of naming the moved member. */
  memberMap?: TypeMembersBundle | null;
  aRow: VersionRow;
  a: Side;
  bRow: VersionRow;
  b: Side;
  itemKey: string;
}) {
  const pair = signaturePair(texts, aRow, a, bRow, b, itemKey);
  if (pair) {
    const gatesA = cfgGatesOf(aRow, itemKey);
    const gatesB = cfgGatesOf(bRow, itemKey);
    const gates: string[] = [];
    if (gatesA.length > 0) gates.push(`at A: ${gatesA.join(" ")}`);
    if (gatesB.length > 0) gates.push(`at B: ${gatesB.join(" ")}`);
    const changed = pair.from !== pair.to;
    return (
      <span className="row-extra sig-change">
        <span className="muted">
          {changed
            ? "re-signature — measured signature changed: "
            : "re-signature — the measured signature text is unchanged; the re-signature is the recorded cfg gate change: "}
        </span>
        {changed ? (
          <>
            <code className="sig-text">{pair.from}</code>
            <span className="sig-arrow" aria-hidden="true">
              {" → "}
            </span>
            <code className="sig-text">{pair.to}</code>
          </>
        ) : (
          <code className="sig-text">{pair.from}</code>
        )}
        {gates.length > 0 && (
          <span className="muted">
            {` — measured under ${gates.join(" · ")} (provenance, never evaluation)`}
          </span>
        )}
        <span className="muted">
          {" (measured canonical text — parameter types, never names; honest rule 2)"}
        </span>
      </span>
    );
  }
  // T-47 decision 2b: a re-signed member-bearing type names the pub members
  // that moved (a measured set difference). Private/doc churn never reaches
  // this branch: it does not re-sign the type at all.
  const memberDelta = typeMemberDelta(memberVectorsOf(memberMap, itemKey), itemKey, digestAt(aRow, itemKey), digestAt(bRow, itemKey));
  if (memberDelta) return <MemberDeltaNote removed={memberDelta.removed} added={memberDelta.added} />;
  const fn = splitKey(itemKey)[0] === "fn";
  if (fn && !singleVariantPair(aRow, bRow, itemKey)) {
    return (
      <span className="row-extra">
        <span className="muted">
          {"re-signature — digest changed (this key is measured under multiple signatures in one of the compared releases, so no single before/after is drawn; fn digests are parameter-type — honest rule 2). "}
        </span>
      </span>
    );
  }
  return (
    <span className="row-extra">
      <DigestOnlyNote why={fn ? "signature text not resolved for one side" : undefined} />
    </span>
  );
}

/** Removed-row annotations, by pair nature (cross-fork never claims "the
 * successor"). `providerId`/`bVers` are the B side of the diff. */
export function RemovedRowExtra({
  rules,
  providerId,
  bVers,
  itemKey,
  crossFork,
}: {
  rules: Rule[];
  providerId: string;
  bVers: string;
  itemKey: string;
  crossFork: boolean;
}) {
  const rulesAll = rulesFrom({ rules }, itemKey);
  if (crossFork) {
    return (
      <span className="row-extra">
        {rulesAll.map((r) => (
          <RuleLine
            key={r.id}
            rule={r}
            context={`→ rule on ${r.transition.to.provider} (informational here — cross-fork row, never “the successor”)`}
          />
        ))}
        {rulesAll.length === 0 && <NoSuccessorNote />}
      </span>
    );
  }
  const applicable = rulesAll.find(
    (r) => r.transition.to.provider === providerId && r.transition.to.version === bVers,
  );
  const others = rulesAll.filter((r) => r !== applicable);
  return (
    <span className="row-extra">
      {applicable && <RuleLine rule={applicable} context="→ confirmed successor" />}
      {others.map((r) => (
        <RuleLine key={r.id} rule={r} context="→ related rule (other transition)" />
      ))}
      {!applicable && others.length === 0 && <NoSuccessorNote />}
    </span>
  );
}

/**
 * Kind-grouped list of item rows (stable kind order, then name). Each row is
 * a kind chip plus an optional extra annotation plus a deep link into the
 * Alignment view — with the T-38 `back` round-trip when one is given.
 */
export function ItemList({
  keys,
  cssClass,
  rowExtra,
  back,
}: {
  keys: string[];
  cssClass: string;
  rowExtra?: (key: string) => ReactNode;
  back?: string;
}) {
  const byKind = new Map<string, string[]>();
  for (const key of keys) {
    const [kind] = splitKey(key);
    const list = byKind.get(kind) ?? [];
    list.push(key);
    byKind.set(kind, list);
  }
  const sortedKinds = [...byKind.entries()].sort((x, y) => kindRank(x[0]) - kindRank(y[0]));
  return (
    <div className="item-list">
      {sortedKinds.map(([kind, list]) => (
        <div key={kind}>
          <h4 className="item-kind-head">{`${kind} — ${list.length}`}</h4>
          <ul className="item-rows">
            {[...list].sort().map((key) => (
              <li key={key} className={`item-row ${cssClass}`}>
                <KindChip item={key} />
                {rowExtra?.(key)}
                <a
                  className="align-link"
                  href={alignmentLink(key, back)}
                  title={back ? "open this item's fork matrix (with a return link to the current view)" : undefined}
                >
                  alignment
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
