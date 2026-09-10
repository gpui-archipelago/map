// T-39 — Configure-view resolution over the bundle.
//
// A 1:1 TS port of the configure helpers + RULE-6 defaults in
// web/forkmap/app.js (renderConfigure): the per-provider binding-set and
// scaffold finders, the crate-name validator, and the (provider, version,
// project name) a hash or an empty hash resolves to. The view renders bundle
// bytes and resolves {{project_name}} — it computes nothing the export did
// not (T-31 / UC-10). T-33: the helpers read only the metadata subset the
// boot manifest carries (`ConfigureSource` — satisfied by the full bundle
// and the manifest alike), so the configurator boots without the corpus.
// Keep behavior-identical to app.js.

import type {
  BindingEntry,
  BindingsSet,
  ConfigureSource,
  ManifestProvider,
  ManifestVersionRow,
  ScaffoldTemplate,
} from "./types";

export const CRATE_NAME_RE = /^[A-Za-z][A-Za-z0-9_-]*$/;
export const DEFAULT_PROJECT_NAME = "gpui-app";

/** A crate name must start with a letter; only letters, digits, '-' and '_'
 * follow (app.js CRATE_NAME_RE). */
export function validCrateName(s: unknown): boolean {
  return typeof s === "string" && CRATE_NAME_RE.test(s);
}

/** A hash `name` resolves to itself when valid, else the default — an
 * invalid hash value never names a project into existence. */
export function resolvedProjectName(nameParam: string | undefined | null): string {
  return validCrateName(nameParam) ? (nameParam as string) : DEFAULT_PROJECT_NAME;
}

function providerFor(source: ConfigureSource, id: string): ManifestProvider | null {
  return source.providers.find((p) => p.id === id) ?? null;
}

function rowFor(provider: ManifestProvider, vers: string): ManifestVersionRow | null {
  return provider.versions.find((v) => v.vers === vers) ?? null;
}

export function configureBindingsFor(source: ConfigureSource, providerId: string): BindingsSet | null {
  return (source.templates?.bindings ?? []).find((s) => s.provider === providerId) ?? null;
}

export function configureBindingFor(
  source: ConfigureSource,
  providerId: string,
  vers: string,
): BindingEntry | null {
  return (configureBindingsFor(source, providerId)?.entries ?? []).find((e) => e.vers === vers) ?? null;
}

export function configureScaffoldFor(source: ConfigureSource, providerId: string): ScaffoldTemplate | null {
  return (source.templates?.scaffold ?? []).find((e) => e.provider === providerId) ?? null;
}

/** RULE-6 default version: the provider's latest stable — never a yanked or
 * prerelease row; falls back to the last published row. */
export function defaultVersion(provider: ManifestProvider): string {
  return provider.latest_stable ?? provider.versions[provider.versions.length - 1]?.vers ?? "";
}

/** The provider an empty hash renders: the source's recommended provider when
 * it names a real provider, else the first provider (app.js). */
export function recommendedProviderId(source: ConfigureSource): string {
  const rec = source.recommended_provider;
  return rec && providerFor(source, rec) ? rec : source.providers[0]?.id ?? "";
}

/**
 * Resolve the Configure route exactly as app.js render() does: provider = the
 * hash `p` when it names a real provider, else the recommended provider, else
 * providers[0]; version = the hash `v` when it names a real row of that
 * provider, else the RULE-6 default (latest stable); name = the hash `name`
 * when valid, else the default.
 */
export function resolveConfigured(
  source: ConfigureSource,
  params: Record<string, string>,
): { provider: ManifestProvider; vers: string; name: string } {
  const provider =
    providerFor(source, params.p) ?? providerFor(source, recommendedProviderId(source)) ?? source.providers[0];
  const vers = rowFor(provider, params.v) ? params.v : defaultVersion(provider);
  return { provider, vers, name: resolvedProjectName(params.name) };
}
