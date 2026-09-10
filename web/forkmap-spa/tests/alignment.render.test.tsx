// T-39 — Alignment view render parity (increment 3).
//
// Renders the actual AlignmentView (react-dom/server over the committed
// bundle) for the recorded-story deep links and asserts the rendered markup:
// the item head + identity note, the confirmed-rule box for the 1.17.2
// removal story, the per-fork matrix with its summary chips and cell-state
// dots, the T-38 return chip for a back deep link, the empty-hash hint state,
// the docs panel, and the honest-rule ids + every alignment-* id app.js binds
// in the DOM output of the view.

import { describe, expect, test } from "bun:test";
import { renderToString } from "react-dom/server";
import { createElement } from "react";
import {
  type ItemDocStory,
  alignmentPills,
  branchBase,
  buildIndex,
  cellState,
  digestPrevalence,
  digestsOf,
  fnDigestTexts,
  isMemberBearingKind,
  itemDocStory,
  itemVariants,
  ruleActionableKeys,
  streamPartition,
  variantMemberStats,
  variantSteps,
  VARIANT_PALETTE,
} from "../src/bundle/derive";
import { memberVectorsOf } from "../src/bundle/keyPayload";
import type { DockCell } from "../src/bundle/derive";
import { bundleCounts } from "../src/bundle/counts";
import {
  validateAlignIndex,
  validateBundle,
  validateColumnBucket,
  validateDocTexts,
  validateFnTexts,
  validateManifest,
  validateSrcLocs,
  validateTypeMembers,
} from "../src/bundle/validate";
import { alignOrdinals } from "../src/bundle/alignmentSlice";
import { projectKeyPayload } from "../src/bundle/keyPayload";
import { COLUMN_BUCKET_KEYS } from "../src/bundle/types";
import type {
  AlignIndex,
  AlignmentItem,
  ColumnBucket,
  ForkmapBundle,
  ForkmapManifest,
  KeyPayload,
  SrcLocsBundle,
  TypeMembersBundle,
} from "../src/bundle/types";
import { AlignmentView, VariantLegend } from "../src/views/AlignmentView";
import { ReleasePopover } from "../src/components/ReleasePopover";
import { STATIC_RENDERER_IDS } from "./fixtures/static-renderer-ids";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const BUNDLE_PATH = join(HERE, "..", "..", "forkmap", "data", "forkmap.json");
const MANIFEST_PATH = join(HERE, "..", "..", "forkmap", "data", "forkmap-manifest.json");
const DATA_DIR = join(HERE, "..", "..", "forkmap", "data");
const INDEX_PATH = join(DATA_DIR, "forkmap-align-index.json");
const SRC_LOCS_PATH = join(DATA_DIR, "forkmap-source-locs.json");
const FN_TEXTS_PATH = join(DATA_DIR, "forkmap-fn-texts.json");
const DOC_TEXTS_PATH = join(DATA_DIR, "forkmap-doc-texts.json");
// T-49: the committed shared member map, injected where the member panel is
// asserted (the runtime resolves it through the module-cached loader).
const members: TypeMembersBundle = validateTypeMembers(
  JSON.parse(readFileSync(join(DATA_DIR, "forkmap-type-members.json"), "utf8")),
);

// T-33 increment 5: the view renders from the committed boot manifest + the
// alignment item index + the selected item's committed column bucket (the
// same files the served app loads), while the full committed bundle stays as
// the *oracle* — every derivation the assertions compare against
// (itemVariants, prevalence, pill counts, …) runs over the corpus, proving
// the index/bucket-driven DOM equals the corpus-driven facts.
const bundle: ForkmapBundle = validateBundle(JSON.parse(readFileSync(BUNDLE_PATH, "utf8")));
const manifest: ForkmapManifest = validateManifest(JSON.parse(readFileSync(MANIFEST_PATH, "utf8")));
const alignIndex: AlignIndex = validateAlignIndex(JSON.parse(readFileSync(INDEX_PATH, "utf8")));
const index = buildIndex(bundle);
const counts = bundleCounts(bundle);
// T-44: the committed source-location sidecar (the popover's permalink data),
// loaded once like the doc-texts sidecar the Title tests inject.
const srcLocs: SrcLocsBundle = validateSrcLocs(
  JSON.parse(readFileSync(SRC_LOCS_PATH, "utf8")),
);
// T-33 increment 3: the item-box/popover payload rows the suite injects are
// per-key payload fragments, projected from the committed whole sidecars
// (projectKeyPayload — the exporter's transpose reproduced in TS, asserted
// equal to the committed bucket files by the keyPayload parity suite), so
// the injected record is the same bytes the runtime bucket fetch supplies.
const fnSidecar = validateFnTexts(JSON.parse(readFileSync(FN_TEXTS_PATH, "utf8")));
const docSidecar = validateDocTexts(JSON.parse(readFileSync(DOC_TEXTS_PATH, "utf8")));

function payloadOf(key: string): KeyPayload | null {
  return projectKeyPayload(key, bundle.providers, fnSidecar, docSidecar, srcLocs);
}

/** The selected key's digest-state table as its committed column bucket file
 * carries it (T-33 increment 5) — the same bytes the runtime bucket fetch
 * supplies, resolved via the index's ordinal addressing. */
function columnOf(key: string): AlignmentItem {
  const ordinal = alignOrdinals(alignIndex).get(key);
  if (ordinal === undefined) throw new Error(`key ${key} is not in the align index`);
  const name = `forkmap-column-${String(Math.floor(ordinal / COLUMN_BUCKET_KEYS)).padStart(3, "0")}.json`;
  const bucket: ColumnBucket = validateColumnBucket(JSON.parse(readFileSync(join(DATA_DIR, name), "utf8")));
  const rec = bucket.items.find((i) => i.k === key);
  if (!rec) throw new Error(`key ${key} is not in its column bucket ${name}`);
  return { key: rec.k, ds: rec.ds, cells: rec.cells };
}

function renderAlignment(params: Record<string, string>, payload?: KeyPayload | null): string {
  // The recorded stories render the item's matrix/deck — the runtime fetches
  // the column bucket on selection; the suite injects the committed record
  // (the same bytes) so the server render is synchronous. Unknown keys never
  // render an item box (the view gates on the index).
  const wantsColumn = params.item && alignIndex.keys.some((k) => k.k === params.item);
  return renderToString(
    createElement(AlignmentView, {
      manifest,
      alignIndex,
      params,
      payload,
      itemColumn: wantsColumn ? columnOf(params.item!) : undefined,
    }),
  );
}

/** The variant deck with the member map injected (T-49). `VariantLegend` reads
 * the shared member map the view normally loads in an effect; server renders
 * run no effects, so the suite passes the committed map directly — the same
 * bytes the runtime resolves. */
function renderLegend(key: string, memberMap: TypeMembersBundle | null = members, base: number | null = null): string {
  const stats = isMemberBearingKind(key)
    ? variantMemberStats(itemVariants(bundle, key), memberVectorsOf(memberMap, key))
    : null;
  return renderToString(
    createElement(VariantLegend, {
      variants: itemVariants(bundle, key),
      prevalence: digestPrevalence(bundle, key),
      texts: null,
      memberStats: stats,
      baseVariant: base,
      isolated: null,
      onToggle: () => {},
    }),
  );
}

/** The runtime item-area path before the column bucket lands: no injected
 * column, so ItemBox's lazy loader is still idle — the honest loading state
 * (server render can't run effects, which is exactly the pre-fetch render). */
function renderAlignmentBeforeColumn(params: Record<string, string>): string {
  return renderToString(createElement(AlignmentView, { manifest, alignIndex, params }));
}

function occurrences(haystack: string, needle: string): number {
  let n = 0;
  let i = haystack.indexOf(needle);
  while (i >= 0) {
    n += 1;
    i = haystack.indexOf(needle, i + 1);
  }
  return n;
}

/** The ItemDocTitle caption for a doc story (mirrors the view's wording) — the
 * rendered caption must equal this derivation over the loaded bundle/sidecar. */
function docTitleCap(story: ItemDocStory): string {
  const n = story.docReleases;
  if (story.docs.length === 1) {
    return story.bareReleases === 0
      ? `one docstring · measured on all ${n} release${n === 1 ? "" : "s"}`
      : `one docstring · measured on ${n} of ${n + story.bareReleases} release${n + story.bareReleases === 1 ? "" : "s"} — ${story.bareReleases} carry no doc comment`;
  }
  return `${story.docs.length} docstrings across ${n} release${n === 1 ? "" : "s"} · the first measured (${story.anchor!.providerId} ${story.anchor!.vers}) anchors this title`;
}

describe("Alignment view renders the recorded stories (server render)", () => {
  test("kael AccessibilityNode deep link renders the head, the T-42 digest-variant legend, the active stream + the T-41 absent collapse", () => {
    const key = "struct:accessibility::AccessibilityNode";
    const html = renderAlignment({ item: key });
    const rec = index.byKey.get(key)!;
    const variants = itemVariants(bundle, key);
    const prevalence = digestPrevalence(bundle, key);
    const first = variants[0];
    const last = variants[variants.length - 1];
    expect(html).toContain('id="view-alignment"');
    // item head + presence stats (below the deck: the key's release rows of the
    // dataset's, dataset forks)
    expect(html).toContain("accessibility::AccessibilityNode");
    expect(html).toContain(`>${rec.versions} of ${counts.versions} releases</span>`);
    expect(html).toContain(`>${counts.providers} forks</span>`);
    expect(html).toContain(`>${variants.length} variant${variants.length === 1 ? "" : "s"}</span>`);
    // T-42: the six-status legend is gone; the digest-variant legend names the
    // measured kael signatures in first-measured order (RULE-7: digest/letter/
    // counts all computed from the loaded bundle).
    const legendSegment = html.slice(html.indexOf('id="alignment-variants"'), html.indexOf('class="matrix-stage"'));
    expect(legendSegment).not.toContain("present (unchanged)");
    expect(legendSegment).not.toContain("re-signed (digest changed)");
    expect(html).toContain('id="alignment-variants"');
    // one deck card per measured digest — α…last, first-measured order (RULE-7)
    expect(occurrences(html, 'class="var-card"')).toBe(variants.length);
    expect(html).toContain("<h3>Measured digest variants</h3>");
    expect(html).toContain(`<strong>Variant ${first.label}</strong>`);
    expect(html).toContain(`<strong>Variant ${last.label}</strong>`);
    expect(html).toContain(`>${first.shortDigest}</code>`);
    expect(html).toContain(`>${last.shortDigest}</code>`);
    // per-card stats: releases/forks pills with icons + first-measured facts
    const alpha = prevalence.get(first.digest)!;
    expect(html).toContain(`>${alpha.releases} release${alpha.releases === 1 ? "" : "s"}</span>`);
    expect(html).toContain(`>${alpha.forks.length} fork${alpha.forks.length === 1 ? "" : "s"}</span>`);
    expect(html).toContain(`first measured at ${first.firstSeen!.providerId} ${first.firstSeen!.vers}`);
    expect(html).toContain(`first measured at ${last.firstSeen!.providerId} ${last.firstSeen!.vers}`);
    // the neutral states keep their words under the variant chips
    expect(html).toContain("removed here");
    expect(html).toContain("not measured");
    // matrix dots are colored by measured digest — a color change IS the
    // re-signature.
    for (let i = 0; i < variants.length; i++) {
      expect(html).toContain(`class="cell cell-dv${i % VARIANT_PALETTE}"`);
    }
    expect(html).not.toContain('class="cell cell-same"');
    expect(html).not.toContain('class="cell cell-changed"');
    // the status word stays in the cell's tooltip/aria-label (rule 1)
    const kael = bundle.providers.find((p) => p.id === "kael")!;
    const changedIdx = kael.versions.findIndex((v, i) => cellState(key, branchBase(kael.versions, i), v) === "changed");
    const changedRow = kael.versions[changedIdx];
    const changedVariant = variants.find((x) => digestsOf(changedRow.surface, key)!.has(x.digest))!;
    expect(html).toContain(`changed — variant ${changedVariant.label}"`);
    expect(html).toContain(`measured digest variant: ${first.label} ${first.shortDigest}…`);
    // The matrix owns the stage (the dock column is gone since T-44 — the
    // release popover floats over it only while a cell is pinned).
    expect(html).toContain('class="matrix-stage"');
    expect(html).not.toContain('id="alignment-dock"');
    // T-41: only the streams that measured the item render in full; the rest
    // collapse into one honest summary row.
    const partition = streamPartition(bundle.providers, key);
    const stableRows = kael.versions.filter((v) => !v.prerelease);
    const stableRun = variantSteps(stableRows, variants, key);
    const letters = (ix: number[]) => ix.map((i) => variants[i].label).join("+");
    const noun = kael.versions.some((v) => v.prerelease) ? "stable release" : "release";
    const runPrefix = `${stableRun.present} ${noun}${stableRun.present === 1 ? "" : "s"}`;
    const summary =
      stableRun.steps.length === 1
        ? `${runPrefix} · Variant ${letters(stableRun.steps[0].indexes)}`
        : `${runPrefix} · ${stableRun.steps
            .map((s, i) => (i === 0 ? letters(s.indexes) : `${letters(s.indexes)} (${s.vers})`))
            .join(" → ")}`;
    expect(html).toContain(summary);
    expect(occurrences(html, "— never measured on this stream")).toBe(0);
    expect(occurrences(html, '<strong class="stream-name">')).toBe(partition.present.length);
    expect(html).toContain(`<strong class="stream-name">${partition.present[0].id}</strong>`);
    // collapsed block: the absent provider ids + the computed release count
    const absentRows = partition.absent.reduce((n, p) => n + p.versions.length, 0);
    expect(html).toContain('id="alignment-absent"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain(
      `never measured on ${partition.absent.map((p) => p.id).join(" · ")} — absent across ${absentRows} recorded release${absentRows === 1 ? "" : "s"}`,
    );
    expect(html).toContain(">show</span>");
    expect(html).not.toContain(">hide</span>");
  });

  test("T-49: AccessibilityNode shows the measured member count per variant and the 10 → 11 → 12 → 19 shift", () => {
    const key = "struct:accessibility::AccessibilityNode";
    const html = renderLegend(key);
    // The recorded story: the type only ever grew, so every shift is positive
    // and equals the difference of the neighbouring counts.
    expect(html).toContain("members 10");
    expect(html).toContain("members 11");
    expect(html).toContain("members 12");
    expect(html).toContain("members 19");
    expect(html).toContain("(+1)");
    expect(html).toContain("(+7)");
    // The panel is comparative: a base chip per resolved variant and one delta
    // row each, and the policy is stated exactly once.
    expect(html).toContain('id="alignment-members"');
    expect(html).toContain("Member contract");
    expect(html).toContain("consumer-visible pub members only");
    expect(html).toContain("private/pub(crate) members never re-sign a type");
    expect(occurrences(html, 'class="member-base-chip mono"')).toBe(4);
    // Nothing is selected until a base is chosen, so no chip is pressed.
    expect(occurrences(html, 'class="member-base-chip mono selected"')).toBe(0);
    // The stat derivation itself matches the sidecar byte-for-byte.
    const stats = variantMemberStats(itemVariants(bundle, key), memberVectorsOf(members, key));
    expect(stats.map((s) => s.count)).toEqual([10, 11, 12, 19]);
    expect(stats.map((s) => s.shift)).toEqual([null, 1, 1, 7]);
    for (const s of stats) expect(s.vector).not.toBeNull();
  });

  test("T-49: selecting a base variant diffs every other variant, expandable to the measured segments", () => {
    const key = "struct:accessibility::AccessibilityNode";
    const html = renderLegend(key, members, 0);
    // Base α (10 members): δ (19) is +9 net, and the delta is a real measured
    // set difference of the alpha and delta vectors — never a reconstruction.
    const stats = variantMemberStats(itemVariants(bundle, key), memberVectorsOf(members, key));
    const a = stats[0];
    const d = stats[3];
    expect(a.vector).not.toBeNull();
    expect(d.vector).not.toBeNull();
    const aSet = new Set(a.vector!);
    const dSet = new Set(d.vector!);
    const added = d.vector!.filter((s) => !aSet.has(s));
    const removed = a.vector!.filter((s) => !dSet.has(s));
    expect(added.length - removed.length).toBe(9);
    expect(html).toContain(`${`−${removed.length} +${added.length}`}`);
    // Every delta row is collapsed by default (the expansion is the only place
    // segments render, so the default surface stays small).
    expect(html).not.toContain("member-delta-segs");
    expect(a.vector!.every((s) => html.includes(s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")))).toBe(false);
  });

  test("T-49 honest states: an fn key and a member-less kind render no member panel; a multi-digest key states no single set", () => {
    // An fn key has no member projection at all.
    const fnHtml = renderLegend("fn:Window::blur");
    expect(fnHtml).not.toContain('id="alignment-members"');
    expect(fnHtml).not.toContain("members ");
    // A member-less kind (type alias) likewise.
    const aliasHtml = renderLegend("type:WindowBackgroundAppearance");
    expect(aliasHtml).not.toContain('id="alignment-members"');
    // The map absent (still loading): a member-bearing type still renders the
    // panel, stating that no vector resolved rather than a fabricated 0.
    const noMap = renderLegend("struct:accessibility::AccessibilityNode", null);
    expect(noMap).toContain('id="alignment-members"');
    expect(noMap).toContain("No member vector resolved");
    expect(noMap).not.toContain("members 0");
    // Every card states the honest unknown, never a fabricated count.
    expect(occurrences(noMap, "members —")).toBe(4);
  });

  test("T-49: the AccessibilityNode deep link renders the member contract panel on the deck", () => {
    // The full-view path: the panel is wired under the deck and states the
    // policy. (The runtime resolves the map through the shared module-cached
    // loader in an effect; a server render is the pre-load state, which must
    // still be the honest one.)
    const html = renderAlignment({ item: "struct:accessibility::AccessibilityNode" });
    expect(html).toContain('id="alignment-members"');
    expect(html).toContain("Member contract");
    expect(html).toContain("consumer-visible pub members only");
    // A non-member-bearing kind on the same path never renders it.
    const fnHtml = renderAlignment({ item: "fn:Window::blur" });
    expect(fnHtml).not.toContain('id="alignment-members"');
  });

  test("uno record_frame_timing + back param renders the rule box and the T-38 return chip", () => {
    const html = renderAlignment({
      item: "fn:profiler::record_frame_timing",
      back: "journal?s=gpui-unofficial&v=1.17.2",
    });
    // The confirmed rule box (from-side) renders under the head.
    expect(html).toContain("Confirmed migration rules");
    expect(html).toContain("record_frame_timing");
    expect(html).toContain("confirmed rule gpui-unofficial-1.17.2-01");
    // uno's own stream chip names the honest first removal on the *stable*
    // line (1.17.2 vs its branch base 1.16.3) — the 1.17.0-pre preview is
    // rendered separately and is not a step of the stable run.
    expect(html).toContain("✕ first removed at 1.17.2");
    expect(html).not.toContain("✕ first removed at 1.17.0-pre");
    expect(html).not.toContain("~ first re-signed at 1.7.2");
    // return chip (T-38 round-trip from a Journal deep link)
    expect(html).toContain('class="back-chip mono"');
    expect(html).toContain("← return to Journal — gpui-unofficial 1.17.2");
    expect(html).toContain('aria-label="Return to the Journal — gpui-unofficial 1.17.2 view"');
    expect(html).toContain('href="#/journal?s=gpui-unofficial&amp;v=1.17.2"');
  });

  test("pre-release previews render in their own group, never as steps of the stable variant run", () => {
    const html = renderAlignment({ item: "fn:Window::blur" });
    // Previews are a distinct group below the stable line (the label names it),
    // so a preview's new variant can't sit between two stable cells and make a
    // later backport look like a regression to legacy.
    expect(html).toContain('class="stream-previews"');
    expect(html).toContain('class="stream-previews-label mono">pre-release previews — not on the stable line');
    // uno's 1.19.0-pre (the β preview) is still a real, present cell — but in
    // the separate preview group, and no variant run lists it as a change
    // point back toward the legacy line (the recorded "new then legacy" snag).
    expect(html).toContain('data-cell-vers="1.19.0-pre"');
    expect(html).not.toContain("→ β (1.19.0-pre)");
  });

  test("an empty hash renders the pick-an-item hint and no matrix (and the list is closed)", () => {
    const html = renderAlignment({});
    expect(html).toContain("Pick an item above (or a preset) to render its fork matrix");
    expect(html).not.toContain('class="matrix"');
    expect(html).not.toContain('class="cell cell-same"');
    expect(html).toContain('id="alignment-suggest" class="suggest" role="listbox" hidden=""');
    // preset chips (all recorded-story items exist in the corpus)
    expect(html).toContain("presets");
    expect(html).toContain("struct:accessibility::AccessibilityNode");
  });

  test("a hash naming an unmeasured/unknown item never invents a matrix", () => {
    const html = renderAlignment({ item: "fn:no_such_item_measured" });
    expect(html).toContain("Pick an item above (or a preset) to render its fork matrix");
    expect(html).not.toContain('class="matrix"');
  });

  test("a back target into landing/alignment renders no return chip (matches app.js)", () => {
    const fromAlignment = renderAlignment({ item: "fn:Window::blur", back: "alignment?item=struct:accessibility::AccessibilityNode" });
    expect(fromAlignment).not.toContain('class="back-chip mono"');
    const fromLanding = renderAlignment({ item: "fn:Window::blur", back: "" });
    expect(fromLanding).not.toContain('class="back-chip mono"');
  });

  test("the docs panel names where each class of change is documented", () => {
    const html = renderAlignment({ item: "fn:Window::blur" });
    expect(html).toContain("Where this class of change is documented");
    expect(html).toContain("doc 08 — study: is the used-API report meaningful on real GPUI code?");
    expect(html).toContain("doc 13 — field note: two kits, one measured generation");
  });

  test("honest-rule ids and every static-renderer-bound alignment-* id exist in the rendered view", () => {
    const html = renderAlignment({ item: "struct:accessibility::AccessibilityNode" });
    for (let n = 1; n <= 7; n++) {
      expect(html, `honest-rule-${n}`).toContain(`id="honest-rule-${n}"`);
    }
    // The bound-id contract is the frozen snapshot of the retired static
    // renderer (tests/fixtures/static-renderer-ids.ts, T-39 increment 6).
    const boundIds = new Set<string>(STATIC_RENDERER_IDS.alignment);
    for (const id of boundIds) {
      expect(html, `rendered id "${id}"`).toContain(`id="${id}"`);
    }
  });
});

describe("T-40 alignment inspector renders (server render)", () => {
  test("the kind pills render inside the suggestion dropdown with bundle-computed counts and All active", () => {
    const html = renderAlignment({});
    expect(html).toContain('id="alignment-kinds"');
    expect(html).toContain('title="filter the suggestions by kind">kind<');
    const pills = alignmentPills(index, ruleActionableKeys(bundle));
    // All four pills: label + the count markup (computed, never a literal
    // placeholder — the renderer shows exactly what alignmentPills derives).
    for (const p of pills) {
      expect(html, `pill ${p.filter}`).toContain(`>${p.count.toLocaleString("en-US")}</span>`);
    }
    expect(html).toContain("has a migration recipe");
    // aria-pressed mirrors the active filter: All active, the other three not.
    expect(occurrences(html, 'aria-pressed="true"')).toBe(1);
    expect(occurrences(html, 'aria-pressed="false"')).toBe(3);
    // T-41: the pills are a toolbar *inside* the suggestion dropdown — they
    // sit between the query input and the listbox, in the same bordered panel
    // that hides when the list closes (no more “pills under the active item”).
    expect(html).toContain('class="suggest-panel" hidden=""');
    const order = [
      html.indexOf('id="alignment-query"'),
      html.indexOf('class="suggest-panel"'),
      html.indexOf('id="alignment-kinds"'),
      html.indexOf('id="alignment-suggest"'),
    ];
    expect(order.every((i) => i >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  test("the matrix cells are focusable buttons that carry the pin data attrs and retarget the readout", () => {
    const html = renderAlignment({ item: "fn:Window::blur" });
    // T-42: the dots are colored by the measured digest (variant α = the
    // legacy signature everywhere; β = the uno 1.19.0-pre / gpui-pre re-sign)
    expect(html).toContain('class="cell cell-dv0"');
    expect(html).toContain('class="cell cell-dv1"');
    expect(html).toContain('class="cell cell-absent"');
    expect(html).toContain('title="gpui-unofficial 1.19.0-pre (pre-release): changed\nmeasured digest variant: β bdc56592…\ndiff base: α a07c1800…"');
    expect(html).toContain("<button");
    // T-44: the pin data attrs anchor the popover to the exact cell; the
    // aria-describedby retarget (release-popover-status) applies only to the
    // pinned cell — at rest (server render, nothing pinned) no cell points at
    // a missing readout and no dock placeholder renders.
    expect(html).toContain('data-cell-provider="gpui-unofficial" data-cell-vers="1.19.0-pre"');
    expect(html).not.toContain('aria-describedby="alignment-dock-status"');
    expect(html).not.toContain('aria-describedby="release-popover-status"');
    expect(html).not.toContain('id="release-popover"');
    expect(html).not.toContain("no cell pinned");
    // click-vs-hover FSM: every matrix cell is a popup-button toggle — it
    // declares the dialog popover it controls and that it starts collapsed;
    // a pin (aria-expanded="true" + the describedby readout) is reached by
    // explicit click / Enter / Space, never by hover/focus alone, so at rest
    // (server render) no cell is expanded and no popover/missing-readout
    // leaks into the markup.
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain('aria-controls="release-popover"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('aria-expanded="true"');
    // escaped-text discipline under renderToString: the kchip title quotes
    // the item identity (double quotes), the label carries an & and the
    // item-facts tooltip carries apostrophes — all HTML-escaped.
    expect(html).toContain("&quot;fn:Window::blur&quot;");
    expect(html).toContain("&amp;");
    expect(html).toContain("&#x27;");
  });

  test("the confirmed-rule box adds the copy-recipe control (flash + polite live region)", () => {
    const html = renderAlignment({ item: "fn:profiler::record_frame_timing" });
    expect(html).toContain("Confirmed migration rules");
    // From-side box: exactly one rule row → one copy control.
    expect(occurrences(html, ">copy recipe</button>")).toBe(1);
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    // The payload is data, copied on click only — never dumped into the DOM.
    expect(html).not.toContain("// gocar migration recipe");
    expect(html).not.toContain("// rule: gpui-unofficial-1.17.2-01");
    // The to-side (successor) box carries the same affordance.
    const htmlTo = renderAlignment({ item: "fn:profiler::record_frame_event" });
    expect(htmlTo).toContain("← successor of");
    expect(occurrences(htmlTo, ">copy recipe</button>")).toBe(1);
  });
});

describe("T-44 release popover renders a pinned cell's record (server render)", () => {
  function provider(id: string) {
    const p = bundle.providers.find((x) => x.id === id);
    if (!p) throw new Error(`no provider ${id}`);
    return p;
  }

  /** The DockCell the matrix builds for one (provider, version) — rebuilt
   * exactly like MatrixStream does (cellState + digestsOf against the
   * branch base), so the popover renders the real record. */
  function cellOf(providerId: string, vers: string, key: string): DockCell {
    const p = provider(providerId);
    const vs = p.versions.map((v) => v.vers);
    const idx = vs.indexOf(vers);
    const row = p.versions[idx];
    const prev = branchBase(p.versions, idx);
    const st = cellState(key, prev, row);
    const digests = row.surface ? [...digestsOf(row.surface, key) ?? []].sort() : [];
    const prevDigests = st === "changed" && prev?.surface ? [...digestsOf(prev.surface, key) ?? []].sort() : [];
    const phrase =
      st === "same"
        ? "present (unchanged)"
        : st === "changed"
          ? "re-signed (digest changed)"
          : st === "added"
            ? "appears here"
            : st === "removed"
              ? "removed here"
              : st === "absent"
                ? "absent"
                : "not measured";
    return {
      providerId: p.id,
      vers: row.vers,
      flagTxt: row.yanked ? "yanked" : row.prerelease ? "pre-release" : "stable",
      state: st,
      phrase,
      digests,
      prevVers: prev ? prev.vers : null,
      prevDigests: prevDigests.length > 0 ? prevDigests : null,
    };
  }

  function renderPopover(
    key: string,
    cell: DockCell,
    locs: SrcLocsBundle | null = srcLocs,
  ): string {
    return renderToString(
      createElement(ReleasePopover, {
        bundle,
        itemKey: key,
        cell,
        variants: itemVariants(bundle, key),
        locs,
        memberMap: null,
        onDismiss: () => {},
      }),
    );
  }

  test("a pinned changed blur cell shows the release-unique facts: flags, transition, measured source + exit ramps — never the digest hexes", () => {
    const key = "fn:Window::blur";
    const uno = provider("gpui-unofficial");
    const vs = uno.versions.map((v) => v.vers);
    const idx = vs.indexOf("1.19.0-pre");
    expect(uno.versions[idx - 1].vers).toBe("1.18.0");
    const cell = cellOf(uno.id, "1.19.0-pre", key);
    expect(cell.state).toBe("changed");
    expect(cell.flagTxt).toBe("pre-release");
    const html = renderPopover(key, cell);
    // the channel + the RULE-6 pre-release flag chip
    expect(html).toContain("gpui-unofficial 1.19.0-pre");
    expect(html).toContain("pre-release — not a stable release (rule 6)");
    // the stream-transition status names the branch predecessor
    expect(html).toContain('id="release-popover-status"');
    expect(html).toContain("re-signed (digest changed)");
    expect(html).toContain("branch predecessor 1.18.0");
    // the variant transition names α → β without re-printing the 64-hex
    // digests or the signatures (the deck owns them — the duplication trap)
    expect(html).toContain("α → β");
    expect(html).not.toContain("a07c1800");
    expect(html).not.toContain("bdc56592");
    expect(html).not.toContain("blake3");
    expect(html).not.toContain("&amp; mut App");
    // the measured declaration source permalink (docs.rs, package + lib rule)
    expect(html).toContain(
      'href="https://docs.rs/gpui-unofficial/1.19.0-pre/src/gpui/window.rs.html#2081-2094"',
    );
    expect(html).toContain("window.rs L2081–2094");
    // the exit ramps: the predecessor → release Changes pair + the Journal row
    expect(html).toContain(
      'href="#/changes?a=gpui-unofficial%3A1.18.0&amp;b=gpui-unofficial%3A1.19.0-pre"',
    );
    expect(html).toContain("Diff in Changes");
    expect(html).toContain('href="#/journal?s=gpui-unofficial&amp;v=1.19.0-pre"');
    expect(html).toContain("in Journal");
    // the ✕ dismissal is an accessible control (aria-label, never a bare ✕)
    expect(html).toContain('aria-label="Dismiss"');
    // the mock's “SHA-256” mislabel never ships (grep guard)
    expect(html).not.toContain("SHA-256");
  });

  test("an absent cell states the honest no-source line with no fabricated continuity", () => {
    const key = "struct:accessibility::AccessibilityNode";
    const uno = provider("gpui-unofficial");
    const cell = cellOf(uno.id, "1.18.1", key);
    expect(cell.state).toBe("absent");
    const html = renderPopover(key, cell);
    expect(html).toContain("gpui-unofficial 1.18.1");
    // RULE-4: absent means absent — zero lines, no anchor, no variant claim
    expect(html).toContain("absent — no declaration in this release (rule 4)");
    expect(html).not.toContain("docs.rs");
    expect(html).not.toContain("variant");
    // the ramps stay release-level honest (a previous published row exists)
    expect(html).toContain("Diff in Changes");
  });

  test("a never-pinned view renders no popover and no inert placeholder", () => {
    const html = renderAlignment({ item: "fn:Window::blur" });
    // no cell pinned → nothing renders (the direction's empty-dock finding)
    expect(html).not.toContain('id="release-popover"');
    expect(html).not.toContain("no cell pinned");
    expect(html).not.toContain("Release inspector");
    // the dock ids are retired consistently
    expect(html).not.toContain("alignment-dock");
    expect(html).not.toContain('aria-describedby="alignment-dock-status"');
  });

  test("the source permalink stays unrendered until the sidecar resolves (RULE-7 pre-fetch state)", () => {
    const key = "fn:Window::blur";
    // any present cell with a stable state (blur is re-signed between some
    // uno rows in publish order — find a same-state row for the pre-fetch
    // assertion).
    const uno = provider("gpui-unofficial");
    let cell: DockCell | null = null;
    for (let i = 1; i < uno.versions.length && !cell; i++) {
      const c = cellOf(uno.id, uno.versions[i].vers, key);
      if (c.state === "same") cell = c;
    }
    expect(cell).not.toBeNull();
    const html = renderPopover(key, cell!, null);
    expect(html).toContain("resolving the measured declaration…");
    expect(html).not.toContain("docs.rs");
    expect(html).not.toContain("window.rs L");
  });
});

describe("T-44 the popover names a changed cell's transition without re-printing type-level facts (server render)", () => {
  function provider(id: string) {
    const p = bundle.providers.find((x) => x.id === id);
    if (!p) throw new Error(`no provider ${id}`);
    return p;
  }

  /** The DockCell of a changed (provider, version) row for `key` — the
   * pinned-record shape the matrix builds (changed cells carry their
   * branch base's digests). */
  function changedCell(providerId: string, vers: string, key: string): DockCell {
    const p = provider(providerId);
    const vs = p.versions.map((v) => v.vers);
    const idx = vs.indexOf(vers);
    const row = p.versions[idx];
    const prev = branchBase(p.versions, idx);
    const st = cellState(key, prev, row);
    if (st !== "changed") throw new Error(`expected changed at ${providerId} ${vers}, got ${st}`);
    return {
      providerId: p.id,
      vers: row.vers,
      flagTxt: row.prerelease ? "pre-release" : "stable",
      state: st,
      phrase: "re-signed (digest changed)",
      digests: [...digestsOf(row.surface, key)!].sort(),
      prevVers: prev!.vers,
      prevDigests: [...digestsOf(prev!.surface, key)!].sort(),
    };
  }

  function popoverHtml(key: string, cell: DockCell): string {
    return renderToString(
      createElement(ReleasePopover, {
        bundle,
        itemKey: key,
        cell,
        variants: itemVariants(bundle, key),
        locs: srcLocs,
        memberMap: null,
        onDismiss: () => {},
      }),
    );
  }

  test("a changed blur cell names its α → β transition and points at the measured source — the measured signature texts stay on the deck", () => {
    const key = "fn:Window::blur";
    const cell = changedCell("gpui-unofficial", "1.19.0-pre", key);
    expect(cell.prevVers).toBe("1.18.0");
    const html = popoverHtml(key, cell);
    // the transition is named in deck vocabulary (letters, no hex/no text)
    expect(html).toContain("α → β");
    expect(html).toContain("the measured signatures are on the variant cards");
    // the T-34 measured signature texts themselves render nowhere in the
    // popover — the deck cards own them (duplication-trap readout gone);
    // rule 2's type-text guard needs no digest-only fallback here because
    // the popover never prints a canonical text at all.
    expect(html).not.toContain("fn Window::blur");
    expect(html).not.toContain("&amp; mut self");
    expect(html).not.toContain("measured change vs");
    // the measured declaration of this exact release still anchors the cell
    expect(html).toContain("window.rs L2081–2094");
  });

  test("a type re-signature popover stays text- and hex-free (rule 2: type text is never dumped)", () => {
    const key = "struct:accessibility::AccessibilityNode";
    const p = provider("kael");
    const cell = changedCell(p.id, "0.2.0", key);
    expect(cell.prevVers).toBe("0.1.2");
    const html = popoverHtml(key, cell);
    // the state context names the previous published row — never a call
    // shape, never a doc-text dump (the review's cited literals stay out)
    expect(html).toContain("re-signed (digest changed)");
    expect(html).toContain("branch predecessor 0.1.2");
    expect(html).toContain("α → β");
    expect(html).not.toContain("Bounds<Pixels>");
    expect(html).not.toContain("new(role");
    expect(html).not.toContain("4d8626cd");
    expect(html).not.toContain("c5d79070");
    // the type's measured declaration still resolves (kael measured it)
    expect(html).toContain("docs.rs");
    expect(html).toContain("L");
  });

  test("a changed fn cell without a resolved source keeps the honest pre-fetch line", () => {
    const key = "fn:Window::blur";
    const cell = changedCell("gpui-unofficial", "1.19.0-pre", key);
    const html = renderToString(
      createElement(ReleasePopover, {
        bundle,
        itemKey: key,
        cell,
        variants: itemVariants(bundle, key),
        locs: null,
        memberMap: null,
        onDismiss: () => {},
      }),
    );
    expect(html).toContain("α → β");
    expect(html).not.toContain("window.rs L");
    expect(html).toContain("resolving the measured declaration…");
  });
});

describe("T-45 a stable uno cell renders the upstream github source anchor beside docs.rs (server render)", () => {
  function uno() {
    return bundle.providers.find((p) => p.id === "gpui-unofficial")!;
  }
  function presentCell(vers: string, key: string): DockCell {
    const p = uno();
    const vs = p.versions.map((v) => v.vers);
    const idx = vs.indexOf(vers);
    const row = p.versions[idx];
    const prev = branchBase(p.versions, idx);
    const st = cellState(key, prev, row);
    const present = st === "added" || st === "same" || st === "changed";
    if (!present) throw new Error(`expected a present cell at ${vers}, got ${st}`);
    const prevDigests = st === "changed" && prev?.surface ? [...digestsOf(prev.surface, key)!].sort() : [];
    const phrase =
      st === "same"
        ? "present (unchanged)"
        : st === "changed"
          ? "re-signed (digest changed)"
          : "appears here";
    return {
      providerId: p.id,
      vers: row.vers,
      flagTxt: row.prerelease ? "pre-release" : "stable",
      state: st,
      phrase,
      digests: [...digestsOf(row.surface, key)!].sort(),
      prevVers: prev ? prev.vers : null,
      prevDigests: prevDigests.length > 0 ? prevDigests : null,
    };
  }
  function htmlFor(cell: DockCell, key: string): string {
    return renderToString(
      createElement(ReleasePopover, {
        bundle,
        itemKey: key,
        cell,
        variants: itemVariants(bundle, key),
        locs: srcLocs,
        memberMap: null,
        onDismiss: () => {},
      }),
    );
  }

  test("a stable uno cell (1.18.1, a 1.18-line patch) carries the docs.rs coordinate anchor and the zed github anchor", () => {
    const key = "fn:Window::blur";
    const cell = presentCell("1.18.1", key);
    // Against its branch base (the previous stable 1.18.0, not the preview
    // 1.19.0-pre) this backport carries the legacy signature — a present,
    // unchanged stable cell, which is exactly why the source anchors render.
    expect(cell.state).toBe("same");
    expect(cell.prevVers).toBe("1.18.0");
    const html = htmlFor(cell, key);
    // the measured docs.rs anchor stays (the published crate's rustdoc, every fork)
    expect(html).toContain(
      'href="https://docs.rs/gpui-unofficial/1.18.1/src/gpui/window.rs.html#2073-2084"',
    );
    expect(html).toContain("window.rs L2073–2084");
    // the curated zed github anchor renders for this stable tag-mirrored version
    expect(html).toContain(
      'href="https://github.com/zed-industries/zed/blob/v1.18.1/crates/gpui/src/window.rs#L2073-L2084"',
    );
    // the github anchor is visibly distinct in the source token (host+ref)
    expect(html).toContain("release-source-link-gh");
    expect(html).toContain("github");
    expect(html).toContain("v1.18.1");
    // no digest hexes / signature bytes leak into the source token (the deck owns them)
    expect(html).not.toContain("a07c1800");
    expect(html).not.toContain("&amp; mut App");
  });

  test("a prerelease echo of the same item (1.19.0-pre) names its valid zed tag — github anchor too", () => {
    const key = "fn:Window::blur";
    const cell = presentCell("1.19.0-pre", key);
    const html = htmlFor(cell, key);
    expect(html).toContain("window.rs L2081–2094");
    // the docs.rs coordinate anchor shows (title attribute carries “docs.rs source view”)
    expect(html).toContain("docs.rs");
    // zed tags its 1.19.0-pre interleaving, so the prerelease row renders the github
    // anchor at v1.19.0-pre — never a fabricated ref, the curated map applies to it too
    expect(html).toContain(
      'href="https://github.com/zed-industries/zed/blob/v1.19.0-pre/crates/gpui/src/window.rs#L2081-L2094"',
    );
    expect(html).toContain("release-source-link-gh");
    expect(html).toContain("v1.19.0-pre");
  });
});

describe("T-42 digest variants render over the recorded stories (server render)", () => {
  test("a two-variant item renders one deck card per measured digest, first-measured order", () => {
    const key = "fn:Window::blur";
    const html = renderAlignment({ item: key });
    const variants = itemVariants(bundle, key);
    const prevalence = digestPrevalence(bundle, key);
    const rec = index.byKey.get(key)!;
    // one card per measured digest (RULE-7 — never a deck literal)
    expect(occurrences(html, 'class="var-card"')).toBe(variants.length);
    // cards are isolate toggles (aria-pressed mirrors the idle state)
    expect(occurrences(html, 'class="var-card" aria-pressed="false"')).toBe(variants.length);
    for (const v of variants) {
      expect(html).toContain(`<strong>Variant ${v.label}</strong>`);
      expect(html).toContain(`>${v.shortDigest}</code>`);
      const count = prevalence.get(v.digest)!;
      expect(html).toContain(`>${count.releases} release${count.releases === 1 ? "" : "s"}</span>`);
      expect(html).toContain(`>${count.forks.length} fork${count.forks.length === 1 ? "" : "s"}</span>`);
      // the forks line renders only while the deck is narrow (not “wide”)
      if (variants.length <= VARIANT_PALETTE) expect(html).toContain(count.forks.join(" · "));
    }
    // overall stats live below the deck — the hero name sits on the cards
    expect(html).toContain(`>${rec.versions} of ${counts.versions} releases</span>`);
    // neutral dot states moved to their own legend above the matrix
    expect(html).toContain('id="alignment-dot-legend"');
    expect(html).toContain('class="legend-info mono"');
    expect(html).toContain('title="dot color = the measured digest it carries · a color change within a stream is a re-signature"');
  });

  test("a single-signature item keeps the deck to one card + the dot-state legend", () => {
    const key = "fn:profiler::record_frame_timing";
    const html = renderAlignment({ item: key });
    expect(itemVariants(bundle, key).length).toBe(1);
    expect(occurrences(html, 'class="var-card"')).toBe(1);
    expect(html).toContain("<strong>Variant α</strong>");
    expect(html).not.toContain("<strong>Variant β</strong>");
    expect(html).toContain(">e7817244</code>");
    expect(html).toContain(">20 releases</span>");
    expect(html).toContain(">3 forks</span>");
    // the dot-state legend keeps the neutral words (removed here / absent /
    // not measured — the statuses a present dot's color can never show)
    expect(html).toContain("removed here");
    expect(html).toContain("absent");
    expect(html).toContain("not measured");
    // the uno removal rows keep their pale “removed here” dots (no digest)
    expect(html).toContain('class="cell cell-removed flag-pre"');
  });

  test("a changed cell's variant identity is the deck's, not the popover's (no per-row digest chips)", () => {
    const key = "fn:Window::blur";
    const uno = bundle.providers.find((x) => x.id === "gpui-unofficial")!;
    const vs = uno.versions.map((v) => v.vers);
    const idx = vs.indexOf("1.19.0-pre");
    const row = uno.versions[idx];
    const prev = branchBase(uno.versions, idx);
    const st = cellState(key, prev, row);
    const digests = [...digestsOf(row.surface, key)!].sort();
    const prevDigests = [...digestsOf(prev!.surface, key)!].sort();
    expect(st).toBe("changed");
    expect(prev!.vers).toBe("1.18.0");
    const dock: DockCell = {
      providerId: uno.id,
      vers: row.vers,
      flagTxt: "pre-release",
      state: st,
      phrase: "re-signed (digest changed)",
      digests,
      prevVers: prev!.vers,
      prevDigests,
    };
    const html = renderToString(
      createElement(ReleasePopover, {
        bundle,
        itemKey: key,
        cell: dock,
        variants: itemVariants(bundle, key),
        locs: srcLocs,
        memberMap: null,
        onDismiss: () => {},
      }),
    );
    // the popover names the letters (the same identity axis the legend and
    // matrix dots share) without re-printing the per-row digest hexes — the
    // variant chip rows the dock used to render are type-level (T-42 deck).
    expect(html).toContain("α → β");
    expect(html).not.toContain("a07c1800");
    expect(html).not.toContain("bdc56592");
    expect(html).not.toContain("dock-var");
    expect(html).not.toContain("previous published row (1.18.0) — digest");
  });
});

describe("T-42 variant chips resolve their measured fn text from the sidecar (server render)", () => {
  const sidecar = validateFnTexts(
    JSON.parse(readFileSync(join(HERE, "..", "..", "forkmap", "data", "forkmap-fn-texts.json"), "utf8")),
  );

  test("fn variant chips render α/β with their measured signatures (digest + counts move to the tooltip)", () => {
    const key = "fn:Window::blur";
    const variants = itemVariants(bundle, key);
    const texts = fnDigestTexts(sidecar, bundle.providers, key);
    expect(texts.size).toBe(2);
    const html = renderToString(
      createElement(VariantLegend, {
        variants,
        prevalence: digestPrevalence(bundle, key),
        texts,
        isolated: null,
        onToggle: () => {},
      }),
    );
    // the measured signatures render verbatim (HTML-escaped &) on the cards
    expect(html).toContain('<code class="var-sig mono">fn Window::blur(&amp; mut self)</code>');
    expect(html).toContain('<code class="var-sig mono">fn Window::blur(&amp; mut self, &amp; mut App)</code>');
    // digest + forks facts ride the card pills and tooltips, never prose
    expect(html).toContain("first measured at gpui-unofficial 1.19.0-pre");
    expect(html).not.toContain("61 rel · 5 forks");
  });

  test("type variants never resolve a signature — chips stay digest-only (rule 2)", () => {
    const key = "struct:accessibility::AccessibilityNode";
    const variants = itemVariants(bundle, key);
    const texts = fnDigestTexts(sidecar, bundle.providers, key);
    expect(texts.size).toBe(0);
    const html = renderToString(
      createElement(VariantLegend, {
        variants,
        prevalence: digestPrevalence(bundle, key),
        texts,
        isolated: null,
        onToggle: () => {},
      }),
    );
    expect(html).toContain('class="var-card" aria-pressed="false"');
    expect(html).toContain(">4d8626cd</code>");
    expect(html).toContain(">c5d79070</code>");
    expect(html).not.toContain("var-sig");
  });
});

describe("T-43 docstrings render the promoted Title + measured deltas (server render)", () => {
  // The selected items' payload fragments (projected from the committed
  // whole sidecars at module scope — the same bytes the committed bucket
  // files carry), injected through AlignmentView's optional prop exactly as
  // the runtime lazy bucket hook supplies them once fetched — the render
  // suite asserts the post-load resting DOM (the no-payload state is
  // asserted separately below: digest-only, no Title yet).
  // renderToString escapes apostrophes as &#x27; in text AND attributes, so the
  // count needle is the escaped form (the DOM textContent would decode it).
  const SENTENCE = "Remove focus from all elements within this context&#x27;s window.";

  test("blur's shared docstring renders exactly once — the Title, never the cards (no-duplication)", () => {
    const html = renderAlignment({ item: "fn:Window::blur" }, payloadOf("fn:Window::blur"));
    // the acceptance's no-duplication guarantee: the sentence appears once in
    // the whole resting DOM — the promoted Title — while the two digest-variant
    // cards render signature-only
    expect(occurrences(html, SENTENCE)).toBe(1);
    expect(html).toContain('id="alignment-item-doc"');
    const story = itemDocStory(bundle, "fn:Window::blur", docSidecar)!;
    expect(story.docs.length).toBe(1);
    expect(html).toContain(docTitleCap(story));
    // the sentence lives above the deck; nothing below the deck repeats it
    const deckStart = html.indexOf('class="deck"');
    expect(deckStart).toBeGreaterThan(0);
    expect(html.slice(deckStart)).not.toContain(SENTENCE);
  });

  test("before the lazy payload bucket lands the item renders digest-only — no Title (honest pre-fetch state)", () => {
    const html = renderAlignment({ item: "fn:Window::blur" });
    expect(occurrences(html, SENTENCE)).toBe(0);
    expect(html).not.toContain('id="alignment-item-doc"');
  });

  test("before the item's column bucket lands the item area shows the honest loading state (T-33 increment 5)", () => {
    const html = renderAlignmentBeforeColumn({ item: "fn:Window::blur" });
    expect(html).toContain("Loading this item&#x27;s digest column…");
    expect(html).toContain('role="status"');
    // The matrix + deck need the digest state — nothing is invented while the
    // bucket is in flight, and the rest of the page (search, docs) still
    // renders (never a dead-end).
    expect(html).not.toContain('class="matrix"');
    expect(html).not.toContain('id="alignment-variants"');
    expect(html).toContain("Search measured items");
  });

  test("FileWatcher::new renders the baseline Title + the β card's measured doc-delta chip", () => {
    const html = renderAlignment({ item: "fn:FileWatcher::new" }, payloadOf("fn:FileWatcher::new"));
    // the native docstring (first measured, kael 0.1.1) anchors the Title
    expect(html).toContain("Creates a file watcher that dispatches callbacks on the given app&#x27;s");
    expect(html).toContain(docTitleCap(itemDocStory(bundle, "fn:FileWatcher::new", docSidecar)!));
    // exactly one delta chip — the β (browser) variant card, never the α card
    expect(occurrences(html, 'class="doc-delta mono"')).toBe(1);
    // the chip face is the measured line counts; the tooltip carries the
    // measured bytes: the variant doc + the baseline → variant line diff
    expect(html).toContain(">-2 +1</span>");
    expect(html).toContain("Create a browser file-watcher placeholder.");
    expect(html).toContain("- Creates a file watcher that dispatches callbacks on the given app&#x27;s");
    expect(html).toContain("- foreground executor.");
    expect(html).toContain("+ Create a browser file-watcher placeholder.");
  });

  test("register_url_scheme: within-digest divergence renders no chip — the deck's axis cannot host it", () => {
    const html = renderAlignment({ item: "fn:App::register_url_scheme" }, payloadOf("fn:App::register_url_scheme"));
    // the baseline (zed-era) docstring anchors the Title; the caption reports
    // the measured divergence
    expect(html).toContain("Registers the given URL scheme (e.g. `zed` for `zed://` urls)");
    expect(html).toContain(docTitleCap(itemDocStory(bundle, "fn:App::register_url_scheme", docSidecar)!));
    // the zed→kael fork-rename doc drifted within its one digest (a doc edit
    // never re-signs) — no variant-level doc exists, so no chip renders and
    // the kael text is never placed (the honest boundary, recorded in T-43)
    expect(occurrences(html, 'class="doc-delta mono"')).toBe(0);
    expect(html).not.toContain("kael://");
  });

  test("types keep the digest-only treatment — no Title and no chips, payload or not (decision 1(a))", () => {
    const html = renderAlignment({ item: "struct:accessibility::AccessibilityNode" }, payloadOf("struct:accessibility::AccessibilityNode"));
    expect(html).not.toContain('id="alignment-item-doc"');
    expect(html).not.toContain("doc-delta");
    expect(html).toContain("Measured digest variants");
  });
});
