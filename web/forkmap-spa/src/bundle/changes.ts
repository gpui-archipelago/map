// T-39 — Changes-view pair resolution over the bundle.
//
// A 1:1 TS port of the pair/state functions in web/forkmap/app.js
// (defaultPair, changesPairValue, changesSide, resolveChanges, releaseFlags
// + the providerFor/rowFor finders). These decide *which* two releases a
// Changes deep link or an empty hash renders, so their semantics are the
// RULE-6 contract: an unnamed side resolves on its sibling's fork to the
// latest stable (+ its branch base when both sides share the fork) — never a
// prerelease.
//
// Parity rule: keep behavior-identical to app.js (they are what the caption
// prose and the picker-convergence handlers are built on).
//
// T-33 increment 4: the finders are typed on the boot manifest's provider
// rows (metadata only — never a measured surface), so both the full bundle
// (the parity suite's oracle) and the boot manifest (what the Changes view
// renders from, beside the journal slice + per-release files) satisfy them —
// the ConfigureSource precedent.

import type { ManifestProvider, ManifestVersionRow, Side } from "./types";
import { branchBase } from "./derive";

/** A pair-resolution source: the fork rows the pickers/resolver read —
 * satisfied by the full bundle and the boot manifest alike (Provider rows
 * are a structural superset of the manifest rows). */
export interface PairSource {
  providers: ManifestProvider[];
  recommended_provider?: string;
}

export function providerFor(source: PairSource, id: string): ManifestProvider | null {
  return source.providers.find((p) => p.id === id) ?? null;
}

export function rowFor(provider: ManifestProvider, vers: string): ManifestVersionRow | null {
  return provider.versions.find((v) => v.vers === vers) ?? null;
}

/**
 * The default diffable pair of a stream (RULE-6): B is the latest stable —
 * never a prerelease — and A is its **branch** base (the previous stable of
 * its line, or for a preview the newest stable published before it), never the
 * raw publish predecessor. Null when B has no such base (the stream's first
 * stable).
 */
export function defaultPair(provider: ManifestProvider): { a: string | null; b: string } {
  const b =
    provider.versions.find((v) => v.vers === provider.latest_stable) ?? provider.versions[provider.versions.length - 1];
  const bi = provider.versions.indexOf(b);
  const a = branchBase(provider.versions, bi);
  return { a: a ? a.vers : null, b: b.vers };
}

/** Canonical side value ("<fork>:<vers>") for a Changes deep link. */
export function changesPairValue(providerOrId: ManifestProvider | string, vers: string): string {
  const id = typeof providerOrId === "string" ? providerOrId : providerOrId.id;
  return `${id}:${vers}`;
}

/**
 * Parse one Changes side param: the canonical `<fork>:<vers>` form, or a bare
 * `<vers>` resolved against the `stream` (the v1 `?p=<fork>&a=…&b=…` shape).
 * A value naming an unknown fork/row is treated as absent (null) so the hash
 * can never name a row into existence.
 */
export function changesSide(
  raw: string | null | undefined,
  source: PairSource,
  stream?: string,
): Side | null {
  if (!raw) return null;
  const i = raw.indexOf(":");
  if (i > 0) {
    const prov = providerFor(source, raw.slice(0, i));
    const vers = raw.slice(i + 1);
    if (prov && rowFor(prov, vers)) return { provider: prov, vers };
    return null; // canonical form naming unknown rows — treated as absent
  }
  const prov = stream ? providerFor(source, stream) : null;
  if (prov && rowFor(prov, raw)) return { provider: prov, vers: raw };
  return null;
}

/**
 * Resolve a Changes route's sides (RULE-6): hash-named rows win; a missing
 * side falls back on its sibling's fork (anchor) to the default pair — the
 * latest stable plus its branch base when both sides share the fork. A hash
 * that names nothing resolves to the first provider's defaults.
 */
export function resolveChanges(
  source: PairSource,
  params: Record<string, string>,
): { a: Side; b: Side } {
  const stream = params.p ? providerFor(source, params.p) : null;
  let a = changesSide(params.a, source, stream?.id);
  let b = changesSide(params.b, source, stream?.id);
  const anchor = a?.provider ?? b?.provider ?? stream ?? source.providers[0];
  const def = defaultPair(anchor);
  if (!a) a = { provider: anchor, vers: def.a ?? def.b };
  if (!b) b = { provider: anchor, vers: def.b };
  return { a, b };
}

/** Whether the route itself names the pair (deep link) rather than defaults. */
export function namedPair(params: Record<string, string>): boolean {
  return Boolean(params.a || params.b || params.p);
}

/** Human flag words of a release row, in the order the site renders them.
 * Typed on the flag subset so full-bundle rows and boot-manifest rows both
 * work (T-33). */
export function releaseFlags(v: { yanked?: boolean; prerelease?: boolean }): string[] {
  const parts: string[] = [];
  if (v.yanked) parts.push("yanked");
  if (v.prerelease) parts.push("pre-release");
  return parts;
}

/** " (flag, flag)" suffix for a release chip, or "" when unflagged. */
export function releaseFlagsSuffix(v: { yanked?: boolean; prerelease?: boolean }): string {
  const flags = releaseFlags(v);
  return flags.length ? ` (${flags.join(", ")})` : "";
}
