// T-34 — fn-signature sidecar parity tests.
//
// Pure-data assertions over the committed data/forkmap-fn-texts.json + the
// main bundle: the doc-12 `fn:Window::blur` re-signature and the doc-09
// cfg-gated profiler re-signatures resolve to their measured signatures
// (single-variant keys only), non-fn keys and multi-digest fn keys stay
// digest-only, and cfg gates stay provenance data beside the text.

import { describe, expect, test } from "bun:test";
import {
  cfgGatesOf,
  changedSignatureDelta,
  diffRows,
  fnTextsOf,
  signaturePair,
  singleVariantPair,
  validateBundle,
  validateFnTexts,
} from "../src/bundle";
import type { ForkmapBundle, FnTextsBundle, Provider, Side, VersionRow } from "../src/bundle";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const BUNDLE_PATH = join(HERE, "..", "..", "forkmap", "data", "forkmap.json");
const TEXTS_PATH = join(HERE, "..", "..", "forkmap", "data", "forkmap-fn-texts.json");

const bundle: ForkmapBundle = validateBundle(JSON.parse(readFileSync(BUNDLE_PATH, "utf8")));
const texts: FnTextsBundle = validateFnTexts(JSON.parse(readFileSync(TEXTS_PATH, "utf8")));

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

describe("sidecar shape + validation", () => {
  test("the committed sidecar validates and mirrors the six providers", () => {
    expect(texts.schema).toBe("gocar.forkmap.fntexts.v1");
    expect(texts.dataset_schema).toBe(bundle.dataset_schema);
    expect(texts.providers.map((p) => p.id)).toEqual(bundle.providers.map((p) => p.id));
    // A version whose fn key resolves carries its signature text.
    const uno = texts.providers.find((p) => p.id === "gpui-unofficial")!;
    const v = uno.versions.find((x) => x.vers === "1.19.0-pre")!;
    expect(v.fn_texts["fn:Window::blur"]).toBe("fn Window::blur(& mut self, & mut App)");
  });

  test("validateFnTexts rejects a mismatched schema loudly", () => {
    expect(() => validateFnTexts({ ...texts, schema: "gocar.forkmap.fntexts.v0" })).toThrow(/schema/);
  });
});

describe("T-34 signature resolution over the recorded stories", () => {
  test("doc-12: blur re-signature renders its measured before/after (uno 1.18.1 → 1.19.0-pre)", () => {
    const uno = provider("gpui-unofficial");
    const aRow = row(uno, "1.18.1");
    const bRow = row(uno, "1.19.0-pre");
    const d = diffRows(aRow, bRow);
    expect(d.ok).toBe(true);
    if (!d.ok) return;
    expect(d.resigned.some((r) => r.key === "fn:Window::blur")).toBe(true);
    expect(singleVariantPair(aRow, bRow, "fn:Window::blur")).toBe(true);
    expect(signaturePair(texts, aRow, side(uno, "1.18.1"), bRow, side(uno, "1.19.0-pre"), "fn:Window::blur")).toEqual({
      from: "fn Window::blur(& mut self)",
      to: "fn Window::blur(& mut self, & mut App)",
    });
    // gpui-pre's stream carries the same re-signed signature to its latest
    // row (resolution is per-release; 0.3.0–0.3.3 measure it identically).
    const pre = provider("gpui-pre");
    expect(fnTextsOf(texts, pre, "0.3.3")!["fn:Window::blur"]).toBe(
      "fn Window::blur(& mut self, & mut App)",
    );
  });

  test("doc-09: the profiler re-signatures resolve with their cfg gates as provenance", () => {
    const uno = provider("gpui-unofficial");
    const aRow = row(uno, "1.16.3");
    const bRow = row(uno, "1.17.2");
    const d = diffRows(aRow, bRow);
    expect(d.ok).toBe(true);
    if (!d.ok) return;
    const key = "fn:profiler::FrameTiming::draw_duration";
    expect(d.resigned.map((r) => r.key)).toContain(key);
    // The re-signature is the *gate*: the signature text is byte-identical
    // (digests hash the cfg-prefixed text) and the gate moves at B.
    expect(cfgGatesOf(aRow, key)).toEqual([]);
    expect(cfgGatesOf(bRow, key)).toEqual(['cfg (feature = "profiler")']);
    const pair = signaturePair(texts, aRow, side(uno, "1.16.3"), bRow, side(uno, "1.17.2"), key);
    expect(pair).toEqual({
      from: "fn profiler::FrameTiming::draw_duration(& self)-> Duration",
      to: "fn profiler::FrameTiming::draw_duration(& self)-> Duration",
    });
  });

  test("a multi-digest fn key cannot render one before/after signature", () => {
    // uno 1.16.1 → 1.19.0-pre re-signs `ThreadTimings::save_task_timing`,
    // measured under two cfg variants on both sides (profiler on/off) —
    // single-variant is false, so no single signature pair is claimed.
    const uno = provider("gpui-unofficial");
    const aRow = row(uno, "1.16.1");
    const bRow = row(uno, "1.19.0-pre");
    const d = diffRows(aRow, bRow);
    expect(d.ok).toBe(true);
    if (!d.ok) return;
    const key = "fn:profiler::ThreadTimings::save_task_timing";
    expect(d.resigned.map((r) => r.key)).toContain(key);
    expect(singleVariantPair(aRow, bRow, key)).toBe(false);
    expect(signaturePair(texts, aRow, side(uno, "1.16.1"), bRow, side(uno, "1.19.0-pre"), key)).toBeNull();
  });

  test("non-fn keys and unresolved text never produce a signature pair", () => {
    const kael = provider("kael");
    const aRow = row(kael, "0.1.2");
    const bRow = row(kael, "0.2.0");
    const key = "struct:accessibility::AccessibilityNode";
    const d = diffRows(aRow, bRow);
    expect(d.ok).toBe(true);
    if (!d.ok) return;
    expect(d.resigned.map((r) => r.key)).toContain(key);
    expect(signaturePair(texts, aRow, side(kael, "0.1.2"), bRow, side(kael, "0.2.0"), key)).toBeNull();

    // Without the sidecar nothing resolves (the honest fallback state).
    const uno = provider("gpui-unofficial");
    expect(
      signaturePair(null, row(uno, "1.18.1"), side(uno, "1.18.1"), row(uno, "1.19.0-pre"), side(uno, "1.19.0-pre"), "fn:Window::blur"),
    ).toBeNull();
  });

  test("fnTextsOf resolves per (provider, version) and misses unknown rows", () => {
    const uno = provider("gpui-unofficial");
    const map = fnTextsOf(texts, uno, "1.18.1");
    expect(map).toBeTruthy();
    expect(map!["fn:Window::blur"]).toBe("fn Window::blur(& mut self)");
    expect(fnTextsOf(texts, uno, "0.0.0-nonexistent")).toBeNull();
    expect(fnTextsOf(null, uno, "1.18.1")).toBeNull();
  });
});

describe("T-41 changed-cell signature deltas resolve vs the previous published row", () => {
  test("doc-12: the blur cell at uno 1.19.0-pre (prev 1.18.0) resolves its measured before/after", () => {
    const key = "fn:Window::blur";
    const res = changedSignatureDelta(texts, bundle.providers, key, "gpui-unofficial", "1.19.0-pre", "1.18.0");
    expect(res.delta).toEqual({
      from: "fn Window::blur(& mut self)",
      to: "fn Window::blur(& mut self, & mut App)",
      fromGates: [],
      toGates: [],
    });
    expect(res.reason).toBeNull();
  });

  test("doc-09: a gate-only re-signature resolves equal texts with the gate as provenance", () => {
    const key = "fn:profiler::FrameTiming::draw_duration";
    const res = changedSignatureDelta(texts, bundle.providers, key, "gpui-unofficial", "1.17.2", "1.16.3");
    expect(res.delta).not.toBeNull();
    expect(res.delta!.from).toBe(res.delta!.to); // the digest moved on the cfg prefix
    expect(res.delta!.fromGates).toEqual([]);
    expect(res.delta!.toGates).toEqual(['cfg (feature = "profiler")']);
    expect(res.reason).toBeNull();
  });

  test("without the sidecar nothing resolves into a signature (honest fallback)", () => {
    const res = changedSignatureDelta(null, bundle.providers, "fn:Window::blur", "gpui-unofficial", "1.19.0-pre", "1.18.0");
    expect(res.delta).toBeNull();
    expect(res.reason).toContain("sidecar is loading or absent");
  });
});
