// T-39 — site header chrome (ported from web/forkmap/index.html + main()'s
// quick-metric fill). Metrics are read from the loaded bundle (RULE-7 —
// never typed into the page).
//
// T-55 copy pass: one row, and the suite hierarchy stated once. This app is a
// child of the gpui-archipelago site (it is served from /map/), so the brand
// is a breadcrumb — the wordmark is the way home, `/ Fork Map` declares the
// tool you are in — and the tabs are that tool's views, named without
// repeating “map” inside the map. No ↗ link back to the brand's own site: the
// breadcrumb is the home link. The bundle schema lives in the footer, and the
// landing's provenance card carries the full statement.

import type { BundleCounts } from "../bundle/types";
import type { ViewName } from "../routing";

const NAV: { view: ViewName; href: string; label: string }[] = [
  { view: "landing", href: "#/", label: "Overview" },
  { view: "changes", href: "#/changes", label: "Changes" },
  { view: "alignment", href: "#/alignment", label: "Alignment" },
  { view: "configure", href: "#/configure", label: "Configure" },
  { view: "journal", href: "#/journal", label: "Journal" },
];

/** The project home this tool lives inside (the map is served from /map/).
 * Absolute rather than ../ so it still resolves when the map is served from a
 * different path in dev. */
const HOME_HREF = "https://gpui-archipelago.github.io/";

/** The map's own repository — the chrome's one outbound link. */
const REPO_HREF = "https://github.com/gpui-archipelago/map";

export function Header({ counts, view }: { counts: BundleCounts; view: ViewName }) {
  return (
    <header className="site-header">
      <div className="wrap">
        <div className="brand-lockup">
          <a className="brand-home" href={HOME_HREF} title="gpui-archipelago — the project home">
            <img className="brand-tile" src="./logo-mark.webp" alt="" width={30} height={30} />
            <span className="brand-mark">gpui-archipelago</span>
          </a>
          <span className="brand-sep" aria-hidden="true">
            /
          </span>
          <span className="brand-tool">Fork Map</span>
        </div>

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
