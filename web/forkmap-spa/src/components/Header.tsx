// T-39 — site header chrome (ported from web/forkmap/index.html + main()'s
// quick-metric fill). Metrics are read from the loaded bundle (RULE-7 —
// never typed into the page).

import type { BundleCounts, ForkmapManifest } from "../bundle/types";
import type { ViewName } from "../routing";

const NAV: { view: ViewName; href: string; label: string }[] = [
  { view: "landing", href: "#/", label: "Map overview" },
  { view: "changes", href: "#/changes", label: "Changes" },
  { view: "alignment", href: "#/alignment", label: "Alignment" },
  { view: "configure", href: "#/configure", label: "Configure" },
  { view: "journal", href: "#/journal", label: "Journal" },
];

/** This SPA is the fork-map viewer; the main site is its sibling at the origin
 *  root (this app is served from /map/). Absolute rather than ../ so it still
 *  resolves when the map is served from a different path in dev. */
const BACK_HREF = "https://gpui-archipelago.github.io/";

export function Header({ manifest, counts, view }: { manifest: ForkmapManifest; counts: BundleCounts; view: ViewName }) {
  return (
    <header className="site-header">
      <div className="wrap">
        <div className="brand">
          <a className="brand-lockup" href="#/">
            <img className="brand-tile" src="./logo-mark.webp" alt="" width={38} height={38} />
            <span className="brand-text">
              <span className="brand-line">
                <span className="brand-mark">gpui-archipelago</span>
                <span className="brand-aka">(the fork map)</span>
                <span
                  className="brand-chip mono"
                  title="the committed boot-manifest schema — see the footer provenance"
                >
                  bundle <span id="header-schema">{manifest.schema}</span>
                </span>
              </span>
              <span className="brand-sub">every fork is an island · empirical cross-fork alignment</span>
            </span>
          </a>
        </div>

        <div className="header-metrics mono" aria-label="dataset quick metrics">
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
          <span className="h-sep" aria-hidden="true">
            ·
          </span>
          <span className="h-metric">
            <span className="h-num" id="metric-items">
              {counts.items.toLocaleString("en-US")}
            </span>
            &nbsp;item records
          </span>
          <span className="h-sep" aria-hidden="true">
            ·
          </span>
          <span className="h-metric">
            <span className="h-num" id="metric-facades">
              {counts.facades}
            </span>
            &nbsp;shim tables
          </span>
        </div>

        <nav className="site-nav" aria-label="views">
          {NAV.map((n) => (
            <a key={n.view} href={n.href} className={view === n.view ? "active" : undefined}>
              {n.label}
            </a>
          ))}
          {/* The way back to the main site. Sits last, mirroring the site's own
              nav, whose one outbound link (GitHub) also comes last. */}
          <a className="nav-back" href={BACK_HREF}>
            gpui-archipelago <span aria-hidden="true">↗</span>
          </a>
          </nav>
        </div>
      </header>
    );
    }
