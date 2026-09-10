// T-39 — study-reader excerpt parity (increment 5; design decision (a)-lite,
// recorded in the T-39 task file).
//
// The committed src/study/study-excerpts.ts is a diff-checked snapshot of the
// five study docs' (07/08/09/12/13) openings: every committed excerpt is
// regenerated here from the live repo markdown and compared byte-for-byte, so
// a doc edit that moves its opening breaks this suite loudly — drift stays
// visible and the modal never silently quotes a stale opening. Plus: the
// extraction rule's plain-text shape, the study-doc constant set, and the
// study-modal id-coverage tripwire.

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DOCS, DOC_NUMBERS, STUDY_DOC_NUMBERS, isStudyDoc } from "../src/content/docs";
import {
  EXCERPT_DOC_NUMBERS,
  excerptFromDoc,
  excerptSourcePath,
  plainText,
} from "../src/study/excerpt";
import { STUDY_EXCERPTS } from "../src/study/study-excerpts";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..", ".."); // repo root (tests/ -> web/forkmap-spa -> web -> root)
const SRC = join(HERE, "..", "src");

function studyDocMarkdown(num: number | string): string {
  return readFileSync(join(REPO, excerptSourcePath(num)), "utf8");
}

describe("the five study docs (07/08/09/12/13) are the reader's set", () => {
  test("STUDY_DOC_NUMBERS is exactly the five; DOC_NUMBERS aliases it", () => {
    expect([...STUDY_DOC_NUMBERS]).toEqual([7, 8, 9, 12, 13]);
    expect([...DOC_NUMBERS]).toEqual([...STUDY_DOC_NUMBERS]);
    expect([...EXCERPT_DOC_NUMBERS]).toEqual([...STUDY_DOC_NUMBERS]);
  });

  test("every study num has a DOCS entry whose source file exists in the repo", () => {
    for (const num of STUDY_DOC_NUMBERS) {
      const doc = DOCS[String(num)];
      expect(doc, `DOCS entry for ${num}`).toBeTruthy();
      expect(doc!.path).toMatch(/^docs\/04-user-docs\/.*\.md$/);
      const full = join(REPO, excerptSourcePath(num));
      expect(readFileSync(full, "utf8").length, `doc ${num} at ${full}`).toBeGreaterThan(200);
    }
  });

  test("isStudyDoc is true only for the five (non-studies stay outbound links)", () => {
    for (const num of STUDY_DOC_NUMBERS) {
      expect(isStudyDoc(num)).toBe(true);
      expect(isStudyDoc(String(num))).toBe(true);
    }
    for (const not of ["10", "11", "99"]) {
      expect(isStudyDoc(not)).toBe(false);
    }
  });
});

describe("the extraction rule (first paragraph under the doc's first ## section)", () => {
  test("each study doc yields a substantial single-paragraph excerpt", () => {
    for (const num of STUDY_DOC_NUMBERS) {
      const excerpt = excerptFromDoc(studyDocMarkdown(num));
      expect(excerpt.length, `doc ${num} excerpt length`).toBeGreaterThan(60);
      expect(excerpt.includes("\n"), `doc ${num} excerpt is one paragraph`).toBe(false);
    }
  });

  test("plain-text normalization strips inline markdown and keeps prose", () => {
    expect(plainText("`cargo gocar lock` **refuses** [doc 11](../04-user-docs/11-alias-shim-for-kits.md) floors")).toBe(
      "cargo gocar lock refuses doc 11 floors",
    );
    // a code span shields bracket text from link parsing ([patch] stays literal)
    expect(plainText("a same-name re-export crate + `[patch]` that routes")).toBe(
      "a same-name re-export crate + [patch] that routes",
    );
    // underscore emphasis is never stripped (platform_companion keeps its chars)
    expect(plainText("_x_ platform_companion")).toBe("_x_ platform_companion");
  });

  test("the committed excerpts are clean plain prose (no leftover markdown markers)", () => {
    for (const num of STUDY_DOC_NUMBERS) {
      const excerpt = STUDY_EXCERPTS[String(num)];
      expect(excerpt, `doc ${num} excerpt present`).toBeTruthy();
      expect(excerpt!.includes("**"), `doc ${num} no bold markers`).toBe(false);
      expect(excerpt!.includes("*"), `doc ${num} no emphasis markers`).toBe(false);
      expect(excerpt!.includes("`"), `doc ${num} no code spans`).toBe(false);
      expect(excerpt!.match(/\[[^\]]*\]\(/), `doc ${num} no link syntax`).toBeNull();
    }
  });
});

describe("committed excerpts are a diff-checked snapshot of the live docs", () => {
  test("every committed excerpt equals the current extraction of its doc (drift parity)", () => {
    for (const num of EXCERPT_DOC_NUMBERS) {
      const key = String(num);
      const want = excerptFromDoc(studyDocMarkdown(num));
      expect(STUDY_EXCERPTS[key], `doc ${key} excerpt matches the live doc opening`).toBe(want);
    }
  });

  test("the committed file covers exactly the five studies and nothing else", () => {
    const keys = Object.keys(STUDY_EXCERPTS).sort();
    expect(keys).toEqual([...STUDY_DOC_NUMBERS].map(String).sort());
    for (const key of keys) expect(STUDY_EXCERPTS[key].length).toBeGreaterThan(60);
  });
});

describe("study reader id-coverage tripwire", () => {
  test("every study-modal id exists in the component and is asserted by the render suite", () => {
    const ids = [
      "study-modal",
      "study-modal-kicker",
      "study-modal-title",
      "study-modal-excerpt",
      "study-modal-note",
      "study-modal-open",
      "study-modal-close",
    ];
    const component = readFileSync(join(SRC, "components", "StudyModal.tsx"), "utf8");
    const renderSuite = readFileSync(join(HERE, "study.render.test.tsx"), "utf8");
    for (const id of ids) {
      expect(component, `id ${id} in StudyModal.tsx`).toContain(`id="${id}"`);
      expect(renderSuite, `id ${id} asserted in study.render.test.tsx`).toContain(`id="${id}"`);
    }
  });

  test("every trigger-bearing view source announces the dialog on its study links", () => {
    // DocLink/StudyDocLink is the single choke point; the views that hand-build
    // study-title anchors must route them through it (aria-haspopup="dialog").
    for (const file of ["views/LandingView.tsx", "views/AlignmentView.tsx", "views/ConfigureView.tsx"]) {
      const src = readFileSync(join(SRC, file), "utf8");
      expect(src, `${file} uses StudyDocLink`).toContain("StudyDocLink");
    }
  });
});
