// T-39 — the one place that knows where the committed data bundle lives at
// runtime. Every data fetch in the app (the boot manifest, the journal
// slice, the per-release files, the align index + column buckets, the
// payload buckets) resolves through committedDataUrl().
//
// The path is *document-relative* on purpose: `forkmap/data/<file>` resolves
// against the page's own base (document.baseURI — the directory that serves
// index.html), so the built artifact works wherever a host serves it. The
// build mirrors the committed bundle's *runtime-fetched* files into
// dist/forkmap/data (vite.config.ts does the copy; the whole-file parity
// anchors stay repo-only), so a deployment of dist/ alone — under any host
// path, no rewrite rules — resolves every data fetch inside itself (T-32's
// hosted shape; hash routing keeps the document base stable). This is also
// the URL namespace the retired static site used (/forkmap/data/… served
// from web/).
//
// In dev Vite serves source modules and no copy exists at the document base,
// so the forkmap-dev-sibling middleware (vite.config.ts) answers the same
// /forkmap/data/… namespace straight from the committed web/forkmap tree —
// dev and the built artifact fetch identical URLs.
//
// The path is assembled from parts at runtime — a static relative literal
// inside new URL(...) would make Vite treat the file as a build asset
// (emitted into dist/) and roll the chunk hash on every data change,
// breaking the deterministic-build requirement. The data is never inlined
// into a chunk or content-hashed into an asset name; the build's mirror is a
// verbatim copy.
export function committedDataUrl(file: string): string {
  // The browser base is the document (the deployment root). Test/SSR
  // contexts (bun, react-dom/server) have no document — fall back to the
  // module URL, which is fine: these URLs are only ever fetched by the
  // browser runtime.
  const base = typeof document === "undefined" ? import.meta.url : document.baseURI;
  return new URL(["forkmap", "data", file].join("/"), base).href;
}
