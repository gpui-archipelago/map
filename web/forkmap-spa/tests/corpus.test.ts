// T-33 increment 4 — corpus layer parity tests (per-release files + journal
// story slice).
//
// The committed forkmap-release-###.json files and forkmap-journal.json are
// the Changes/Journal corpus views' row-level payload (the ~35 MB corpus +
// ~15.7 MB fn-texts whole files are never fetched by the runtime; they stay
// committed as the canonical row store + parity anchor). These tests pin the
// split's honest guarantees:
//   - every committed release file validates and equals the client derivation
//     over the committed corpus + fn-texts sidecar (deriveReleaseFile — the
//     exporter's per-release projection reproduced in TS, RULE-7);
//   - the committed journal slice equals the client derivation over the full
//     bundle (deriveJournalSlice — the exporter's branchBase/diffRows port
//     reproduced with the client's own derivations) for every entry;
//   - the runtime reconstruction (rowFromRelease over the manifest row space)
//     reproduces each release's corpus surface exactly (record sets + cfg
//     gates), and the views' logical facts (buildCorpusData over the slice)
//     agree with the slice + the manifest row space 1:1;
//   - validateRelease / validateJournal are shape-strict: a stale or
//     truncated file must fail loudly, never render half-truths beside a
//     resolved diff.

import { describe, expect, test } from "bun:test";
import { diffRows, pairKey, surfacesIdentical } from "../src/bundle/derive";
import {
  buildCorpusData,
  deriveJournalSlice,
  deriveReleaseFile,
  factsOf,
  rowFromRelease,
} from "../src/bundle/corpus";
import { branchBase } from "../src/bundle/derive";
import {
  validateBundle,
  validateFnTexts,
  validateJournal,
  validateManifest,
  validateRelease,
} from "../src/bundle/validate";
import type {
  ForkmapBundle,
  ForkmapManifest,
  FnTextsBundle,
  JournalSlice,
  ReleaseFile,
} from "../src/bundle/types";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, "..", "..", "forkmap", "data");
const load = <T,>(name: string, validate: (raw: unknown) => T): T =>
  validate(JSON.parse(readFileSync(join(DATA, name), "utf8")));

const bundle: ForkmapBundle = load("forkmap.json", validateBundle);
const manifest: ForkmapManifest = load("forkmap-manifest.json", validateManifest);
const fnTexts: FnTextsBundle = load("forkmap-fn-texts.json", validateFnTexts);

const releaseFiles = readdirSync(DATA)
  .filter((n) => /^forkmap-release-\d{3}\.json$/.test(n))
  .sort();
const committed: ReleaseFile[] = releaseFiles.map((n) => load(n, validateRelease));
const journal: JournalSlice = load("forkmap-journal.json", validateJournal);

describe("the committed per-release payload files (T-33 increment 4)", () => {
  test("every file validates, and equals the client derivation over the corpus + fn sidecar (RULE-7)", () => {
    // One file per measured release row.
    const measuredRows = bundle.providers
      .flatMap((p) => p.versions)
      .filter((v) => v.surface !== null && v.surface !== undefined);
    expect(committed.length).toBe(measuredRows.length);
    for (const file of committed) {
      const want = deriveReleaseFile(file.p, file.v, bundle, fnTexts);
      expect(want, `${file.p} ${file.v} is a measured release`).not.toBeNull();
      expect(file).toEqual(want!);
      expect(file.schema).toBe("gocar.forkmap.release.v1");
      expect(file.dataset_schema).toBe(bundle.dataset_schema);
      expect(file.dataset_synced_at).toBe(bundle.dataset_synced_at);
    }
  });

  test("row reconstruction reproduces each release's corpus surface exactly", () => {
    type RowLike = { key: string; digest: string; cfg?: string[] };
    const gatesOf = (surface: RowLike[]) => {
      const out = new Map<string, string[]>();
      for (const item of surface) {
        if (!item.cfg || item.cfg.length === 0) continue;
        const key = item.key;
        let gates = out.get(key);
        if (!gates) {
          gates = [];
          out.set(key, gates);
        }
        for (const g of item.cfg) if (!gates.includes(g)) gates.push(g);
      }
      for (const gates of out.values()) gates.sort();
      return out;
    };
    for (const file of committed) {
      const provider = manifest.providers.find((p) => p.id === file.p)!;
      const metaRow = provider.versions.find((r) => r.vers === file.v)!;
      const row = rowFromRelease(metaRow, file);
      expect(row.surface!.length, `${file.p} ${file.v} record count`).toBe(file.n);
      const corpusRow = bundle.providers.find((p) => p.id === file.p)!.versions.find((r) => r.vers === file.v)!;
      // Same (key, digest) record set…
      const pairs = (surface: RowLike[]) => surface.map((i) => pairKey(i.key, i.digest)).sort();
      expect(pairs(row.surface!), `${file.p} ${file.v} records`).toEqual(pairs(corpusRow.surface!));
      // …and the same cfg provenance per key (empty cfg omitted by the
      // compact rows reads as the same gates).
      expect(gatesOf(row.surface!), `${file.p} ${file.v} cfg gates`).toEqual(gatesOf(corpusRow.surface!));
    }
  });

  test("addressing: file ordinals are the flat row-space positions of measured rows", () => {
    let flat = 0;
    for (const p of bundle.providers) {
      for (const row of p.versions) {
        if (row.surface !== null && row.surface !== undefined) {
          const file = committed[flat];
          expect(file.p).toBe(p.id);
          expect(file.v).toBe(row.vers);
          flat += 1;
        }
      }
    }
    expect(flat).toBe(committed.length);
  });

  test("the measured-empty release and the blur story ride their files honestly", () => {
    const empty = committed.find((f) => f.p === "gpui" && f.v === "0.1.0")!;
    expect(empty.n).toBe(0);
    expect(empty.s).toEqual([]);
    const pre = committed.find((f) => f.p === "gpui-unofficial" && f.v === "1.19.0-pre")!;
    expect(pre.n).toBe(2062);
    expect(pre.f!["fn:Window::blur"]).toBe("fn Window::blur(& mut self, & mut App)");
    const uno118 = committed.find((f) => f.p === "gpui-unofficial" && f.v === "1.18.1")!;
    expect(uno118.f!["fn:Window::blur"]).toBe("fn Window::blur(& mut self)");
  });
});

describe("the committed journal story slice (T-33 increment 4)", () => {
  test("every entry equals the client derivation over the full bundle (RULE-7)", () => {
    expect(journal).toEqual(deriveJournalSlice(bundle));
    expect(journal.schema).toBe("gocar.forkmap.journal.v1");
    const rows = journal.streams.reduce((n, s) => n + s.rows.length, 0);
    // The slice mirrors the full bundle's row space 1:1.
    expect(rows).toBe(bundle.providers.reduce((n, p) => n + p.versions.length, 0));
  });

  test("the slice's counts agree with the client diffRows over every entry (parity tripwire)", () => {
    for (const p of bundle.providers) {
      const stream = journal.streams.find((s) => s.id === p.id)!;
      expect(stream.rows.length).toBe(p.versions.length);
      for (let vi = 0; vi < p.versions.length; vi++) {
        const entry = stream.rows[vi];
        const v = p.versions[vi];
        const base = branchBase(p.versions, vi);
        const baseIdx = base ? p.versions.indexOf(base) : undefined;
        expect(entry.pr === undefined ? null : entry.pr, `${p.id} ${entry.v} pr`).toBe(
          baseIdx === undefined ? null : baseIdx,
        );
        // m/n classify the row exactly like the corpus (null / empty / len).
        const m = v.surface === null || v.surface === undefined ? 0 : v.surface.length === 0 ? 1 : 2;
        expect(entry.m, `${p.id} ${entry.v} m`).toBe(m);
        expect(entry.n, `${p.id} ${entry.v} n`).toBe(m === 2 ? v.surface!.length : 0);
        if (!base) {
          expect(entry.d, `${p.id} ${entry.v} no base → no d`).toBeUndefined();
          continue;
        }
        const diff = diffRows(base, v);
        if (!diff.ok) {
          expect(entry.d, `${p.id} ${entry.v} unmeasured pair → no d`).toBeUndefined();
          continue;
        }
        if (diff.identical) {
          expect(entry.d, `${p.id} ${entry.v} identical flag`).toEqual({ id: 1 });
        } else {
          expect(entry.d, `${p.id} ${entry.v} counts`).toEqual({
            rm: diff.removed.length,
            ad: diff.added.length,
            rs: diff.resigned.length,
          });
        }
      }
    }
  });

  test("the recorded story spot checks (doc-12 blur generation, exact-copy republish, measured-empty)", () => {
    const uno = journal.streams.find((s) => s.id === "gpui-unofficial")!;
    const pre = uno.rows.find((r) => r.v === "1.19.0-pre")!;
    expect(pre.m).toBe(2);
    expect(pre.n).toBe(2062);
    expect(pre.pr).toBe(41); // 1.18.0 is the preview's branch base
    expect(pre.d).toEqual({ rm: 2, ad: 14, rs: 20 });
    const backport = uno.rows.find((r) => r.v === "1.18.1")!;
    expect(backport.d).toEqual({ id: 1 }); // exact-copy of 1.18.0
    const gpui = journal.streams.find((s) => s.id === "gpui")!;
    const empty = gpui.rows.find((r) => r.v === "0.1.0")!;
    expect(empty.m).toBe(1); // measured-empty is a real state (RULE-4)
    expect(empty.n).toBe(0);
    expect(empty.pr).toBeUndefined();
    expect(empty.d).toBeUndefined();
  });
});

describe("the views' logical facts agree with the slice + manifest row space (T-33 increment 4)", () => {
  const { data } = (() => {
    const m = manifest;
    return { data: buildCorpusData(m, journal) };
  })();

  test("buildCorpusData maps every slice entry 1:1 onto its manifest release row", () => {
    expect(data.streams.length).toBe(manifest.providers.length);
    for (const provider of manifest.providers) {
      const stream = data.streams.find((s) => s.id === provider.id)!;
      const sliceStream = journal.streams.find((s) => s.id === provider.id)!;
      expect(stream.facts.length).toBe(provider.versions.length);
      for (let vi = 0; vi < provider.versions.length; vi++) {
        const metaRow = provider.versions[vi];
        const fact = stream.facts[vi];
        const entry = sliceStream.rows[vi];
        expect(fact.vers).toBe(metaRow.vers);
        expect(fact.m).toBe(entry.m);
        expect(fact.n).toBe(entry.n);
        expect(fact.identical).toBe(entry.d !== undefined && "id" in entry.d);
        expect(fact.counts).toEqual(
          entry.d !== undefined && !("id" in entry.d) ? { rm: entry.d.rm, ad: entry.d.ad, rs: entry.d.rs } : null,
        );
        const prevVers = entry.pr === undefined ? null : provider.versions[entry.pr]?.vers ?? null;
        expect(fact.prevVers).toBe(prevVers);
      }
    }
  });

  test("factsOf resolves a release's facts, and the reconstructed pair diffs match the slice counts", () => {
    const pre = factsOf(data, "gpui-unofficial", "1.19.0-pre")!;
    expect(pre.counts).toEqual({ rm: 2, ad: 14, rs: 20 });
    const base = factsOf(data, "gpui-unofficial", "1.18.1")!;
    expect(base.identical).toBe(true);
    // Reconstructed rows (the runtime pair path) diff to the same counts.
    const aFile = committed.find((f) => f.p === "gpui-unofficial" && f.v === "1.18.1")!;
    const bFile = committed.find((f) => f.p === "gpui-unofficial" && f.v === "1.19.0-pre")!;
    const uno = manifest.providers.find((p) => p.id === "gpui-unofficial")!;
    const aRow = rowFromRelease(uno.versions.find((r) => r.vers === "1.18.1")!, aFile);
    const bRow = rowFromRelease(uno.versions.find((r) => r.vers === "1.19.0-pre")!, bFile);
    const d = diffRows(aRow, bRow);
    expect(d.ok).toBe(true);
    expect((d as { identical: boolean }).identical).toBe(false);
    if (!d.ok) return;
    expect(d.removed.length).toBe(pre.counts!.rm);
    expect(d.added.length).toBe(pre.counts!.ad);
    expect(d.resigned.length).toBe(pre.counts!.rs);
    expect(d.resigned.some((r) => r.key === "fn:Window::blur")).toBe(true);
  });

  test("measured-empty rows reconstruct honest empty surfaces (never null)", () => {
    const empty = committed.find((f) => f.p === "gpui" && f.v === "0.1.0")!;
    const gpui = manifest.providers.find((p) => p.id === "gpui")!;
    const row = rowFromRelease(gpui.versions.find((r) => r.vers === "0.1.0")!, empty);
    expect(row.surface).toEqual([]);
    const corpusRow = bundle.providers.find((p) => p.id === "gpui")!.versions.find((r) => r.vers === "0.1.0")!;
    expect(surfacesIdentical(row.surface!, corpusRow.surface!)).toBe(true);
  });
});

describe("validateRelease / validateJournal are shape-strict (T-33 increment 4)", () => {
  test("a corpus or sidecar served at a release URL fails loudly on its schema", () => {
    expect(() => validateRelease(bundle as unknown as Record<string, unknown>)).toThrow(
      /release schema must be/,
    );
    expect(() => validateRelease(fnTexts as unknown as Record<string, unknown>)).toThrow(
      /release schema must be/,
    );
  });

  test("malformed release rows, digests, or missing headers fail loudly", () => {
    // A row-rich file (the last release file carries a full measured surface).
    const rowRich = releaseFiles[releaseFiles.length - 1];
    const raw = () =>
      JSON.parse(readFileSync(join(DATA, rowRich), "utf8")) as Record<string, unknown>;
    const badDigest = structuredClone(raw());
    (badDigest.s as string[][])[0][1] = "not-a-digest";
    expect(() => validateRelease(badDigest)).toThrow(/64-hex/);
    const shortRow = structuredClone(raw());
    shortRow.s = [["fn:Window::blur"]];
    expect(() => validateRelease(shortRow)).toThrow(/surface rows must be \[key, digest/);
    const missingV = { ...raw(), v: "" };
    expect(() => validateRelease(missingV)).toThrow(/release version/);
    const emptyText = { ...raw(), f: { "fn:Window::blur": "" } };
    expect(() => validateRelease(emptyText)).toThrow(/release f\[fn:Window::blur\]/);
    const emptyF = { ...raw(), f: {} };
    expect(() => validateRelease(emptyF)).not.toThrow(); // absent/empty f is honest
  });

  test("journal shape violations fail loudly (d without pr, never-measured with d, id+counts mix)", () => {
    const raw = () =>
      JSON.parse(readFileSync(join(DATA, "forkmap-journal.json"), "utf8")) as Record<string, unknown>;
    const noPr = structuredClone(raw());
    const rows = (noPr.streams as Record<string, unknown>[])[0].rows as Record<string, unknown>[];
    const withD = rows.find((r) => r.d);
    if (withD) delete withD.pr;
    expect(() => validateJournal(noPr)).toThrow(/d requires its pr predecessor/);
    const neverMeasured = structuredClone(raw());
    const rows2 = (neverMeasured.streams as Record<string, unknown>[])[0].rows as Record<string, unknown>[];
    const withD2 = rows2.find((r) => r.d);
    if (withD2) withD2.m = 0;
    expect(() => validateJournal(neverMeasured)).toThrow(/never-measured row carries no diff state/);
    const mixed = structuredClone(raw());
    const rows3 = (mixed.streams as Record<string, unknown>[])[0].rows as Record<string, unknown>[];
    const withD3 = rows3.find((r) => r.d && "rm" in (r.d as object)) as Record<string, unknown>;
    if (withD3) withD3.d = { rm: 1, ad: 0, rs: 0, id: 1 };
    expect(() => validateJournal(mixed)).toThrow(/d must be \{ id: 1 \} or \{ rm, ad, rs \}/);
    const zeroCounts = structuredClone(raw());
    const rows4 = (zeroCounts.streams as Record<string, unknown>[])[0].rows as Record<string, unknown>[];
    const withD4 = rows4.find((r) => r.d && "rm" in (r.d as object)) as Record<string, unknown>;
    if (withD4) withD4.d = { rm: 0, ad: 0, rs: 0 };
    expect(() => validateJournal(zeroCounts)).toThrow(/identical pair carries the id flag/);
    expect(() => validateJournal({ ...raw(), schema: "gocar.forkmap.journal.v0" })).toThrow(
      /journal schema must be/,
    );
  });

  test("a full bundle never validates as the journal slice", () => {
    expect(() => validateJournal(bundle as unknown as Record<string, unknown>)).toThrow(
      /journal schema must be/,
    );
  });
});
