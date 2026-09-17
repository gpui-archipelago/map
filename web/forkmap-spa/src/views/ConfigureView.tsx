// T-39 — Configure view (the static site's view-configure + renderConfigure,
// ported 1:1).
//
// Pick a fork — optionally an exact release — and read the CLI's own rendered
// bytes for that (provider, version): the manifest (templates.bindings,
// resolved {{project_name}}) + the starter src/main.rs (templates.scaffold).
// The view renders bundle text only and computes nothing the export did not
// (T-31 / UC-10): every compile claim is a bundle marker with an evidence
// link (rule 5), flagged rows are never defaults (rule 6), and the offer
// never leaves the six measured forks. The (p, v, name) hash params are the
// deep-link state; typing in the project-name field re-renders the name line
// live and commits the name to the hash on blur/Enter — like app.js.
//
// T-52 copy pass: the page states its claim instead of arguing it. The
// runnable equivalent — `cargo gocar new <name> --provider <id>` — rides the
// header bar as a copy button (the words "byte-equal to the CLI" are gone:
// the command is shown), the verification facts are a banner + spec list
// rather than a run-on paragraph, and the two generated files share one card
// with tabs and one copy control.

import { useEffect, useRef, useState } from "react";
import { AboutNote } from "../components/AboutNote";
import { CopyButton } from "../components/CopyButton";
import {
  configureBindingFor,
  configureScaffoldFor,
  resolvedProjectName,
  resolveConfigured,
  validCrateName,
} from "../bundle/configure";
import { releaseFlags } from "../bundle/changes";
import { compileStatus } from "../bundle/derive";
import type { ForkmapManifest, ManifestProvider, ManifestVersionRow } from "../bundle/types";
import { routeHash } from "../routing";
import { StudyDocLink } from "../components/StudyDocLink";

/** The provider option's text: the fork id, plus the crates.io package only
 * where it differs from the id (RULE-7 honest — and in the current corpus it
 * never does, so the closed select no longer truncates). */
function providerOptionLabel(p: ManifestProvider): string {
  return p.package === p.id ? p.id : `${p.id} (${p.package})`;
}

/** `<vers> (yanked, pre-release)` version-option label (RULE-6 flags shown). */
function versionOptionLabel(v: ManifestVersionRow): string {
  const flags = releaseFlags(v);
  return flags.length ? `${v.vers} (${flags.join(", ")})` : v.vers;
}

/** The two generated files of one offer, in tab order. */
type FileTab = "cargo" | "main";

/** The "Verification & platform" panel: the compile marker or the honest
 * not-probed banner (RULE-5), then the facts as a spec list — the platform
 * binding unit (T-17 companion) and the compiler floor — then the RULE-6
 * flags and the curated note a row outside the docs/07 matrix carries. */
function StatusPanel({
  manifest,
  provider,
  vers,
}: {
  manifest: ForkmapManifest;
  provider: ManifestProvider;
  vers: string;
}) {
  const row = provider.versions.find((v) => v.vers === vers) ?? null;
  const binding = configureBindingFor(manifest, provider.id, vers);
  const st = compileStatus(provider, vers);
  const m = provider.compile_verified ?? null;
  const c = provider.platform_companion ?? null;
  const pin = c ? (c.pin === "mirror" ? "version-locked 1:1 (mirror)" : `fixed at ${c.pin.fixed}`) : "";
  const feat = c?.features?.length ? ` · features ${c.features.map((f) => `"${f}"`).join(" + ")}` : "";
  // The dataset's toolchain floor is still a stub (null = unknown, never
  // absent-as-measured): until a compiler pass attests one, the declared floor
  // stays the advisory story (doc 10).
  const floor = row?.toolchain_floor ?? null;
  const facade = row?.facade ?? null;

  return (
    <div className="panel" id="configure-status">
      <h2>Verification &amp; platform</h2>
      {st.badge && st.marker ? (
        // RULE-5: badge data + evidence link — never a bare claim.
        <p className="status-ok">
          {`Compile-verified — this exact row through \`cargo gocar new\` → \`lock\` → \`cargo build --locked\`, zero hand edits · rustc ${st.marker.toolchain} · `}
          <StudyDocLink num={7} href={st.marker.evidence}>
            doc 07
          </StudyDocLink>
        </p>
      ) : (
        <p className="status-warn">
          {`⚠️ Not compile-probed for ${vers} · `}
          {m
            ? `${`last verified on this fork: ${m.vers} (rustc ${m.toolchain})`} · `
            : "no compile probe exists for this fork · "}
          {m ? (
            <StudyDocLink num={7} href={m.evidence}>
              doc 07
            </StudyDocLink>
          ) : null}
        </p>
      )}
      {/* The facts as a spec list (the shape the landing's provenance card
          shares): one label, one value per row. */}
      <dl className="spec-list cfg-specs">
        <dt>Platform binding</dt>
        <dd>
          {c
            ? `${c.package} · ${pin}${feat} · post-split launch via gpui_platform::application()`
            : `${provider.package} ships its own platform layer · pre-split launch via Application::new()`}
        </dd>
        <dt>Compiler floor</dt>
        <dd>
          {row?.rust_version ? `declared rust-version ${row.rust_version} · ` : ""}
          {floor ?? "advisory only — no attested floor yet"}
          {" · "}
          <StudyDocLink num={10}>doc 10</StudyDocLink>
        </dd>
        {facade && (
          <>
            <dt>Facade table</dt>
            <dd>
              {`${facade.aliases.length} alias${facade.aliases.length === 1 ? "" : "es"}, ${facade.polyfills.length} polyfill${facade.polyfills.length === 1 ? "" : "s"}`}
            </dd>
          </>
        )}
      </dl>
      {binding?.note && (
        // Curated reason the docs record (early-era / system-stack rows) —
        // data from the export, never site prose about a specific release.
        <p className="subnote">
          <strong>{"Why this row is not in the matrix: "}</strong>
          {binding.note}
        </p>
      )}
      {row?.prerelease && (
        <p className="status-flag">{"A pre-release — never a default choice (rule 6)."}</p>
      )}
      {row?.yanked && (
        <p className="status-flag">{"Yanked on crates.io — do not bind a new project to it (rule 6)."}</p>
      )}
    </div>
  );
}

/** The Files card: the offer's two generated files behind tabs, one copy
 * control for the file on screen. The bytes are the export's own — the one
 * substitution between them and the template is `{{project_name}}`, applied
 * before they render. Exported with an initial `tab` so the parity suite can
 * assert the other file's bytes without a click (SSR runs no handlers). */
export function FilesPanel({
  manifest,
  provider,
  vers,
  name,
  tab = "cargo",
}: {
  manifest: ForkmapManifest;
  provider: ManifestProvider;
  vers: string;
  name: string;
  tab?: FileTab;
}) {
  const binding = configureBindingFor(manifest, provider.id, vers);
  const scaffold = configureScaffoldFor(manifest, provider.id);
  const [active, setActive] = useState<FileTab>(tab);
  const files: { id: FileTab; label: string; text: string }[] =
    binding && scaffold
      ? [
          { id: "cargo", label: "Cargo.toml", text: binding.cargo_toml.replaceAll("{{project_name}}", name) },
          { id: "main", label: "src/main.rs", text: scaffold.main_rs },
        ]
      : [];
  const file = files.find((f) => f.id === active) ?? files[0];
  return (
    <div className="panel" id="configure-files">
      <h2>Files</h2>
      {!file ? (
        <div id="configure-files-body">
          <p className="empty-hint">
            {"No scaffold bytes in the bundle for this row — regenerate with `python3 scripts/export-fork-map.py`."}
          </p>
        </div>
      ) : (
        <>
          <div className="files-head">
            <div className="file-tabs" role="tablist" aria-label="the generated files">
              {files.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  role="tab"
                  id={`configure-tab-${f.id}`}
                  className={`file-tab${f.id === file.id ? " active" : ""}`}
                  aria-selected={f.id === file.id}
                  aria-controls="configure-files-body"
                  onClick={() => setActive(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <CopyButton
              className="file-copy"
              text={file.text}
              label="copy"
              announce={`${file.label} copied`}
            />
          </div>
          <div id="configure-files-body" role="tabpanel" aria-labelledby={`configure-tab-${file.id}`}>
            <pre className="code-block">{file.text}</pre>
          </div>
        </>
      )}
    </div>
  );
}

/** The Next commands panel: the managed path for a bindable row, or the
 * plain-cargo reading path for a flagged one (rule 6 — the block's own
 * comments carry the caveat, so no prose repeats it below). */
function CommandsPanel({ provider, vers }: { provider: ManifestProvider; vers: string }) {
  const row = provider.versions.find((v) => v.vers === vers) ?? null;
  const flagged = row?.yanked || row?.prerelease;
  const code = flagged
    ? `# ${row?.yanked ? "Yanked on crates.io — do not bind new projects to it." : "Pre-release floor: `cargo gocar lock` refuses prerelease floors by design (docs 07)."}
# The offer above is for reading an era; binding it needs plain cargo:
cargo generate-lockfile
cargo build --locked`
    : `# Pin the artifact (MVS+) and materialize Cargo.lock
cargo gocar lock
# The deterministic, reproducible build (no floating updates)
cargo build --locked
cargo run --locked

# Audit the locked graph vs. the dataset + compiler (exit 1 on violations)
cargo gocar verify-env
# Workspaces only: one gpui engine per binary
cargo gocar check-workspace`;
  return (
    <div className="panel">
      <h2>Next commands</h2>
      <div id="configure-commands">
        <pre className="code-block">{code}</pre>
      </div>
    </div>
  );
}

/** The v2 scope notes — shown as notes, never as buttons (UC-10's
 * acceptance: the map does not over-promise what it cannot build). */
function ScopeNotes() {
  const li = (strong: string, rest: string) => (
    <li>
      <strong>{strong}</strong>
      {` ${rest}`}
    </li>
  );
  return (
    <>
      <p>{"Static text from the committed bundle — no project zip, no server-side build."}</p>
      <ul className="scope-notes">
        {li(
          "Kit-rebase alias-shim bundles are not offered here (v2).",
          "An offer needs a compile probe for the exact combo — the docs/12 probes on the Landing are the only allowed source — and v1 gocar audits refuse alias rows in a managed lock (package-name keyed; phase-5 rebind).",
        )}
        {li(
          "Facade shim source stays human-authored.",
          "A bound release's facade table is data (see the status panel when the release carries one); its source generation is not built — the table and the `cargo gocar facade` CLI are the v1 surface.",
        )}
        {li(
          "Era questions inside a stream stay open.",
          "A companion provider renders as post-split at every version it binds (provider-level mapping); unofficial's early rows carry their caveat in the status panel above (STATUS.md limitation 12).",
        )}
      </ul>
      <p className="subnote">
        {"Every compile claim on this view is a bundle marker with an evidence link (rule 5); every row here is a measured version of the six forks — no other package is offered."}
      </p>
    </>
  );
}

export function ConfigureView({ manifest, params }: { manifest: ForkmapManifest; params: Record<string, string> }) {
  const { provider, vers, name } = resolveConfigured(manifest, params);
  const [nameText, setNameText] = useState<string>(name);
  const nameFocused = useRef(false);

  // A hash change (deep link, a select commit, back/forward) re-resolves the
  // name field — but never while the user is typing: app.js render() skips a
  // focused name input, so live text survives until blur/Enter commits it.
  // Keyed on every param so an unfocused invalid draft is wiped exactly like
  // app.js render() does on any navigation (not only when the hash name moved).
  useEffect(() => {
    if (!nameFocused.current) setNameText(resolvedProjectName(params.name));
  }, [params.p, params.v, params.name]);

  const go = (next: Record<string, string>) => {
    const hash = routeHash("configure", next);
    if (window.location.hash !== hash) window.location.hash = hash;
  };

  const onProvider = (value: string) => {
    const next: Record<string, string> = { p: value };
    if (validCrateName(nameText)) next.name = nameText;
    go(next); // version resets to the new provider's default (rule 6)
  };
  const onVersion = (value: string) => {
    const next: Record<string, string> = { p: provider.id, v: value };
    if (validCrateName(nameText)) next.name = nameText;
    go(next);
  };
  const commitName = () => {
    // app.js: the name reaches the hash on change (blur/Enter) only when it
    // is a valid crate name; invalid text stays local with the warning shown.
    if (validCrateName(nameText)) go({ p: provider.id, v: vers, name: nameText });
  };

  const resolved = resolvedProjectName(nameText);
  const nameValid = validCrateName(nameText);
  // The runnable equivalent of this offer. `cargo gocar new` always floors at
  // the fork's latest stable (docs 08), so the one case it does not reproduce
  // — a row that is not that stable — says so on the button.
  const command = `cargo gocar new ${resolved} --provider ${provider.id}`;
  const commandTitle =
    provider.latest_stable && provider.latest_stable !== vers
      ? `copy this command — \`cargo gocar new\` floors at ${provider.id}'s latest stable (${provider.latest_stable}); the offer above is ${vers}`
      : "copy this command — it writes the files below";

  return (
    <section id="view-configure" className="view">
      <div className="wrap">
        {/* One line, like Changes and Alignment: the title rides the bar over a
            hairline, the three fields are the whole form, and the command that
            writes these bytes is one click away — no prose claiming it. */}
        <div className="controls picker configure-bar" id="configure-controls">
          <h1 className="configure-title">Configure</h1>
          <select
            id="configure-provider"
            aria-label="the fork to bind"
            title="the fork to bind"
            value={provider.id}
            onChange={(e) => onProvider(e.target.value)}
          >
            {manifest.providers.map((p) => (
              <option key={p.id} value={p.id}>
                {providerOptionLabel(p)}
              </option>
            ))}
          </select>
          <select
            id="configure-version"
            aria-label="the release"
            title="the exact release (the default is the fork's latest stable)"
            value={vers}
            onChange={(e) => onVersion(e.target.value)}
          >
            {provider.versions.map((v) => (
              <option key={v.vers} value={v.vers}>
                {versionOptionLabel(v)}
              </option>
            ))}
          </select>
          <span className="ctl-label">Project</span>
          <input
            id="configure-name"
            type="text"
            aria-label="the project name"
            value={nameText}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => setNameText(e.target.value)}
            onFocus={() => {
              nameFocused.current = true;
            }}
            onBlur={() => {
              nameFocused.current = false;
              commitName();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitName();
              }
            }}
          />
          <CopyButton
            className="configure-new"
            text={command}
            label={`📋 ${command}`}
            title={commandTitle}
            announce={`copied: ${command}`}
          />
        </div>
        {/* app.js clears the hint while a valid name is being typed and shows
            only the invalid-name warning; the id stays addressable either way. */}
        <p className="ctl-hint" id="configure-hint" hidden={nameValid}>
          {!nameValid && (
            <span className="status-flag-inline">
              {"must start with a letter — letters, digits, '-' and '_' only; the files below keep the default name until it does."}
            </span>
          )}
        </p>

        <StatusPanel manifest={manifest} provider={provider} vers={vers} />
        <FilesPanel manifest={manifest} provider={provider} vers={vers} name={resolved} />
        <CommandsPanel provider={provider} vers={vers} />

        <details className="ref-fold">
          <summary>What this view does not do</summary>
          <div id="configure-scope">
            <ScopeNotes />
          </div>
        </details>

        <div className="about-note" id="configure-about">
          <AboutNote />
        </div>
      </div>
    </section>
  );
}
