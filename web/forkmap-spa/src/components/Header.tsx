// T-39 — site header chrome (ported from web/forkmap/index.html + main()'s
// quick-metric fill). Metrics are read from the loaded bundle (RULE-7 —
// never typed into the page).
//
// T-55 copy pass: one row. The brand is the name and its mark — the
// "(the fork map)" aside, the "every fork is an island" line and the bundle
// schema chip are gone (the landing's title sets the stage, and the schema
// lives in the landing's provenance card with the rest of the bundle facts).
// The middle is the nav, and the right edge carries the two headline counts
// and the way out to the repository.

import type { BundleCounts } from "../bundle/types";
import type { ViewName } from "../routing";

const NAV: { view: ViewName; href: string; label: string }[] = [
  { view: "landing", href: "#/", label: "Map overview" },
  { view: "changes", href: "#/changes", label: "Changes" },
  { view: "alignment", href: "#/alignment", label: "Alignment" },
  { view: "configure", href: "#/configure", label: "Configure" },
  { view: "journal", href: "#/journal", label: "Journal" },
];

/** The map's own repository — the chrome's one outbound link. */
const REPO_HREF = "https://github.com/gpui-archipelago/map";

export function Header({ counts, view }: { counts: BundleCounts; view: ViewName }) {
  return (
    <header className="site-header">
      <div className="wrap">
        <a className="brand-lockup" href="#/">
          <img className="brand-tile" src="./logo-mark.webp" alt="" width={30} height={30} />
          <span className="brand-mark">gpui-archipelago</span>
        </a>

        <nav className="site-nav" aria-label="views">
          {NAV.map((n) => (
            <a key={n.view} href={n.href} className={view === n.view ? "active" : undefined}>
              {n.label}
            </a>
          ))}
        </nav>

        <div className="header-side">
          <span className="header-metrics mono" aria-label="what the dataset contains">
            <span className="h-metric">
              <span className="h-dot" aria-hidden="true" />
              <span className="h-num" id="metric-providers">
                {counts.providers}
              </span>
              &nbsp;forks
            </span>
            <span className="h-sep" aria-hidden="true">
              ·
            </span>
            <span className="h-metric">
              <span className="h-num" id="metric-versions">
                {counts.versions}
              </span>
              &nbsp;releases
            </span>
          </span>
          {/* The one outbound link, named for where it goes. */}
          <a className="nav-github" href={REPO_HREF} target="_blank" rel="noopener noreferrer">
            GitHub <span aria-hidden="true">↗</span>
          </a>
        </div>
      </div>
    </header>
  );
}
