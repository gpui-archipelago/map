// T-39 — hash routing, ported 1:1 from web/forkmap/app.js.
//
// The hash URLs are the compatibility contract (v1 deep links + the T-38
// back-param/round-trip semantics): `#/`, `#/changes?a=…&b=…`,
// `#/alignment?item=…&back=…`, `#/journal?s=…&v=…`, `#/configure?p=…`.
// View state lives in the hash so every view state stays linkable.

import { parse, stringify } from "./bundle/query";
import { branchBase } from "./bundle/derive";
import type { ManifestProvider, ManifestVersionRow } from "./bundle/types";

export type ViewName = "landing" | "changes" | "alignment" | "configure" | "journal";

export const VIEWS: ViewName[] = ["landing", "changes", "alignment", "configure", "journal"];

export interface Route {
  view: ViewName;
  params: Record<string, string>;
}

/** Parse a location.hash value (already stripped of "#") into a route. */
export function parseHash(hash: string): Route {
  if (!hash || hash === "/") return { view: "landing", params: {} };
  const [pathPart, queryPart] = hash.split("?");
  const view = (pathPart.replace(/^\//, "") || "landing") as ViewName;
  return { view, params: parse(queryPart ?? "") };
}

/** Serialize a route to a hash string ("" for landing, per the v1 shape). */
export function routeHash(view: ViewName, params: Record<string, string>): string {
  const qs = stringify(params);
  const path = view === "landing" ? "" : view;
  return `#/${path}${qs ? `?${qs}` : ""}`;
}

/**
 * Parse a back-param target ("changes?a=…&b=…" without the "#/") into a
 * route — the T-38 context round-trip contract.
 */
export function parseViewTarget(s: string): Route | null {
  if (!s) return null;
  const q = s.indexOf("?");
  const view = ((q < 0 ? s : s.slice(0, q)).replace(/^\/+/, "") || "landing") as ViewName;
  const params: Record<string, string> = {};
  if (q >= 0) {
    for (const [k, v] of new URLSearchParams(s.slice(q + 1))) params[k] = v;
  }
  return { view, params };
}

/**
 * A Changes deep link. Same-fork pairs stamp one provider on both sides;
 * cross-fork pairs (T-35) name the B side's own fork as `bProviderId` —
 * canonical per-side `a=<fork>:<vers>&b=<fork>:<vers>`, mirroring app.js.
 */
export function changesLink(providerId: string, aVers: string, bVers: string, bProviderId?: string): string {
  return `#/changes?a=${encodeURIComponent(`${providerId}:${aVers}`)}&b=${encodeURIComponent(`${bProviderId ?? providerId}:${bVers}`)}`;
}

export function alignmentLink(key: string, back?: string): string {
  const base = `#/alignment?item=${encodeURIComponent(key)}`;
  return back ? `${base}&back=${encodeURIComponent(back)}` : base;
}

/** One side of a Changes label over the manifest's rows. */
interface ManifestSide {
  provider: ManifestProvider;
  vers: string;
}

/**
 * Best-effort label for a return chip (app.js targetLabel): view names + the
 * row versions the hash names — resolved like the views do, never hardcoded.
 * T-33 increment 2: the Alignment view renders from the boot manifest + the
 * digest-state slice (it never holds the full corpus), so the label resolves
 * over the manifest's metadata rows — the same side-resolution semantics
 * (branch base + latest-stable defaults, RULE-6) the corpus views use.
 */
export function targetLabel(source: { providers: ManifestProvider[] }, target: Route): string {
  if (target.view === "changes") {
    const { a, b } = resolveChangesOver(source, target.params);
    const fmt = (s: ManifestSide) => `${s.provider.id} ${s.vers}`;
    return `${fmt(a)} → ${fmt(b)}` + (a.provider.id !== b.provider.id ? " (cross-fork)" : "");
  }
  if (target.view === "journal") {
    const prov = source.providers.find((p) => p.id === target.params.s) ?? null;
    const stream = prov ? prov.id : target.params.s;
    return target.params.v ? `Journal — ${stream} ${target.params.v}` : `Journal${stream ? ` — ${stream}` : ""}`;
  }
  return target.view;
}

/** Parse one Changes side param over the manifest's rows: the canonical
 * `<fork>:<vers>` form, or a bare `<vers>` resolved against `stream` (the v1
 * `?p=<fork>&a=…&b=…` shape) — the `changesSide` semantics (changes.ts)
 * over the metadata rows the boot manifest carries. A value naming an
 * unknown fork/row is null: a hash never names a row into existence. */
function changesSideOver(
  raw: string | null | undefined,
  source: { providers: ManifestProvider[] },
  stream?: string,
): ManifestSide | null {
  if (!raw) return null;
  const i = raw.indexOf(":");
  const rowOf = (p: ManifestProvider, vers: string): ManifestVersionRow | undefined =>
    p.versions.find((v) => v.vers === vers);
  if (i > 0) {
    const prov = source.providers.find((p) => p.id === raw.slice(0, i)) ?? null;
    const vers = raw.slice(i + 1);
    if (prov && rowOf(prov, vers)) return { provider: prov, vers };
    return null;
  }
  const prov = stream ? (source.providers.find((p) => p.id === stream) ?? null) : null;
  if (prov && rowOf(prov, raw)) return { provider: prov, vers: raw };
  return null;
}

/** The `resolveChanges` semantics over the boot manifest (changes.ts):
 * hash-named sides win; a missing side falls back on its sibling's fork
 * (anchor) to the default pair — the latest stable plus its branch base when
 * both sides share the fork (RULE-6, never a prerelease default). A hash
 * that names nothing resolves to the first provider's defaults. Only row
 * metadata (vers, prerelease, latest_stable) is read, so the label resolves
 * without the corpus. */
function resolveChangesOver(
  source: { providers: ManifestProvider[] },
  params: Record<string, string>,
): { a: ManifestSide; b: ManifestSide } {
  const stream = params.p ? (source.providers.find((p) => p.id === params.p) ?? null) : null;
  let a = changesSideOver(params.a, source, stream?.id);
  let b = changesSideOver(params.b, source, stream?.id);
  const anchor = a?.provider ?? b?.provider ?? stream ?? source.providers[0];
  const def = defaultPairOver(anchor);
  if (!a) a = { provider: anchor, vers: def.a ?? def.b };
  if (!b) b = { provider: anchor, vers: def.b };
  return { a, b };
}

/** The `defaultPair` semantics over the manifest's rows (changes.ts): B is
 * the latest stable — never a prerelease — and A is its branch base, never
 * the raw publish predecessor. Null A when B has no such base. */
function defaultPairOver(provider: ManifestProvider): { a: string | null; b: string } {
  const b =
    provider.versions.find((v) => v.vers === provider.latest_stable) ?? provider.versions[provider.versions.length - 1];
  const bi = provider.versions.indexOf(b);
  const a = branchBase(provider.versions, bi);
  return { a: a ? a.vers : null, b: b.vers };
}
