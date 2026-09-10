// T-44 — the release telemetry popover: the cell-anchored replacement for the
// T-40 inspection dock.
//
// The dock's duplication-trap readout is gone: digest + measured signature +
// invariant docstring live type-level on the deck once (T-42 variant cards
// resolve each digest's measured signature from the fn-texts sidecar; T-43's
// Title promotes the invariant docstring), so this popover owns the
// **release-unique** facts only — the channel + its status flags (RULE-6), the
// stream-transition status of the pinned cell, its measured declaration
// source location(s) as docs.rs permalinks (decision 2(a): every coordinate
// is measured data resolved from the lazy source-locs sidecar, RULE-7), and
// the pivot ramps into the Changes diff + Journal views. Since T-45 a pinned
// zed-republishing release (gpui-unofficial) also carries a github source
// anchor beside the docs.rs one — every fork version (stable or prerelease)
// names its curated upstream `v<vers>` tag (upstreamGitRef/githubSourceUrl
// over the provider's `upstream` map); untagged forks stay docs.rs-only
// (honest, RULE-4).
//
// Interaction (per the T-44 direction, refined to the click-vs-hover FSM):
// the popover renders only while a cell is explicitly pinned (no inert idle
// panel — "no cell pinned" renders nothing), it is anchored over/clamped to
// the active cell via getBoundingClientRect (left/right clamps + a vertical
// flip near the bottom), and its lifecycle is a strict IDLE/PINNED state
// machine driven by the matrix cells: activating the pinned cell again
// unpins, activating any other cell re-pins seamlessly (no close-then-open),
// Escape clears and returns focus to the launching cell, a click outside the
// cells + popover dismisses, and an accessible ✕ (aria-label="Dismiss")
// closes. Hover/focus alone never mounts this UI — Layer 1 is the CSS hover
// enlargement + the native `title` tooltip on the dot, so a cursor rising to
// a popover link over the matrix can never tear it away mid-click. The
// matrix cells' `aria-describedby` points at #release-popover-status while
// pinned, so keyboard users reach the same readout by activating a cell —
// the describedby contract survives the dock's removal (the guard-rail
// re-target, verified by ear in the manual a11y queue).
//
// Honest states (RULE-4): an absent/removed/never-measured cell reports its
// state with no invented continuity — no variant letters, no source anchor,
// and the Changes diff ramp only when the release actually has a previous
// published row to diff against. Pre-release/yanked releases carry an
// explicit status chip (RULE-6).

import { useEffect, useRef, useState } from "react";
import type { DockCell, ItemVariant } from "../bundle/derive";
import { digestAt, docsRsSourceUrl, githubSourceUrl, splitKey, srcLocsOf, typeMemberDelta, upstreamGitRef } from "../bundle/derive";
import type { Provider, SrcLocsBundle, TypeMembersBundle, VersionRow } from "../bundle/types";
import { memberVectorsOf } from "../bundle/keyPayload";

/** The popover's status element id — the matrix cells' aria-describedby
 * target (the keyboard readout contract the dock's #alignment-dock-status
 * used to hold). */
export const POPOVER_STATUS_ID = "release-popover-status";

/** The variant letters of the digests a cell carries (α, α+β for a
 * multi-digest row) — the same labels the deck chips and matrix dots share.
 * No digest hexes here: the deck owns the hex + measured signature (the
 * duplication-trap point). */
function lettersOf(cell: DockCell, variants: ItemVariant[]): string[] {
  const out: string[] = [];
  for (const d of cell.digests ?? []) {
    const v = variants.find((x) => x.digest === d);
    if (v) out.push(v.label);
  }
  return [...new Set(out)];
}

/** The variant letters of the *branch base* of a changed cell. */
function prevLettersOf(cell: DockCell, variants: ItemVariant[]): string[] {
  const out: string[] = [];
  for (const d of cell.prevDigests ?? []) {
    const v = variants.find((x) => x.digest === d);
    if (v) out.push(v.label);
  }
  return [...new Set(out)];
}

const PRESENT: ReadonlySet<string> = new Set(["added", "same", "changed"]);

export function ReleasePopover({
  bundle,
  itemKey,
  cell,
  variants,
  locs,
  memberMap,
  onDismiss,
}: {
  /** The release metadata the popover reads — provider rows with their
   * package/upstream source maps. Typed on the metadata subset so full
   * corpus providers and the manifest/synthesized providers both work
   * (T-33 increment 2): the popover reads provider-level facts only, never
   * item surfaces. */
  bundle: { providers: Provider[] };
  itemKey: string;
  cell: DockCell;
  variants: ItemVariant[];
  /** The loaded source-locs sidecar (T-44) — null while it is not fetched:
   * the honest pre-fetch state renders no anchor, never a fabricated one. */
  locs: SrcLocsBundle | null;
  /** The shared type-member map (T-51, `key -> digest -> segments`) — sliced
   * to `itemKey` here. Null while it loads or if it failed: a re-signed type
   * cell then states the policy (pub members only) instead of naming the moved
   * member, never an inference. */
  memberMap: TypeMembersBundle | null;
  onDismiss: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const provider = bundle.providers.find((p) => p.id === cell.providerId) ?? null;
  const present = PRESENT.has(cell.state);
  const letters = present ? lettersOf(cell, variants) : [];
  const changed = cell.state === "changed";
  const prevLetters = changed ? prevLettersOf(cell, variants) : [];
  const unadvisable = cell.flagTxt === "yanked" || cell.flagTxt === "pre-release";
  // T-47 decision 2b: a re-signed member-bearing type cell names the pub
  // member(s) that moved, resolved from the lazy type-members sidecar (both
  // releases measured — the delta is a set difference of the analyzer's own
  // digest segments, never a reconstruction). Null when the key is an fn (its
  // signatures live on the variant cards) or either side's vector is not
  // resolved; the fallback copy below then states the pub-only policy.
  const memberDelta =
    changed && cell.prevVers
      ? typeMemberDelta(
          memberVectorsOf(memberMap, itemKey),
          itemKey,
          digestAt(
            bundle.providers.find((p) => p.id === cell.providerId)?.versions.find((v) => v.vers === cell.prevVers) as VersionRow,
            itemKey,
          ),
          digestAt(
            bundle.providers.find((p) => p.id === cell.providerId)?.versions.find((v) => v.vers === cell.vers) as VersionRow,
            itemKey,
          ),
        )
      : null;

  // Anchor the popover to the pinned cell: locate the cell button, then
  // place the sheet over/clamped to it (left/right clamps + a vertical flip
  // near the bottom). Client-only — the server render carries no position
  // and the component is inert until a pin effect runs.
  useEffect(() => {
    if (!ref.current) return;
    const el = document.querySelector<HTMLElement>(
      `button[data-cell-provider="${cell.providerId}"][data-cell-vers="${cell.vers}"]`,
    );
    if (!el) {
      setPos(null);
      return;
    }
    const rect = el.getBoundingClientRect();
    const pop = ref.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const gap = 6;
    const below = rect.bottom + pop.height + gap <= vh - gap;
    const top = below ? rect.bottom + gap : Math.max(gap, rect.top - pop.height - gap);
    const left = Math.min(Math.max(gap, rect.left), Math.max(gap, vw - pop.width - gap));
    setPos({ top, left });
  }, [cell, variants]);

  // Closing that returns keyboard focus to the launching cell (Escape and the
  // ✕ per the a11y contract — the popover opened from a click/Space/Enter on
  // that cell, so we hand focus back rather than dropping it on the body).
  const dismiss = () => {
    // Hand focus to the launching cell while it is still in the DOM — then
    // clear the pin (the popover unmounts; the dot keeps focus).
    document
      .querySelector<HTMLElement>(
        `button[data-cell-provider="${cell.providerId}"][data-cell-vers="${cell.vers}"]`,
      )
      ?.focus();
    onDismiss();
  };

  // Escape clears the pin and returns focus to the launching cell. The
  // document listener keeps the popover dismissible while focus is anywhere
  // in the view (the FSM's PINNED → IDLE transition).
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        ev.preventDefault();
        dismiss();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // onDismiss changes identity each render (an inline arrow in ItemBox), so
    // this listener always sees the latest pinned cell for the focus return.
  }, [onDismiss]);

  // Outside clicks dismiss (PINNED → IDLE) with no focus grab: a pointerdown
  // on anything that is neither a matrix cell nor inside this sheet clears
  // the pin, leaving focus wherever the user clicked (they may have landed in
  // another control). A pointerdown on a cell is *not* a dismissal — it is
  // the very click that re-pins (or else the interactive FSM would read as a
  // close-then-open). Blank space inside the matrix card (not a cell) does
  // dismiss, matching the popup's boundary: the cells + this sheet own the
  // open state, nothing else.
  useEffect(() => {
    const onDown = (ev: PointerEvent) => {
      const t = ev.target as Node | null;
      if (!t) return;
      if (ref.current && ref.current.contains(t)) return;
      const cell = (t as HTMLElement).closest?.(
        'button[data-cell-provider][data-cell-vers]',
      );
      if (cell) return;
      onDismiss();
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [onDismiss]);

  // The measured declaration source locations of the pinned item in this
  // release (T-44). Null while the sidecar has not loaded; empty for a
  // release/key the sidecar resolves none (never measured, or a re-export
  // key with no declaration).
  const srcs = locs ? srcLocsOf(locs, cell.providerId, cell.vers)?.[itemKey] ?? null : null;
  const sourceReady = locs !== null && locs !== undefined;

  // The status phrase: the state word plus the release-unique context the
  // deck cannot show (which row the state is relative to — the *branch* base,
  // not the raw publish predecessor).
  let status = cell.phrase;
  if (changed && cell.prevVers) status += ` — vs branch predecessor ${cell.prevVers}`;
  if (cell.state === "removed" && cell.prevVers) {
    status += ` — the branch predecessor (${cell.prevVers}) carried it`;
  }
  if (cell.state === "added" && cell.prevVers) {
    status += ` — first present row of this stream since ${cell.prevVers}`;
  }

  const diffHref =
    cell.prevVers && provider
      ? `#/changes?a=${encodeURIComponent(`${provider.id}:${cell.prevVers}`)}&b=${encodeURIComponent(`${provider.id}:${cell.vers}`)}`
      : null;
  const journalHref = provider
    ? `#/journal?s=${encodeURIComponent(provider.id)}&v=${encodeURIComponent(cell.vers)}`
    : null;

  return (
    <div
      className="release-popover"
      id="release-popover"
      role="region"
      aria-label={`${provider ? provider.id : cell.providerId} ${cell.vers} release readout`}
      style={pos ? { top: pos.top, left: pos.left } : undefined}
      ref={ref}
    >
      <header className="release-popover-head">
        <span className="release-chip mono" id="release-popover-channel">
          {`${provider ? provider.id : cell.providerId} ${cell.vers}`}
        </span>
        {unadvisable && (
          <span
            className={`release-flag mono ${cell.flagTxt === "yanked" ? "flag-yanked" : "flag-pre"}`}
            title={
              cell.flagTxt === "yanked"
                ? "yanked from crates.io — unadvisable (rule 6)"
                : "pre-release — not a stable release (rule 6)"
            }
          >
            {cell.flagTxt}
          </span>
        )}
        <button
          type="button"
          className="release-dismiss"
          id="release-popover-dismiss"
          aria-label="Dismiss"
          onClick={dismiss}
        >
          <svg aria-hidden="true" viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M2 2 10 10M10 2 2 10" />
          </svg>
        </button>
      </header>

      <p className="release-status" id={POPOVER_STATUS_ID}>
        {status}
      </p>

      {present && letters.length > 0 && (
        <p className="release-variants mono">
          {changed && prevLetters.length > 0
            ? `${prevLetters.join("+")} → ${letters.join("+")} — digest re-signed here; the measured signatures are on the variant cards`
            : `digest variant ${letters.join("+")} — measured signature on the variant card`}
        </p>
      )}

      {/* T-47 decision 2b: for a re-signed member-bearing type cell, the
          measured pub members that moved — a set difference of the two
          releases' analyzer-produced digest segments (rule 7: exporter-
          derived measured data, never a reconstruction). A private/`pub(crate)`
          member edit never reaches this box: it does not re-sign the type
          (rule 2). */}
      {changed && memberDelta && (
        <p className="release-members" id="release-popover-members">
          <span className="release-label mono">members</span>
          <span className="release-members-delta mono">
            {memberDelta.removed.map((seg) => (
              <span className="member-seg member-removed" key={`-${seg}`} title="measured pub member removed (or re-typed) at this release">
                {`− ${seg}`}
              </span>
            ))}
            {memberDelta.added.map((seg) => (
              <span className="member-seg member-added" key={`+${seg}`} title="measured pub member added (or re-typed) at this release">
                {`+ ${seg}`}
              </span>
            ))}
          </span>
          <span className="muted release-members-note">
            {" — the measured consumer-visible member segments that moved (pub members only; honest rule 2)"}
          </span>
        </p>
      )}
      {changed && !memberDelta && splitKey(itemKey)[0] !== "fn" && (
        <p className="release-members" id="release-popover-members">
          <span className="muted release-members-note">
            {"re-signature — a type's digest covers its consumer-visible pub members only; doc comments and private/pub(crate) members never re-sign it (honest rule 2). The moved member is not named here (the measured member vector is not resolved for this key)."}
          </span>
        </p>
      )}

      <div className="release-source" id="release-popover-source">
        <span className="release-label mono">source</span>
        {!present ? (
          <span className="release-source-empty muted">
            {cell.state === "removed"
              ? "removed here — no declaration in this release (rule 4)"
              : cell.state === "unknown"
                ? "not measured — no source recorded (rule 4)"
                : "absent — no declaration in this release (rule 4)"}
          </span>
        ) : !sourceReady ? (
          <span className="release-source-empty muted">resolving the measured declaration…</span>
        ) : srcs && srcs.length > 0 ? (
          <span className="release-source-links mono">
            {srcs.map((loc) => {
              const key = `${loc.file}:${loc.start}-${loc.end}`;
              if (!provider) {
                return (
                  <span key={key} className="muted">
                    {`${loc.file} L${loc.start}–${loc.end}`}
                  </span>
                );
              }
              // The curated upstream github map (T-45), resolved for this exact
              // release: a mapped fork (any version — stable or prerelease, both
              // carry zed v-tags) → a github anchor beside docs.rs; an unmapped
              // fork (independent repo / untagged republish) → docs.rs only.
              const ghRef = upstreamGitRef(provider.upstream, cell.vers);
              const gh = provider.upstream && ghRef ? githubSourceUrl(provider.upstream, ghRef, loc) : null;
              return (
                <span className="release-source-link-group" key={key}>
                  <a
                    className="release-source-link"
                    href={docsRsSourceUrl(provider, cell.vers, loc)}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="docs.rs source view of this release's measured declaration — every line bound is measured (rule 7)"
                  >
                    {`${loc.file} L${loc.start}–${loc.end}`}
                    <span aria-hidden="true"> ↗</span>
                  </a>
                  {gh && provider.upstream && (
                    <a
                      className="release-source-link release-source-link-gh"
                      href={gh}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`github ${provider.upstream.repo}@${ghRef} — this fork's published bytes republish the upstream tree; every line bound is measured (rule 7)`}
                    >
                      github {ghRef}
                      <span aria-hidden="true"> ↗</span>
                    </a>
                  )}
                </span>
              );
            })}
          </span>
        ) : (
          <span className="release-source-empty muted">
            no measured declaration location for this release (rule 4)
          </span>
        )}
      </div>

      <footer className="release-ramps mono">
        {diffHref ? (
          <a
            className="ramp-chip"
            href={diffHref}
            title={`open the ${cell.prevVers} → ${cell.vers} diff in the Changes view`}
          >
            <span aria-hidden="true">⇄ </span>Diff in Changes
          </a>
        ) : (
          <span className="ramp-chip ramp-off" title="this release has no branch predecessor to diff">
            ⇄ Diff in Changes
          </span>
        )}
        {journalHref ? (
          <a
            className="ramp-chip"
            href={journalHref}
            title={`open the ${cell.vers} entry in the Journal view`}
          >
            <span aria-hidden="true">📖 </span>in Journal
          </a>
        ) : (
          <span className="ramp-chip ramp-off">📖 in Journal</span>
        )}
      </footer>
    </div>
  );
}
