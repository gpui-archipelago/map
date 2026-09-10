// T-39 — shared small components: doc links, kind chips, digest lists
// (ported from web/forkmap/app.js DOM helpers).

import { StudyDocLink } from "./StudyDocLink";

/** A doc link (a.styled like the static site's .doc anchors). Study docs
 * (07/08/09/12/13) open the in-page excerpt dialog (T-39 (a)-lite) on a
 * plain click; every other doc link stays a plain outbound anchor. */
export function DocLink({ num, className }: { num: number | string; className?: string }) {
  return <StudyDocLink num={num} className={className} />;
}

/** kind:name chip — the measured identity rendered verbatim (rule 2). */
export function KindChip({ item }: { item: string }) {
  const i = item.indexOf(":");
  const kind = i > 0 ? item.slice(0, i) : "?";
  const name = i > 0 ? item.slice(i + 1) : item;
  return (
    <span
      className="kchip"
      title={`measured item "${item}" — rendered verbatim as measured (see honest rule 2)`}
    >
      <span className="kchip-kind">{kind}</span>
      <span className="kchip-name">{name}</span>
    </span>
  );
}

/** Short digest prefixes with the full digest in the title. */
export function DigestList({ digests }: { digests: string[] }) {
  return (
    <span className="digests muted">
      digest {digests.length > 1 ? "(s) " : ""}
      {digests.map((d) => (
        <code key={d} title={d}>
          {d.slice(0, 12)}…
        </code>
      ))}
    </span>
  );
}
