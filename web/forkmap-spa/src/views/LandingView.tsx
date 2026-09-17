// T-39 — Landing / Map Overview (the static site's view-landing, ported).
//
// T-54 copy pass: the page earns its tab name. It leads with what the map is
// (one paragraph, no eyebrow and no quote — the islands line lives in the site
// footer), then the six forks *as a table*: package, latest stable, releases,
// the latest stable's measured item records, architecture, and the two things
// a reader wants next (diff that fork, configure it). Below that the four
// tools wear the nav's own names, and the page closes on one provenance card —
// sources, the compile/kit evidence, and the bundle — with the honesty rules
// in the same collapsed disclosure every other view carries.
//
// The measured-items column reads the corpus facts (the same small slice the
// Journal renders) through the shared hook; the parity suite injects them.
// Until they land the column says so — never a number the measurement does not
// carry (RULE-4, RULE-7).

import { AboutNote } from "../components/AboutNote";
import { DocLink } from "../components/common";
import { StudyDocLink } from "../components/StudyDocLink";
import { useCorpusData, type CorpusData } from "../bundle/corpus";
import type { ForkmapManifest, ManifestProvider } from "../bundle/types";

/** Thousands-separated counts. */
const num = (v: number) => v.toLocaleString("en-US");

/** The map's four tools, in nav order, wearing the nav's names. */
const TOOLS = [
  {
    num: "01",
    name: "Changes",
    href: "#/changes",
    go: "Open Changes →",
    cls: "c-coral",
    sub: "Diff any two releases — one fork's own history, or two forks side by side. Added, removed and re-signed items, with the rows themselves.",
  },
  {
    num: "02",
    name: "Alignment",
    href: "#/alignment",
    go: "Search a symbol →",
    cls: "c-ocean",
    sub: "One symbol across all six forks: which releases carry it, where its signature moved, and which hash each fork holds.",
  },
  {
    num: "03",
    name: "Configure",
    href: "#/configure",
    go: "Scaffold a project →",
    cls: "c-island",
    sub: "Pick a fork and a release, and copy the Cargo.toml and main.rs that cargo gocar new writes for it.",
  },
  {
    num: "04",
    name: "Journal",
    href: "#/journal",
    go: "Open the feed →",
    cls: "c-amber",
    sub: "Every release of every fork in one scroll — each entry that release's own measured diff.",
  },
];

/** A fork's architecture, as the dataset marks it: a companion package means
 * the fork shipped no platform layer of its own after the split. */
function architecture(p: ManifestProvider): { label: string; cls: string; note: string | null } {
  const c = p.platform_companion ?? null;
  return c
    ? { label: "post-split", cls: "post", note: c.package }
    : { label: "pre-split", cls: "pre", note: null };
}

/** The latest stable's measured item records, or the honest unknown state. */
function measuredItems(data: CorpusData | null, p: ManifestProvider): { text: string; title: string } {
  const vers = p.latest_stable;
  if (!vers) return { text: "—", title: "this fork has no latest stable in the data" };
  if (!data) return { text: "…", title: "the measured facts are still loading" };
  const facts = data.streams.find((s) => s.id === p.id)?.facts.find((f) => f.vers === vers);
  if (!facts || facts.m === 0) {
    return { text: "not measured", title: `${p.id} ${vers} was never measured — the map has no count for it` };
  }
  return {
    text: num(facts.n),
    title: `item records measured in ${vers}${facts.m === 1 ? " (its surface is measured empty)" : ""}`,
  };
}

/** Per-fork compile evidence (RULE-5): every badge links the study that
 * compiled the real artifact. */
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
              {m ? (
                <StudyDocLink num={7} href={m.evidence}>{`rustc ${m.toolchain} ↗`}</StudyDocLink>
              ) : (
                "no compile evidence yet"
              )}
            </span>
          </div>
        );
      })}
    </>
  );
}

/** The kit checks: does a real kit's shim carry it across the boundary? */
function KitProbes({ manifest }: { manifest: ForkmapManifest }) {
  return (
    <>
      {manifest.kit_probes.map((kp) => (
        <div className="kit-probe" key={`${kp.kit}@${kp.kit_version}`} title={kp.caveat ?? undefined}>
          <strong>{`${kp.kit} ${kp.kit_version}`}</strong>
          {` — binds ${kp.binds} → ${kp.target}: ${kp.outcome} `}
          <StudyDocLink num={12} href={kp.evidence}>
            doc 12
          </StudyDocLink>
        </div>
      ))}
    </>
  );
}

export function LandingView({ manifest, data: injected }: { manifest: ForkmapManifest; data?: CorpusData | null }) {
  // The measured-items column needs the corpus facts; the hook resolves them
  // at runtime (module-cached — the Journal reads the same slice), and the
  // parity suite injects them, exactly like the Alignment view's column.
  const loaded = useCorpusData(manifest, injected === undefined);
  const data = injected !== undefined ? injected : loaded.status === "ready" ? loaded.data : null;
  const preReleases = manifest.providers.reduce(
    (n, p) => n + p.versions.filter((v) => v.prerelease).length,
    0,
  );
  const yanked = manifest.providers.reduce((n, p) => n + p.versions.filter((v) => v.yanked).length, 0);

  return (
    <section id="view-landing" className="view">
      <div className="wrap">
        <div className="hero">
          <h1>The GPUI fork map</h1>
          <p className="hero-intro">
            Zed’s UI framework is published on crates.io under six package names — <code>gpui</code>,{" "}
            <code>gpui-ce</code>, <code>gpui-unofficial</code>, <code>gpui-pre</code>, <code>kael</code>,{" "}
            <code>gpui-box</code> — with diverging APIs and version numbers that do not line up. This map compares
            what is actually inside them, measured from the published source.
          </p>
        </div>

        <div className="panel" id="landing-forks">
          <div className="panel-head">
            <h2>The 6 forks at a glance</h2>
            <span className="panel-kicker mono">
              {`${manifest.counts.versions} releases · ${preReleases} pre-release · ${yanked} yanked`}
            </span>
          </div>
          <div className="table-scroll">
            <table className="fork-table" id="fork-table">
              <thead>
                <tr>
                  <th>Package</th>
                  <th>Latest stable</th>
                  <th>Releases</th>
                  <th>Measured items</th>
                  <th>Architecture</th>
                  <th className="fork-actions-head">Actions</th>
                </tr>
              </thead>
              <tbody>
                {manifest.providers.map((p) => {
                  const arch = architecture(p);
                  const items = measuredItems(data, p);
                  return (
                    <tr key={p.id}>
                      <td>
                        <span className="fork-name mono">{p.id}</span>
                        <span className="fork-desc">{p.description}</span>
                      </td>
                      <td>
                        <span className="fork-vers mono">{p.latest_stable ?? "—"}</span>
                      </td>
                      <td title={`${p.versions.length} published releases on the registry`}>{p.versions.length}</td>
                      <td title={items.title}>{items.text}</td>
                      <td>
                        <span className={`arch-tag ${arch.cls} mono`}>{arch.label}</span>
                        {arch.note && <span className="fork-note mono">{arch.note}</span>}
                      </td>
                      <td className="fork-actions">
                        <a
                          className="fork-action"
                          href={`#/changes?p=${encodeURIComponent(p.id)}`}
                          title={`the latest stable (${p.latest_stable ?? "—"}) against its branch base, in Changes`}
                        >
                          Diff
                        </a>
                        <a
                          className="fork-action"
                          href={`#/configure?p=${encodeURIComponent(p.id)}`}
                          title={`the Cargo.toml and main.rs for ${p.id}`}
                        >
                          Configure →
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <h2 className="section-head">Tools &amp; workbenches</h2>
        <div className="card-grid workflow">
          {TOOLS.map((t) => (
            <a className={`card card-cta ${t.cls}`} href={t.href} key={t.name}>
              <span className="card-num mono" aria-hidden="true">
                {t.num}
              </span>
              <span className="card-body">
                <span className="card-title">{t.name}</span>
                <span className="card-sub">{t.sub}</span>
                <span className="card-go">{t.go}</span>
              </span>
            </a>
          ))}
        </div>

        <div className="panel" id="landing-provenance">
          <h2>Data provenance &amp; verification</h2>
          <dl className="spec-list">
            <dt>Sources</dt>
            <dd id="data-layers">
              crates.io metadata (which versions exist, yanked or prerelease, the <code>rust-version</code> each
              declares) · published source tarballs (the items each release exposes, and a hash of each)
            </dd>
            <dt>Attestation</dt>
            <dd>
              <p className="subnote">
                Only a study that compiled the real artifact marks a release verified (rule 5); each badge links its
                evidence (<span id="landing-link-doc07">
                  <DocLink num={7} />
                </span>) and so do the kit checks below (<span id="landing-link-doc12">
                  <DocLink num={12} />
                </span>). No other claim here is a compile.
              </p>
              <div id="compile-badges" className="badge-list">
                <CompileBadges providers={manifest.providers} />
              </div>
              <div id="kit-probes">
                <KitProbes manifest={manifest} />
              </div>
              <p className="subnote" id="landing-link-doc13">
                The same data answers a kit maintainer’s question — which fork should a kit bind? (<DocLink num={13} />
                )
              </p>
            </dd>
            <dt>Bundle</dt>
            <dd id="data-bundle">
              <code>{manifest.schema}</code> · data frozen{" "}
              <span id="data-as-of">{manifest.dataset_synced_at ?? "(unsynced dataset)"}</span> · no two releases from
              different forks match in this data, so comparing forks is always item by item
            </dd>
          </dl>
          <p className="subnote" id="landing-link-cli">
            This page is a read-only view of what <code>cargo gocar</code> measures. For verdicts about your own code
            — which symbols your app uses, and which fork provides them — use the CLI: <code>report</code>,{" "}
            <code>plan</code>, <code>facade</code>, <code>migrate</code>, <code>verify-env</code>.{" "}
            <DocLink num="cli" />
          </p>
        </div>

        <div className="about-note" id="landing-about">
          <AboutNote />
        </div>
      </div>
    </section>
  );
}
