// T-39 — the documents index.
//
// The study docs are evidence: each one is linked from the claim it grounds, in
// whichever view makes that claim. This page is the other way round — every
// document the reader can open, in one table — and it is deliberately not in
// the nav: the map's five tabs stay five tabs, and the index lives at #/docs
// (one document at #/docs?doc=07, which is the link the rest of the suite
// cites). It also gives two documents their first way in: doc 10 is named once,
// in Configure, and doc 11 is linked from nowhere at all.
//
// The route is the state. Every row is a real href on its topic, so a document
// is linkable, shareable and openable in a new tab; opening one opens the reader
// over the index, and closing it drops the param so the URL never claims a
// document is open when it is not. The doc param goes through Number() so the
// padded form the docs themselves use (#/docs?doc=07) and the bare one
// (#/docs?doc=7) both resolve — and a param naming nothing published opens
// nothing.

import { DOCS, docTopic } from "../content/docs";
import { DOC_INDEX, SUITE_TAKEAWAYS } from "../content/docIndex";
import { routeHash } from "../routing";
import { StudyModal } from "../components/StudyModal";

/** The published docs in the map's own numbering. */
const NUMBERS = Object.keys(DOCS).sort((a, b) => Number(a) - Number(b));

/** The doc number this route names, or null. "" and anything that is not a
 * published doc are null (nothing opens). */
function requestedDoc(params: Record<string, string>): string | null {
  if (params.doc === undefined) return null;
  const num = String(Number(params.doc));
  return DOCS[num] ? num : null;
}

/** The index prose is plain text with `backticked` identifiers; render those as
 * code, like every other view does with the names it quotes. */
function Inline({ text }: { text: string }) {
  return (
    <>
      {text.split(/(`[^`]+`)/g).map((part, i) =>
        part.length > 2 && part.startsWith("`") && part.endsWith("`") ? (
          <code key={i}>{part.slice(1, -1)}</code>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

export function DocsIndexView({ params }: { params: Record<string, string> }) {
  const open = requestedDoc(params);
  const index = routeHash("docs", {});

  // Closing the reader (Escape, Close, the overlay, or its raw-markdown link)
  // drops the param and leaves the index in place.
  const close = () => {
    if (window.location.hash !== index) window.location.hash = index;
  };

  return (
    <section id="view-docs" className="view">
      <div className="wrap">
        <div className="view-head">
          <p className="view-eyebrow mono">documents</p>
          <h1>Documents</h1>
        </div>
        <p className="lede" id="docs-lede">
          {
            "Every document this map publishes: its topic, how far it got, and the claim it establishes. Each title opens the document in the reader."
          }
        </p>
        <div className="table-scroll">
          <table className="docs-index" id="docs-index">
            <thead>
              <tr>
                <th scope="col">Doc</th>
                <th scope="col">Topic</th>
                <th scope="col">Status</th>
                <th scope="col">Finding &amp; takeaway</th>
              </tr>
            </thead>
            <tbody>
              {NUMBERS.map((num) => {
                const doc = DOCS[num];
                const entry = DOC_INDEX[num];
                return (
                  <tr className="docs-row" id={`docs-row-${num}`} key={num}>
                    <td className="docs-doc">{num.padStart(2, "0")}</td>
                    <td>
                      <a
                        className="docs-title"
                        href={routeHash("docs", { doc: num.padStart(2, "0") })}
                        aria-current={open === num ? "true" : undefined}
                      >
                        {docTopic(num)}
                      </a>
                      <span className="docs-path mono">{doc.path}</span>
                    </td>
                    <td>
                      <span className="docs-status">{entry.status}</span>
                      {entry.note && <span className="docs-note">{entry.note}</span>}
                    </td>
                    <td className="docs-finding">
                      <p className="docs-claim">
                        <Inline text={entry.finding} />
                      </p>
                      <ul className="docs-points">
                        {entry.points.map((point) => (
                          <li key={point}>
                            <Inline text={point} />
                          </li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <section className="docs-suite" id="docs-suite">
          <h2 className="section-head">Key takeaways across the suite</h2>
          <ol className="docs-suite-list">
            {SUITE_TAKEAWAYS.map((takeaway) => (
              <li key={takeaway.title}>
                <strong>{takeaway.title}</strong> <Inline text={takeaway.body} />
              </li>
            ))}
          </ol>
        </section>
      </div>
      {open && <StudyModal num={open} onClose={close} />}
    </section>
  );
}
