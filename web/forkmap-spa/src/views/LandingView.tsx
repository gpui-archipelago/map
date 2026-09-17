// T-39 — Landing / Map Overview (the static site's view-landing, ported).
//
// Copy and structure follow web/forkmap/index.html's view-landing section
// verbatim; the data-driven fills (data as of, facts, compile badges, kit
// probes, doc links) read the loaded bundle exactly like renderLanding in
// app.js does. honest-rule-1…7 ids stay in the DOM 1:1.

import type { BundleCounts, ForkmapManifest, ManifestProvider } from "../bundle/types";
import { DOCS } from "../content/docs";
import { DocLink } from "../components/common";
import { StudyDocLink } from "../components/StudyDocLink";

function CompileBadges({ providers }: { providers: ManifestProvider[] }) {
  return (
    <>
      {providers.map((p) => {
        const m = p.compile_verified;
        return (
          <div className="badge" key={p.id}>
            <span className="badge-name">{p.package}</span>
            <span className="badge-vers">{m ? m.vers : "—"}</span>
            <span className="badge-evidence">
              {m ? `compiled on rustc ${m.toolchain} — ` : "no compile evidence yet"}
              {m && <StudyDocLink num={7} href={m.evidence} />}
            </span>
          </div>
        );
      })}
    </>
  );
}

function KitProbes({ manifest }: { manifest: ForkmapManifest }) {
  return (
    <>
      {manifest.kit_probes.map((kp) => (
        <div className="kit-probe" key={`${kp.kit}@${kp.kit_version}`}>
          <div className="kit-probe-head">{`${kp.kit} ${kp.kit_version}`}</div>
          <div className="kit-probe-line muted">{`binds ${kp.binds} → target ${kp.target}`}</div>
          <div className="kit-probe-line">{kp.outcome}</div>
          {kp.caveat && <div className="kit-probe-line muted">caveat: {kp.caveat}</div>}
          <div className="kit-probe-line">
            <StudyDocLink num={12} href={kp.evidence}>{"evidence — " + DOCS[12].title}</StudyDocLink>
          </div>
        </div>
      ))}
    </>
  );
}

export function LandingView({ manifest, counts }: { manifest: ForkmapManifest; counts: BundleCounts }) {
  return (
    <section id="view-landing" className="view">
      <div className="wrap">
        <div className="hero">
          <p className="hero-eyebrow mono">
            how the GPUI packages on crates.io differ — measured from source
          </p>
          <h1>The GPUI fork map</h1>
          <blockquote className="hero-quote">
            Every fork is an island. There’s no mainland and no one’s building one, so the islands have to find
            each other. Here they can.
          </blockquote>
          <p className="hero-intro">
            Zed’s UI framework is published on crates.io under six different package names — <code>gpui</code>,{" "}
            <code>gpui-ce</code>, <code>gpui-unofficial</code>, <code>gpui-pre</code>, <code>kael</code>,{" "}
            <code>gpui-box</code> — with version numbers that do not line up. This map compares what is actually
            inside them:
          </p>

          <div className="card-grid workflow">
            <a className="card card-cta c-coral" href="#/changes">
              <span className="card-num mono" aria-hidden="true">
                01
              </span>
              <span className="card-body">
                <span className="card-title">What changed</span>
                <span className="card-sub">
                  What changed between any two releases: items added, removed, or given a new signature. Within one
                  fork that is a changelog; across two forks it is just one snapshot beside another.
                </span>
              </span>
            </a>
            <a className="card card-cta c-ocean" href="#/alignment">
              <span className="card-num mono" aria-hidden="true">
                02
              </span>
              <span className="card-body">
                <span className="card-title">Who carries it</span>
                <span className="card-sub">
                  Search for an item (like <code>struct:Window</code>) and see which forks carry it, when its
                  signature changed, and where it was dropped.
                </span>
              </span>
            </a>
            <a className="card card-cta c-island" href="#/configure">
              <span className="card-num mono" aria-hidden="true">
                03
              </span>
              <span className="card-body">
                <span className="card-title">Which fork to bind</span>
                <span className="card-sub">
                  Pick a fork — and a release, if you want — and copy the <code>Cargo.toml</code> and{" "}
                  <code>main.rs</code> that <code>cargo gocar new</code> would write for it.
                </span>
              </span>
            </a>
            <a className="card card-cta c-amber" href="#/journal">
              <span className="card-num mono" aria-hidden="true">
                04
              </span>
              <span className="card-body">
                <span className="card-title">Release timeline</span>
                <span className="card-sub">
                  Every release of every fork in one scroll, with what each release changed.
                </span>
              </span>
            </a>
          </div>
        </div>

        <div className="panel data-strip" id="landing-data">
          <span className="data-strip-when mono">
            <span className="h-dot" aria-hidden="true" />
            data as of <span id="data-as-of">{manifest.dataset_synced_at ?? "(unsynced dataset)"}</span>
          </span>
          <span id="data-facts" className="data-facts">
            <span className="data-facts-counts">
              {counts.providers} forks · {counts.versions} releases · {counts.items} items measured across{" "}
              {counts.keys} distinct names · {counts.facades} releases carry facade shims
            </span>
            <span className="data-facts-claim">
              No two releases from different forks match in this data, so comparisons between forks are always item
              by item
            </span>
          </span>
        </div>

        <div className="landing-cols">
          <div className="col-main">
            <div className="panel">
              <div className="panel-head">
                <h2>Where the data comes from</h2>
                <span className="panel-kicker mono">three sources, kept separate</span>
              </div>
              <table id="data-layers" className="layers">
                <thead>
                  <tr>
                    <th>Source</th>
                    <th>What it tells you</th>
                    <th>Where it comes from</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <span className="tag tag-registry">crates.io</span>
                    </td>
                    <td>
                      which versions exist, which are yanked or prerelease, and the <code>rust-version</code> each
                      one declares (as declared, not verified)
                    </td>
                    <td>live from crates.io</td>
                  </tr>
                  <tr>
                    <td>
                      <span className="tag tag-measured">Source code</span>
                    </td>
                    <td>
                      the items each release exposes (<code>kind:name</code> plus a hash of each) and a hash of the
                      whole set — this is what every dot on the page reads
                    </td>
                    <td>
                      parsed from the published source
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <span className="tag tag-stub">Not measured yet</span>
                    </td>
                    <td>
                      derives, trait-interface items, members pulled in from other crates, auto-traits, compiler
                      floors, and cfg <em>evaluation</em> — shown as <em>not measured</em>, never guessed. (Methods
                      and associated items on public types are measured, and each entry records the cfg gates that
                      apply.)
                    </td>
                    <td>to come</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="panel">
              <div className="panel-head">
                <h2>What the map will not claim</h2>
                <span className="panel-kicker mono">enforced in the code, not just here</span>
              </div>
              <p className="subnote">
                Each rule carries the same id in this page and in the code, so a reviewer can find it in both.
              </p>
              <ol id="honest-rules" className="rules">
                <li id="honest-rule-1">
                  <strong>Two releases are only ever called the same within one fork.</strong> Nothing here badges
                  two different forks as the same generation — the dots and cells are the whole story. Identical
                  hashes only happen when a fork republishes its own release byte for byte, and no two forks match
                  in this data. When Changes compares two <em>different</em> forks it shows one snapshot beside
                  another, never a changelog.
                </li>
                <li id="honest-rule-2">
                  <strong>Items are named <code>kind:name</code>.</strong> Module paths are included where the
                  source has real module nesting (<code>fn:profiler::record_frame_event</code>); re-exports stay
                  flat (<code>struct:Window</code>). A function’s hash covers its parameter types, so renaming a
                  parameter does not count as a change. For types, doc comments are part of the text, so a
                  doc-only edit does.
                </li>
                <li id="honest-rule-3">
                  <strong>What is not measured is labelled, not guessed.</strong> Methods and associated items on
                  public types are measured, along with the cfg gates that apply. Derives, trait items, members
                  pulled in from other crates, and cfg evaluation are not. Where that matters the view says so — a
                  quiet row is never taken as proof the two agree.
                </li>
                <li id="honest-rule-4">
                  <strong>A missing row means “not measured”, not “unchanged”.</strong> Unmeasured entries say so.
                </li>
                <li id="honest-rule-5">
                  <strong>Compile badges need evidence.</strong> A release is only marked compile-verified where a
                  study compiled the real artifact, and the badge links to it (docs 07 and 12).
                </li>
                <li id="honest-rule-6">
                  <strong>Yanked and prerelease versions are shown, and flagged.</strong> A prerelease is never
                  presented as a safe choice.
                </li>
                <li id="honest-rule-7">
                  <strong>Every number comes from the dataset.</strong> The footer names the command and schema
                  that produced it, and nothing on the page is typed in by hand.
                </li>
              </ol>
              <p className="subnote">
                The studies behind these rules: 08 (what a used-API report can prove on real code), 09 (migrating
                across the 1.17.2 break), 12 (the kit compile evidence) and 13 (the two-kits field note). They are
                also linked from <a href="#/changes">Changes</a> and <a href="#/alignment">Alignment</a>.
              </p>
            </div>
          </div>

          <div className="col-side">
            <div className="panel">
              <div className="panel-head">
                <h2>Verified compiles</h2>
                <span className="panel-kicker mono island">evidence only</span>
              </div>
              <p className="subnote">
                Only studies that compiled the real thing can mark a release as verified: the six-fork scaffold
                matrix (<span id="landing-link-doc07">
                  <DocLink num={7} />
                </span>
                ) and the kit checks (<span id="landing-link-doc12">
                  <DocLink num={12} />
                </span>
                ). Each badge below links its evidence, and nothing else here claims a compile.
              </p>
              <div id="compile-badges" className="badge-list">
                <CompileBadges providers={manifest.providers} />
              </div>
              <h3 className="panel-sub">Kit checks — do the two kits actually compile?</h3>
              <div id="kit-probes">
                <KitProbes manifest={manifest} />
              </div>
              <p className="subnote">
                The same data answers a kit maintainer’s question — which fork should a kit bind? (<span
                  id="landing-link-doc13"
                >
                  <DocLink num={13} />
                </span>
                )
              </p>
            </div>
          </div>
        </div>

        <div className="panel">
          <h2>Ask the same questions from the CLI</h2>
          <p>
            This page is a read-only view of what <code>cargo gocar</code> measures. For verdicts about your own
            code — which symbols your app uses, and which fork provides them — use the CLI: <code>report</code>,{" "}
            <code>plan</code>, <code>facade</code>, <code>migrate</code>, <code>verify-env</code>.{" "}
            <span id="landing-link-cli">
              <DocLink num="cli" />
            </span>
          </p>
        </div>
      </div>
    </section>
  );
}
