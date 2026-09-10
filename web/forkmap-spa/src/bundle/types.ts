// T-39 — fork-map bundle types.
//
// A faithful TS port of the `gocar.forkmap.v1` bundle shape that the retired
// static site's validateBundle (web/forkmap/app.js, git history) enforced
// and web/forkmap/check.py mirrored. Every nullable field keeps the
// semantics the honest rules rely on:
// `surface: null` means *never measured* (RULE-4), never an empty measurement.

export const FORKMAP_SCHEMA = "gocar.forkmap.v1";

/** The boot-manifest schema (T-33): the fork-map bundle minus every measured
 * surface, plus the export-precomputed corpus counts — what the SPA boots on.
 * The full-corpus sibling (`gocar.forkmap.v1`) is never fetched by the
 * runtime: the Changes/Journal corpus views read the export-derived
 * per-release row data (`gocar.forkmap.journal.v1` + `gocar.forkmap.release.v1`,
 * T-33 increment 4) and the Alignment view renders its matrix from the
 * export-derived digest-state slice (`gocar.forkmap.alignment.v1`, T-33
 * increment 2). */
export const MANIFEST_SCHEMA = "gocar.forkmap.manifest.v1";

/** The alignment digest-state slice schema (T-33 increment 2): per item key
 * its distinct measured digests in first-measured order and the per-release
 * present cells as digest indexes, precomputed at export from the full bundle
 * (option (c)). Since T-33 increment 5 the runtime no longer fetches this
 * file: the Alignment view loads the export-derived item index
 * (`gocar.forkmap.alignindex.v1`) on open and one per-key column bucket
 * (`gocar.forkmap.column.v1`) per selected item; the slice stays committed +
 * emitted as the canonical column store + the parity anchor every mirror
 * projects from (RULE-7). The ~35 MB full corpus is never fetched on the
 * Alignment path. */
export const ALIGNMENT_SCHEMA = "gocar.forkmap.alignment.v1";

/** The alignment item index schema (T-33 increment 5): the Alignment view's
 * resident type-ahead payload — every item key with its release-row count in
 * the type-ahead order, plus the per-stream never-measured markers (RULE-4).
 * Split out of the digest-state slice so opening the view pays for the index
 * alone (~0.7 MB at the current corpus), never the whole ~3.5 MB column
 * store, which rides the sibling column buckets (`gocar.forkmap.column.v1`),
 * fetched per selected item. */
export const ALIGN_INDEX_SCHEMA = "gocar.forkmap.alignindex.v1";

/** The per-key column fragment schema (T-33 increment 5): the digest-state
 * slice's per-key tables — each item's distinct measured digests in
 * first-measured order and its per-release present cells as digest indexes —
 * bucketed by the shared item ordinal (`bucket = ordinal / 128`, the same
 * ordinal space + bucket width as the payload fragments, so a selected
 * item's column fragment and payload fragment ride the same bucket index).
 * The matrix + deck of one selected item fetch one bucket file (median ≈ 29
 * KB at the current corpus), never the whole slice. */
export const COLUMN_SCHEMA = "gocar.forkmap.column.v1";

/** The per-key payload fragment schema (T-33 increment 3): the Alignment
 * item-box/popover payload rows — resolved fn signature texts, resolved
 * docstrings and measured source locations — transposed from the whole-file
 * sidecars into a per-key layout addressed by the shared (provider, version)
 * row space and bucketed by the digest-state slice's item ordinal. Bucket
 * files (data/forkmap-payload-###.json) are compact-serialized: their bytes
 * are the Alignment item-box/popover path's first-visit payload. */
export const PAYLOAD_SCHEMA = "gocar.forkmap.payload.v1";

/** Item keys per payload bucket file (T-33 increment 3) — also the keys per
 * column bucket file (T-33 increment 5, `COLUMN_SCHEMA`): both bucket spaces
 * are split on the same item ordinals, so a selected item's column fragment
 * and payload fragment ride the same bucket index. The item list is sorted in
 * the type-ahead order (the digest-state slice's `items` — the order the
 * align-index file carries, T-33 increment 5), so a key's ordinal in that
 * list addresses its bucket (`bucket = ordinal / 128`) with no hash spec to
 * keep in parity between Rust and TS. 128 ≈ 104 keys ≈ 0.3 MB per payload
 * file at the current corpus (measured 2026-09-09); column buckets at the
 * same width measure median ≈ 29 KB / max ≈ 75 KB. */
export const PAYLOAD_BUCKET_KEYS = 128;

/** The column buckets share the payload buckets' width + ordinal space (T-33
 * increment 5): `bucket = ordinal / COLUMN_BUCKET_KEYS` — the same bucket
 * index a selected item's payload fragment rides. */
export const COLUMN_BUCKET_KEYS = PAYLOAD_BUCKET_KEYS;

/** The per-release payload file schema (T-33 increment 4): the Changes/
 * Journal row-level payload — per measured release row one compact file
 * carrying that release's own digest-level surface rows + its resolved fn
 * signature texts, so a two-release diff fetches exactly two files instead of
 * the whole ~35 MB corpus + ~15.7 MB fn-texts sidecar. Files are addressed
 * by the row's flat position in the shared (provider-major) row space the
 * manifest's version lists define; the whole files stay committed as the
 * parity anchor but leave the runtime fetch graph. */
export const RELEASE_SCHEMA = "gocar.forkmap.release.v1";

/** The journal story slice schema (T-33 increment 4): the collapsed Journal
 * feed's whole data — per provider stream, per release row its measuredness
 * class + item-record count, branch-base predecessor and the (base, row)
 * diff counts, precomputed at export (option (c)) so the feed renders every
 * entry without fetching per-release rows. */
export const JOURNAL_SCHEMA = "gocar.forkmap.journal.v1";

/** One item's payload rows as a bucket file carries them (T-33 increment 3):
 * the key's measured rows over the shared (provider, version) row space,
 * each map keyed `"<provider index>:<version index>"` — the same indexes
 * the digest-state slice's `cells` and the boot manifest's release rows use.
 * A key with no payload rows of a kind omits that map; a key with none at
 * all is absent from its bucket's `items`. */
export interface KeyPayload {
  /** The item key (`kind:qualified-name`). */
  k: string;
  /** `"pi:vi" → resolved docstring` of that release (fn keys only). */
  d?: Record<string, string>;
  /** `"pi:vi" → resolved fn signature text` of that release (fn keys only,
   * single-digest rows only). */
  s?: Record<string, string>;
  /** `"pi:vi" → measured declaration source locations` of that release, as
   * compact `[file, start, end]` tuples (any declared kind; re-export keys
   * never resolve). */
  l?: Record<string, Array<[string, number, number]>>;
}

/** One committed `gocar.forkmap.payload.v1` bucket file
 * (data/forkmap-payload-###.json, T-33 increment 3). */
export interface PayloadBucket {
  schema: string;
  dataset_schema: string;
  dataset_synced_at: string | null;
  /** The item ordinal of this bucket's first key slot
   * (`bucket × PAYLOAD_BUCKET_KEYS`) — the addressing anchor on the shared
   * (slice) ordinal space. */
  from: number;
  /** Per-key payload rows in slice (type-ahead) order. */
  items: KeyPayload[];
}

/** One measured (key, digest) record of a release surface. The committed
 * bundle additionally carries each record's effective `cfg` gate list as
 * provenance (T-26) — declared here so views can state gates for gated
 * items without treating them as evaluation. */
export interface SurfaceItem {
  key: string;
  digest: string;
  /** Effective `#[cfg]` gates (own + enclosing impl/module chain), as
   * recorded — provenance marking, never evaluation. Absent on records
   * without gates (and in hand-built fixtures). */
  cfg?: string[];
}

/** A release's facade shim table (`gocar.facade.v1`) as exported: real shims
 * only — a version whose every rule classified skipped carries no facade row
 * (the skipped-with-reason stays a `cargo gocar facade` decision aid). The
 * front end reads only the shim counts (`aliases`/`polyfills` lengths). */
export interface FacadeShim {
  aliases: unknown[];
  polyfills: unknown[];
  skipped: unknown[];
}

/** A release row: registry truth + measured surface (or null = unmeasured). */
export interface VersionRow {
  vers: string;
  yanked: boolean;
  prerelease: boolean;
  /** null = never measured; [] = measured empty; else measured items. */
  surface: SurfaceItem[] | null;
  /** Declared rust-version (never an attestation — the meta line says so). */
  rust_version?: string;
  /** The facade shim table of this exact release, when it carries shims. */
  facade?: FacadeShim;
  /** Whole-surface blake3 hash (measured); the site never renders it and
   * never compares it across forks (RULE-1) — check.py asserts equality
   * stays within a stream. */
  api_hash?: string;
}

/** A compile-verified marker: badge data carried by the bundle (RULE-5). */
export interface CompileMarker {
  vers: string;
  toolchain: string;
  evidence: string;
}

/** The T-17 per-provider platform-companion mapping (crates.io-index-verified
 * pin rules). Absent for pre-split providers. */
export interface PlatformCompanion {
  package: string;
  /** "mirror" (version-for-version caret) or a fixed single version. */
  pin: "mirror" | { fixed: string };
  features?: string[];
  note?: string;
}

/** The curated upstream github source map (T-45), when a fork's published
 * bytes republish an upstream repo's crate under its own package name at a
 * mapable tag. Absent = no verified upstream source — the release's docs.rs
 * anchor is the only source. Curated data with provenance (exported from the
 * bundle's provider rows), never derived from `repository`. */
export interface GitHubUpstream {
  /** The upstream `owner/repo` (no leading scheme) whose tree holds the crate. */
  repo: string;
  /** The repo-tree directory equal to the crate's lib source root — what the
   * measured `file` is prefixed with to reach the declaration upstream. */
  tree: string;
  /** The upstream tag prefix a fork version refs under (e.g. `v`): the fork
   * republishes an upstream release whose git tag is `<prefix><vers>` for
   * every fork version (stable and prerelease alike). Absent = the fork has no
   * upstream release-tag map (independent fork, or a republish whose versions
   * don't name upstream tags) — never shows a github anchor. */
  tag?: string;
  note?: string;
}

/** A fork (provider): one shared lineage stream of releases. */
export interface Provider {
  id: string;
  package: string;
  lib_name: string;
  latest_stable?: string;
  description?: string;
  repository?: string;
  platform_companion?: PlatformCompanion | null;
  upstream?: GitHubUpstream;
  compile_verified?: CompileMarker;
  versions: VersionRow[];
}

/** One measured release end of a rule's transition provenance. */
export interface RuleEndpoint {
  provider: string;
  version: string;
  api_hash?: string;
}

/** A confirmed migration rule between two measured items. */
export interface Rule {
  id: string;
  from: { key: string };
  to: { key: string };
  /** Provenance: which measured releases bound the transition (the row
   * renderer's "confirmed successor" claim checks the to-end). */
  transition: { from: RuleEndpoint; to: RuleEndpoint };
  human_confirmed: boolean;
  note?: string;
}

export interface KitProbe {
  kit: string;
  kit_version: string;
  binds: string;
  target: string;
  outcome: string;
  caveat?: string;
  evidence: string;
}

export interface BindingEntry {
  vers: string;
  cargo_toml: string;
  main_rs?: string;
  note?: string;
}

export interface BindingsSet {
  provider: string;
  entries: BindingEntry[];
}

export interface ScaffoldTemplate {
  provider: string;
  cargo_toml: string;
  main_rs: string;
}

export interface Templates {
  scaffold: ScaffoldTemplate[];
  bindings: BindingsSet[];
}

/** The committed `gocar.forkmap.v1` bundle (data/forkmap.json). */
export interface ForkmapBundle {
  schema: string;
  dataset_schema: string;
  dataset_synced_at: string | null;
  contract: string;
  contract_description?: string | null;
  /** The provider an empty Configure hash renders (the export's choice, e.g.
   * the fork the docs/07 matrix proves); falls back to providers[0]. */
  recommended_provider?: string;
  rules: Rule[];
  templates: Templates;
  kit_probes: KitProbe[];
  providers: Provider[];
}

// ---------------------------------------------------------------------------
// The boot manifest (data/forkmap-manifest.json, T-33) — the fork-map bundle
// minus every measured `surface`, plus the export-precomputed corpus counts.
// ---------------------------------------------------------------------------

/** A release row as the boot manifest carries it: metadata only, never the
 * measured surface (the measured rows ride the export-derived per-release
 * files, T-33 increment 4). Structurally a supertype of `VersionRow` (every
 * full-bundle row satisfies it), so the light views and the shared
 * resolution helpers can read either. */
export interface ManifestVersionRow {
  vers: string;
  yanked: boolean;
  prerelease: boolean;
  rust_version?: string;
  api_hash?: string;
  versem?: number[];
  toolchain_floor?: string;
  /** The facade shim table of this exact release, when it carries shims. */
  facade?: FacadeShim;
}

/** A fork as the boot manifest carries it (version rows without surfaces). */
export interface ManifestProvider {
  id: string;
  package: string;
  lib_name: string;
  latest_stable?: string;
  description?: string;
  repository?: string;
  platform_companion?: PlatformCompanion | null;
  upstream?: GitHubUpstream;
  compile_verified?: CompileMarker;
  versions: ManifestVersionRow[];
}

/** The committed `gocar.forkmap.manifest.v1` boot slice
 * (data/forkmap-manifest.json, T-33). */
export interface ForkmapManifest {
  schema: string;
  dataset_schema: string;
  dataset_synced_at: string | null;
  contract: string;
  contract_description?: string | null;
  recommended_provider?: string;
  rules: Rule[];
  templates: Templates;
  kit_probes: KitProbe[];
  providers: ManifestProvider[];
  /** Corpus counts, precomputed at export from the same data the full bundle
   * carries (RULE-7: dataset-derived by the generating command; the parity
   * suite asserts them equal to the client derivation over the bundle). */
  counts: BundleCounts;
}

/** One provider stream skeleton of the digest-state slice: the stream's
 * identity plus which of its release rows were never measured (RULE-4's
 * `surface: null` — the matrix's "not measured" cells). A measured-empty row
 * is never listed. The rows' version metadata lives in the boot manifest;
 * the slice carries only what the matrix cannot read there. */
export interface AlignmentStream {
  id: string;
  /** Indexes into the provider's own version-row order (shared by the full
   * bundle and the boot manifest) of rows whose surface was never measured. */
  unmeasured: number[];
}

/** One item's digest-state table (T-33 increment 2): its distinct measured
 * digests in first-measured order (the α/β/γ… deck labels — the exact order
 * the client `itemVariants` derivation produces over the corpus), and the
 * present cells. */
export interface AlignmentItem {
  key: string;
  /** Distinct digests in first-measured order (within one release row ties
   * break on digest bytes) — indexes into this pool by every cell. */
  ds: string[];
  /** `[provider index, version index, digest indexes into `ds`]` — one
   * entry per (release row, key) the corpus measures present: a row measured
   * under several digests at once (cfg variants / model artifacts) carries
   * them all; a measured row without the key and a never-measured row
   * contribute no cell. Strictly ordered by (provider, version) in the
   * corpus scan order. */
  cells: Array<[number, number, number[]]>;
}

/** The committed `gocar.forkmap.alignment.v1` digest-state slice
 * (data/forkmap-alignment.json, T-33 increment 2). Since T-33 increment 5 it
 * is the parity anchor + the mirror input (deriveAlignmentSlice / the
 * re-bucketing mirrors deriveAlignIndex + deriveColumnBuckets), not a
 * runtime fetch. */
export interface AlignmentSlice {
  schema: string;
  dataset_schema: string;
  dataset_synced_at: string | null;
  /** The provider streams, in bundle order — the order every `cells` provider
   * index refers to, and the order the matrix walks. */
  streams: AlignmentStream[];
  /** Per-key digest-state tables, sorted in the type-ahead's own order (kind
   * rank, then key bytes) so the file IS the corpus index + matrix data. */
  items: AlignmentItem[];
}

// ---------------------------------------------------------------------------
// The alignment item index + per-key column buckets (T-33 increment 5) — the
// digest-state slice split into the bytes each Alignment interaction reads.
// ---------------------------------------------------------------------------

/** One item's entry in the alignment item index (T-33 increment 5): the key
 * the type-ahead matches + its release-row count (a release counts once per
 * key — a multi-digest row is one cell). Kind/name split from the key text on
 * the client exactly like the full-bundle index; the per-key digest pools +
 * cells ride the column buckets. */
export interface AlignIndexKey {
  /** The item key (`kind:qualified-name`). */
  k: string;
  /** Release rows carrying the key — the type-ahead's per-key count, equal to
   * the item's `cells` length in the digest-state slice. */
  n: number;
}

/** The committed `gocar.forkmap.alignindex.v1` item index
 * (data/forkmap-align-index.json, T-33 increment 5) — what the Alignment
 * view fetches on open: the type-ahead key list + the per-stream
 * never-measured markers. The key list is sorted in the type-ahead order —
 * the same order as the slice's `items`, so a key's position here IS its
 * ordinal in the shared addressing space the column + payload buckets are
 * split on. */
export interface AlignIndex {
  schema: string;
  dataset_schema: string;
  dataset_synced_at: string | null;
  /** The provider streams, in bundle order (byte-equal to the slice's —
   * RULE-4's never-measured markers live here so the matrix synthesis needs
   * no second file). */
  streams: AlignmentStream[];
  /** The type-ahead key list with per-key release-row counts. */
  keys: AlignIndexKey[];
}

/** One item's digest-state table as a column bucket file carries it (T-33
 * increment 5): byte-equal to the slice's own item (the slice stays the
 * canonical column store + parity anchor). */
export interface ColumnItem {
  /** The item key (`kind:qualified-name`). */
  k: string;
  /** Distinct digests in first-measured order — indexes into this pool by
   * every cell (the α/β/γ… deck labels). */
  ds: string[];
  /** `[provider index, version index, digest indexes into `ds`]` — one entry
   * per (release row, key) the corpus measures present. */
  cells: Array<[number, number, number[]]>;
}

/** One committed `gocar.forkmap.column.v1` bucket file
 * (data/forkmap-column-###.json, T-33 increment 5). */
export interface ColumnBucket {
  schema: string;
  dataset_schema: string;
  dataset_synced_at: string | null;
  /** The item ordinal of this bucket's first key slot (`bucket ×
   * COLUMN_BUCKET_KEYS`) — the shared addressing space (the slice's item
   * order, carried by the align-index file), like the payload buckets' `from`. */
  from: number;
  /** Per-key digest-state tables in slice (type-ahead) order. */
  items: ColumnItem[];
}

// ---------------------------------------------------------------------------
// The fn-signature sidecar (data/forkmap-fn-texts.json, T-34) — loaded
// lazily, off the boot critical path, only when a view renders re-signed
// fn rows.
// ---------------------------------------------------------------------------

export const FN_TEXTS_SCHEMA = "gocar.forkmap.fntexts.v1";

/** One version's effective measured `fn:` signature texts, as the exporter
 * resolved them from the dataset's sparse emissions (equal digest ⇒ byte-
 * equal canonical text — resolution, never inference). */
export interface FnTextsVersion {
  vers: string;
  /** `fn:` key → effective canonical signature text of this exact release.
   * Multi-digest keys (measured cfg variants / model artifacts) are absent
   * — views render those digest-only. */
  fn_texts: Record<string, string>;
}

export interface FnTextsProvider {
  id: string;
  versions: FnTextsVersion[];
}

/** The committed `gocar.forkmap.fntexts.v1` sidecar (forkmap-fn-texts.json). */
export interface FnTextsBundle {
  schema: string;
  dataset_synced_at: string | null;
  dataset_schema: string;
  providers: FnTextsProvider[];
}

// ---------------------------------------------------------------------------
// The doc-texts sidecar (data/forkmap-doc-texts.json, T-43) — per-version
// effective measured fn docstrings, resolved at export by walking the
// thinning's own measured order (never inferred; a corpus doc removal is an
// explicit `""` marker that ends a carry, so a still-doc-less release simply
// has no entry). Loaded lazily beside the fn-texts sidecar, only when the
// Alignment view renders an item whose title/docs need the bytes.
// ---------------------------------------------------------------------------

export const DOC_TEXTS_SCHEMA = "gocar.forkmap.doctexts.v1";

// ---------------------------------------------------------------------------
// The source-location sidecar (data/forkmap-source-locs.json, T-44) — the
// measured declaration source locations of surface items, per measured
// release. Loaded lazily beside the other sidecars, only when the Alignment
// popover renders a source permalink.
// ---------------------------------------------------------------------------

export const SRC_LOCS_SCHEMA = "gocar.forkmap.srclocs.v1";

/** One measured declaration source location (T-44): the file relative to the
 * library source directory + the inclusive 1-based line span of the item's
 * syn span (first attribute/doc line through the closing line). */
export interface SourceLoc {
  file: string;
  start: number;
  end: number;
}

/** One version's measured declaration source locations. A key is absent when
 * the release resolves no location for it: it is a re-export (`use:`) key or
 * was never measured. A key usually maps to one location; a release that
 * measures a key at several declarations at once (cfg variants / model
 * artifacts) maps to each, deduplicated and sorted at export. */
export interface SrcLocsVersion {
  vers: string;
  source_locs: Record<string, SourceLoc[]>;
}

export interface SrcLocsProvider {
  id: string;
  versions: SrcLocsVersion[];
}

/** The committed `gocar.forkmap.srclocs.v1` sidecar
 * (forkmap-source-locs.json). */
export interface SrcLocsBundle {
  schema: string;
  dataset_synced_at: string | null;
  dataset_schema: string;
  providers: SrcLocsProvider[];
}

/** One version's effective measured `fn:` docstrings, as the exporter
 * resolved them from the dataset's sparse emissions (a release row's entry
 * IS that release's doc — the thinning's own last-write-wins text). */
export interface DocTextsVersion {
  vers: string;
  /** `fn:` key → effective measured docstring of this exact release.
   * A key is absent when the release carries no doc: it never had one, its
   * doc was removed (the `""` marker ended the carry), or the release
   * measures the key under several digests (cfg variants) where no single
   * text resolves. */
  doc_texts: Record<string, string>;
}

export interface DocTextsProvider {
  id: string;
  versions: DocTextsVersion[];
}

/** The committed `gocar.forkmap.doctexts.v1` sidecar
 * (forkmap-doc-texts.json). */
export interface DocTextsBundle {
  schema: string;
  dataset_synced_at: string | null;
  dataset_schema: string;
  providers: DocTextsProvider[];
}

// ---------------------------------------------------------------------------
// The type-members sidecar (data/forkmap-type-members.json, T-47 decision 2b)
// — per-release effective consumer-visible member segments of member-bearing
// types, resolved at export from the dataset's sparse on-change emissions
// (equal digest ⇒ byte-equal segments: the member vector and the digest are
// one computation). Loaded lazily beside the other sidecars, only when a
// re-signed type row needs to say which member moved.
// ---------------------------------------------------------------------------

export const TYPE_MEMBERS_SCHEMA = "gocar.forkmap.typemembers.v2";

/** The committed `gocar.forkmap.typemembers.v2` sidecar
 * (forkmap-type-members.json) — the **normalized** pub-member projection
 * (T-50): one copy per distinct `(key, digest)`, content-addressed by the
 * type digest.
 *
 * The digest already fully determines the member vector (corpus-checked: 0
 * digests map to more than one vector), so v1's per-release rows re-persisted
 * the same content 3.1x. The dictionary is a single cross-stream map rather
 * than per-provider, because the digest is a cross-stream key (543 of 2 137
 * pairs are measured identically by two or more forks).
 * The digest is an exact but **one-way** address: 45 vectors map to more than
 * one digest, because the digest also covers the head (generics, where,
 * supertraits) that the member projection does not model.
 *
 * Views fetch this whole file once per session, module-cached (`loadTypeMembers`,
 * T-51): every surface resolves its member vectors out of this one map — the
 * Alignment item's per-variant story and the Changes/Journal pair delta alike.
 * It is not per-key payload state. */
export interface TypeMembersBundle {
  schema: string;
  dataset_synced_at: string | null;
  dataset_schema: string;
  /** `type key -> { digest -> pub-member segments }`. A key absent here
   * carries no member projection (a member-less unit struct / empty enum, or
   * a non-member-bearing kind); a digest absent under a key means that exact
   * release measured no vector for it. */
  vectors: Record<string, Record<string, string[]>>;
}

/** The member vectors of one item: `digest -> pub-member segments`. Resolved per
 * key out of the shared map (`memberVectorsOf`), never per release row (T-51). */
export type KeyMemberVectors = Record<string, string[]>;

/** Derived corpus-wide counts shown in the header + provenance footer. */
export interface BundleCounts {
  providers: number;
  versions: number;
  items: number;
  keys: number;
  facades: number;
}

/** The bundle subset Configure resolution reads — satisfied by both the full
 * bundle and the boot manifest, so the configurator boots without the corpus
 * (T-33). */
export interface ConfigureSource {
  providers: ManifestProvider[];
  recommended_provider?: string;
  templates: Templates;
}

/** A release row plus the provider that owns it. */
export interface Side {
  provider: ManifestProvider;
  vers: string;
}

// ---------------------------------------------------------------------------
// The per-release payload files (data/forkmap-release-###.json, T-33
// increment 4) — the Changes/Journal row-level payload: per measured release
// row its own digest-level surface rows + resolved fn signature texts.
// ---------------------------------------------------------------------------

/** One compact digest-level surface row of a release file (T-33 increment
 * 4): `[key, digest]` for an unconditional record, `[key, digest, …cfg]`
 * when gates are recorded (provenance, never evaluation). The corpus bundle's
 * own surface record, projected to an array in its row order. */
export type ReleaseSurfaceRow = [string, string, ...string[]];

/** One committed `gocar.forkmap.release.v1` file (forkmap-release-###.json). */
export interface ReleaseFile {
  schema: string;
  dataset_schema: string;
  dataset_synced_at: string | null;
  /** Provider id of the release row (the validator's self-check against a
   * misaddressed fetch — the ordinal is resolved from the manifest). */
  p: string;
  /** Release version (the other half of that self-check). */
  v: string;
  /** Item-record count of the measured surface (`surface.length`; a
   * measured-empty release carries 0). */
  n: number;
  /** Digest-level surface rows in the corpus row order — the release's own
   * measured records. Never carries `text`/`doc`/`src`. */
  s: ReleaseSurfaceRow[];
  /** The release's resolved fn signature texts — its row of the fn-texts
   * sidecar (single-digest fn keys only). Absent when it resolves none. */
  f?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// The journal story slice (data/forkmap-journal.json, T-33 increment 4) —
// the collapsed Journal feed's whole data + the corpus views' per-row
// measuredness/counts.
// ---------------------------------------------------------------------------

/** The measured (branch base, release) diff counts of a journal entry. */
export interface JournalRowCounts {
  rm: number;
  ad: number;
  rs: number;
}

/** The diff state of a measured (branch base, row) pair: the counts, or the
 * identical flag (`{ id: 1 }`) for a within-stream exact-copy republish. */
export type JournalRowDiff = JournalRowCounts | { id: 1 };

/** One release row's entry in the journal slice: what the collapsed feed and
 * the caption render per row that the manifest does not carry. `pr` indexes
 * the stream's own version rows (the same list the manifest carries). */
export interface JournalRow {
  v: string;
  /** Measuredness class: 0 = never-measured, 1 = measured-empty, 2 =
   * measured (RULE-4's null-vs-empty split, compact). */
  m: 0 | 1 | 2;
  /** Item-record count of the measured surface (0 for m < 2). */
  n: number;
  /** The branch-base predecessor's row index, absent when the release has no
   * base (the first stable/preview of its branch line). */
  pr?: number;
  /** The measured (base, row) diff state — present only when the row and its
   * branch-base predecessor are both measured. */
  d?: JournalRowDiff;
}

export interface JournalStream {
  id: string;
  /** One entry per published version row, in the dataset's recorded
   * (crates.io publish) order — the same list the manifest's version rows
   * mirror, so every `pr` index and release-file ordinal lands on the same
   * row. */
  rows: JournalRow[];
}

/** The committed `gocar.forkmap.journal.v1` story slice
 * (forkmap-journal.json, T-33 increment 4). */
export interface JournalSlice {
  schema: string;
  dataset_schema: string;
  dataset_synced_at: string | null;
  streams: JournalStream[];
}
