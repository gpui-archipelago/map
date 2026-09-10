// T-43 — doc-texts derivations over the committed sidecar.
//
// Pure-data assertions over the real `forkmap-doc-texts.json` +
// `forkmap.json` mirroring what the Alignment view renders (the promoted
// Title docstring + the per-variant doc-delta chips), on the T-34/T-42
// pattern: lookups resolve the sidecar's per-release bytes, and the item
// doc story is a release scan — the doc's unit is the release, never the
// digest (an fn doc change never re-signs, so a digest lookup can never
// resolve a doc). Every number below is measured from the committed files
// (RULE-7); re-derive, never hand-edit.

import { describe, expect, test } from "bun:test";
import {
  DOC_TEXTS_SCHEMA,
  FN_TEXTS_SCHEMA,
  buildIndex,
  diffDocLines,
  docTextAt,
  docTextsOf,
  itemDocChips,
  itemDocStory,
  itemVariants,
} from "../src/bundle";
import type { DocTextsBundle, ForkmapBundle, Provider } from "../src/bundle";
import { validateDocTexts } from "../src/bundle/validate";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadBundle } from "./stories.test";

const HERE = dirname(fileURLToPath(import.meta.url));
const SIDECAR_PATH = join(HERE, "..", "..", "forkmap", "data", "forkmap-doc-texts.json");

const bundle = loadBundle();
const sidecar: DocTextsBundle = validateDocTexts(JSON.parse(readFileSync(SIDECAR_PATH, "utf8")));
const index = buildIndex(bundle);

const BLUR = "fn:Window::blur";
const BLUR_DOC = "Remove focus from all elements within this context's window.";
const FILE_WATCHER = "fn:FileWatcher::new";
const NATIVE_DOC = "Creates a file watcher that dispatches callbacks on the given app's\nforeground executor.";
const BROWSER_DOC = "Create a browser file-watcher placeholder.";
const URL_SCHEME = "fn:App::register_url_scheme";
const BACKGROUND_NEW = "fn:BackgroundExecutor::new";
const NODE = "struct:accessibility::AccessibilityNode";

function providerMap(b: ForkmapBundle): Record<string, Provider> {
  return Object.fromEntries(b.providers.map((p) => [p.id, p]));
}

describe("docTextsOf / docTextAt resolve the sidecar's per-release bytes", () => {
  test("the blur docstring resolves at both measured signatures (uno 1.18.1 α and 1.19.0-pre β)", () => {
    const uno = providerMap(bundle)["gpui-unofficial"];
    const at = (vers: string) => docTextsOf(sidecar, uno, vers)?.[BLUR] ?? null;
    expect(at("1.18.1")).toBe(BLUR_DOC);
    expect(at("1.19.0-pre")).toBe(BLUR_DOC);
    // docTextAt reads through a Side the same way
    expect(docTextAt(sidecar, { provider: uno, vers: "1.18.1" }, BLUR)).toBe(BLUR_DOC);
  });

  test("a release whose key is measured under several digests resolves no single doc (cfg variants)", () => {
    // fn:Edges::to_pixels is the corpus's cfg-artifact key — multi-digest
    // rows never resolve one text (the exporter's exclusion, mirrored here).
    let checked = 0;
    for (const p of bundle.providers) {
      for (const v of p.versions) {
        if (v.surface === null || v.surface === undefined) continue;
        const key = "fn:Edges::to_pixels";
        const digs = v.surface.filter((i) => i.key === key).map((i) => i.digest);
        if (new Set(digs).size > 1) {
          expect(docTextsOf(sidecar, p, v.vers)?.[key], `${p.id} ${v.vers}`).toBeUndefined();
          checked += 1;
        }
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  test("non-fn keys never resolve a doc (decision 1(a): types stay digest-only)", () => {
    const kael = providerMap(bundle)["kael"];
    expect(docTextsOf(sidecar, kael, "0.2.0")?.[NODE]).toBeUndefined();
    expect(docTextAt(sidecar, { provider: kael, vers: "0.2.0" }, NODE)).toBeNull();
  });

  test("validateDocTexts is shape-strict like validateFnTexts", () => {
    expect(sidecar.schema).toBe(DOC_TEXTS_SCHEMA);
    expect(() => validateDocTexts({ ...sidecar, schema: "gocar.forkmap.doctexts.v0" })).toThrow(/schema/);
    // a version row without its doc_texts map must fail loudly
    const noMap: unknown = {
      ...sidecar,
      providers: sidecar.providers.map((p) =>
        p.id === sidecar.providers[0].id
          ? { ...p, versions: [{ vers: p.versions[0].vers }, ...p.versions.slice(1)] }
          : p,
      ),
    };
    expect(() => validateDocTexts(noMap)).toThrow(/doc_texts/);
    // an fn-texts file must never validate as a doc-texts file
    expect(() => validateDocTexts({ ...sidecar, schema: FN_TEXTS_SCHEMA })).toThrow(/schema/);
  });
});

describe("itemDocStory — the release scan behind the promoted Title", () => {
  test("blur: one invariant docstring across every measured release, both digests (the shared-Title premise)", () => {
    const story = itemDocStory(bundle, BLUR, sidecar);
    expect(story.docs).toEqual([BLUR_DOC]);
    // every measured release of the key resolves the shared doc
    expect(story.docReleases).toBe(index.byKey.get(BLUR)!.versions);
    expect(story.bareReleases).toBe(0);
    expect(story.anchor).toEqual({ providerId: "gpui", vers: "0.1.0-test" });
    // every measured digest carries that one doc — variantDoc has both
    const variants = itemVariants(bundle, BLUR);
    expect(story.variantDoc.size).toBe(2);
    for (const v of variants) expect(story.variantDoc.get(v.digest)).toBe(BLUR_DOC);
    expect(index.byKey.get(BLUR)!.versions).toBe(story.docReleases + story.bareReleases);
  });

  test("FileWatcher::new: digest-aligned divergence — native baseline + browser variant", () => {
    const story = itemDocStory(bundle, FILE_WATCHER, sidecar);
    expect(story.docs).toEqual([NATIVE_DOC, BROWSER_DOC]);
    expect(story.docReleases).toBe(index.byKey.get(FILE_WATCHER)!.versions);
    expect(story.bareReleases).toBe(0);
    expect(story.anchor).toEqual({ providerId: "kael", vers: "0.1.1" });
    const variants = itemVariants(bundle, FILE_WATCHER);
    expect(variants.map((v) => v.shortDigest)).toEqual(["6509fd8e", "473446f4"]);
    // each digest maps to exactly one doc — the variant-level doc exists
    expect(story.variantDoc.get(variants[0].digest)).toBe(NATIVE_DOC);
    expect(story.variantDoc.get(variants[1].digest)).toBe(BROWSER_DOC);
  });

  test("register_url_scheme: docs diverge WITHIN one digest (the fork rename zed→kael never re-signed)", () => {
    const story = itemDocStory(bundle, URL_SCHEME, sidecar);
    expect(story.docs.length).toBe(2);
    expect(story.docs[0]).toContain("`zed` for `zed://` urls");
    expect(story.docs[1]).toContain("`kael` for `kael://` urls");
    expect(story.docReleases).toBe(index.byKey.get(URL_SCHEME)!.versions);
    expect(story.bareReleases).toBe(0);
    // its one measured digest spans both texts — no variant-level doc exists
    const variants = itemVariants(bundle, URL_SCHEME);
    expect(variants.length).toBe(1);
    expect(story.variantDoc.has(variants[0].digest)).toBe(false);
  });

  test("BackgroundExecutor::new: one docstring, but later releases resolve none (the doc removal)", () => {
    const story = itemDocStory(bundle, BACKGROUND_NEW, sidecar);
    expect(story.docs).toEqual(["Creates a new BackgroundExecutor from the given PlatformDispatcher."]);
    // the recorded removal: some measured releases resolve no doc…
    expect(story.bareReleases).toBeGreaterThan(0);
    // …and every measured release is either documented or bare.
    expect(story.docReleases + story.bareReleases).toBe(index.byKey.get(BACKGROUND_NEW)!.versions);
    expect(story.anchor).toEqual({ providerId: "gpui-ce", vers: "0.2.2" });
  });

  test("a type item has no doc story (decision 1(a)) — and no story while the sidecar is absent", () => {
    const story = itemDocStory(bundle, NODE, sidecar);
    expect(story.docs).toEqual([]);
    expect(story.docReleases).toBe(0);
    expect(story.anchor).toBeNull();
    // same item, no sidecar loaded: nothing resolves (honest pre-fetch state)
    const unloaded = itemDocStory(bundle, BLUR, null);
    expect(unloaded.docs).toEqual([]);
    expect(unloaded.bareReleases).toBe(index.byKey.get(BLUR)!.versions);
  });
});

describe("itemDocChips + diffDocLines — the measured deltas the deck renders", () => {
  test("FileWatcher::new yields one chip: the browser variant vs the native baseline", () => {
    const story = itemDocStory(bundle, FILE_WATCHER, sidecar);
    const chips = itemDocChips(story);
    expect(chips.length).toBe(1);
    const variants = itemVariants(bundle, FILE_WATCHER);
    expect(chips[0].digest).toBe(variants[1].digest); // the β browser variant
    expect(chips[0].doc).toBe(BROWSER_DOC);
    // the measured line diff vs the baseline: the two native lines removed,
    // the single browser line added
    expect(chips[0].diff.removed).toEqual([
      "Creates a file watcher that dispatches callbacks on the given app's",
      "foreground executor.",
    ]);
    expect(chips[0].diff.added).toEqual(["Create a browser file-watcher placeholder."]);
  });

  test("invariant items (blur) yield no chips — the docstring is their one story", () => {
    expect(itemDocChips(itemDocStory(bundle, BLUR, sidecar))).toEqual([]);
  });

  test("within-digest divergence (register_url_scheme) yields no chip — no variant-level doc exists", () => {
    expect(itemDocChips(itemDocStory(bundle, URL_SCHEME, sidecar))).toEqual([]);
  });

  test("diffDocLines reports added/removed lines (RULE-7 bytes, never a summary)", () => {
    expect(diffDocLines("a\nb\nc", "a\nx\nc")).toEqual({ added: ["x"], removed: ["b"] });
    expect(diffDocLines("same", "same")).toEqual({ added: [], removed: [] });
    expect(diffDocLines("a\nb", "a\nb\nc")).toEqual({ added: ["c"], removed: [] });
    expect(diffDocLines("a\nb\nc", "c\nd")).toEqual({ added: ["d"], removed: ["a", "b"] });
    expect(diffDocLines("", "")).toEqual({ added: [], removed: [] });
  });
});
