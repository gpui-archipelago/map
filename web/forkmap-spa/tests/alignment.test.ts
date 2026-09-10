// T-39 — Alignment-view parity tests (increment 3).
//
// Pure-data assertions over the committed bundle mirroring what the Alignment
// view renders (the matrix cell states, per-stream summary chips and the
// type-ahead index — web/forkmap/check.py asserted the same stories on the
// static site's derivations until the static renderer retired — the suite
// lives here now):
//   - searchIndex finds the recorded presets (exact → prefix → substring);
//   - buildIndex counts a version once per key and carries the kind/name;
//   - streamCallouts over the recorded stories produce the chips the view
//     renders ("✕ first removed at …", "~ first re-signed at …", "✓ present
//     throughout", "— never measured on this stream");
//   - id coverage: every `alignment-*`/`view-alignment` id app.js binds must
//     exist in the SPA's AlignmentView source.

import { describe, expect, test } from "bun:test";
import {
  ALIGNMENT_PRESETS,
  ALIGN_MIN_QUERY,
  ALIGN_SUGGEST_CAP,
  alignmentPills,
  alignmentQuerySearchable,
  alignmentSuggestionWindow,
  buildIndex,
  cellState,
  changedSignatureDelta,
  digestPrevalence,
  digestsOf,
  filterAlignmentKeys,
  fnDigestTexts,
  itemVariants,
  ruleActionableKeys,
  ruleCopyPayload,
  rulesFrom,
  rulesTo,
  searchIndex,
  splitKey,
  streamCallouts,
  streamPartition,
  streamVariantSteps,
  digestAt,
  variantLabel,
} from "../src/bundle/derive";
import { TYPE_MEMBERS_SCHEMA } from "../src/bundle";
import type { ForkmapBundle, ItemVariant, KeyMemberVectors, Provider, VersionRow } from "../src/bundle";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadBundle } from "./stories.test";
import { indexIndex } from "../src/bundle/alignmentSlice";
import { validateAlignIndex, validateFnTexts, validateTypeMembers } from "../src/bundle/validate";
import { STATIC_RENDERER_IDS } from "./fixtures/static-renderer-ids";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "..", "src");

const bundle = loadBundle();

// The committed type-members sidecar (T-47 decision 2b), loaded exactly as
// the SPA fetches it (validateTypeMembers).
const members = validateTypeMembers(
  JSON.parse(readFileSync(join(HERE, "..", "..", "forkmap", "data", "forkmap-type-members.json"), "utf8")),
);

/** The fragment-shaped member map for one item (`digest -> segments`, T-50):
 * what the per-key payload fragment carries, derived here from the committed
 * normalized anchor so the tests exercise the shipped content. */
const vecsFor = (key: string): KeyMemberVectors => members.vectors[key] ?? {};

/** One release's measured member vector for `key`, resolved the way a view
 * resolves it: through the digest that release's own surface row carries. */
const memberVecAt = (providerId: string, vers: string, key: string): string[] | null => {
  const p = bundle.providers.find((x) => x.id === providerId);
  const row = p?.versions.find((v) => v.vers === vers);
  if (!row) return null;
  const digest = digestAt(row, key);
  return digest ? (members.vectors[key]?.[digest] ?? null) : null;
};
const index = buildIndex(bundle);

function providerMap(b: ForkmapBundle): Record<string, Provider> {
  return Object.fromEntries(b.providers.map((p) => [p.id, p]));
}

describe("the corpus index (buildIndex/searchIndex) the combobox is built on", () => {
  test("every preset key is in the index with kind + name split", () => {
    for (const key of ALIGNMENT_PRESETS) {
      const rec = index.byKey.get(key);
      expect(rec, `preset ${key}`).toBeTruthy();
      expect(`${rec!.kind}:${rec!.name}`).toBe(key);
      expect(rec!.versions).toBeGreaterThan(0);
    }
  });

  test("searchIndex ranks exact before prefix before substring", () => {
    // Exact kind:name first …
    expect(searchIndex(index, "struct:accessibility::AccessibilityNode")[0]).toBe(
      "struct:accessibility::AccessibilityNode",
    );
    // … then prefix matches (a name fragment) …
    const prefix = searchIndex(index, "record_frame_timing");
    expect(prefix[0]).toBe("fn:profiler::record_frame_timing");
    // … and substring matches always trail; no matches for garbage.
    expect(searchIndex(index, "no-such-item-xyz")).toEqual([]);
    expect(searchIndex(index, "   ")).toEqual([]);
  });

  test("a release row is counted once per key across the whole corpus", () => {
    // Every index count is the union of the per-provider counts (once per
    // release row, never twice for a row measured under several digests).
    const manual = (key: string) =>
      bundle.providers.reduce(
        (n, p) => n + p.versions.filter((v) => v.surface && v.surface.some((i) => i.key === key)).length,
        0,
      );
    for (const key of ALIGNMENT_PRESETS) {
      expect(index.byKey.get(key)!.versions, key).toBe(manual(key));
    }
    // A key measured by several providers still counts each row once.
    expect(index.byKey.get("fn:Window::blur")!.versions).toBe(manual("fn:Window::blur"));
  });
});

describe("T-46 type-ahead interaction policy (bounded window + min-query floor)", () => {
  // The view's second index constructor (indexIndex over the committed align
  // index — the file the served app loads) must search identically to
  // buildIndex's over the full corpus; both fill CorpusIndex.search.
  const alignIndex = indexIndex(
    validateAlignIndex(
      JSON.parse(readFileSync(join(HERE, "..", "..", "forkmap", "data", "forkmap-align-index.json"), "utf8")),
    ),
  );

  test("searchIndex output is unchanged by the precomputed-lowercase scan (parity with the per-keystroke port)", () => {
    const manual = (q: string) => {
      const lq = q.trim().toLowerCase();
      if (!lq) return [];
      const exact: string[] = [];
      const prefix: string[] = [];
      const rest: string[] = [];
      for (const key of index.keys) {
        const k = key.toLowerCase();
        if (k === lq) exact.push(key);
        else if (k.startsWith(lq)) prefix.push(key);
        else if (k.includes(lq)) rest.push(key);
      }
      return [...exact, ...prefix, ...rest];
    };
    const queries = [
      "w",
      "wi",
      "win",
      "Window",
      "blur",
      "fn:",
      "record_frame_timing",
      " struct:accessibility::AccessibilityNode ",
      "no-such-item-xyz",
      "",
      "   ",
      ..."abcdefghijklmnopqrstuvwxyz",
    ];
    for (const q of queries) {
      expect(searchIndex(index, q), `query ${JSON.stringify(q)}`).toEqual(manual(q));
      // The index built from the committed align-index file matches too.
      expect(searchIndex(alignIndex, q), `align-index query ${JSON.stringify(q)}`).toEqual(manual(q));
    }
    // The precomputed list really is the keys lowercased, in order.
    for (let i = 0; i < index.keys.length; i++) expect(index.search[i]).toBe(index.keys[i].toLowerCase());
    for (let i = 0; i < alignIndex.keys.length; i++) expect(alignIndex.search[i]).toBe(alignIndex.keys[i].toLowerCase());
  });

  test("the window keeps the full match set's order and reports the rest honestly (RULE-7)", () => {
    for (const q of ["w", "fn:", "win", "blur", "record_frame_timing", ""]) {
      const matches = searchIndex(index, q);
      const { shown, more } = alignmentSuggestionWindow(matches);
      expect(shown.length).toBe(Math.min(matches.length, ALIGN_SUGGEST_CAP));
      expect(more).toBe(Math.max(0, matches.length - ALIGN_SUGGEST_CAP));
      expect(shown.length + more).toBe(matches.length); // nothing is dropped, only un-rendered
      expect(shown).toEqual(matches.slice(0, ALIGN_SUGGEST_CAP)); // a prefix: order parity holds
      expect([...shown, ...matches.slice(ALIGN_SUGGEST_CAP)]).toEqual(matches);
    }
    // The broad queries (the recorded worst cases): each exceeds the cap, so
    // the window shows the cap and reports the remainder honestly; a narrow
    // query renders every row and no more-row.
    const broadMatches = searchIndex(index, "w");
    expect(broadMatches.length).toBeGreaterThan(ALIGN_SUGGEST_CAP);
    const broad = alignmentSuggestionWindow(broadMatches);
    expect(broad.shown.length).toBe(ALIGN_SUGGEST_CAP);
    expect(broad.more).toBe(broadMatches.length - ALIGN_SUGGEST_CAP);
    const fnMatches = searchIndex(index, "fn:");
    expect(fnMatches.length).toBeGreaterThan(ALIGN_SUGGEST_CAP);
    const fnPrefix = alignmentSuggestionWindow(fnMatches);
    expect(fnPrefix.shown.length).toBe(ALIGN_SUGGEST_CAP);
    expect(fnPrefix.more).toBe(fnMatches.length - ALIGN_SUGGEST_CAP);
    const narrow = alignmentSuggestionWindow(searchIndex(index, "blur"));
    expect(narrow.more).toBe(0);
    expect(narrow.shown).toEqual(searchIndex(index, "blur"));
    expect(alignmentSuggestionWindow([])).toEqual({ shown: [], more: 0 });
  });

  test("the min-query floor stops exactly the all-browse 1-char queries", () => {
    expect(ALIGN_MIN_QUERY).toBe(2);
    expect(alignmentQuerySearchable("")).toBe(false);
    expect(alignmentQuerySearchable("   ")).toBe(false);
    for (const q of "abcdefghijklmnopqrstuvwxyz") {
      expect(alignmentQuerySearchable(q), `1-char ${q}`).toBe(false);
      // Grounding fact the floor is recorded on: over this corpus no 1-char
      // query is a plausible target — all 26 are browse (> the cap). A corpus
      // refresh that changes this fails loudly here (see derive.ts ALIGN_MIN_QUERY).
      expect(searchIndex(index, q).length).toBeGreaterThan(ALIGN_SUGGEST_CAP);
    }
    expect(alignmentQuerySearchable("wi")).toBe(true); // 2-char searches run
    expect(alignmentQuerySearchable("fn:")).toBe(true); // kind prefixes are exactly 3 chars
    expect(alignmentQuerySearchable(" Window::blur ")).toBe(true); // trimmed
  });

  test("the window applies after the kind quick filter (the pills act over the searched list)", () => {
    const { shown, more } = alignmentSuggestionWindow(filterAlignmentKeys("fn", searchIndex(index, "w"), new Set()));
    expect(shown.every((k) => splitKey(k)[0] === "fn")).toBe(true);
    expect(more).toBe(filterAlignmentKeys("fn", searchIndex(index, "w"), new Set()).length - 100);
    const rule = alignmentSuggestionWindow(filterAlignmentKeys("rule", searchIndex(index, "record_frame"), ruleActionableKeys(bundle)));
    expect(rule.shown).toEqual(["fn:profiler::record_frame_event", "fn:profiler::record_frame_timing"]);
    expect(rule.more).toBe(0);
  });
});

describe("per-stream matrix chips over the recorded stories (streamCallouts)", () => {
  test("kael AccessibilityNode: re-signed once at 0.2.0, never removed → the view's chips", () => {
    const kael = providerMap(bundle)["kael"];
    const c = streamCallouts(kael, "struct:accessibility::AccessibilityNode");
    expect(c.present).toBe(true);
    expect(c.firstChanged).toBe(2); // 0.2.0
    expect(kael.versions[c.firstChanged].vers).toBe("0.2.0");
    expect(c.firstRemoved).toBe(-1);
    // The recorded cell run the matrix renders: added/same → same → changed.
    const states = kael.versions.slice(0, 3).map((v, i) => cellState("struct:accessibility::AccessibilityNode", i > 0 ? kael.versions[i - 1] : null, v));
    expect(states[0]).toBe("added");
    expect(states[1]).toBe("same");
    expect(states[2]).toBe("changed");
  });

  test("uno record_frame_timing: never re-signed after its 1.7.2 addition; first removed at the recorded pre row", () => {
    const uno = providerMap(bundle)["gpui-unofficial"];
    const c = streamCallouts(uno, "fn:profiler::record_frame_timing");
    expect(c.present).toBe(true);
    expect(c.firstChanged).toBe(-1); // no digest change after its 1.7.2 addition
    expect(c.firstRemoved).toBe(36);
    expect(uno.versions[c.firstRemoved].vers).toBe("1.17.0-pre");
    // The honest cell run the matrix renders: present through 1.16.1, dropped
    // by the 1.17.0-pre row, re-added by the 1.16.2 republish, dropped for
    // real at 1.17.2 (the recorded story). Never “fixed” to a clean run.
    const vs = uno.versions.map((v) => v.vers);
    const stateAt = (vers: string) =>
      cellState("fn:profiler::record_frame_timing", uno.versions[vs.indexOf(vers) - 1], uno.versions[vs.indexOf(vers)]);
    expect(stateAt("1.16.1")).toBe("same");
    expect(stateAt("1.17.0-pre")).toBe("removed");
    expect(stateAt("1.16.2")).toBe("added");
    expect(stateAt("1.17.2")).toBe("removed");
  });

  test("a key absent from a stream reports absent with no callouts", () => {
    const uno = providerMap(bundle)["gpui-unofficial"];
    const c = streamCallouts(uno, "struct:accessibility::AccessibilityNode");
    expect(c.present).toBe(false);
    expect(c.firstChanged).toBe(-1);
    expect(c.firstRemoved).toBe(-1);
  });

  test("fn:Window::blur stays present on kael with no re-signature", () => {
    const kael = providerMap(bundle)["kael"];
    const c = streamCallouts(kael, "fn:Window::blur");
    expect(c.present).toBe(true);
    expect(c.firstChanged).toBe(-1);
    expect(c.firstRemoved).toBe(-1);
  });
});

describe("Alignment view ids survive in the SPA source (id coverage tripwire)", () => {
  // The static check.py used to assert every id app.js binds exists in
  // index.html. Since the static renderer retired (T-39 increment 6) the
  // contract is the frozen snapshot in tests/fixtures/static-renderer-ids.ts
  // (generated with app.js's getElementById + closest rules): the Alignment
  // view's ids (`alignment-*` + `view-alignment`) must exist in the SPA's
  // JSX, and honest-rule-1…7 must live in the AboutNote the view renders.
  const boundAlignmentIds = new Set<string>([...STATIC_RENDERER_IDS.alignment]);
  expect(boundAlignmentIds.size).toBeGreaterThan(0);

  const alignmentSrc = readFileSync(join(SRC, "views", "AlignmentView.tsx"), "utf8");
  for (const id of boundAlignmentIds) {
    expect(alignmentSrc, `id "${id}" exists in the AlignmentView source`).toContain(`id="${id}"`);
  }
});

describe("T-40 quick filters: the kind pills + ⚡ rule actionability", () => {
  test("the ⚡ lookup is exactly the rule store's touched keys (from/to sides)", () => {
    const actionable = ruleActionableKeys(bundle);
    const touched = new Set<string>();
    for (const r of bundle.rules) {
      touched.add(r.from.key);
      touched.add(r.to.key);
    }
    expect(actionable).toEqual(touched);
    expect([...actionable].sort()).toEqual([
      "fn:profiler::record_frame_event",
      "fn:profiler::record_frame_timing",
    ]);
    // …and an item “has a migration recipe” iff the confirmed-rule box's own
    // lookup (rulesFrom/rulesTo) finds one — the ⚡ pill is never a separate
    // registry.
    expect(rulesFrom(bundle, "fn:profiler::record_frame_timing").length).toBeGreaterThan(0);
    expect(rulesTo(bundle, "fn:profiler::record_frame_event").length).toBeGreaterThan(0);
    expect(actionable.has("fn:Window::blur")).toBe(false);
    expect(rulesFrom(bundle, "fn:Window::blur")).toEqual([]);
    expect(rulesTo(bundle, "fn:Window::blur")).toEqual([]);
  });

  test("pill counts are computed from the index (RULE-7)", () => {
    const pills = alignmentPills(index, ruleActionableKeys(bundle));
    expect(pills.map((p) => p.filter)).toEqual(["all", "fn", "struct", "rule"]);
    expect(pills.map((p) => p.label)).toEqual(["All", "fn", "struct", "has a migration recipe"]);
    // RULE-7: every count equals a manual computation over the loaded bundle.
    const manualKind = (kind: string) => index.keys.filter((k) => splitKey(k)[0] === kind).length;
    expect(pills[0].count).toBe(index.keys.length);
    expect(pills[1].count).toBe(manualKind("fn"));
    expect(pills[2].count).toBe(manualKind("struct"));
    expect(pills[3].count).toBe([...ruleActionableKeys(bundle)].filter((k) => index.byKey.has(k)).length);
  });

  test("filterAlignmentKeys implements the pill semantics over suggestions", () => {
    const actionable = ruleActionableKeys(bundle);
    const sample = searchIndex(index, "record_frame");
    expect(sample.length).toBeGreaterThan(0);
    expect(filterAlignmentKeys("all", sample, actionable)).toEqual(sample);
    expect(filterAlignmentKeys("fn", sample, actionable)).toEqual(sample.filter((k) => splitKey(k)[0] === "fn"));
    expect(filterAlignmentKeys("rule", sample, actionable)).toEqual([
      "fn:profiler::record_frame_event",
      "fn:profiler::record_frame_timing",
    ]);
    // blur matches a fn identity (the doc-12 story) and a struct with the
    // blur matches a fn identity (the doc-12 story) and a struct with the
    // same stem — the kind pills split exactly on the measured kind.
    const blur = searchIndex(index, "blur");
    expect(blur).toContain("fn:Window::blur");
    expect(filterAlignmentKeys("struct", blur, actionable)).toEqual(
      blur.filter((k) => splitKey(k)[0] === "struct"),
    );
    expect(filterAlignmentKeys("rule", blur, actionable)).toEqual([]);
  });
});

describe("T-40 recipe-copy payload (byte-pinned, comment-only)", () => {
  test("the payload is the seed rule's machine-checkable essence — all dataset", () => {
    expect(bundle.rules.length).toBe(1);
    const payload = ruleCopyPayload(bundle.rules[0]);
    expect(payload).toBe(
      "// gocar migration recipe — dataset-vouched, never compile-vouched (doc 09)\n" +
        "// rule: gpui-unofficial-1.17.2-01\n" +
        "// from: fn:profiler::record_frame_timing\n" +
        "// to: fn:profiler::record_frame_event\n" +
        "// measured transition: gpui-unofficial 1.16.1 → gpui-unofficial 1.17.2",
    );
    // comment-only: nothing pretends to be source (no call-shape bytes).
    expect(payload.split("\n").every((l) => l.startsWith("//"))).toBe(true);
    expect(payload).not.toContain("fn ");
  });
});

describe("T-40 inspection-dock digest prevalence (N releases · M forks)", () => {
  test("digestPrevalence counts every measured row carrying the (key, digest) record", () => {
    const uno = providerMap(bundle)["gpui-unofficial"];
    const row181 = uno.versions.find((v) => v.vers === "1.18.1")!;
    const key = "fn:Window::blur";
    const at181 = [...digestsOf(row181.surface, key)!];
    expect(at181.length).toBe(1);
    const digest = at181[0];
    const map = digestPrevalence(bundle, key);
    const rec = map.get(digest);
    expect(rec).toBeTruthy();
    // Manual scan: same counting rule (a measured row carrying the record
    // counts once; forks are the distinct carriers).
    let releases = 0;
    const forks = new Set<string>();
    for (const p of bundle.providers) {
      for (const v of p.versions) {
        if (v.surface && v.surface.some((i) => i.key === key && i.digest === digest)) {
          releases += 1;
          forks.add(p.id);
        }
      }
    }
    expect(rec!.releases).toBe(releases);
    expect(rec!.forks).toEqual([...forks].sort());
    // The doc-12 fact: the old blur signature spans releases + forks, the new
    // one lives on the pre-split row and gpui-pre's stream.
    expect(releases).toBeGreaterThan(1);
    expect(forks.size).toBeGreaterThan(1);
  });

  test("the two measured blur generations resolve to distinct prevalence records", () => {
    const uno = providerMap(bundle)["gpui-unofficial"];
    const key = "fn:Window::blur";
    const map = digestPrevalence(bundle, key);
    const oldD = [...digestsOf(uno.versions.find((v) => v.vers === "1.18.1")!.surface, key)!][0];
    const newD = [...digestsOf(uno.versions.find((v) => v.vers === "1.19.0-pre")!.surface, key)!][0];
    expect(oldD).not.toBe(newD);
    expect(oldD).toMatch(/^[0-9a-f]{64}$/); // blake3 64-hex — never “SHA-256”
    const oldRec = map.get(oldD)!;
    const newRec = map.get(newD)!;
    expect(oldRec.forks).toContain("gpui-unofficial");
    expect(newRec.forks).toEqual(["gpui-pre", "gpui-unofficial"].sort());
  });
});

describe("T-41 absent-stream partition (the “dead strip” collapse)", () => {
  test("streamPartition splits by measured presence, preserving bundle order", () => {
    const manual = (key: string) => {
      const present: typeof bundle.providers = [];
      const absent: typeof bundle.providers = [];
      for (const p of bundle.providers) {
        if (streamCallouts(p, key).present) present.push(p);
        else absent.push(p);
      }
      return { present, absent };
    };
    // AccessibilityNode: the review's dead-strip case — only the streams that
    // ever measured it render in full; the rest collapse into the absent block
    // (an “absent” dot means the release was measured without the item, so the
    // never-measured streams stay reachable through the expand toggle).
    const anoKey = "struct:accessibility::AccessibilityNode";
    const ano = streamPartition(bundle.providers, anoKey);
    const anoManual = manual(anoKey);
    expect(ano.present.map((p) => p.id)).toEqual(anoManual.present.map((p) => p.id));
    expect(ano.absent.map((p) => p.id)).toEqual(anoManual.absent.map((p) => p.id));
    // The partition is a disjoint cover of the bundle's providers: every stream
    // lands on one side, and every release row lands with it.
    expect(ano.present.length + ano.absent.length).toBe(bundle.providers.length);
    const totalRows = bundle.providers.reduce((n, p) => n + p.versions.length, 0);
    const splitRows =
      ano.present.reduce((n, p) => n + p.versions.length, 0) +
      ano.absent.reduce((n, p) => n + p.versions.length, 0);
    expect(splitRows).toBe(totalRows);
    // …and the partition always equals a manual streamCallouts scan.
    for (const key of ["fn:Window::blur", "fn:profiler::record_frame_timing", "fn:profiler::record_frame_event"]) {
      const got = streamPartition(bundle.providers, key);
      const want = manual(key);
      expect(got.present.map((p) => p.id)).toEqual(want.present.map((p) => p.id));
      expect(got.absent.map((p) => p.id)).toEqual(want.absent.map((p) => p.id));
    }
  });
});

describe("T-41 changed-cell signature detail without the sidecar (digest-only reasons)", () => {
  test("an fn re-signature states the sidecar as the unresolved reason when texts are absent", () => {
    const res = changedSignatureDelta(null, bundle.providers, "fn:Window::blur", "gpui-unofficial", "1.19.0-pre", "1.18.0");
    expect(res.delta).toBeNull();
    expect(res.reason).toContain("signature text is not resolved");
  });

  test("a type re-signature states the pub-only granularity reason when the member vector is unresolved (rule 2)", () => {
    const key = "struct:accessibility::AccessibilityNode";
    const res = changedSignatureDelta(null, bundle.providers, key, "kael", "0.2.0", "0.1.1");
    expect(res.delta).toBeNull();
    expect(res.members).toBeNull();
    // T-47 decision 2b: with no member sidecar the row states the policy
    // (the digest covers consumer-visible pub members only) instead of
    // naming the moved member — never an inference.
    expect(res.reason).toContain("consumer-visible pub members only");
    expect(res.reason).toContain("member vector is not resolved");
  });

  test("a type re-signature resolves the measured member delta when the sidecar is loaded (T-47 2b)", () => {
    const key = "struct:accessibility::AccessibilityNode";
    const res = changedSignatureDelta(
      null,
      bundle.providers,
      key,
      "kael",
      "0.2.0",
      "0.1.1",
      vecsFor(key),
    );
    expect(res.delta).toBeNull();
    expect(res.reason).toBeNull();
    expect(res.members).not.toBeNull();
    expect(res.members!.removed.length + res.members!.added.length).toBeGreaterThan(0);
    // Every reported segment is a member the two releases actually measured
    // (measured, never invented) and the two sides are disjoint.
    const before = new Set(memberVecAt("kael", "0.1.1", key) ?? []);
    const after = new Set(memberVecAt("kael", "0.2.0", key) ?? []);
    for (const seg of res.members!.removed) {
      expect(before.has(seg)).toBe(true);
      expect(after.has(seg)).toBe(false);
    }
    for (const seg of res.members!.added) {
      expect(after.has(seg)).toBe(true);
      expect(before.has(seg)).toBe(false);
    }
  });

  test("the recorded GestureTuning field swap discloses exactly the two moved members (T-47 2b)", () => {
    // uno 1.18.1 -> 1.19.0-pre replaced a pub field with a differently-typed
    // one in `struct:GestureTuning`: `momentum_decay_per_ms: f32` became
    // `scroll_physics: ScrollPhysics`. The panel must name exactly those two
    // and nothing else — in particular the *doc comments* rewritten on the
    // four surviving fields (and moved onto the new one) are presentation
    // metadata, never re-signing and never surfaced as a member.
    const key = "struct:GestureTuning";
    const res = changedSignatureDelta(
      null,
      bundle.providers,
      key,
      "gpui-unofficial",
      "1.19.0-pre",
      "1.18.1",
      vecsFor(key),
    );
    expect(res.delta).toBeNull();
    expect(res.reason).toBeNull();
    expect(res.members).toEqual({
      removed: ["momentum_decay_per_ms : f32"],
      added: ["scroll_physics : ScrollPhysics"],
    });
    // Both sides are the measured vectors, and the digest really did move.
    const vec = (vers: string) => memberVecAt("gpui-unofficial", vers, key) ?? [];
    expect(vec("1.18.1")).toContain("momentum_decay_per_ms : f32");
    expect(vec("1.18.1")).not.toContain("scroll_physics : ScrollPhysics");
    expect(vec("1.19.0-pre")).toContain("scroll_physics : ScrollPhysics");
    expect(vec("1.19.0-pre")).not.toContain("momentum_decay_per_ms : f32");
    // The unchanged pub members appear on both sides and so are not a delta.
    for (const stable of [
      "touch_slop : Pixels",
      "multi_tap_interval : Duration",
      "multi_tap_slop : Pixels",
      "long_press_duration : Duration",
      "min_fling_velocity : f32",
    ]) {
      expect(vec("1.18.1")).toContain(stable);
      expect(vec("1.19.0-pre")).toContain(stable);
    }
  });

  test("the preview pair GestureTuning 1.18.0 -> 1.19.0-pre resolves (T-50 acceptance)", () => {
    // The shape that kept escaping: the Alignment diffs a preview against its
    // **branch base** — the newest stable by publish order, which is 1.18.0
    // here even though 1.18.1 is published after 1.19.0-pre. 1.18.0 and 1.18.1
    // measure the same digest, so the pair resolves through the digest both
    // share, and the moved member is disclosed.
    const key = "struct:GestureTuning";
    const uno = bundle.providers.find((p) => p.id === "gpui-unofficial")!;
    const aRow = uno.versions.find((v) => v.vers === "1.18.0")!;
    const bRow = uno.versions.find((v) => v.vers === "1.19.0-pre")!;
    // The pair really is a re-sign, and 1.18.0 is the preview's branch base.
    expect(digestAt(aRow, key)).not.toBe(digestAt(bRow, key));
    // Both endpoints are reachable from the *same* fragment map: the payload
    // fragment carries every digest the key ever measured under (T-50), so no
    // per-release keying is needed.
    const res = changedSignatureDelta(
      null,
      bundle.providers,
      key,
      "gpui-unofficial",
      "1.19.0-pre",
      "1.18.0",
      vecsFor(key),
    );
    expect(res.delta).toBeNull();
    expect(res.reason).toBeNull();
    expect(res.members).toEqual({
      removed: ["momentum_decay_per_ms : f32"],
      added: ["scroll_physics : ScrollPhysics"],
    });
  });

  test("a type alias stays digest-only: a member projection is not meaningful for it", () => {
    const key = "type:animation::easing::Linear";
    const res = changedSignatureDelta(null, bundle.providers, key, "kael", "0.2.0", "0.1.2", vecsFor(key));
    expect(res.members).toBeNull();
    expect(res.delta).toBeNull();
    if (res.reason) expect(res.reason).toMatch(/no member projection|RHS/);
  });

  test("non-changed or first-row cells resolve nothing (no fabricated pair)", () => {
    // kael's first row can never be “changed” (no predecessor).
    expect(changedSignatureDelta(null, bundle.providers, "fn:Window::blur", "gpui-unofficial", "0.230.1", null).delta).toBeNull();
    // A same cell (no adjacency to resolve) has no prev row to compare.
    const same = changedSignatureDelta(null, bundle.providers, "fn:Window::blur", "gpui-unofficial", "1.18.1", null);
    expect(same.delta).toBeNull();
    expect(same.reason).toBeNull();
  });
});

describe("T-42 digest variants — the measured-digest identity axis (itemVariants)", () => {
  test("blur's two measured generations label α = legacy, β = re-signed (first-measured order)", () => {
    const vs = itemVariants(bundle, "fn:Window::blur");
    expect(vs.map((v) => v.shortDigest)).toEqual(["a07c1800", "bdc56592"]);
    expect(vs.map((v) => v.label)).toEqual(["α", "β"]);
    expect(vs[0].firstSeen).toEqual({ providerId: "gpui", vers: "0.1.0-test" });
    expect(vs[1].firstSeen).toEqual({ providerId: "gpui-unofficial", vers: "1.19.0-pre" });
    for (const v of vs) expect(v.digest).toMatch(/^[0-9a-f]{64}$/); // blake3 64-hex
  });

  test("kael's AccessibilityNode measures four signatures in release order — the α→δ run the matrix renders", () => {
    const vs = itemVariants(bundle, "struct:accessibility::AccessibilityNode");
    expect(vs.map((v) => v.shortDigest)).toEqual(["4d8626cd", "5d9c2d05", "acde2854", "c5d79070"]);
    expect(vs.map((v) => v.label)).toEqual(["α", "β", "γ", "δ"]);
    expect(vs.map((v) => v.firstSeen?.vers)).toEqual(["0.1.1", "0.2.0", "0.3.0", "0.4.0"]);
    expect(vs.every((v) => v.firstSeen?.providerId === "kael")).toBe(true);
  });

  test("single-signature items resolve to exactly one variant (α)", () => {
    expect(itemVariants(bundle, "fn:profiler::record_frame_timing").map((v) => v.shortDigest)).toEqual(["e7817244"]);
    expect(itemVariants(bundle, "fn:profiler::record_frame_event").map((v) => v.shortDigest)).toEqual(["ec57f66c"]);
    expect(itemVariants(bundle, "fn:profiler::record_frame_timing")[0].label).toBe("α");
  });

  test("the derivation equals a manual first-measured scan over the bundle (RULE-7)", () => {
    // The palette-cycle case is real on the corpus, on keys whose
    // consumer-visible interface genuinely churned: trait:InteractiveElement
    // measures 12 distinct digests (pub-member adds/re-signatures across the
    // fork stream) — labels must keep counting and the derivation must equal
    // the manual scan exactly. (T-47: struct:Window, which used to measure 20
    // digest variants, now collapses to one — its public field/member surface
    // never changed; the 20 were private-member/doc churn misread as
    // re-signatures.)
    const key = "trait:InteractiveElement";
    const manual: { digest: string; where: { providerId: string; vers: string } }[] = [];
    const seen = new Set<string>();
    for (const p of bundle.providers) {
      for (const v of p.versions) {
        if (v.surface === null || v.surface === undefined) continue;
        const row = new Set<string>();
        for (const item of v.surface) if (item.key === key) row.add(item.digest);
        for (const d of [...row].sort()) {
          if (!seen.has(d)) {
            seen.add(d);
            manual.push({ digest: d, where: { providerId: p.id, vers: v.vers } });
          }
        }
      }
    }
    const got = itemVariants(bundle, key);
    expect(got.length).toBeGreaterThan(8);
    expect(got.map((v) => v.digest)).toEqual(manual.map((m) => m.digest));
    got.forEach((v, i) => expect(v.firstSeen).toEqual(manual[i].where));
    expect(got[0].label).toBe("α");
    expect(got[7].label).toBe("θ");
    expect(got[8].label).toBe("ι"); // the palette cycles at 8 swatches, never at the label
  });

  test("labels stay honest past the Greek alphabet (#n beyond 24)", () => {
    expect(variantLabel(0)).toBe("α");
    expect(variantLabel(3)).toBe("δ");
    expect(variantLabel(23)).toBe("ω");
    expect(variantLabel(24)).toBe("#25");
  });
});

function manualVariantRun(
  provider: Provider,
  variants: ItemVariant[],
  key: string,
): { present: number; steps: { indexes: number[]; vers: string | null }[] } {
  const steps: { indexes: number[]; vers: string | null }[] = [];
  let present = 0;
  for (const v of provider.versions) {
    const ds = digestsOf(v.surface, key);
    if (ds === null || ds.size === 0) continue;
    present += 1;
    const indexes = variantIndexesOf(v, variants, key);
    if (indexes.length === 0) continue;
    const last = steps[steps.length - 1];
    if (last && last.indexes.length === indexes.length && last.indexes.every((x, i) => x === indexes[i])) continue;
    steps.push({ indexes, vers: steps.length === 0 ? null : v.vers });
  }
  return { present, steps };
}

/** The variant indexes one measured row carries for `key`, sorted (unresolved
 * digests dropped) — the per-row unit both the manual fold and the parity
 * checks above build on. */
function variantIndexesOf(row: VersionRow, variants: ItemVariant[], key: string): number[] {
  return [...(digestsOf(row.surface, key) ?? [])]
    .map((d) => variants.findIndex((x) => x.digest === d))
    .filter((i) => i >= 0)
    .sort((a, b) => a - b);
}

describe("T-42 per-stream variant-run chips (streamVariantSteps)", () => {
  const pm = () => providerMap(bundle);

  test("uno's blur run is the manual fold of its published rows — a reversion is its own step", () => {
    const key = "fn:Window::blur";
    const variants = itemVariants(bundle, key);
    const uno = pm()["gpui-unofficial"];
    const run = streamVariantSteps(uno, variants, key);
    expect(run).toEqual(manualVariantRun(uno, variants, key));
    // present = every published row carrying the item (manual scan)
    let manual = 0;
    for (const v of uno.versions) {
      const ds = digestsOf(v.surface, key);
      if (ds && ds.size > 0) manual += 1;
    }
    expect(run.present).toBe(manual);
    expect(run.present).toBeGreaterThan(0);
  });

  test("a stream whose present rows share one variant resolves to a single step", () => {
    const key = "fn:Window::blur";
    const variants = itemVariants(bundle, key);
    const pre = pm()["gpui-pre"];
    const run = streamVariantSteps(pre, variants, key);
    expect(run).toEqual(manualVariantRun(pre, variants, key));
    // The recorded property: every present row carries the same single variant,
    // so the whole stream is one uniform run (never a step per release).
    const present = pre.versions.filter((v) => (digestsOf(v.surface, key)?.size ?? 0) > 0);
    expect(present.length).toBeGreaterThan(0);
    const first = variantIndexesOf(present[0], variants, key);
    expect(first.length).toBe(1);
    for (const v of present) expect(variantIndexesOf(v, variants, key)).toEqual(first);
    expect(run.steps).toEqual([{ indexes: first, vers: null }]);
    expect(run.present).toBe(present.length);
  });

  test("kael's AccessibilityNode chains its measured variants in published order", () => {
    const key = "struct:accessibility::AccessibilityNode";
    const variants = itemVariants(bundle, key);
    const kael = pm()["kael"];
    const run = streamVariantSteps(kael, variants, key);
    expect(run).toEqual(manualVariantRun(kael, variants, key));
    expect(run.present).toBeGreaterThan(0);
  });

  test("removals are skipped in the steps but the present count stays honest (uno record_frame_timing)", () => {
    const key = "fn:profiler::record_frame_timing";
    const variants = itemVariants(bundle, key);
    const uno = pm()["gpui-unofficial"];
    const run = streamVariantSteps(uno, variants, key);
    expect(run).toEqual(manualVariantRun(uno, variants, key));
    let manual = 0;
    for (const v of uno.versions) {
      const ds = digestsOf(v.surface, key);
      if (ds && ds.size > 0) manual += 1;
    }
    expect(run.present).toBe(manual);
    expect(run.present).toBeGreaterThan(1);
  });
});

describe("T-42 signature-by-hex: fnDigestTexts resolves each digest's measured text from the sidecar", () => {
  // The sidecar is the committed sibling of the bundle (forkmap-fn-texts.json,
  // T-34) — loaded exactly as the SPA fetches it (validateFnTexts).
  const sidecarRaw: unknown = JSON.parse(
    readFileSync(join(HERE, "..", "..", "forkmap", "data", "forkmap-fn-texts.json"), "utf8"),
  );
  const sidecar = validateFnTexts(sidecarRaw);

  test("the two blur generations resolve to their measured signatures (the dock's from → to pair, digest-keyed)", () => {
    const key = "fn:Window::blur";
    const variants = itemVariants(bundle, key);
    const map = fnDigestTexts(sidecar, bundle.providers, key);
    expect(map.size).toBe(2);
    expect(map.get(variants[0].digest)).toBe("fn Window::blur(& mut self)");
    expect(map.get(variants[1].digest)).toBe("fn Window::blur(& mut self, & mut App)");
    // same digest anywhere in the corpus ⇒ the same bytes (T-34 invariant)
    expect(map.get(variants[1].digest)).toBe(map.get(bdcDigestOf(bundle, "gpui-pre", "0.3.3")!));
  });

  test("single-signature fn items resolve their one text; type keys never resolve (rule 2)", () => {
    const timing = fnDigestTexts(sidecar, bundle.providers, "fn:profiler::record_frame_timing");
    expect(timing.size).toBe(1);
    expect([...timing.values()][0]).toBe("fn profiler::record_frame_timing(FrameTiming)");
    expect(fnDigestTexts(sidecar, bundle.providers, "struct:accessibility::AccessibilityNode").size).toBe(0);
    expect(fnDigestTexts(sidecar, bundle.providers, "struct:Window").size).toBe(0);
  });

  test("no sidecar → no texts (the digest-only treatment holds until the lazy load lands)", () => {
    expect(fnDigestTexts(null, bundle.providers, "fn:Window::blur").size).toBe(0);
    expect(fnDigestTexts(undefined, bundle.providers, "fn:Window::blur").size).toBe(0);
  });
});

function bdcDigestOf(b: ForkmapBundle, providerId: string, vers: string): string | null {
  const p = b.providers.find((x) => x.id === providerId);
  const v = p?.versions.find((x) => x.vers === vers);
  if (!v?.surface) return null;
  const ds = v.surface.filter((i) => i.key === "fn:Window::blur").map((i) => i.digest);
  return ds.length === 1 ? ds[0] : null;
}

describe("validateTypeMembers is shape-strict like the other sidecars (T-50)", () => {
  test("the committed normalized sidecar validates and every vector is member-bearing data", () => {
    expect(members.schema).toBe(TYPE_MEMBERS_SCHEMA);
    // Member-bearing kinds only, blake3 64-hex addresses, every segment a
    // non-empty string. An empty vector (`[]`) is honest measured data: a
    // member-bearing type with no pub member. (The sidecar's key/digest totals
    // are dataset content — the shape is what this test pins, not the size.)
    for (const [key, byDigest] of Object.entries(members.vectors)) {
      expect(key).toMatch(/^(struct|enum|union|trait):/);
      for (const [digest, segs] of Object.entries(byDigest)) {
        expect(digest).toMatch(/^[0-9a-f]{64}$/);
        for (const seg of segs) expect(seg.length).toBeGreaterThan(0);
      }
    }
  });

  test("the dictionary is normalized: one copy per (key, digest), no duplicates", () => {
    // T-50's whole point — v1 stored a vector next to every release row (3.1x
    // redundant). A key's digest map is a *map*, so a duplicate address is
    // structurally impossible; assert every enumerated address is distinct.
    const seen = new Set<string>();
    for (const [key, byDigest] of Object.entries(members.vectors)) {
      for (const digest of Object.keys(byDigest)) {
        const addr = `${key}|${digest}`;
        expect(seen.has(addr)).toBe(false);
        seen.add(addr);
      }
    }
    expect(seen.size).toBeGreaterThan(0);
  });

  test("schema + malformed vectors fail loudly", () => {
    expect(() => validateTypeMembers({ ...members, schema: "gocar.forkmap.typemembers.v1" })).toThrow(
      /schema/,
    );
    // a non-object digest map must fail
    expect(() =>
      validateTypeMembers({ ...members, vectors: { "struct:X": "not-a-map" } }),
    ).toThrow(/must be a digest map/);
    // a non-array vector must fail
    expect(() =>
      validateTypeMembers({ ...members, vectors: { "struct:X": { ["a".repeat(64)]: "nope" } } }),
    ).toThrow(/must be an array/);
    // a non-blake3 digest must fail
    expect(() =>
      validateTypeMembers({ ...members, vectors: { "struct:X": { nothex: ["ok"] } } }),
    ).toThrow(/blake3 64-hex/);
    // an empty segment must fail: it could not be the digest's preimage
    expect(() =>
      validateTypeMembers({ ...members, vectors: { "struct:X": { ["b".repeat(64)]: ["ok", ""] } } }),
    ).toThrow(/non-empty strings/);
    // a non-member-bearing kind must fail
    expect(() =>
      validateTypeMembers({ ...members, vectors: { "fn:blur": { ["c".repeat(64)]: ["x"] } } }),
    ).toThrow(/member-bearing kind/);
  });

  test("a member vector is never a private-member leak: no `pub(crate)`/private names", () => {
    // The whole point of the T-47 1a correction: private members never enter
    // the projection, so nothing recorded here can name one.
    for (const byDigest of Object.values(members.vectors)) {
      for (const segs of Object.values(byDigest)) {
        for (const seg of segs) expect(seg).not.toContain("pub(crate)");
      }
    }
  });
});
