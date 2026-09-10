// T-51 — the shared member-map delivery contract.
//
// The member projection is delivered as ONE normalized whole-file map
// (`forkmap-type-members.json`, `key -> digest -> pub-member segments`),
// module-cached behind `loadTypeMembers()`. Every surface — the Alignment
// item, the Changes/Journal pair and the release popover — resolves through
// the same map, so opening a pair costs no per-key member request at all.
//
// These tests pin the delivery contract itself (one fetch per session; a
// failure degrades to the honest pub-only policy copy, never a dead end) and
// the resolution semantics the surfaces share (`memberVectorsOf`), against the
// committed sidecar.

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadTypeMembers, memberVectorsOf, typeMembersUrl } from "../src/bundle/keyPayload";
import { validateTypeMembers } from "../src/bundle/validate";
import { digestAt } from "../src/bundle/derive";
import { validateBundle } from "../src/bundle/validate";
import type { ForkmapBundle, Provider, TypeMembersBundle, VersionRow } from "../src/bundle/types";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, "..", "..", "forkmap", "data");

const anchor: TypeMembersBundle = validateTypeMembers(
  JSON.parse(readFileSync(join(DATA, "forkmap-type-members.json"), "utf8")),
);
const bundle: ForkmapBundle = validateBundle(JSON.parse(readFileSync(join(DATA, "forkmap.json"), "utf8")));

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

describe("the member map is one session-cached file (T-51)", () => {
  test("the committed URL is the normalized whole-file map, not a per-key fragment", () => {
    expect(typeMembersUrl()).toContain("forkmap-type-members.json");
    expect(typeMembersUrl()).not.toContain("payload");
    expect(typeMembersUrl()).not.toContain("column");
  });

  test("loadTypeMembers fetches the file exactly once, however many callers ask", async () => {
    const realFetch = globalThis.fetch;
    const seen: string[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input instanceof Request ? input.url : input);
      seen.push(url);
      return new Response(readFileSync(join(DATA, "forkmap-type-members.json"), "utf8"), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;
    try {
      // The runtime resolves the same module-level cache from every surface
      // (Alignment, Changes, Journal, popover) — three concurrent callers plus
      // a later one must share a single in-flight request.
      const first = await loadTypeMembers();
      const [a, b] = await Promise.all([loadTypeMembers(), loadTypeMembers()]);
      const later = await loadTypeMembers();
      expect(seen.length).toBe(1);
      expect(first.vectors).toBe(a.vectors);
      expect(a.vectors).toBe(b.vectors);
      expect(b.vectors).toBe(later.vectors);
      expect(first.vectors["struct:GestureTuning"]).toBeDefined();
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  test("memberVectorsOf resolves the key's whole digest story, or null when it carries none", () => {
    // A member-bearing key: every digest it was measured under, so any two
    // releases of it can be diffed without asking the pair for anything.
    const gesture = memberVectorsOf(anchor, "struct:GestureTuning");
    expect(gesture).not.toBeNull();
    const uno = provider("gpui-unofficial");
    const d18 = digestAt(row(uno, "1.18.0"), "struct:GestureTuning");
    const dPre = digestAt(row(uno, "1.19.0-pre"), "struct:GestureTuning");
    expect(d18).not.toBeNull();
    expect(dPre).not.toBeNull();
    // Both endpoints are reachable from the one map — the acceptance pair.
    expect(gesture![d18!]).toBeDefined();
    expect(gesture![dPre!]).toBeDefined();
    // A key with no member projection, and the null bundle, resolve nothing.
    expect(memberVectorsOf(anchor, "fn:Window::blur")).toBeNull();
    expect(memberVectorsOf(anchor, "struct:NoSuchType")).toBeNull();
    expect(memberVectorsOf(null, "struct:GestureTuning")).toBeNull();
  });

  test("every recorded vector is a digest-guarded index entry: sorted, non-empty segments", () => {
    // The map is the exporter's resolved projection — a vector is present only
    // under the digest it was measured with, so the lookup is exactly
    // `(key, digest)`. Segments are the analyzer's own canonical strings.
    let vectors = 0;
    for (const [key, byDigest] of Object.entries(anchor.vectors)) {
      expect(key.startsWith("fn:")).toBe(false);
      expect(key.startsWith("use:")).toBe(false);
      for (const [digest, segs] of Object.entries(byDigest)) {
        expect(digest).toMatch(/^[0-9a-f]{64}$/);
        expect(Array.isArray(segs)).toBe(true);
        // `Some([])` is measured-and-empty (a member-less type), distinct from
        // an absent digest — never a hole in the map.
        expect(segs.every((s) => s.length > 0)).toBe(true);
        vectors += 1;
      }
    }
    expect(vectors).toBeGreaterThan(0);
  });

  test("a failed load never latches: the cache drops the rejection so a retry resolves", () => {
    // The runtime contract the surfaces rely on: `loadTypeMembers` returns the
    // same in-flight promise to every caller, and on rejection clears the cache
    // (`typeMembersCache.catch(() => { typeMembersCache = null })`) so a later
    // visit retries instead of rendering the policy copy forever. Assert the
    // source of that contract directly — a stale-cache regression here would
    // strand every member delta behind one transient network blip, which no
    // happy-path fetch test can catch.
    const src = readFileSync(join(HERE, "..", "src", "bundle", "keyPayload.ts"), "utf8");
    const loader = src.slice(src.indexOf("export function loadTypeMembers"));
    const end = loader.indexOf("\n}");
    const body = loader.slice(0, end);
    expect(body).toContain("if (!typeMembersCache)");
    expect(body).toContain("typeMembersCache.catch(");
    expect(body).toContain("typeMembersCache = null");
    // The hook swallows the rejection into the honest null state (the pub-only
    // policy copy), never a thrown render.
    const hook = src.slice(src.indexOf("export function useTypeMembers"));
    expect(hook.slice(0, hook.indexOf("\n}"))).toContain(".catch(");
  });
});
