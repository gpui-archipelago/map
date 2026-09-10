// T-34 — re-signed-row render tests (server render over the committed bundle
// + sidecar).
//
// ResignedRowExtra is the shared row annotation of the Changes diff and the
// Journal feed: single-variant fn keys render their measured before/after
// signature (or the "signature unchanged, gate change" line when the digest
// moved on the cfg prefix); types, multi-variant fn keys and unresolved
// texts keep the digest-only treatment with the reason stated.

import { describe, expect, test } from "bun:test";
import { renderToString } from "react-dom/server";
import { createElement } from "react";
import { ResignedRowExtra } from "../src/components/rows";
import { validateBundle, validateFnTexts, validateTypeMembers, cfgGatesOf, digestAt, typeMemberDelta } from "../src/bundle";
import type { ForkmapBundle, FnTextsBundle, KeyMemberVectors, Provider, Side, TypeMembersBundle, VersionRow } from "../src/bundle";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const BUNDLE_PATH = join(HERE, "..", "..", "forkmap", "data", "forkmap.json");
const TEXTS_PATH = join(HERE, "..", "..", "forkmap", "data", "forkmap-fn-texts.json");
const MEMBERS_PATH = join(HERE, "..", "..", "forkmap", "data", "forkmap-type-members.json");

const bundle: ForkmapBundle = validateBundle(JSON.parse(readFileSync(BUNDLE_PATH, "utf8")));
const texts: FnTextsBundle = validateFnTexts(JSON.parse(readFileSync(TEXTS_PATH, "utf8")));
const anchor: TypeMembersBundle = validateTypeMembers(JSON.parse(readFileSync(MEMBERS_PATH, "utf8")));
const vecsFor = (key: string): KeyMemberVectors => anchor.vectors[key] ?? {};

function provider(id: string): Provider {
  const p = bundle.providers.find((x) => x.id === id);
  if (!p) throw new Error(`no provider ${id}`);
  return p;
}

function row(p: Provider, vers: string): VersionRow {
  const r = p.versions.find((v) => v.vers === vers);
  if (!r) throw new Error(`no row ${p.id} ${vers}`);
  return r;
}

function side(p: Provider, vers: string): Side {
  return { provider: p, vers };
}

function renderNote(
  itemKey: string,
  aRow: VersionRow,
  a: Side,
  bRow: VersionRow,
  b: Side,
  memberMap: TypeMembersBundle | null = null,
) {
  return renderToString(createElement(ResignedRowExtra, { texts, memberMap, aRow, a, bRow, b, itemKey }));
}

describe("ResignedRowExtra renders the measured signature change (T-34)", () => {
  test("doc-12: blur's before/after signature renders for uno 1.18.1 → 1.19.0-pre", () => {
    const uno = provider("gpui-unofficial");
    const a = side(uno, "1.18.1");
    const b = side(uno, "1.19.0-pre");
    const html = renderNote("fn:Window::blur", row(uno, a.vers), a, row(uno, b.vers), b);
    expect(html).toContain("re-signature — measured signature changed:");
    expect(html).toContain("fn Window::blur(&amp; mut self)</code>");
    expect(html).toContain("fn Window::blur(&amp; mut self, &amp; mut App)</code>");
    expect(html).toContain("sig-change");
    expect(html).toContain("parameter types, never names");
  });

  test("doc-09: a gate-only re-signature states the unchanged text and the gate move", () => {
    const uno = provider("gpui-unofficial");
    const a = side(uno, "1.16.3");
    const b = side(uno, "1.17.2");
    const key = "fn:profiler::FrameTiming::draw_duration";
    const html = renderNote(key, row(uno, a.vers), a, row(uno, b.vers), b);
    expect(html).toContain("the measured signature text is unchanged");
    expect(html).toContain("fn profiler::FrameTiming::draw_duration(&amp; self)-&gt; Duration");
    expect(html).toContain("cfg (feature = &quot;profiler&quot;)");
    expect(html).toContain("provenance, never evaluation");
  });

  test("a re-signed member-bearing type rows the measured pub-member delta (T-47 2b)", () => {
    // The real kael story: accessibility::AccessibilityNode re-signed between
    // 0.1.2 and 0.2.0 on a consumer-visible member change. With the
    // type-members sidecar loaded the row names the members that moved — a
    // set difference of the analyzer's own digest segments, never a
    // reconstruction.
    const kael = provider("kael");
    // 0.1.1 is the accessibility module's first measured row (the member
    // vector's baseline anchor) and 0.2.0 re-signed the struct — both sides
    // carry a measured vector, so the set difference is real.
    const a = side(kael, "0.1.1");
    const b = side(kael, "0.2.0");
    const key = "struct:accessibility::AccessibilityNode";
    const html = renderNote(key, row(kael, a.vers), a, row(kael, b.vers), b, anchor);
    expect(html).toContain("measured pub members that moved");
    expect(html).toContain("consumer-visible members only");
    expect(html).toContain("member-delta");
    expect(html).not.toContain("sig-change");
    // At least one segment moved on one side, and every rendered segment is
    // one of the two releases' measured vectors (measured, never invented).
    const delta = typeMemberDelta(vecsFor(key), key, digestAt(row(kael, a.vers), key), digestAt(row(kael, b.vers), key));
    expect(delta).not.toBeNull();
    const at = (vers: string) => vecsFor(key)[digestAt(row(kael, vers), key) ?? ""] ?? [];
    const all = new Set([...at(a.vers), ...at(b.vers)]);
    // React escapes `<`/`>`/`&` in text children — assert the escaped form so
    // the check is exact.
    const escapeHtml = (t: string) =>
      t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    for (const seg of [...delta!.removed, ...delta!.added]) {
      expect(all.has(seg)).toBe(true);
      expect(html).toContain(escapeHtml(seg));
    }
  });

  test("without the member sidecar a re-signed type states the pub-only policy (honest fallback)", () => {
    const kael = provider("kael");
    const a = side(kael, "0.1.1");
    const b = side(kael, "0.2.0");
    const html = renderNote("struct:accessibility::AccessibilityNode", row(kael, a.vers), a, row(kael, b.vers), b, null);
    expect(html).toContain("digest changed");
    expect(html).toContain("consumer-visible pub members only");
    expect(html).toContain("private/pub(crate) members never re-sign");
    expect(html).not.toContain("sig-change");
    expect(html).not.toContain("member-delta");
  });

  test("a doc-only / private-only type change never re-signs, so no delta renders", () => {
    // struct:Window's pub surface never changed across the corpus (T-47 1a):
    // its digest is one value, so a pair that did not re-sign must resolve no
    // member delta at all — the honest no-op.
    const uno = provider("gpui-unofficial");
    const a = side(uno, "1.16.1");
    const b = side(uno, "1.16.3");
    expect(
      typeMemberDelta(
        vecsFor("struct:Window"),
        "struct:Window",
        digestAt(row(uno, a.vers), "struct:Window"),
        digestAt(row(uno, b.vers), "struct:Window"),
      ),
    ).toBeNull();
  });

  test("a multi-variant fn key states why no single before/after is drawn", () => {
    const uno = provider("gpui-unofficial");
    const a = side(uno, "1.16.1");
    const b = side(uno, "1.19.0-pre");
    const html = renderNote(
      "fn:profiler::ThreadTimings::save_task_timing",
      row(uno, a.vers),
      a,
      row(uno, b.vers),
      b,
    );
    expect(html).toContain("multiple signatures in one of the compared releases");
    expect(html).not.toContain("sig-change");
  });

  test("T-50/T-51 acceptance: the preview pair GestureTuning 1.18.0 → 1.19.0-pre names the swapped fields on the row", () => {
    // The corpus order is 1.18.0-pre, 1.18.0, 1.19.0-pre, 1.18.1 — so the
    // preview's branch predecessor is 1.18.0 (NOT 1.18.1, which publishes
    // after it). Both endpoints resolve out of the one shared map, and the row
    // itself — not only the popover — carries the measured delta.
    const uno = provider("gpui-unofficial");
    const key = "struct:GestureTuning";
    const a = side(uno, "1.18.0");
    const b = side(uno, "1.19.0-pre");
    const html = renderNote(key, row(uno, a.vers), a, row(uno, b.vers), b, anchor);
    expect(html).toContain("measured pub members that moved");
    expect(html).toContain("momentum_decay_per_ms : f32");
    expect(html).toContain("scroll_physics : ScrollPhysics");
    // Removal and addition are distinguished, not just listed.
    expect(html).toContain("member-removed");
    expect(html).toContain("member-added");
    // The measured delta matches the source-level field swap exactly.
    const delta = typeMemberDelta(
      vecsFor(key),
      key,
      digestAt(row(uno, a.vers), key),
      digestAt(row(uno, b.vers), key),
    );
    expect(delta).toEqual({
      removed: ["momentum_decay_per_ms : f32"],
      added: ["scroll_physics : ScrollPhysics"],
    });
  });

  test("without the sidecar nothing renders as a signature (honest fallback)", () => {
    const uno = provider("gpui-unofficial");
    const a = side(uno, "1.18.1");
    const b = side(uno, "1.19.0-pre");
    const html = renderToString(
      createElement(ResignedRowExtra, {
        texts: null,
        aRow: row(uno, a.vers),
        a,
        bRow: row(uno, b.vers),
        b,
        itemKey: "fn:Window::blur",
      }),
    );
    expect(html).toContain("signature text not resolved for one side");
    expect(html).not.toContain("sig-change");
  });

  test("cfg gates stay data on the bundle side, readable per row", () => {
    const uno = provider("gpui-unofficial");
    const v172 = row(uno, "1.17.2");
    expect(cfgGatesOf(v172, "fn:profiler::record_frame_event")).toEqual(['cfg (feature = "profiler")']);
    expect(cfgGatesOf(row(uno, "1.16.3"), "fn:Window::blur")).toEqual([]);
  });
});
