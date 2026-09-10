// T-44 — source-location derivations over the committed sidecar.
//
// Pure-data assertions over the real `forkmap-source-locs.json` +
// `forkmap.json` mirroring what the Alignment popover renders (the docs.rs
// source permalink of a pinned release), on the T-34/T-43 pattern: the
// sidecar is a direct projection of the dataset's full per-row coordinates —
// a release's entry IS that release's own measurement (no carry, no
// inference), so the equivalence check below is exhaustive: every dataset
// (key, location) pair of a measured release resolves into that release's
// sidecar row, and nothing else does. The docs.rs URL follows the T-44
// normalization rule (package names the crate, lib target names the src
// path, bare measured line range as the fragment). Every number is measured
// from the committed files (RULE-7); re-derive, never hand-edit.

import { describe, expect, test } from "bun:test";
import {
  SRC_LOCS_SCHEMA,
  docsRsSourceUrl,
  githubSourceUrl,
  srcLocsAt,
  srcLocsOf,
  upstreamGitRef,
} from "../src/bundle";
import type { Provider, SrcLocsBundle } from "../src/bundle";
import { validateSrcLocs } from "../src/bundle/validate";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadBundle } from "./stories.test";

const HERE = dirname(fileURLToPath(import.meta.url));
const SIDECAR_PATH = join(HERE, "..", "..", "forkmap", "data", "forkmap-source-locs.json");

const bundle = loadBundle();
const sidecar: SrcLocsBundle = validateSrcLocs(JSON.parse(readFileSync(SIDECAR_PATH, "utf8")));

const BLUR = "fn:Window::blur";

function providerMap(b: typeof bundle): Record<string, Provider> {
  return Object.fromEntries(b.providers.map((p) => [p.id, p]));
}

describe("srcLocsOf / srcLocsAt resolve each release's own measured declaration", () => {
  test("blur: the legacy signature's declaration moved between releases without re-signing — each row is its own measure", () => {
    const uno = providerMap(bundle)["gpui-unofficial"];
    // uno 1.16.1 (digest α a07c1800…): the declaration span, verified against
    // the corpus source (window.rs L2208 is the doc comment, L2219 the brace)
    expect(srcLocsOf(sidecar, uno, "1.16.1")?.[BLUR]).toEqual([
      { file: "window.rs", start: 2208, end: 2219 },
    ]);
    // the same signature moved to 2073-2084 by 1.18.1 (an edit above it) —
    // the per-row persistence that needs no reconstruction
    expect(srcLocsOf(sidecar, uno, "1.18.1")?.[BLUR]).toEqual([
      { file: "window.rs", start: 2073, end: 2084 },
    ]);
    // the re-signed β row measures its own location (1.19.0-pre: 2081-2094)
    expect(srcLocsAt(sidecar, uno, "1.19.0-pre", BLUR)).toEqual([
      { file: "window.rs", start: 2081, end: 2094 },
    ]);
  });

  test("docsRsSourceUrl builds the package + lib-target URL with the measured line range", () => {
    const uno = providerMap(bundle)["gpui-unofficial"];
    const locs = srcLocsAt(sidecar, uno, "1.19.0-pre", BLUR)!;
    expect(locs).toHaveLength(1);
    // the package names the crate root; the lib target (`gpui`) the src path;
    // the fragment is the bare measured range (rustdoc's src-script grammar)
    expect(docsRsSourceUrl(uno, "1.19.0-pre", locs[0])).toBe(
      "https://docs.rs/gpui-unofficial/1.19.0-pre/src/gpui/window.rs.html#2081-2094",
    );
  });

  test("T-45: the curated upstream github map resolves every fork version (stable and prerelease) to its zed tag", () => {
    // Only gpui-unofficial (in this dataset) republishes zed's crates/gpui at
    // a curated, tag-mirroring upstream — the independent forks carry none.
    const uno = providerMap(bundle)["gpui-unofficial"];
    expect(uno.upstream).toBeTruthy();
    expect(uno.upstream?.repo).toBe("zed-industries/zed");
    expect(uno.upstream?.tree).toBe("crates/gpui/src");
    for (const [id] of Object.entries(providerMap(bundle))) {
      if (id === "gpui-unofficial") continue;
      const p = providerMap(bundle)[id];
      expect(p.upstream).toBeUndefined();
    }

    const row181 = uno.versions.find((v) => v.vers === "1.18.1")!;
    const rowPre = uno.versions.find((v) => v.vers === "1.19.0-pre")!;
    const rowOld = uno.versions.find((v) => v.vers === "1.12.0")!;
    // every fork version — stable or prerelease — mirrors its zed release tag:
    // 1.12.0 == v1.12.0, 1.18.1 == v1.18.1, and the prerelease 1.19.0-pre ==
    // v1.19.0-pre (zed tags its 1.19.0-pre interleaving); only a fork with no
    // curated tag map has none.
    expect(upstreamGitRef(uno.upstream, "1.18.1")).toBe("v1.18.1");
    expect(upstreamGitRef(uno.upstream, row181.vers)).toBe("v1.18.1");
    expect(upstreamGitRef(uno.upstream, rowOld.vers)).toBe("v1.12.0");
    expect(upstreamGitRef(uno.upstream, rowPre.vers)).toBe("v1.19.0-pre");
    expect(upstreamGitRef(uno.upstream, "1.16.1")).toBe("v1.16.1");
    // a fork without a curated tag rule never forms a github ref
    expect(upstreamGitRef(providerMap(bundle)["kael"].upstream, "0.4.1")).toBeNull();
  });

  test("T-45: githubSourceUrl builds the upstream blob URL from repo+tree+ref+measured loc", () => {
    const uno = providerMap(bundle)["gpui-unofficial"];
    // blur at uno 1.18.1 == zed v1.18.1's crates/gpui/src/window.rs, measured
    // 2073-2084 — the sheet the git tag-mirrored fork exposes
    const locs = srcLocsAt(sidecar, uno, "1.18.1", BLUR)!;
    expect(locs).toHaveLength(1);
    const ref = upstreamGitRef(uno.upstream, "1.18.1")!;
    expect(ref).toBe("v1.18.1");
    expect(githubSourceUrl(uno.upstream!, ref, locs[0])).toBe(
      "https://github.com/zed-industries/zed/blob/v1.18.1/crates/gpui/src/window.rs#L2073-L2084",
    );
  });

  test("sidecar consistency: every resolved key exists in its release's measured surface, never a use: key, arrays sorted", () => {
    // The bundle's surfaces are digest-level (the export strips src — the
    // sidecar is the only web-side carrier), so the projection check runs
    // one-way: every sidecar (provider, version, key) must name an item the
    // release's measured surface actually carries, of a kind with a real
    // declaration (never `use:`), with a valid sorted line span.
    let resolvedPairs = 0;
    for (const p of bundle.providers) {
      for (const v of p.versions) {
        if (v.surface === null || v.surface === undefined) continue;
        const map = srcLocsOf(sidecar, p, v.vers);
        if (!map) continue;
        const surfaceKeys = new Set(v.surface.map((i) => i.key));
        for (const [key, locs] of Object.entries(map)) {
          resolvedPairs += locs.length;
          expect(key.startsWith("use:"), `${p.id} ${v.vers} ${key}`).toBe(false);
          expect(surfaceKeys.has(key), `${p.id} ${v.vers} ${key} in surface`).toBe(true);
          const sorted = [...locs].sort(
            (a, b) => a.file.localeCompare(b.file) || a.start - b.start || a.end - b.end,
          );
          expect(locs).toEqual(sorted);
          for (const l of locs) {
            expect(l.start).toBeGreaterThanOrEqual(1);
            expect(l.end).toBeGreaterThanOrEqual(l.start);
          }
        }
      }
    }
    // Conservation (RULE-7 — re-derive, never hand-edit): every committed
    // sidecar location row resolves through the measured (provider, version)
    // space, and none is orphaned.
    const sidecarPairs = sidecar.providers.reduce(
      (n, p) =>
        n +
        p.versions.reduce(
          (m, v) => m + Object.values(v.source_locs).reduce((k, l) => k + l.length, 0),
          0,
        ),
      0,
    );
    expect(resolvedPairs).toBe(sidecarPairs);
  });

  test("an unmeasured release and re-export keys resolve nothing", () => {
    const kael = providerMap(bundle)["kael"];
    expect(srcLocsOf(sidecar, kael, "0.2.0")).not.toBeNull();
    // no version of any provider measures a use: key's declaration
    for (const p of bundle.providers) {
      for (const v of p.versions) {
        const map = srcLocsOf(sidecar, p, v.vers);
        if (!map) continue;
        for (const key of Object.keys(map)) {
          expect(key.startsWith("use:")).toBe(false);
        }
      }
    }
  });
});

describe("validateSrcLocs is shape-strict like the other sidecars", () => {
  test("schema + malformed locations fail loudly", () => {
    expect(sidecar.schema).toBe(SRC_LOCS_SCHEMA);
    expect(() => validateSrcLocs({ ...sidecar, schema: "gocar.forkmap.srclocs.v0" })).toThrow(/schema/);
    // a location with a missing file / non-positive start must fail
    const badLoc: unknown = {
      ...sidecar,
      providers: sidecar.providers.map((p, i) =>
        i === 0
          ? {
              ...p,
              versions: [
                {
                  vers: p.versions[0].vers,
                  source_locs: { "fn:x": [{ start: 0, end: 3 }] },
                },
              ],
            }
          : p,
      ),
    };
    expect(() => validateSrcLocs(badLoc)).toThrow(/file|start/);
    // an empty location array must fail
    const empty: unknown = {
      ...sidecar,
      providers: sidecar.providers.map((p, i) =>
        i === 0
          ? {
              ...p,
              versions: [
                { vers: p.versions[0].vers, source_locs: { "fn:x": [] } },
              ],
            }
          : p,
      ),
    };
    expect(() => validateSrcLocs(empty)).toThrow(/non-empty/);
  });
});
