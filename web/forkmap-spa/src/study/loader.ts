// T-39 — where the reader's docs come from at runtime.
//
// Same discipline as the data bundle (src/bundle/dataUrls.ts): the path in
// src/content/docs.ts is *document-relative* (`docs/04-user-docs/NN-….md`), so
// it resolves against the page's own base — under any host path, no rewrite
// rules. The dev server answers that namespace from the repo tree
// (vite.config.ts siblingServe("/docs/", …)), and the built artifact answers it
// from its own dist/docs mirror (docsCopy), which is why dist alone is enough.
//
// The URL is assembled at runtime rather than written as a static relative
// literal, for the same reason committedDataUrl is: Vite would otherwise treat
// the file as a build asset and roll a chunk hash on every doc edit.

/** The absolute URL a doc is fetched from. Test/SSR contexts have no document
 * (and never fetch), so the module URL is a harmless fallback there. */
export function docUrl(path: string): string {
  const base = typeof document === "undefined" ? import.meta.url : document.baseURI;
  return new URL(path, base).href;
}

/** The doc's markdown. Throws on a non-OK response so the reader can say so
 * instead of pretending it rendered something. */
export async function fetchDocMarkdown(path: string, signal?: AbortSignal): Promise<string> {
  const res = await fetch(docUrl(path), { signal });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return await res.text();
}
