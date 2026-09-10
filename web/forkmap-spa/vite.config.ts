import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import { dirname, join, normalize, resolve } from "node:path";
import { cpSync, createReadStream, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";

const HERE = dirname(fileURLToPath(import.meta.url));
/** web/forkmap — the sibling tree holding the committed data bundle. */
const FORKMAP_DIR = resolve(HERE, "..", "forkmap");
/** The repo's published study docs (fetched from gpui-corpus/curation/research
 * by scripts/fetch-docs.sh); the reader's "read the full doc" hrefs are
 * site-relative `docs/…`, so the build mirrors this tree into dist/docs. */
const DOCS_DIR = resolve(HERE, "..", "..", "docs");
/** The production build output — a self-contained artifact (see the
 * forkmapDataCopy plugin: dist/ alone serves the app, data mirror included). */
const OUT_DIR = "dist";

const MIME: Record<string, string> = {
  ".json": "application/json",
  ".js": "text/javascript",
  ".css": "text/css",
  ".html": "text/html",
  ".md": "text/markdown",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

/**
 * Dev-only: serve a repo directory under an absolute URL prefix.
 *
 * The SPA fetches the data bundle at runtime as `forkmap/data/…` and links the
 * study docs as `docs/…` — both document-relative (see src/bundle/dataUrls.ts
 * and src/content/docs.ts). In dev, Vite's root is web/forkmap-spa/, so those
 * paths match no file — without this middleware the request falls through to
 * Vite's SPA fallback and a JSON fetch receives index.html (a silent
 * 200-with-wrong-body). This plugin answers them straight from the repo tree,
 * with the right content type, before the fallback can. Build output is
 * unaffected: the built artifact fetches the same document-relative namespace
 * from its own dist/forkmap/data and dist/docs mirrors (forkmapDataCopy +
 * docsCopy below) — no middleware needed.
 */
function siblingServe(prefix: string, dir: string): Plugin {
  return {
    name: `sibling-serve-${prefix.replace(/\W+/g, "")}`,
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url || !req.url.startsWith(prefix)) return next();
        const urlPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
        // Strip the prefix and map onto the directory; normalize + containment
        // guard so a URL can't escape it.
        const rel = normalize(urlPath.replace(prefix, ""));
        const file = join(dir, rel);
        if (!file.startsWith(dir) || !existsSync(file) || !statSync(file).isFile()) {
          res.statusCode = 404;
          res.end(`not found: ${urlPath}`);
          return;
        }
        const ext = file.slice(file.lastIndexOf(".")).toLowerCase();
        res.setHeader("Content-Type", MIME[ext] ?? "application/octet-stream");
        createReadStream(file).pipe(res);
      });
    },
  };
}

/**
 * Self-contained production builds (T-32-hostable): mirror the committed
 * web/forkmap/data bundle's *runtime-fetched* files into the output at
 * forkmap/data/.
 *
 * The SPA fetches every data file document-relative — forkmap/data/… against
 * the page's own base (src/bundle/dataUrls.ts) — so a dist/ deployed alone,
 * under any host path, resolves all of them against its own copy; nothing
 * outside the artifact is consulted at runtime. The mirror is lean: only the
 * fetch families below ride the deploy (~60 MB at the current corpus) — the
 * whole corpus/fn/doc/source-loc sidecars and the whole digest-state slice
 * are committed parity anchors no runtime view fetches and stay repo-only
 * (shipping them would add ~105 MB of dead weight). The copy is verbatim and
 * unhashed: re-runs stay byte-identical and chunk hashes never move on a data
 * change, because the data is copied into the output, never imported into a
 * chunk or content-hashed into an asset name. A layout change (a renamed or
 * new fetch family) fails the build loudly rather than shipping an artifact a
 * runtime fetch would 404 against; the served-artifact smoke is the backstop
 * once the families are in sync. The dev server needs none of this —
 * forkmapDevSibling() serves the same namespace from the source tree.
 */
const RUNTIME_DATA: Array<string | RegExp> = [
  // Boot + boot-adjacent slices.
  "forkmap-manifest.json",
  "forkmap-journal.json",
  "forkmap-align-index.json",
  // Per-release row files (Changes/Journal diff pairs).
  /^forkmap-release-\d{3}\.json$/,
  // Per-key digest columns (Alignment) + payload buckets (item box/popover).
  /^forkmap-column-\d{3}\.json$/,
  /^forkmap-payload-\d{3}\.json$/,
  // The lazy type-members sidecar (T-47 decision 2b): the pub-member
  // segments a re-signed type row diffs. Whole-file (not bucketed) like the
  // fn-texts anchor; fetched once, only on a member-bearing item.
  "forkmap-type-members.json",
];

const isRuntimeDataFile = (name: string): boolean =>
  RUNTIME_DATA.some((entry) => (typeof entry === "string" ? entry === name : entry.test(name)));

function forkmapDataCopy(): Plugin {
  const from = resolve(FORKMAP_DIR, "data");
  return {
    name: "forkmap-data-copy",
    apply: "build",
    closeBundle() {
      if (!existsSync(from)) {
        throw new Error(`forkmap-data-copy: committed bundle missing at ${from}`);
      }
      const dest = resolve(HERE, OUT_DIR, "forkmap", "data");
      mkdirSync(dest, { recursive: true });
      const names = readdirSync(from).filter(isRuntimeDataFile);
      // Fail loudly if the committed layout no longer matches a runtime
      // family (renamed at export?) — never ship a mirror a fetch 404s on.
      for (const entry of RUNTIME_DATA) {
        const found =
          typeof entry === "string" ? names.includes(entry) : names.some((name) => entry.test(name));
        if (!found) {
          throw new Error(`forkmap-data-copy: runtime family missing from ${from}: ${String(entry)}`);
        }
      }
      for (const name of names) {
        cpSync(join(from, name), join(dest, name));
      }
    },
  };
}

/**
 * Publish the study docs with the site: the repo's docs/ mirror (the studies
 * fetched from gpui-corpus/curation/research) is copied verbatim into
 * dist/docs, so the reader's site-relative `docs/…` hrefs resolve inside the
 * deployed artifact under any host path — same discipline as the data mirror
 * above. Verbatim + unhashed, so a doc edit never moves a chunk hash.
 */
function docsCopy(): Plugin {
  return {
    name: "forkmap-docs-copy",
    apply: "build",
    closeBundle() {
      if (!existsSync(DOCS_DIR)) {
        throw new Error(`forkmap-docs-copy: study docs missing at ${DOCS_DIR} — run scripts/fetch-docs.sh`);
      }
      cpSync(DOCS_DIR, resolve(HERE, OUT_DIR, "docs"), { recursive: true });
    },
  };
}

// T-39 (web/forkmap-spa): deterministic static build for the sibling SPA.
//   base: "./"     — asset references are host-agnostic (T-32 decides the
//                    served URL shape); hash routing means no server rewrite
//                    rules are needed. The data fetches are document-relative
//                    against the build's own forkmap/data/ mirror, so dist/
//                    is fully self-contained (forkmapDataCopy above).
//   data mirror — the runtime-fetched subset of the committed bundle rides
//                 dist/forkmap/data as a verbatim copy, never a build
//                 dependency: chunk hashes stay stable across data refreshes
//                 (deterministic re-run), parity anchors stay repo-only (the
//                 lean mirror ships no file the runtime never fetches), and
//                 the whole artifact boots from its own files — no sibling
//                 tree, no network beyond the host serving dist/ (T-29's
//                 currency e2e + T-33's cache story preserved; per-view
//                 first-visit payloads unchanged — only the on-demand files
//                 are fetched).
export default defineConfig({
  base: "./",
  // tailwindcss() compiles the @theme tokens + Tailwind directives in
  // src/styles.css into real CSS custom properties (:root) and utilities.
  plugins: [
    react(),
    tailwindcss(),
    siblingServe("/forkmap/", FORKMAP_DIR),
    siblingServe("/docs/", DOCS_DIR),
    forkmapDataCopy(),
    docsCopy(),
  ],
  build: {
    outDir: OUT_DIR,
    emptyOutDir: true,
    sourcemap: false,
  },
});
