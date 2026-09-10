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

export function Header({ manifest, counts, view }: { manifest: ForkmapManifest; counts: BundleCounts; view: ViewName }) {
  return (
    <header className="site-header">
      <div className="wrap">
        <div className="brand">
          <a className="brand-lockup" href="#/">
            <span className="brand-tile" aria-hidden="true">
              <span className="tile-isle i1" />
              <span className="tile-isle i2" />
              <span className="tile-isle i3" />
            </span>
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
          </nav>
        </div>
      </header>
    );
    }
