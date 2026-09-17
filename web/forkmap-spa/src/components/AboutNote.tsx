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
    rest: "two releases are only called the same within one fork; the dots and cells are the whole story. Comparing two different forks shows one snapshot beside another, never a changelog.",
  },
  {
    strong: "Rule 2 —",
    rest: "items are named kind:name, with module paths where the source nests modules. A function's hash covers its parameter types; a type's covers its public members, so doc comments and private members never change it.",
  },
  {
    strong: "Rule 3 —",
    rest: "methods and associated items on public types are measured; derives, trait items, members from other crates and cfg evaluation are not — and are never guessed at.",
  },
  { strong: "Rule 4 —", rest: "a missing row means “not measured”, not “unchanged”." },
  {
    strong: "Rule 5 —",
    rest: "a compile badge only appears where a study compiled the real thing, and it links its evidence.",
  },
  {
    strong: "Rule 6 —",
    rest: "yanked and prerelease releases are shown and flagged; a prerelease is never the default choice.",
  },
  {
    strong: "Rule 7 —",
    rest: "every number comes from the dataset; nothing here is typed in by hand.",
  },
];

export function AboutNote() {
  return (
    <section className="about-note">
      {/* Closed by default (T-42 copy pass): the full rule text stays in the
          DOM for the id tripwires, one click (or Tab+Enter on the summary)
          away instead of pushing the page length. */}
      <details>
        <summary>About the data — what it will and will not claim</summary>
        <p className="subnote">
          Seven rules, the same ones the CLI follows. Each carries the same id here and in the code, so a reviewer
          can find it in both.
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
