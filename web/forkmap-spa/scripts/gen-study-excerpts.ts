// T-39 — regenerate src/study/study-excerpts.ts from the five study docs
// (docs 04-user-docs 07/08/09/12/13). The extraction rule + plain-text
// normalization live in src/study/excerpt.ts and are shared with the drift
// parity test, so the committed file can never disagree with the live docs
// silently: `bun test` regenerates every excerpt and compares byte-for-byte.
//
// Output is deterministic — re-running with unchanged docs produces a
// byte-identical file (and prints "unchanged"). The build itself never
// regenerates (the deterministic-build rule: byte-identical re-runs), so the
// generated file is committed; run this when a study doc's opening changes
// and the drift test will tell you when you need to.
//
//   bun run study:excerpts     (from web/forkmap-spa/)
//
// Safety: refuses to write when any of the five docs yields no excerpt, so a
// doc restructure that breaks the rule fails loudly instead of emitting an
// empty/broken module.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { DOCS } from "../src/content/docs";
import { EXCERPT_DOC_NUMBERS, excerptFromDoc, excerptSourcePath } from "../src/study/excerpt";

const HERE = dirname(import.meta.dir); // web/forkmap-spa/
const REPO = join(HERE, "..", ".."); // repo root (web/forkmap-spa/../..)
const OUT = join(HERE, "src", "study", "study-excerpts.ts");

const entries: [string, string][] = [];
for (const num of EXCERPT_DOC_NUMBERS) {
  const key = String(num);
  const sourcePath = excerptSourcePath(key);
  const full = join(REPO, sourcePath);
  if (!existsSync(full)) throw new Error(`study excerpt source missing: ${full}`);
  const excerpt = excerptFromDoc(readFileSync(full, "utf8"));
  if (excerpt.length < 40) {
    throw new Error(
      `doc ${key} (${sourcePath}) yielded a ${excerpt.length}-char excerpt — the ` +
        "first-##-section rule may need the doc, or the doc lost its opening section",
    );
  }
  entries.push([key, excerpt]);
}

const header = `// T-39 — study-reader excerpts: one opening paragraph per study doc (docs
// 07/08/09/12/13), extracted verbatim from the repo markdown by the rule in
// src/study/excerpt.ts (first paragraph under the doc's first "## " section,
// inline markdown stripped to plain text) and plain-text-normalized.
//
// GENERATED FILE — do not hand-edit. Regenerate with \`bun run study:excerpts\`
// (scripts/gen-study-excerpts.ts). The excerpt is a diff-checked snapshot:
// \`bun test\` regenerates every entry from the live docs and compares it to
// this file, so a doc edit that moves its opening breaks the parity suite —
// drift stays visible, and the modal never silently quotes a stale opening.`;

const body = entries.map(([key, excerpt]) => `  ${JSON.stringify(key)}: ${JSON.stringify(excerpt)},`).join("\n");

const out = `${header}

export const STUDY_EXCERPTS: Record<string, string> = {
${body}
};
`;

const prev = existsSync(OUT) ? readFileSync(OUT, "utf8") : null;
if (prev === out) {
  console.log("study excerpts unchanged (docs match the committed file)");
} else {
  if (prev !== null) {
    const show = prev.split("\n").findIndex((l, i) => out.split("\n")[i] !== l);
    console.log(`study excerpts CHANGED at line ${show + 1} — regenerated ${OUT}`);
  } else {
    console.log(`study excerpts generated: ${OUT}`);
  }
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, out);
}

// Also surface the per-doc opening words once per run, so a human glancing at
// the generator output sees what the rule picked up.
for (const [key, excerpt] of entries) {
  const opener = excerpt.length > 110 ? `${excerpt.slice(0, 110)}…` : excerpt;
  console.log(`  doc ${key}: ${opener}`);
}
console.log(`source: ${DOCS["7"].path.replace(/^\.\.\/\.\.\//, "")} et al. (${REPO})`);
