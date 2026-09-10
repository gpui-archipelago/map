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
              {m ? `compiled on rustc ${m.toolchain} — ` : "no compile study yet"}
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
            crates.io cross-fork alignment &amp; empirical measurement — a dumb renderer over the gocar dataset
          </p>
          <h1>The GPUI fork map</h1>
          <blockquote className="hero-quote">
            Every fork is an island. There’s no mainland and no one’s building one, so the islands have to find
            each other. Here they can.
          </blockquote>
          <p className="hero-intro">
            Zed’s UI framework is republished on crates.io as six packages — <code>gpui</code>,{" "}
            <code>gpui-ce</code>, <code>gpui-unofficial</code>, <code>gpui-pre</code>, <code>kael</code>,{" "}
            <code>gpui-box</code> — under incomparable version numbers. This map answers the questions names
            cannot:
          </p>

          <div className="card-grid workflow">
            <a className="card card-cta c-coral" href="#/changes">
              <span className="card-num mono" aria-hidden="true">
                01
              </span>
              <span className="card-body">
                <span className="card-title">What changed</span>
                <span className="card-sub">
                  The item-set delta between any two releases of any fork(s): added / removed / re-signed,
                  computed here from the measured surfaces. Within a fork it is a changelog; across forks it is a
                  snapshot-surface difference.
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
                  Type an item (<code>kind:name</code>) — per-fork presence / re-signature matrix with
                  first-removal callouts and rule successors.
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
                  Pick a fork (optionally an exact release) — copy the manifest + starter <code>main.rs</code>{" "}
                  that <code>cargo gocar new</code> writes, byte-equal.
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
                  Every release of every fork in one continuous scroll — each entry is what that release changed
                  against the release before it.
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
              {counts.providers} forks · {counts.versions} published versions · {counts.items} measured item
              records across {counts.keys} item identities · {counts.facades} versions carry facade shim tables
            </span>
            <span className="data-facts-claim">
              In this data no two releases of different forks share an identical measured surface — cross-fork
              comparisons are item-level claims only
            </span>
          </span>
        </div>

        <div className="landing-cols">
          <div className="col-main">
            <div className="panel">
              <div className="panel-head">
                <h2>Three truth layers</h2>
                <span className="panel-kicker mono">separation of attestation</span>
              </div>
              <table className="layers">
                <thead>
                  <tr>
                    <th>Layer</th>
                    <th>What the map shows</th>
                    <th>Origin</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <span className="tag tag-registry">Registry truth</span>
                    </td>
                    <td>
                      published versions, yanked / prerelease flags, declared <code>rust-version</code> (never an
                      attestation)
                    </td>
                    <td>live crates.io sync</td>
                  </tr>
                  <tr>
                    <td>
                      <span className="tag tag-measured">Measured</span>
                    </td>
                    <td>
                      per-version item surfaces (<code>kind:name</code> + digest), whole-surface hashes — every
                      dot on this page
                    </td>
                    <td>
                      syn-level corpus analysis (<code>gocar-index</code>)
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <span className="tag tag-stub">Not yet measured</span>
                    </td>
                    <td>
                      derives / trait-interface items / external-crate members, auto-traits, attested compiler
                      floors, cfg <em>evaluation</em> — shown as <em>not measured</em>, never guessed (methods and
                      assoc items of public types are measured since T-26; each entry carries its cfg gates as
                      provenance)
                    </td>
                    <td>awaits the compiler/rustdoc passes (phase 3)</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="panel">
              <div className="panel-head">
                <h2>Honest display rules</h2>
                <span className="panel-kicker mono">implemented as code paths, not prose</span>
              </div>
              <p className="subnote">
                Each rule carries the same id in the DOM you are reading and in <code>app.js</code>, so a reviewer
                can find every rule in the UI and in the code.
              </p>
              <ol id="honest-rules" className="rules">
                <li id="honest-rule-1">
                  <strong>Epochs are exact-copy-only within a stream.</strong> No cross-fork “same generation”
                  badges exist anywhere on this site — matrix cells and dots are the whole story. Equal
                  whole-surface hashes occur only for within-stream byte-identical republishes, and equal surfaces
                  never span two forks in this data. When the Changes view compares two <em>different</em> forks,
                  it renders a snapshot-surface difference (never a changelog), and rule rows there are
                  informational only.
                </li>
                <li id="honest-rule-2">
                  <strong>Qualified item identity.</strong> Items are <code>kind:&lt;name&gt;</code> with module
                  paths where the corpus walks <code>pub mod</code> chains (
                  <code>fn:profiler::record_frame_event</code>); root re-exports stay flat (
                  <code>struct:Window</code>). Fn digests are parameter-type level (a parameter rename never
                  re-signs); doc comments are part of a type’s canonical text, so a doc-only change reads as a
                  re-signature (a changed digest).
                </li>
                <li id="honest-rule-3">
                  <strong>Out-of-model is stated, never inferred.</strong> Methods and associated items of public
                  types are measured (T-26, 2026-09-07) and each entry carries its effective cfg gates as
                  provenance; derives, trait-interface items, external-crate members and cfg evaluation are
                  outside the measured item model. Views that touch them say so — the map never infers
                  compatibility from a lack of deltas.
                </li>
                <li id="honest-rule-4">
                  <strong>
                    <code>null</code> is not “unchanged”.
                  </strong>{" "}
                  An unmeasured row renders “not measured”, never as an absence or a non-change.
                </li>
                <li id="honest-rule-5">
                  <strong>Badges need evidence.</strong> “Compile-verified” appears only where the studies
                  compiled real artifacts, and each badge links its study (docs 07 / 12).
                </li>
                <li id="honest-rule-6">
                  <strong>Flags are shown, not hidden.</strong> Yanked and prerelease rows are rendered and
                  flagged; a prerelease is never presented as a stable choice.
                </li>
                <li id="honest-rule-7">
                  <strong>Every claim traces to the dataset.</strong> One footer names the generating command and
                  schema; every number on this page is derived from the dataset — the corpus counts ride the boot
                  manifest, precomputed by the exporter from the same data the full bundle carries, never typed in.
                </li>
              </ol>
              <p className="subnote">
                The recorded studies behind the classes above: doc 08 (what the used-API report can prove on real
                code), doc 09 (migrate + facade across the real 1.17.2 break), doc 12 (the alias-shim compile
                evidence on both real kits), doc 13 (the two-kits field note). Study links also live on the{" "}
                <a href="#/changes">Changes</a> and <a href="#/alignment">Alignment</a> views.
              </p>
            </div>
          </div>

          <div className="col-side">
            <div className="panel">
              <div className="panel-head">
                <h2>Verified compiles</h2>
                <span className="panel-kicker mono island">rule-5 provenance</span>
              </div>
              <p className="subnote">
                Only the studies that compiled real artifacts may badge a release: the six-provider scaffold
                matrix (<span id="landing-link-doc07">
                  <DocLink num={7} />
                </span>
                ) and the kit-rebase probes (<span id="landing-link-doc12">
                  <DocLink num={12} />
                </span>
                ). Every badge below links its evidence. Nothing else on this page claims a compile.
              </p>
              <div id="compile-badges" className="badge-list">
                <CompileBadges providers={manifest.providers} />
              </div>
              <h3 className="panel-sub">Kit probes — the compile story behind the two kits</h3>
              <div id="kit-probes">
                <KitProbes manifest={manifest} />
              </div>
              <p className="subnote">
                The same alignment answers a kit maintainer’s “which fork should a kit bind?” — the two-kits
                story (<span id="landing-link-doc13">
                  <DocLink num={13} />
                </span>
                ).
              </p>
            </div>
          </div>
        </div>

        <div className="panel">
          <h2>Run the same questions in your terminal</h2>
          <p>
            The map is a read-only rendering of what <code>cargo gocar</code> measures and resolves. For one{" "}
            <em>app’s</em> used slice — the per-symbol verdicts a fork chooser actually needs — use the CLI:{" "}
            <code>report</code>, <code>plan</code>, <code>facade</code>, <code>migrate</code>,{" "}
            <code>verify-env</code>. <span id="landing-link-cli">
              <DocLink num="cli" />
            </span>
          </p>
        </div>
      </div>
    </section>
  );
}
