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

import { useEffect, useRef, useState } from "react";
import { AboutNote } from "../components/AboutNote";
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

/** `<vers> (yanked, pre-release)` version-option label (RULE-6 flags shown). */
function versionOptionLabel(v: ManifestVersionRow): string {
  const flags = releaseFlags(v);
  return flags.length ? `${v.vers} (${flags.join(", ")})` : v.vers;
}

/** The copy-to-clipboard flash of one file (T-31 inline flash, ported from
 * app.js bindCopy: clipboard API with a select-and-execCommand fallback for
 * non-secure hosts). The polite live region is the Configure a11y increment:
 * a screen reader hears the result without focus being stolen — a detached
 * toast was rejected, see the T-39 outcome. */
function CodeShell({ title, sub, text }: { title: string; sub?: string; text: string }) {
  const preRef = useRef<HTMLPreElement | null>(null);
  const timer = useRef<number | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "ok" | "fail">("idle");

  useEffect(() => {
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, []);

  const flash = (ok: boolean) => {
    setCopyState(ok ? "ok" : "fail");
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopyState("idle"), 1400);
  };

  const onCopy = async () => {
    const pre = preRef.current;
    if (!pre) return;
    const textToCopy = pre.textContent ?? "";
    try {
      await navigator.clipboard.writeText(textToCopy);
      flash(true);
      return;
    } catch {
      // fall through to the select + execCommand fallback
    }
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(pre);
    sel?.removeAllRanges();
    sel?.addRange(range);
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    sel?.removeAllRanges();
    flash(ok);
  };

  const label =
    copyState === "ok" ? "copied ✓" : copyState === "fail" ? "press Ctrl/Cmd-C to copy" : "copy";
  return (
    <div className="code-shell">
      <div className="code-head">
        <h3>{title}</h3>
        <button
          type="button"
          className={`copy-btn${copyState === "ok" ? " copied" : ""}`}
          title="copy the file text"
          onClick={onCopy}
        >
          {label}
        </button>
      </div>
      {sub && <p className="file-sub muted">{sub}</p>}
      <pre className="code-block" ref={preRef}>
        {text}
      </pre>
      <span className="visually-hidden" role="status" aria-live="polite">
        {copyState === "ok" ? "copied" : copyState === "fail" ? "copy failed — press Ctrl/Cmd-C to copy" : ""}
      </span>
    </div>
  );
}

/** The "Status of this offer" panel: the compile marker or the honest
 * not-probed box (RULE-5), the yanked/prerelease flags (RULE-6), the binding
 * unit (T-17 platform companion) and the row facts line. */
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
  const parts: string[] = [];
  if (row) {
    if (row.rust_version) parts.push(`declared rust-version ${row.rust_version}`);
    if (row.facade) {
      parts.push(
        `facade table: ${row.facade.aliases.length} alias${row.facade.aliases.length === 1 ? "" : "es"}, ${row.facade.polyfills.length} polyfill${row.facade.polyfills.length === 1 ? "" : "s"}`,
      );
    }
    // The dataset's toolchain floor is still a stub (null = unknown, never
    // absent-as-measured): until a compiler pass attests one, the declared
    // floor stays the advisory story — read like app.js does.
    const floor = row.toolchain_floor;
    if (!floor) {
      parts.push("no attested compiler floor yet — the declared floor is the advisory story");
    }
  }
  const pinText = c ? (c.pin === "mirror" ? "version-locked to the fork release (mirror)" : `fixed at ${c.pin.fixed} for the lineage`) : "";
  const feat = c?.features?.length ? `, features ${c.features.map((f) => `"${f}"`).join(" + ")}` : "";

  return (
    <div className="panel" id="configure-status">
      <h2>Status of this offer</h2>
      {st.badge && st.marker ? (
        // RULE-5: badge data + evidence link — never a bare claim.
        <div className="status-ok">
          <p>
            {"Compile-verified — this exact starting point was built through `cargo gocar new` → `lock` → `cargo build --locked` with zero hand edits."}
          </p>
          <p className="subnote">
            {`rustc ${st.marker.toolchain}. Evidence: `}
            <StudyDocLink num={7} href={st.marker.evidence} />
          </p>
        </div>
      ) : (
        <div className="status-warn">
          <p>{"Not compile-probed here — no build evidence exists for this exact (fork, version) starting point."}</p>
          <p className="subnote">
            {m ? (
              <>
                <span>{`This provider's only compile-verified row is ${m.vers} (rustc ${m.toolchain}): `}</span>
                <StudyDocLink num={7} href={m.evidence} />
                <span>{"."}</span>
              </>
            ) : (
              <span>{"The docs/07 matrix has no compile probe for this provider."}</span>
            )}
          </p>
          {binding?.note && (
            // Curated reason the docs record (early-era / system-stack rows) —
            // data from the export, never site prose about a specific release.
            <p className="subnote">
              <strong>{"Why this row is not in the matrix: "}</strong>
              {binding.note}
            </p>
          )}
        </div>
      )}
      {row?.prerelease && (
        <p className="status-flag">
          <span>
            {"Pre-release release — never a default choice (rule 6), and `cargo gocar lock` refuses prerelease floors by design (docs 07): binding this generation through the tool means the stable provider row (e.g. gpui-pre), not this pin."}
          </span>
        </p>
      )}
      {row?.yanked && (
        <p className="status-flag">
          <span>{"Yanked on crates.io — do not bind a new project to it (rule 6)."}</span>
        </p>
      )}
      <p className="cfg-line">
        <strong>{"Binding unit: "}</strong>
        {c ? (
          <span>{`${provider.package} ${vers} + platform companion ${c.package} (${pinText}${feat}) — post-split launch via gpui_platform::application().`}</span>
        ) : (
          <span>
            {`${provider.package} ${vers} alone — pre-split provider, ships its own platform layer (era template: Application::new()).`}
          </span>
        )}
      </p>
      {parts.length > 0 && (
        <p className="cfg-line muted">{`${parts.join(" · ")} (declared values are never attestations; doc 10).`}</p>
      )}
    </div>
  );
}

/** The Files panel: two code shells (manifest + main.rs) whose bytes are the
 * export's own, byte-equal to what `cargo gocar new` writes. */
function FilesPanel({
  manifest,
  provider,
  vers,
  name,
}: {
  manifest: ForkmapManifest;
  provider: ManifestProvider;
  vers: string;
  name: string;
}) {
  const binding = configureBindingFor(manifest, provider.id, vers);
  const scaffold = configureScaffoldFor(manifest, provider.id);
  return (
    <div className="panel" id="configure-files">
      <h2>Files</h2>
      <div id="configure-files-body">
        {!binding || !scaffold ? (
          <p className="empty-hint">
            {"No scaffold bytes in the bundle for this row — regenerate with `python3 scripts/export-fork-map.py`."}
          </p>
        ) : (
          <>
            <CodeShell
              title="Cargo.toml"
              sub={
                "`{{project_name}}` is resolved to the name above — the only substitution between these bytes and the exported template, which is byte-equal to what `cargo gocar new` writes (pinned by tests)."
              }
              text={binding.cargo_toml.replaceAll("{{project_name}}", name)}
            />
            <CodeShell
              title="src/main.rs"
              sub={
                provider.platform_companion
                  ? "Post-split launch shape — `gpui_platform::application()` supplies the platform layer the fork no longer ships."
                  : "Pre-split launch shape — `Application::new()` on the fork's own platform layer."
              }
              text={scaffold.main_rs}
            />
          </>
        )}
      </div>
    </div>
  );
}

/** The Next commands panel: the managed path for a bindable row, or the
 * plain-cargo reading path for a flagged one (rule 6). */
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
        {flagged && (
          <p className="subnote">
            {"A gocar-managed lock never selects a yanked or prerelease floor (rule 6); for a tool-managed starting point pick the provider's latest stable row."}
          </p>
        )}
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
      <p>
        {
          "This view is static text from the committed bundle — no project zip, no server-side build. For the full scaffold (README, .gitignore, directory layout) run `cargo gocar new <name> --provider <id>`; the files above are that same generator's output."
        }
      </p>
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

  return (
    <section id="view-configure" className="view">
      <div className="wrap">
        <div className="view-head">
          <p className="view-eyebrow mono">which fork to bind — a byte-exact starting point</p>
          <h1>
            Configure <span className="view-tag mono">a starting point, byte-equal to `cargo gocar new`</span>
          </h1>
          <p className="lede">
            Pick a fork — optionally an exact release (the default is the provider’s latest stable, never yanked or
            prerelease). The manifest and starter <code>main.rs</code> below are the CLI’s own rendered bytes for that
            (provider, version): one generator, two output paths, pinned byte-equal by tests.
          </p>
        </div>

        <div className="controls panel picker">
          <label className="ctl">
            <span>Provider</span>
            <select id="configure-provider" value={provider.id} onChange={(e) => onProvider(e.target.value)}>
              {manifest.providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {`${p.id} (${p.package})`}
                </option>
              ))}
            </select>
          </label>
          <label className="ctl">
            <span>Version</span>
            <select id="configure-version" value={vers} onChange={(e) => onVersion(e.target.value)}>
              {provider.versions.map((v) => (
                <option key={v.vers} value={v.vers}>
                  {versionOptionLabel(v)}
                </option>
              ))}
            </select>
          </label>
          <label className="ctl">
            <span>Project name</span>
            <input
              id="configure-name"
              type="text"
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
          </label>
          <div className="ctl-hint" id="configure-hint">
            {/* app.js's live input handler clears the hint while a valid name
             * is being typed (only the invalid warning or the next render's
             * standard line shows); this port keeps the standard line visible
             * while typing — same end states, no blank gap, never a wrong
             * message. */}
            {nameValid ? (
              <span>
                {"The offer below is rendered from the bundle for this exact (provider, version) — the default is the latest stable (rule 6)."}
              </span>
            ) : (
              <span className="status-flag-inline">
                {"project name must start with a letter; only letters, digits, '-' and '_' follow — showing the scaffold under the default name until fixed"}
              </span>
            )}
          </div>
        </div>

        <StatusPanel manifest={manifest} provider={provider} vers={vers} />
        <FilesPanel manifest={manifest} provider={provider} vers={vers} name={resolved} />
        <CommandsPanel provider={provider} vers={vers} />

        <div className="panel">
          <h2>
            {"What this view does not do "}
            <span className="view-tag mono">v2 scope, shown as notes</span>
          </h2>
          <div id="configure-scope">
            <ScopeNotes />
          </div>
        </div>

        <div className="about-note" id="configure-about">
          <AboutNote />
        </div>
      </div>
    </section>
  );
}
