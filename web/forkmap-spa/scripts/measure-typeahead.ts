// T-46 measurement: the Alignment type-ahead's per-keystroke interaction
// cost over the resident data (the committed alignment item index).
//
// The before/after numbers the T-46 Outcome records follow this method:
//   - search latency is the pure `searchIndex` scan over the index the view
//     builds (indexIndex over forkmap-align-index.json — the same bytes the
//     served app loads), timed per query in bun; medians over N alternating
//     runs so JIT warm-up does not favor one query.
//   - the list population is reported two ways: the exact per-query match
//     row counts (the variable the T-46 render bound controls) and an SSR
//     markup-render proxy (react-dom/server over the same suggest-row
//     subtree for N rows) — a node floor for DOM population, NOT layout or
//     paint; the served by-ear pass in the Outcome covers the rest.
//   - the 1-/2-char match distribution is what the min-query decision is
//     grounded on (a 1-char query is nearly always a browse, never a
//     target; kind prefixes are exactly 3 chars).
//
// Stdlib + the committed data only; run with bun from web/forkmap-spa/:
//
//     bun scripts/measure-typeahead.ts [queries...]
//     # default queries: the T-46 worst cases (w wi win Window blur fn:)
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToString } from "react-dom/server";
import { createElement } from "react";
import { indexIndex } from "../src/bundle/alignmentSlice";
import { searchIndex } from "../src/bundle/derive";
import { validateAlignIndex } from "../src/bundle/validate";

const HERE = dirname(fileURLToPath(import.meta.url));
const INDEX_PATH = join(HERE, "..", "..", "forkmap", "data", "forkmap-align-index.json");
const index = indexIndex(validateAlignIndex(JSON.parse(readFileSync(INDEX_PATH, "utf8"))));

const fmt = (n: number) => n.toLocaleString("en-US");

/** Median ms of `fn` over `runs` alternating executions (JIT-fair). */
function medianMs(fn: () => void, runs = 200): number {
  for (let i = 0; i < 20; i++) fn(); // warm-up
  const samples: number[] = [];
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now();
    fn();
    samples.push(performance.now() - t0);
  }
  samples.sort((a, b) => a - b);
  return samples[Math.floor(samples.length / 2)];
}

/** SSR markup-render proxy for the suggestion listbox: N suggest-row
 * buttons (kind chip + release count), the same subtree the view maps. */
function renderRows(keys: string[]): string {
  return renderToString(
    createElement(
      "div",
      { role: "listbox" },
      keys.map((key, i) =>
        createElement(
          "button",
          {
            key,
            type: "button",
            className: "suggest-row",
            id: `align-opt-${i}`,
            role: "option",
          },
          createElement("span", { className: "kchip" },
            createElement("span", { className: "kchip-kind" }, key.slice(0, key.indexOf(":"))),
            createElement("span", { className: "kchip-name" }, key.slice(key.indexOf(":") + 1)),
          ),
          createElement("span", { className: "suggest-count" }, "1 release"),
        ),
      ),
    ),
  );
}

function reportQuery(query: string): void {
  const matches = searchIndex(index, query);
  const shown = matches.slice(0, 100);
  const scanMs = medianMs(() => searchIndex(index, query));
  console.log(`query ${JSON.stringify(query)}`);
  console.log(
    `  searchIndex median ${scanMs.toFixed(3)} ms · matches ${fmt(matches.length)} · rendered before ${fmt(matches.length)} rows / after ${fmt(shown.length)} rows + ${fmt(Math.max(0, matches.length - shown.length))} more-row`,
  );
  if (matches.length > 0) {
    const allMs = medianMs(() => renderRows(matches), 30);
    const shownMs = medianMs(() => renderRows(shown), 30);
    console.log(
      `  SSR listbox proxy (median, 30 runs): before ${allMs.toFixed(1)} ms over ${fmt(matches.length)} rows · after ${shownMs.toFixed(1)} ms over ${fmt(shown.length)} rows`,
    );
  }
}

function distribution(): void {
  // Every lowercase 1- and 2-letter query over the corpus — the shape the
  // min-query-floor decision is grounded on (a 1-char query is nearly always
  // a browse, never a target; kind prefixes are exactly 3 chars).
  const letters = "abcdefghijklmnopqrstuvwxyz";
  const byLen: Record<number, { zero: number; narrow: number; broad: number; max: { q: string; n: number } }> = {};
  const row = (len: number) => {
    byLen[len] ??= { zero: 0, narrow: 0, broad: 0, max: { q: "", n: 0 } };
    return byLen[len];
  };
  const count = (q: string) => {
    const n = searchIndex(index, q).length;
    const r = row(q.length);
    if (n === 0) r.zero += 1;
    else if (n <= 100) r.narrow += 1;
    else r.broad += 1;
    if (n > r.max.n) r.max = { q, n };
  };
  for (const a of letters) count(a);
  for (const a of letters) for (const b of letters) count(a + b);
  for (const len of [1, 2]) {
    const r = byLen[len];
    console.log(
      `${len}-char lowercase queries: ${fmt(r.zero)} no-match · ${fmt(r.narrow)} <= 100 (a plausible target) · ${fmt(r.broad)} > 100 (a browse); widest ${JSON.stringify(r.max.q)} → ${fmt(r.max.n)}`, 
    );
  }
}

const queries = process.argv.slice(2).length ? process.argv.slice(2) : ["w", "wi", "win", "Window", "blur", "fn:"];
console.log(`type-ahead over the committed align index: ${fmt(index.keys.length)} keys`);
for (const q of queries) reportQuery(q);
distribution();
