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
import { ConfigureView } from "../src/views/ConfigureView";
import { STATIC_RENDERER_IDS } from "./fixtures/static-renderer-ids";
import { DOCS } from "../src/content/docs";
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

/** react-dom/server escapes text content (&quot;/&amp;/&#x27;/&lt;/&gt;) — decode so
 * assertions read like the rendered page. */
function text(html: string): string {
  return html
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
    // the picker lists every provider (the selected option carries React's
    // `selected` attribute — assert the option's visible text + closing tag)
    for (const p of manifest.providers) {
      expect(html).toContain(`${p.id} (${p.package})</option>`);
    }
    // RULE-5 status (compile marker row) + evidence link, or the honest
    // not-probed box when the default has moved past the probe.
    if (st.badge) {
      expect(html).toContain('class="status-ok"');
      expect(html).toContain("Compile-verified — this exact starting point was built through");
      expect(html).toContain(`rustc ${st.marker!.toolchain}. Evidence:`);
    } else {
      expect(html).toContain('class="status-warn"');
      expect(html).toContain(
        "Not compile-probed here — no build evidence exists for this exact (fork, version) starting point.",
      );
    }
    expect(html).toContain(DOCS["7"].title);
    // binding unit (unofficial's mirror companion) + the honest floor note
    expect(html).toContain(`gpui-unofficial ${rec.vers} + platform companion gpui-platform-gpui-unofficial`);
    expect(html).toContain("version-locked to the fork release (mirror), features \"x11\" + \"wayland\"");
    expect(html).toContain("no attested compiler floor yet — the declared floor is the advisory story");
    // standard hint (the input shows the default, valid name)
    expect(html).toContain('id="configure-name"');
    expect(html).toContain('value="gpui-app"');
    expect(html).toContain("the default is the latest stable (rule 6)");
    expect(html).not.toContain("status-flag-inline");
    // the manifest bytes are the export's own with the name resolved
    expect(html).toContain('name = "gpui-app"');
    expect(html).toContain(`min-version = "${rec.vers}"`);
    expect(occurrences(html, "{{project_name}}")).toBe(1); // only the file-sub note
    // scaffold main.rs (post-split launch shape for unofficial)
    expect(html).toContain("Post-split launch shape —");
    expect(html).toContain(scaffold.main_rs.split("\n")[0]);
    // commands + scope notes
    expect(html).toContain("cargo gocar lock");
    expect(html).toContain("cargo gocar verify-env");
    expect(html).toContain("Kit-rebase alias-shim bundles are not offered here (v2).");
    expect(html).toContain("every row here is a measured version of the six forks — no other package is offered.");
    for (let n = 1; n <= 7; n++) {
      expect(html, `honest-rule-${n}`).toContain(`id="honest-rule-${n}"`);
    }
  });

  test("kael 0.2.0 renders the honest not-probed box, its curated note, the facts + the resolved name", () => {
    const kael = manifest.providers.find((p) => p.id === "kael")!;
    const m = kael.compile_verified!;
    const note = configureBindingFor(manifest, "kael", "0.2.0")!.note;
    expect(note, "kael 0.2.0 carries the docs/07 window-edge note").toBeTruthy();
    const html = text(renderConfigure({ p: "kael", v: "0.2.0", name: "my-app" }));
    expect(html).toContain('class="status-warn"');
    expect(html).toContain("Not compile-probed here — no build evidence exists for this exact (fork, version) starting point.");
    // the only probe on the site is the provider's own marker row (RULE-5)
    expect(html).toContain(`This provider's only compile-verified row is ${m.vers} (rustc ${m.toolchain}): `);
    expect(html).toContain("Why this row is not in the matrix:");
    expect(html).toContain(note!);
    // pre-split binding unit + facts line (kael rows declare rust-version)
    expect(html).toContain("kael 0.2.0 alone — pre-split provider, ships its own platform layer (era template: Application::new()).");
    expect(html).toContain("declared rust-version 1.87 · no attested compiler floor yet — the declared floor is the advisory story (declared values are never attestations; doc 10).");
    // name resolved into the manifest bytes; only the note still names the token
    expect(html).toContain('name = "my-app"');
    expect(html).toContain('min-version = "0.2.0"');
    expect(occurrences(html, "{{project_name}}")).toBe(1);
    // pre-split scaffold launch shape
    expect(html).toContain("Pre-split launch shape — `Application::new()` on the fork's own platform layer.");
    expect(html).toContain("Application::new()");
    // bindable row → the managed command path
    expect(html).toContain("cargo gocar lock");
  });

  test("a yanked row (gpui-ce 0.3.2) is flagged, never offered as a tool-managed start (RULE-6)", () => {
    const html = text(renderConfigure({ p: "gpui-ce", v: "0.3.2" }));
    expect(html).toContain("Yanked on crates.io — do not bind a new project to it (rule 6).");
    // the fixed companion pin of the T-17 mapping
    expect(html).toContain("gpui-ce 0.3.2 + platform companion gpui_ce_platform (fixed at 0.1.0 for the lineage");
    // reading-era commands, never the managed lock path (the scaffold's own
    // main.rs comments do name `cargo gocar lock` — target the command block)
    expect(html).toContain("# Yanked on crates.io — do not bind new projects to it.");
    expect(html).toContain("cargo generate-lockfile");
    expect(html).not.toContain("# Pin the artifact (MVS+) and materialize Cargo.lock");
    expect(html).not.toContain("cargo gocar verify-env");
    expect(html).toContain("A gocar-managed lock never selects a yanked or prerelease floor (rule 6); for a tool-managed starting point pick the provider's latest stable row.");
  });

  test("a prerelease row (uno 1.17.0-pre) is flagged with the pre-release reading story", () => {
    const html = text(renderConfigure({ p: "gpui-unofficial", v: "1.17.0-pre" }));
    expect(html).toContain("Pre-release release — never a default choice (rule 6), and `cargo gocar lock` refuses prerelease floors by design (docs 07)");
    expect(html).toContain("1.17.0-pre (pre-release)");
    expect(html).toContain("# Pre-release floor: `cargo gocar lock` refuses prerelease floors by design (docs 07).");
    expect(html).toContain("cargo generate-lockfile");
    expect(html).not.toContain("# Pin the artifact (MVS+) and materialize Cargo.lock");
    expect(html).not.toContain("cargo gocar verify-env");
    expect(html).toContain("A gocar-managed lock never selects a yanked or prerelease floor (rule 6); for a tool-managed starting point pick the provider's latest stable row.");
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
