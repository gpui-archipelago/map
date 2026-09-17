// T-39 — Configure view render parity (increment 4).
//
// Renders the actual ConfigureView (react-dom/server over the committed
// bundle) for the empty hash and the recorded-story deep links and asserts
// the rendered markup: the RULE-5 compile-verified badge for the default
// offer, the honest not-probed box + curated note for kael 0.2.0, the
// RULE-6 flags + reading-commands for yanked/prerelease rows, the binding
// unit (T-17 platform companion) + row facts lines, the byte-resolved
// Cargo.toml ({{project_name}} substituted) and the scaffold main.rs, the
// v2 scope notes, the honest-rule ids, and every configure-* id the static
// view + app.js bind in the DOM output.

import { describe, expect, test } from "bun:test";
import { renderToString } from "react-dom/server";
import { createElement } from "react";
import { configureBindingFor, resolveConfigured } from "../src/bundle/configure";
import { configureScaffoldFor } from "../src/bundle/configure";
import { compileStatus } from "../src/bundle/derive";
import { validateManifest } from "../src/bundle/validate";
import type { ForkmapManifest } from "../src/bundle/types";
import { ConfigureView, FilesPanel } from "../src/views/ConfigureView";
import { STATIC_RENDERER_IDS } from "./fixtures/static-renderer-ids";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
// T-33: Configure renders from the committed boot manifest — the same slice
// the served app boots on (metadata + templates, no measured surfaces).
const MANIFEST_PATH = join(HERE, "..", "..", "forkmap", "data", "forkmap-manifest.json");

const manifest: ForkmapManifest = validateManifest(JSON.parse(readFileSync(MANIFEST_PATH, "utf8")));

function renderConfigure(params: Record<string, string>): string {
  return renderToString(createElement(ConfigureView, { manifest, params }));
}

function occurrences(haystack: string, needle: string): number {
  let n = 0;
  let i = haystack.indexOf(needle);
  while (i >= 0) {
    n += 1;
    i = haystack.indexOf(needle, i + 1);
  }
  return n;
}
/** react-dom/server escapes text content (&quot;/&amp;/&#x27;/&lt;/&gt;) and
 * separates adjacent expressions with <!-- --> markers — decode/strip so
 * assertions read like the rendered page. */
function text(html: string): string {
  return html
    .replace(/<!-- -->/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x27;/g, "'");
}

describe("Configure view renders the recorded stories (server render)", () => {
  test("the empty hash renders the recommended provider's latest-stable offer with the RULE-5 status the data supports", () => {
    const rec = resolveConfigured(manifest, {});
    const st = compileStatus(rec.provider, rec.vers);
    // RULE-6: the empty hash resolves the provider's latest stable; a RULE-5
    // badge renders only when the provider's compile marker is that exact row.
    expect(rec.vers).toBe(rec.provider.latest_stable!);
    const scaffold = configureScaffoldFor(manifest, rec.provider.id)!;
    const html = text(renderConfigure({}));
    expect(html).toContain('id="view-configure"');
    // ids app.js binds + the static panels
    for (const id of [
      "configure-provider",
      "configure-version",
      "configure-name",
      "configure-hint",
      "configure-status",
      "configure-files",
      "configure-files-body",
      "configure-commands",
      "configure-scope",
      "configure-about",
    ]) {
      expect(html, `id "${id}"`).toContain(`id="${id}"`);
    }
    // the picker lists every provider — the id alone, the crates.io package
    // only where it differs from it (the parenthetical used to truncate the
    // closed select: every current fork has package === id)
    for (const p of manifest.providers) {
      const label = p.package === p.id ? p.id : `${p.id} (${p.package})`;
      expect(html).toContain(`${label}</option>`);
    }
    // RULE-5 status (one banner line + the spec rows) or the honest
    // not-probed banner when the default has moved past the probe.
    if (st.badge) {
      expect(html).toContain('class="status-ok"');
      expect(html).toContain(
        "Compile-verified — this exact row through `cargo gocar new` → `lock` → `cargo build --locked`, zero hand edits",
      );
      expect(html).toContain(`rustc ${st.marker!.toolchain}`);
      expect(html).toContain(`href="${st.marker!.evidence}"`);
    } else {
      expect(html).toContain('class="status-warn"');
      expect(html).toContain(`Not compile-probed for ${rec.vers}`);
    }
    // the evidence link keeps the study's own text short on the banner
    expect(html).toContain(">doc 07</a>");
    // platform binding (unofficial's mirror companion) + compiler floor rows
    expect(html).toContain("<dt>Platform binding</dt>");
    expect(html).toContain("gpui-platform-gpui-unofficial · version-locked 1:1 (mirror) · features \"x11\" + \"wayland\"");
    expect(html).toContain("post-split launch via gpui_platform::application()");
    expect(html).toContain("<dt>Compiler floor</dt>");
    expect(html).toContain("advisory only — no attested floor yet");
    // standard hint: a valid name shows no warning, and the id stays bound
    expect(html).toContain('id="configure-name"');
    expect(html).toContain('value="gpui-app"');
    expect(html).toContain('id="configure-hint" hidden=""');
    expect(html).not.toContain("status-flag-inline");
    // the runnable equivalent of the offer rides the header bar
    expect(html).toContain(`📋 cargo gocar new gpui-app --provider ${rec.provider.id}`);
    // the manifest bytes are the export's own with the name resolved — the
    // template token never reaches the DOM
    expect(html).toContain('name = "gpui-app"');
    expect(html).toContain(`min-version = "${rec.vers}"`);
    expect(html).not.toContain("{{project_name}}");
    // one card, a tab per file, one copy control for the visible file
    expect(html).toContain('class="file-tabs"');
    expect(occurrences(html, 'role="tab" id="configure-tab-')).toBe(2);
    expect(html).toContain(">Cargo.toml</button>");
    expect(html).toContain(">src/main.rs</button>");
    expect(html).toContain('class="copy-btn file-copy"');
    expect(html).toContain('role="tab"');
    // the default tab is Cargo.toml, so the scaffold's bytes are not in this
    // DOM — they are asserted through the panel's own tab below
    expect(html).not.toContain(scaffold.main_rs.split("\n")[0]);
    // commands + scope notes
    expect(html).toContain("cargo gocar lock");
    expect(html).toContain("cargo gocar verify-env");
    expect(html).toContain("Kit-rebase alias-shim bundles are not offered here (v2).");
    expect(html).toContain("every row here is a measured version of the six forks — no other package is offered.");
    for (let n = 1; n <= 7; n++) {
      expect(html, `honest-rule-${n}`).toContain(`id="honest-rule-${n}"`);
    }
  });

  test("the scaffold's own bytes render behind the second tab", () => {
    const rec = resolveConfigured(manifest, {});
    const scaffold = configureScaffoldFor(manifest, rec.provider.id)!;
    const html = text(
      renderToString(
        createElement(FilesPanel, {
          manifest,
          provider: rec.provider,
          vers: rec.vers,
          name: "gpui-app",
          tab: "main",
        }),
      ),
    );
    // the CLI's main.rs bytes, verbatim, with the tab it belongs to selected
    expect(html).toContain(scaffold.main_rs.split("\n")[0]);
    expect(html).toContain('class="file-tab active"');
    expect(html).toContain("src/main.rs</button>");
    // …and the Cargo.toml bytes are not in this render (one file at a time)
    expect(html).not.toContain('name = "gpui-app"');
  });

  test("kael 0.2.0 renders the honest not-probed box, its curated note, the facts + the resolved name", () => {
    const kael = manifest.providers.find((p) => p.id === "kael")!;
    const m = kael.compile_verified!;
    const note = configureBindingFor(manifest, "kael", "0.2.0")!.note;
    expect(note, "kael 0.2.0 carries the docs/07 window-edge note").toBeTruthy();
    const html = text(renderConfigure({ p: "kael", v: "0.2.0", name: "my-app" }));
    expect(html).toContain('class="status-warn"');
    expect(html).toContain("Not compile-probed for 0.2.0");
    // the only probe on the site is the provider's own marker row (RULE-5)
    expect(html).toContain(`last verified on this fork: ${m.vers} (rustc ${m.toolchain})`);
    expect(html).toContain("Why this row is not in the matrix:");
    expect(html).toContain(note!);
    // pre-split platform binding + the declared compiler floor row
    expect(html).toContain("kael ships its own platform layer · pre-split launch via Application::new()");
    expect(html).toContain("declared rust-version 1.87 · advisory only — no attested floor yet");
    expect(html).toContain(">doc 10</a>");
    // name resolved into the manifest bytes; the token never reaches the DOM
    expect(html).toContain('name = "my-app"');
    expect(html).toContain('min-version = "0.2.0"');
    expect(html).not.toContain("{{project_name}}");
    // pre-split scaffold launch shape
    expect(html).toContain("Application::new()");
    // bindable row → the managed command path
    expect(html).toContain("cargo gocar lock");
  });

  test("a yanked row (gpui-ce 0.3.2) is flagged, never offered as a tool-managed start (RULE-6)", () => {
    const html = text(renderConfigure({ p: "gpui-ce", v: "0.3.2" }));
    expect(html).toContain("Yanked on crates.io — do not bind a new project to it (rule 6).");
    // the fixed companion pin of the T-17 mapping
    expect(html).toContain("gpui_ce_platform · fixed at 0.1.0");
    // reading-era commands, never the managed lock path (the scaffold's own
    // main.rs comments do name `cargo gocar lock` — target the command block)
    expect(html).toContain("# Yanked on crates.io — do not bind new projects to it.");
    expect(html).toContain("cargo generate-lockfile");
    expect(html).not.toContain("# Pin the artifact (MVS+) and materialize Cargo.lock");
    expect(html).not.toContain("cargo gocar verify-env");
  });

  test("a prerelease row (uno 1.17.0-pre) is flagged with the pre-release reading story", () => {
    const html = text(renderConfigure({ p: "gpui-unofficial", v: "1.17.0-pre" }));
    expect(html).toContain("A pre-release — never a default choice (rule 6).");
    expect(html).toContain("1.17.0-pre (pre-release)");
    expect(html).toContain("# Pre-release floor: `cargo gocar lock` refuses prerelease floors by design (docs 07).");
    expect(html).toContain("cargo generate-lockfile");
    expect(html).not.toContain("# Pin the artifact (MVS+) and materialize Cargo.lock");
    expect(html).not.toContain("cargo gocar verify-env");
    // the copy command names its own floor caveat (it cannot reproduce a row
    // that is not the fork's latest stable)
    expect(html).toContain(
      "copy this command — `cargo gocar new` floors at gpui-unofficial's latest stable",
    );
  });

  test("an unknown version falls back to the provider's latest stable; an invalid hash name falls back to the default", () => {
    const kael = manifest.providers.find((p) => p.id === "kael")!;
    const html = text(renderConfigure({ p: "kael", v: "9.9.9", name: "my app" }));
    expect(html).toContain('id="configure-name"');
    expect(html).toContain('value="gpui-app"');
    expect(html).toContain(`min-version = "${kael.latest_stable}"`);
    // the fallback default's status follows kael's own marker row.
    expect(html).toContain(
      compileStatus(kael, kael.latest_stable!).badge ? 'class="status-ok"' : 'class="status-warn"',
    );
    expect(html).not.toContain("status-flag-inline");
  });

  test("an unknown provider falls back to the recommended provider (never invented)", () => {
    const rec = resolveConfigured(manifest, { p: "no-such-fork" });
    const html = text(renderConfigure({ p: "no-such-fork" }));
    expect(html).toContain(`min-version = "${rec.vers}"`);
    // the fallback offer's status follows its own marker row, like any default.
    const badged = rec.provider.compile_verified?.vers === rec.vers;
    expect(html).toContain(badged ? 'class="status-ok"' : 'class="status-warn"');
  });

  test("every configure id the static markup + app.js bound exists in the rendered DOM", () => {
    const html = text(renderConfigure({ p: "kael", v: "0.2.0", name: "my-app" }));
    // The static-markup id contract is the frozen snapshot of the retired
    // static renderer (tests/fixtures/static-renderer-ids.ts, T-39
    // increment 6) — the index.html view-configure section's configure-* ids.
    const staticIds = new Set<string>(STATIC_RENDERER_IDS.configureStatic);
    expect(staticIds.size).toBeGreaterThan(0);
    for (const id of staticIds) {
      expect(html, `rendered id "${id}"`).toContain(`id="${id}"`);
    }
  });
});
