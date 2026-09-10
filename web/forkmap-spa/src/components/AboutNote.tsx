// T-39 — AboutNote (the static site's aboutNote(), ported: the "About the
// data — the honest display rules, implemented" disclosure shared by the
// Changes and Alignment views). The short-form rule rows carry the
// honest-rule-1…7 ids that the id-coverage tripwires and the smoke assert,
// and the id semantics of the DOM-landing list: a reviewer can find every
// rule in the UI and in the code. Ported 1:1 from the retired
// web/forkmap/app.js (ruleList(false) + docLinkRow).

import { Fragment } from "react";
import { DOC_NUMBERS } from "../content/docs";
import { DocLink } from "./common";

const SHORT_RULES: { strong: string; rest: string }[] = [
  {
    strong: "Rule 1 —",
    rest: "no cross-fork “same generation” badges, ever — the cells and dots are the whole story; cross-fork Changes deltas are snapshot-surface differences, never changelogs, with rule rows informational only.",
  },
  {
    strong: "Rule 2 —",
    rest: "items are kind:name with module paths where the corpus walks pub mod chains (root re-exports stay flat); fn digests are parameter-type; a type's digest covers its consumer-visible pub members only — doc comments and pub(crate)/private members never re-sign a type.",
  },
  {
    strong: "Rule 3 —",
    rest: "methods and associated items of public types are measured (T-26); derives, trait-interface items, external-crate members and cfg evaluation are not — never inferred.",
  },
  { strong: "Rule 4 —", rest: "null ≠ unchanged: unmeasured rows render “not measured”." },
  {
    strong: "Rule 5 —",
    rest: "“compiles” badges only where the studies compiled real artifacts, each linked to its evidence.",
  },
  {
    strong: "Rule 6 —",
    rest: "yanked + prerelease rows are flagged; a prerelease is never a default choice.",
  },
  {
    strong: "Rule 7 —",
    rest: "every claim traces to the dataset; nothing here is hand-edited.",
  },
];

export function AboutNote() {
  return (
    <section className="about-note">
      {/* Closed by default (T-42 copy pass): the full rule text stays in the
          DOM for the id tripwires, one click (or Tab+Enter on the summary)
          away instead of pushing the page length. */}
      <details>
        <summary>About the data — the honest display rules</summary>
        <p className="subnote">
          Seven rules shared with the CLI toolchain are code paths here (ids honest-rule-1…7 in the DOM and
          RULE-1…7 in app.js).
        </p>
        <ol className="rules">
          {SHORT_RULES.map((r, i) => (
            <li key={i} id={`honest-rule-${i + 1}`}>
              <strong>{r.strong}</strong> {r.rest}
            </li>
          ))}
        </ol>
        <p className="subnote">
          <strong>Studies &amp; docs: </strong>
          {DOC_NUMBERS.map((n) => (
            <Fragment key={n}>
              <DocLink num={n} />{" · "}
            </Fragment>
          ))}
        </p>
      </details>
    </section>
  );
}
