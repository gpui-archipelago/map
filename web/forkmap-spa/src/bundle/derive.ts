// T-39 — pure derivations over the fork-map bundle.
//
// A 1:1 TS port of the pure (DOM-free) functions in the retired
// web/forkmap/app.js (git history) — the semantics web/forkmap/check.py
// asserted in Python until the static renderer retired (T-39 increment 6).
// Parity rule: these functions must stay behavior-identical to that port,
// so the SPA can never disagree with the recorded numbers. Move them only
// with a recorded diff against app.js.
//
// Honest display rules (UC-09) are code paths here, ids honest-rule-N in the
// DOM: RULE-1 no cross-fork "same generation" badge — cells are digest-state
// dots only and nothing here ever reads `api_epoch` or compares whole-surface
// hashes across providers; RULE-2 kind:name identity; RULE-3 out-of-model is
// stated, never inferred; RULE-4 null != unchanged; RULE-5 compile badges
// need evidence; RULE-6 yanked/pre flagged, never defaulted; RULE-7 every
// count computed from the loaded bundle.

import type {
  CompileMarker,
  DocTextsBundle,
  FnTextsBundle,
  GitHubUpstream,
  Provider,
  Rule,
  Side,
  SourceLoc,
  SrcLocsBundle,
  SurfaceItem,
  KeyMemberVectors,
  VersionRow,
} from "./types";

/** split "kind:name" into [kind, name]; a key without a ":" is ["?", key]. */
export function splitKey(key: string): [string, string] {
  const i = key.indexOf(":");
  if (i <= 0 || i === key.length - 1) return ["?", key];
  return [key.slice(0, i), key.slice(i + 1)];
}

/** Canonical pair-set key of one (key, digest) record. */
export function pairKey(key: string, digest: string): string {
  return key + "\u0000" + digest;
}

/** Sorted (key, digest) pair list — surfaces compare equal iff these match. */
export function surfacePairs(surface: SurfaceItem[]): string[] {
  return surface.map((i) => pairKey(i.key, i.digest)).sort();
}

export function surfacesIdentical(a: SurfaceItem[], b: SurfaceItem[]): boolean {
  const pa = surfacePairs(a);
  const pb = surfacePairs(b);
  if (pa.length !== pb.length) return false;
  for (let i = 0; i < pa.length; i++) if (pa[i] !== pb[i]) return false;
  return true;
}

/**
 * Digest set under one key of a surface: null when the row was never
 * measured, empty set when the key is absent from a measured row.
 */
export function digestsOf(surface: SurfaceItem[] | null | undefined, key: string): Set<string> | null {
  if (surface === null || surface === undefined) return null;
  const out = new Set<string>();
  for (const item of surface) if (item.key === key) out.add(item.digest);
  return out;
}

/** Whether a release row carries the key at all (measured and present). */
export function hasItem(versionRow: VersionRow, key: string): boolean {
  return (
    versionRow.surface !== null &&
    versionRow.surface !== undefined &&
    versionRow.surface.some((i) => i.key === key)
  );
}

export interface DiffOk {
  ok: true;
  identical: boolean;
  removed: string[];
  added: string[];
  resigned: { key: string; fromDigests: string[]; toDigests: string[] }[];
}
export interface DiffNotOk {
  ok: false;
  reason: string;
}
export type DiffResult = DiffOk | DiffNotOk;

/**
 * Item-set delta between two release rows (RULE-4 aware): { ok:false } when
 * either side was never measured — a "not measured" outcome is never
 * presented as a diff.
 */
export function diffRows(aRow: VersionRow, bRow: VersionRow): DiffResult {
  if (aRow.surface === null || aRow.surface === undefined) {
    return { ok: false, reason: `Release A (${aRow.vers}) was never measured — the map cannot diff it.` };
  }
  if (bRow.surface === null || bRow.surface === undefined) {
    return { ok: false, reason: `Release B (${bRow.vers}) was never measured — the map cannot diff it.` };
  }
  // Per-key digest sets are built once (surfaces are sets of (key,digest)
  // records, so a key's digests in a measured row are its distinct values in
  // record order). Outputs are identical to scanning the surfaces per key —
  // this stays behavior-identical to app.js's diffRows, just linear in the
  // surface sizes instead of quadratic (the Journal feed renders a diff per
  // entry, and identical 12k-item pairs were seconds of scans).
  const aDig = new Map<string, Set<string>>();
  for (const item of aRow.surface) {
    let s = aDig.get(item.key);
    if (!s) {
      s = new Set();
      aDig.set(item.key, s);
    }
    s.add(item.digest);
  }
  const bDig = new Map<string, Set<string>>();
  for (const item of bRow.surface) {
    let s = bDig.get(item.key);
    if (!s) {
      s = new Set();
      bDig.set(item.key, s);
    }
    s.add(item.digest);
  }
  const removed: string[] = [];
  const added: string[] = [];
  const resigned: { key: string; fromDigests: string[]; toDigests: string[] }[] = [];
  for (const [key, da] of aDig) {
    const db = bDig.get(key);
    if (!db) removed.push(key);
    else if (da.size !== db.size || ![...da].every((d) => db.has(d))) {
      resigned.push({ key, fromDigests: [...da], toDigests: [...db] });
    }
  }
  for (const key of bDig.keys()) {
    if (!aDig.has(key)) added.push(key);
  }
  removed.sort();
  added.sort();
  resigned.sort((x, y) => (x.key < y.key ? -1 : x.key > y.key ? 1 : 0));
  return {
    ok: true,
    identical: removed.length === 0 && added.length === 0 && resigned.length === 0,
    removed,
    added,
    resigned,
  };
}

/** Numeric semver segments of an `x.y.z[-pre]` version, for ordering stables. */
function segs(vers: string): number[] {
  return vers
    .split("-")[0]
    .split(".")
    .map((s) => Number.parseInt(s, 10) || 0);
}

/** `a < b` as semver over numeric segments (prereleases never compared here). */
function semverLt(a: string, b: string): boolean {
  const A = segs(a);
  const B = segs(b);
  for (let i = 0; i < Math.max(A.length, B.length); i++) {
    const x = A[i] ?? 0;
    const y = B[i] ?? 0;
    if (x !== y) return x < y;
  }
  return false;
}

/**
 * The branch diff base of one release within its stream (shared by the Journal
 * and the Alignment matrix/dock):
 * - a **stable** release is diffed against the previous stable of the stream
 *   by semver (the stable backbone) — previews never sit between stables, so a
 *   backport published after a newer line's preview (uno 1.18.1 after
 *   1.19.0-pre) is still diffed against its own line (1.18.0), not the preview;
 * - a **preview** (pre-release) is diffed against the newest stable published
 *   before it (array order = the recorded crates.io publish order) — the line
 *   its preview was cut from.
 *
 * A preview is never a diff base, and a release with no such predecessor
 * (the first stable or preview of its stream) has no base (null).
 *
 * Typed on the minimal row subset the rule reads (vers + prerelease), so
 * full-bundle rows and boot-manifest rows both work — and generic, so a
 * caller keeps its own row type back (T-33).
 */
export function branchBase<T extends { vers: string; prerelease: boolean }>(rows: T[], idx: number): T | null {
  const v = rows[idx];
  if (v.prerelease) {
    for (let i = idx - 1; i >= 0; i--) {
      if (!rows[i].prerelease) return rows[i];
    }
    return null;
  }
  let best: T | null = null;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (i === idx || r.prerelease) continue;
    if (semverLt(r.vers, v.vers) && (best === null || semverLt(best.vers, r.vers))) best = r;
  }
  return best;
}

export type CellState = "unknown" | "added" | "same" | "changed" | "removed" | "absent";

/**
 * Cell state of `key` at a version row, relative to its **branch** base (the
 * row `branchBase` chooses) — a stable against the previous stable, a preview
 * against the newest stable published before it. Never the raw publish
 * predecessor, so a backport isn't misread against a newer line's preview.
 */
export function cellState(key: string, prevRow: VersionRow | null, row: VersionRow): CellState {
  if (row.surface === null || row.surface === undefined) return "unknown";
  const here = hasItem(row, key);
  const prevOk = prevRow && prevRow.surface !== null && prevRow.surface !== undefined;
  if (!here) {
    if (prevOk && hasItem(prevRow, key)) return "removed";
    return "absent";
  }
  if (prevOk && hasItem(prevRow, key)) {
    const da = digestsOf(prevRow.surface, key);
    const db = digestsOf(row.surface, key);
    if (da!.size !== db!.size || ![...da!].every((d) => db!.has(d))) return "changed";
    return "same";
  }
  return "added";
}

/** Per-stream callouts for the matrix (indexes into provider.versions). */
export function streamCallouts(provider: Provider, key: string): { firstChanged: number; firstRemoved: number; present: boolean } {
  let firstChanged = -1;
  let firstRemoved = -1;
  let present = false;
  for (let i = 0; i < provider.versions.length; i++) {
    const row = provider.versions[i];
    const st = cellState(key, branchBase(provider.versions, i), row);
    if (st === "added" || st === "same" || st === "changed") present = true;
    if (st === "changed" && firstChanged < 0) firstChanged = i;
    if (st === "removed" && firstRemoved < 0) firstRemoved = i;
  }
  return { firstChanged, firstRemoved, present };
}

/** Stable kind order for sorted lists, then name. */
export const KIND_ORDER = ["fn", "struct", "enum", "trait", "type", "const", "static", "use"];

/** Whether the two compared rows carry exactly one distinct digest for a
 * resigned key each — the condition for rendering one measured before/after
 * signature (T-34). A key measured under *multiple* signatures in a release
 * (cfg variants / model artifacts such as `fn:Edges::to_pixels`) is
 * ambiguous as a single signature and stays digest-only. */
export function singleVariantPair(aRow: VersionRow, bRow: VersionRow, key: string): boolean {
  const da = digestsOf(aRow.surface, key);
  const db = digestsOf(bRow.surface, key);
  return da !== null && db !== null && da.size === 1 && db.size === 1;
}

/** The effective `cfg` gates recorded for `key` in a row (union over the
 * key's records, sorted) — provenance marking, never evaluation. Empty when
 * the row carries the key unconditionally. */
export function cfgGatesOf(row: VersionRow, key: string): string[] {
  if (row.surface === null || row.surface === undefined) return [];
  const out = new Set<string>();
  for (const item of row.surface) {
    if (item.key === key) for (const g of item.cfg ?? []) out.add(g);
  }
  return [...out].sort();
}

/** The fn-signature map of one side (provider+version) of the sidecar, or
 * null when the sidecar is not loaded or carries no row for the release.
 * Typed on the minimal provider reference (id) so full-bundle providers and
 * boot-manifest providers both work (T-33 increment 4). */
export function fnTextsOf(
  texts: FnTextsBundle | null | undefined,
  provider: { id: string } | string,
  vers: string,
): Record<string, string> | null {
  if (!texts) return null;
  const id = typeof provider === "string" ? provider : provider.id;
  const p = texts.providers.find((x) => x.id === id);
  if (!p) return null;
  const v = p.versions.find((x) => x.vers === vers);
  return v ? v.fn_texts : null;
}

/** The effective measured signature text of one `fn:` key at one side, or
 * null when the sidecar cannot resolve it for that release. */
export function fnTextAt(
  texts: FnTextsBundle | null | undefined,
  side: Side,
  key: string,
): string | null {
  return fnTextsOf(texts, side.provider, side.vers)?.[key] ?? null;
}

/** The doc-text map of one side (provider+version) of the doc sidecar, or
 * null when the sidecar is not loaded or carries no row for the release. */
export function docTextsOf(
  texts: DocTextsBundle | null | undefined,
  provider: { id: string } | string,
  vers: string,
): Record<string, string> | null {
  if (!texts) return null;
  const id = typeof provider === "string" ? provider : provider.id;
  const p = texts.providers.find((x) => x.id === id);
  if (!p) return null;
  const v = p.versions.find((x) => x.vers === vers);
  return v ? v.doc_texts : null;
}

/** The effective measured docstring of one `fn:` key at one side, or null
 * when the sidecar resolves none for that release (never had a doc, its doc
 * was removed, or the release measures the key under several digests — cfg
 * variants — where the exporter resolves no single text). */
export function docTextAt(
  texts: DocTextsBundle | null | undefined,
  side: Side,
  key: string,
): string | null {
  return docTextsOf(texts, side.provider, side.vers)?.[key] ?? null;
}

// ---------------------------------------------------------------------------
// Source locations (T-44): the measured declaration coordinates behind the
// Alignment popover's docs.rs source permalinks. Resolution is a direct
// lookup — the sidecar is a projection of the dataset's full per-row
// coordinates, so a release's entry IS that release's own measurement (no
// carry, no inference).
// ---------------------------------------------------------------------------

/** The source-location map of one provider+version of the sidecar, or null
 * when the sidecar is not loaded or carries no row for the release. */
export function srcLocsOf(
  locs: SrcLocsBundle | null | undefined,
  provider: { id: string } | string,
  vers: string,
): Record<string, SourceLoc[]> | null {
  if (!locs) return null;
  const id = typeof provider === "string" ? provider : provider.id;
  const p = locs.providers.find((x) => x.id === id);
  if (!p) return null;
  const v = p.versions.find((x) => x.vers === vers);
  return v ? v.source_locs : null;
}

/** The measured declaration location(s) of one `key` at one release, or null
 * when the sidecar resolves none (not loaded, unmeasured release, or a
 * re-export key — which has no declaration of its own). */
export function srcLocsAt(
  locs: SrcLocsBundle | null | undefined,
  provider: Provider | string,
  vers: string,
  key: string,
): SourceLoc[] | null {
  return srcLocsOf(locs, provider, vers)?.[key] ?? null;
}

/** The docs.rs source permalink of one measured declaration location (T-44).
 * The URL follows the normalization rule for the republished forks: the
 * **package** (fork id) names the crate root while the **lib target**
 * (`provider.lib_name`, `gpui` for every fork) names the src path — and the
 * fragment is the bare measured line range, the form rustdoc's own src-script
 * parses (`#(\d+)(?:-(\d+))?` on docs.rs, verified against the live pages).
 * The coordinate is measured data (RULE-7); docs.rs 404s for a version it
 * never built are the link's own fate, never a fabricated span. */
export function docsRsSourceUrl(
  provider: Provider,
  vers: string,
  loc: SourceLoc,
): string {
  const package_ = encodeURIComponent(provider.package);
  const version = encodeURIComponent(vers);
  const lib = encodeURIComponent(provider.lib_name);
  const file = loc.file
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
  return `https://docs.rs/${package_}/${version}/src/${lib}/${file}.html#${loc.start}-${loc.end}`;
}

// ---------------------------------------------------------------------------
// Upstream github source links (T-45): where a fork's published bytes live in
// the upstream repo tree it republishes, beside the docs.rs anchor. Like the
// docs.rs URL these are pure derivations over the curated per-provider
// `upstream` map the export projects into the bundle — the repo/tree/layout is
// curated data (never derived from `repository`), and a github anchor renders
// only where the tag rule actually resolves the version.
// ---------------------------------------------------------------------------

/** Whether a fork `vers` names a concrete upstream github ref under its curated
 * tag-prefix map (T-45): any fork version — stable or prerelease — the fork
 * republishes the upstream release whose git tag is `<tag><vers>` (zed tags its
 * `1.19.0-pre` interleaving as `v1.19.0-pre`, so no prerelease carving-out).
 * Returns the formed ref (e.g. `v1.18.1`) or null when the fork has no curated
 * upstream tag map (independent fork, or an untagged republish). */
export function upstreamGitRef(upstream: GitHubUpstream | undefined, vers: string): string | null {
  const tag = upstream?.tag;
  if (!tag) return null;
  return `${tag}${vers}`;
}

/** The upstream github blob source permalink of one measured declaration
 * location (T-45): `github.com/{owner}/{repo}/blob/{ref}/{tree}/{file}#L{start}-L{end}`.
 * `ref` must come from `upstreamGitRef` (the curated tag rule's resolution) —
 * the builder never fabricates a ref. The coordinate and lines are measured
 * data (RULE-7); a ref github never tagged 404s as its own fate. */
export function githubSourceUrl(
  upstream: GitHubUpstream,
  ref: string,
  loc: SourceLoc,
): string {
  // The repo/tree/file are github path segments — encode per segment so the
  // owner/repo slash stays a path separator, never `%2F`.
  const repo = upstream.repo
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
  const refEnc = encodeURIComponent(ref);
  const tree = upstream.tree
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
  const file = loc.file
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
  return `https://github.com/${repo}/blob/${refEnc}/${tree}/${file}#L${loc.start}-L${loc.end}`;
}

/** The before/after signature texts of a resigned fn key between the two
 * compared rows — measured canonical texts, resolved from the sidecar, both
 * sides single-variant. Null when the change cannot honestly render as
 * measured text (non-fn key, multi-variant side, or unresolved text). The
 * two texts may be equal: a digest moves on the *cfg-prefixed* bytes, so a
 * re-signature can be a pure gate change (doc-09's profiler rows) — the
 * call site reads the pair together with `cfgGatesOf` on both rows. */
export function signaturePair(
  texts: FnTextsBundle | null | undefined,
  aRow: VersionRow,
  a: Side,
  bRow: VersionRow,
  b: Side,
  key: string,
): { from: string; to: string } | null {
  if (splitKey(key)[0] !== "fn") return null;
  if (!singleVariantPair(aRow, bRow, key)) return null;
  const from = fnTextAt(texts, a, key);
  const to = fnTextAt(texts, b, key);
  if (!from || !to) return null;
  return { from, to };
}

/** The measured member delta of a re-signed type key between two releases
 * (T-47 decision 2b): the member segments that left and those that arrived,
 * as a set difference of the two releases' measured pub-member vectors — the
 * exact analog of `signaturePair`, but over member sets rather than one
 * signature. Segments are the analyzer's own canonical strings (the digest's
 * preimage), so a delta is a measured fact, never a reconstruction.
 *
 * Null when the delta cannot honestly resolve: a non-member-bearing kind
 * (`fn:`/`use:`/`const:`/`static:`/`type:`), either side's vector absent (a
 * multi-digest key, or the sidecar not loaded), an unchanged set (a digest
 * move that is not a member move — e.g. a member `#[cfg]` gate fold the
 * vectors already carry, or a kind-level canonical change the member set does
 * not express), or both vectors empty. The call site falls back to the rule-2
 * policy copy. */
/** The measured digest a release carries for `key`, or null when it does not
 * measure the key at all — the address a member vector is reached by (T-51).
 * A key measured under several digests in one release yields the *first*
 * (surface order) here; callers that must refuse an ambiguous pair check
 * `digestsOf` instead. */
export function digestAt(row: VersionRow, key: string): string | null {
  return row.surface?.find((s) => s.key === key)?.digest ?? null;
}

export function typeMemberDelta(
  members: KeyMemberVectors | null | undefined,
  key: string,
  aDigest: string | null | undefined,
  bDigest: string | null | undefined,
): { removed: string[]; added: string[] } | null {
  const kind = splitKey(key)[0];
  if (kind !== "struct" && kind !== "enum" && kind !== "union" && kind !== "trait") return null;
  if (!aDigest || !bDigest) return null;
  const from = members?.[aDigest];
  const to = members?.[bDigest];
  if (!from || !to) return null;
  const fromSet = new Set(from);
  const toSet = new Set(to);
  const removed = from.filter((seg) => !toSet.has(seg));
  const added = to.filter((seg) => !fromSet.has(seg));
  if (removed.length === 0 && added.length === 0) return null;
  return { removed, added };
}

/** Whether `key`'s kind can carry a member projection at all (struct/enum/
 * union/trait — the T-47 member-bearing kinds). A `type:` alias's contract is
 * its RHS and const/static are single items, so they have no member vector. */
export function isMemberBearingKind(key: string): boolean {
  const kind = splitKey(key)[0];
  return kind === "struct" || kind === "enum" || kind === "union" || kind === "trait";
}

/** One digest variant's measured member stat (T-49): the segment count, or null
 * when no vector was measured for it.
 *
 * `count: 0` is a real measurement — a type the analyzer measured with no pub
 * members (a unit struct, an all-`pub(crate)` struct). `vector: null` is the
 * honest *unknown*: a multi-digest row (a key measured under several digests in
 * one release) or a key the member sidecar does not carry. The two must never
 * render alike (RULE-4). */
export interface VariantMemberStat {
  digest: string;
  label: string;
  /** The measured segment count, or null when no vector resolved. */
  count: number | null;
  /** The measured segments, or null when no vector resolved. `[]` = measured
   * empty (distinct from null). */
  vector: string[] | null;
  /** The signed shift against the previous variant in first-measured order, or
   * null when either side's count did not resolve. */
  shift: number | null;
}

/** The per-variant member stats of `key`, in the variants' own first-measured
 * order (T-49). Pure: reads the shared member map (RULE-7) — the Alignment deck
 * adds no request. The shift compares each variant against the previous one in
 * that order, which is the order the α/β/… letters follow; it is **not** a
 * chronology claim across streams (rule 1). */
export function variantMemberStats(
  variants: ItemVariant[],
  members: KeyMemberVectors | null | undefined,
): VariantMemberStat[] {
  let prev: number | null = null;
  return variants.map((v) => {
    const vector = members?.[v.digest] ?? null;
    const count = vector ? vector.length : null;
    const shift = count !== null && prev !== null ? count - prev : null;
    if (count !== null) prev = count;
    return { digest: v.digest, label: v.label, count, vector, shift };
  });
}

/** The measured member delta between two digest variants of one key (T-49): a
 * pure set difference of the two variants' measured vectors, in the analyzer's
 * own segment strings — the same operation as `typeMemberDelta`, keyed on
 * variants instead of adjacent releases (one vocabulary, no second
 * implementation).
 *
 * Null when either variant's vector did not resolve (unknown is never an empty
 * delta), when `key` is not member-bearing, or when the sets are equal. */
export function variantMemberDelta(
  key: string,
  members: KeyMemberVectors | null | undefined,
  aDigest: string | null | undefined,
  bDigest: string | null | undefined,
): { removed: string[]; added: string[] } | null {
  return typeMemberDelta(members, key, aDigest, bDigest);
}

/** Alignment preset chips (T-38): recorded-story item identities. */
export const ALIGNMENT_PRESETS = [
  "struct:accessibility::AccessibilityNode", // kael 0.2.0 re-sign (story 2)
  "fn:Window::blur", // blur() → blur(cx) re-signature (doc 12 / T-26)
  "fn:profiler::record_frame_timing", // removed by uno 1.17.2 (story 1)
  "fn:profiler::record_frame_event", // its cfg-gated successor (doc 09)
];

/** Rules whose from-side is this item (removed-row successor lookups). */
export function rulesFrom(bundle: { rules: Rule[] }, key: string): Rule[] {
  return bundle.rules.filter((r) => r.from.key === key);
}

/** Rules whose to-side is this item. */
export function rulesTo(bundle: { rules: Rule[] }, key: string): Rule[] {
  return bundle.rules.filter((r) => r.to.key === key);
}

/** The set of corpus keys a confirmed rule touches (from-side or to-side) —
 * the ⚡ “has a migration recipe” quick-filter lookup, the same rule store
 * the confirmed-rule box reads (T-40). */
export function ruleActionableKeys(bundle: { rules: Rule[] }): Set<string> {
  const out = new Set<string>();
  for (const r of bundle.rules) {
    out.add(r.from.key);
    out.add(r.to.key);
  }
  return out;
}

/** A quick-filter value: "all", a measured kind token ("fn", "struct", …),
 * or "rule" (the ⚡ pill). */
export type AlignmentFilter = "all" | "rule" | string;

/** Filter an already-searched key list by a quick filter (T-40). The rule
 * filter keeps exactly the keys a confirmed rule touches — a computed
 * actionability flag, never a promise of recipe density. */
export function filterAlignmentKeys(
  filter: AlignmentFilter,
  keys: string[],
  actionable: Set<string>,
): string[] {
  if (filter === "all") return keys;
  if (filter === "rule") return keys.filter((k) => actionable.has(k));
  return keys.filter((k) => splitKey(k)[0] === filter);
}

/** One Alignment quick-filter pill (T-40). Every count is computed from the
 * loaded bundle + index (RULE-7) — the mock's “Search 13,344 items” style
 * literals never ship. */
export interface AlignmentPill {
  /** The filter value: "all" | "rule" | a measured kind token. */
  filter: AlignmentFilter;
  /** The visible label ("All", "fn", "has a migration recipe"). */
  label: string;
  /** Corpus-wide key count of the group. */
  count: number;
  /** The ⚡ marker rides on the rule pill only. */
  bolt: boolean;
}

/** The Alignment quick-filter pills: All, then the two largest measured kind
 * groups (the mock's fn/structs pick — derived, so a corpus refresh re-derives
 * the pills), then the ⚡ rule pill. Ties break on the stable kind order. */
export function alignmentPills(index: CorpusIndex, actionable: Set<string>): AlignmentPill[] {
  const counts = new Map<string, number>();
  for (const key of index.keys) {
    const [kind] = splitKey(key);
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
  }
  const topKinds = [...counts.entries()]
    .sort((a, b) => (b[1] !== a[1] ? b[1] - a[1] : kindRank(a[0]) - kindRank(b[0])))
    .slice(0, 2)
    .map(([kind]) => kind);
  const ruleCount = index.keys.reduce((n, k) => (actionable.has(k) ? n + 1 : n), 0);
  return [
    { filter: "all", label: "All", count: index.keys.length, bolt: false },
    ...topKinds.map((kind) => ({ filter: kind, label: kind, count: counts.get(kind)!, bolt: false })),
    { filter: "rule", label: "has a migration recipe", count: ruleCount, bolt: true },
  ];
}

/** The recipe-copy payload of one confirmed rule (T-40): a comment-only,
 * machine-checkable essence — rule id + measured from/to keys + transition
 * provenance. All fields are dataset facts; nothing pretends to be source
 * (call shapes and compile-vouched snippets are not in the dataset — doc 09:
 * dataset vouching ≠ compile vouching). Byte-pinned by tests. */
export function ruleCopyPayload(rule: Rule): string {
  return [
    "// gocar migration recipe — dataset-vouched, never compile-vouched (doc 09)",
    `// rule: ${rule.id}`,
    `// from: ${rule.from.key}`,
    `// to: ${rule.to.key}`,
    `// measured transition: ${rule.transition.from.provider} ${rule.transition.from.version} → ${rule.transition.to.provider} ${rule.transition.to.version}`,
  ].join("\n");
}

export function kindRank(kind: string): number {
  const i = KIND_ORDER.indexOf(kind);
  return i < 0 ? KIND_ORDER.length : i;
}

export function compareKeys(x: string, y: string): number {
  const [kx] = splitKey(x);
  const [ky] = splitKey(y);
  if (kindRank(kx) !== kindRank(ky)) return kindRank(kx) - kindRank(ky);
  return x < y ? -1 : x > y ? 1 : 0;
}

/** RULE-5 compile-verified badge status of one (provider, version): a badge
 * exists only on the export's curated marker row for that provider — badge
 * data carried by the bundle, never derived and never hardcoded next to a
 * version literal. Typed on the marker subset so full-bundle providers and
 * boot-manifest providers both work (T-33). */
export function compileStatus(
  provider: { compile_verified?: CompileMarker },
  vers: string,
): { badge: boolean; marker: CompileMarker | null } {
  const m = provider.compile_verified ?? null;
  if (m && m.vers === vers) return { badge: true, marker: m };
  return { badge: false, marker: null };
}

export interface CorpusIndex {
  keys: string[];
  /** The keys lowercased, parallel to `keys` in the same order — the type-ahead
   * scan's per-keystroke lowercase pass is hoisted here, once per index build
   * (T-46: same output as lowercasing per query, minus 13 344 allocations and
   * ~half the scan time on every keystroke). Both index constructors fill it;
   * the type makes a future constructor that forgets it a compile error. */
  search: string[];
  byKey: Map<string, { key: string; kind: string; name: string; versions: number }>;
}

/** Index over the whole corpus (Alignment type-ahead over every item). */
export function buildIndex(bundle: { providers: Provider[] }): CorpusIndex {
  const byKey = new Map<string, { key: string; kind: string; name: string; versions: number }>();
  for (const p of bundle.providers) {
    for (const v of p.versions) {
      if (v.surface === null || v.surface === undefined) continue;
      const seen = new Set<string>();
      for (const item of v.surface) {
        if (seen.has(item.key)) continue; // count a version once per key
        seen.add(item.key);
        let rec = byKey.get(item.key);
        if (!rec) {
          const [kind, name] = splitKey(item.key);
          rec = { key: item.key, kind, name, versions: 0 };
          byKey.set(item.key, rec);
        }
        rec.versions += 1;
      }
    }
  }
  const keys = [...byKey.keys()].sort(compareKeys);
  return { keys, search: keys.map((k) => k.toLowerCase()), byKey };
}

/** Alignment type-ahead search: exact matches, then prefix, then substring.
 * The scan reads the precomputed lowercase keys (CorpusIndex.search) — the
 * output is identical to lowercasing each key per query (parity: the recorded
 * numbers the combobox shows never change); only the per-query cost does. */
export function searchIndex(index: CorpusIndex, query: string): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const exact: string[] = [];
  const prefix: string[] = [];
  const rest: string[] = [];
  for (let i = 0; i < index.keys.length; i++) {
    const key = index.keys[i];
    const k = index.search[i];
    if (k === q) exact.push(key);
    else if (k.startsWith(q)) prefix.push(key);
    else if (k.includes(q)) rest.push(key);
  }
  return [...exact, ...prefix, ...rest];
}

/** The Alignment suggestion-list window (T-46): a broad query matches
 * thousands of keys and the listbox renders only this many rows, reporting
 * the rest honestly. The full match set is still computed (order + count are
 * the parity surface and the more-row's number is derived from it — RULE-7);
 * only the DOM population is bounded. 100 rows ≈ 10 listbox screens and
 * renders in ~2 ms (measure-typeahead.ts), an order of magnitude under the
 * worst queries' full-set renders. */
export const ALIGN_SUGGEST_CAP = 100;

/** Minimum trimmed query length before the Alignment type-ahead search runs
 * (T-46). Grounded on the measured 1-/2-char distribution over the committed
 * index (measure-typeahead.ts): every 1-char lowercase query is a browse
 * (0 of 26 narrow enough to be a target), while 189 of 676 2-char queries
 * are — so the floor stops exactly the all-browse 1-char keystrokes and
 * keeps every 2-char search (kind prefixes reach their 3-char `kind:` form
 * through it). Below the floor the dropdown shows an honest keep-typing
 * hint, never a no-match claim. */
export const ALIGN_MIN_QUERY = 2;

/** Whether a query is long enough for the type-ahead search to run. */
export function alignmentQuerySearchable(query: string): boolean {
  return query.trim().length >= ALIGN_MIN_QUERY;
}

/** The rendered window over a match set: the first ALIGN_SUGGEST_CAP rows
 * plus the honest count of matches beyond them (0 when the whole set fits).
 * `shown` is always a prefix of `matches` in search order, so the visible
 * rows and the Enter-selects-first behaviors never disagree with the full
 * result set. */
export function alignmentSuggestionWindow(matches: string[]): { shown: string[]; more: number } {
  if (matches.length <= ALIGN_SUGGEST_CAP) return { shown: matches, more: 0 };
  return { shown: matches.slice(0, ALIGN_SUGGEST_CAP), more: matches.length - ALIGN_SUGGEST_CAP };
}

/** Corpus-wide prevalence of one (key, digest) record: how many measured
 * release rows across how many forks carry it — the inspection dock's
 * “N releases · M forks share this digest” fact. A row counts once per
 * digest; a key measured under several digests in one row contributes to
 * each. Pure scan of the loaded bundle (RULE-7), never an epoch or
 * whole-surface claim — item-level record equality only (rule 1). */
export interface DigestPrevalence {
  releases: number;
  /** Distinct provider ids carrying the record, sorted (deterministic). */
  forks: string[];
}

export type DigestPrevalenceMap = Map<string, DigestPrevalence>;

export function digestPrevalence(bundle: { providers: Provider[] }, key: string): DigestPrevalenceMap {
  const out = new Map<string, DigestPrevalence>();
  for (const p of bundle.providers) {
    for (const v of p.versions) {
      if (v.surface === null || v.surface === undefined) continue;
      const seen = new Set<string>(); // a row counts once per digest
      for (const item of v.surface) {
        if (item.key !== key || seen.has(item.digest)) continue;
        seen.add(item.digest);
        let rec = out.get(item.digest);
        if (!rec) {
          rec = { releases: 0, forks: [] };
          out.set(item.digest, rec);
        }
        rec.releases += 1;
        if (!rec.forks.includes(p.id)) rec.forks.push(p.id);
      }
    }
  }
  for (const rec of out.values()) rec.forks.sort();
  return out;
}

/** The inspection-dock payload of one matrix cell (T-40): what the cell's
 * hover title already carries, materialized persistently — channel, state,
 * the legend phrase and the sorted measured digests ([] when the measured
 * row lacks the key, null when the row was never measured). T-41 adds the
 * branch base's identity + digests so a changed cell's readout is a real
 * before/after. */
export interface DockCell {
  providerId: string;
  vers: string;
  /** yanked / pre-release / stable (the cell label's flag text). */
  flagTxt: string;
  state: CellState;
  /** The legend phrase of the state (“present (unchanged)”, “removed here”, …). */
  phrase: string;
  digests: string[] | null;
  /** The release's branch diff base (see `branchBase`) — null when the
   * release has none (the stream's first stable/preview). Present on changed
   * cells so the dock can render the measured before/after (T-41). */
  prevVers: string | null;
  /** The item's digests in the branch base — non-null only when the cell is
   * “changed” (re-signed), where the base measured the item under different
   * digest(s). */
  prevDigests: string[] | null;
}

/** Partition the providers by measured presence of `key` (T-41): streams
 * that ever carried the item (added/same/changed — including streams that
 * later removed it) come first in bundle order; streams where the item was
 * never measured follow, so the view can collapse the “dead strips” (never
 * deleting their cells — expand renders every row). */
export function streamPartition(providers: Provider[], key: string): {
  present: Provider[];
  absent: Provider[];
} {
  const present: Provider[] = [];
  const absent: Provider[] = [];
  for (const p of providers) {
    if (streamCallouts(p, key).present) present.push(p);
    else absent.push(p);
  }
  return { present, absent };
}

/** The measured before/after of one changed cell, resolved from the T-34
 * sidecar: the release and its branch base of one stream, one key, both sides
 * a single measured signature. cfg gates ride along as provenance (never
 * evaluation). */
export interface SignatureDelta {
  from: string;
  to: string;
  fromGates: string[];
  toGates: string[];
}

export interface ChangedSignature {
  delta: SignatureDelta | null;
  /** The measured member delta of a re-signed type key (T-47 decision 2b):
   * the pub-member segments that left / arrived between the base and the
   * release. Non-null only when the key is member-bearing (struct/enum/union/
   * trait) and both releases' measured member vectors resolve — then no
   * `reason` is drawn. Null for fn keys (use `delta`) and for types whose
   * member movement cannot be enumerated (the reason states the policy). */
  members: { removed: string[]; added: string[] } | null;
  /** Why no measured before/after is drawn, when the cell is a re-signature
   * but the delta cannot resolve honestly (a member-bearing type whose member
   * vector is not resolved — a multi-digest key or the sidecar still loading;
   * a `type`/`const`/`static` alias-or-scalar kind whose digest move the
   * member projection does not express; multi-variant or unresolved fn keys).
   * Null when the cell is not a changed cell or when a delta resolved. */
  reason: string | null;
}

/** The dock's re-signature detail (T-41): for a “changed” cell, resolve the
 * measured signature before/after vs the release's branch base (the same
 * `branchBase` `cellState` compares). `prevVers` is the DockCell's base
 * version. For a member-bearing type key the member delta (T-47 decision 2b)
 * is resolved from the type-members sidecar instead — the two are mutually
 * exclusive per key kind. */
export function changedSignatureDelta(
  texts: FnTextsBundle | null | undefined,
  providers: Provider[],
  key: string,
  providerId: string,
  vers: string,
  prevVers: string | null,
  members: KeyMemberVectors | null | undefined = null,
): ChangedSignature {
  if (!prevVers) return { delta: null, members: null, reason: null }; // a first row can never be “changed”
  const p = providers.find((x) => x.id === providerId);
  if (!p) return { delta: null, members: null, reason: null };
  const aRow = p.versions.find((v) => v.vers === prevVers) ?? null;
  const bRow = p.versions.find((v) => v.vers === vers) ?? null;
  if (!aRow || !bRow) return { delta: null, members: null, reason: null };
  const a: Side = { provider: p, vers: prevVers };
  const b: Side = { provider: p, vers };
  const kind = splitKey(key)[0];
  const pair = signaturePair(texts, aRow, a, bRow, b, key);
  if (pair) {
    return {
      delta: { from: pair.from, to: pair.to, fromGates: cfgGatesOf(aRow, key), toGates: cfgGatesOf(bRow, key) },
      members: null,
      reason: null,
    };
  }
  // A member-bearing type key: state which measured member moved (T-47
  // decision 2b). When the vector is not resolved (multi-digest key, sidecar
  // still loading) the policy copy below stands in — never an inference.
  if (kind !== "fn") {
    const delta = typeMemberDelta(members, key, digestAt(aRow, key), digestAt(bRow, key));
    if (delta) return { delta: null, members: delta, reason: null };
    if (kind === "struct" || kind === "enum" || kind === "union" || kind === "trait") {
      return {
        delta: null,
        members: null,
        reason: "this type's digest covers its consumer-visible pub members only, and the measured member vector is not resolved for one side (the shared member map is still loading, or the key is measured under several digests)",
      };
    }
    return {
      delta: null,
      members: null,
      reason: "this item kind carries no member projection (a type alias's contract is its RHS, a const/static is a single item), so only the digest is honest (rule 2)",
    };
  }
  if (!singleVariantPair(aRow, bRow, key)) {
    return {
      delta: null,
      members: null,
      reason: "this fn key is measured under multiple signatures in one of the two releases, so no single before/after is drawn",
    };
  }
  return {
    delta: null,
    members: null,
    reason: "the measured signature text is not resolved for one side (the fn-text sidecar is loading or absent)",
  };
}

// ---------------------------------------------------------------------------
// Digest variants (T-42) — the measured-digest identity axis of the
// Alignment inspector: an item's distinct blake3 digests across the whole
// corpus, labeled α, β, γ, … in first-measured order. Every digest is a
// measured record (RULE-7); nothing here is curated or inferred.
// ---------------------------------------------------------------------------

/** The Greek sequence variant letters ride in label order. 24 letters cover
 * the measured corpus (the most-variant key measures 20 digests); anything
 * past ω falls back to an explicit `#n` index so labels never lie. */
export const VARIANT_LABELS = [
  "α", "β", "γ", "δ", "ε", "ζ", "η", "θ", "ι", "κ", "λ", "μ",
  "ν", "ξ", "ο", "π", "ρ", "σ", "τ", "υ", "φ", "χ", "ψ", "ω",
];

/** The label of the digest variant at `index` (0 → α, 1 → β, …). */
export function variantLabel(index: number): string {
  return index < VARIANT_LABELS.length ? VARIANT_LABELS[index] : `#${index + 1}`;
}

/** One distinct measured digest of an item (T-42). The variant palette
 * swatch index is `index % VARIANT_PALETTE` (8 swatches, cycled) — see
 * alignment.css `--dv0…--dv7`. */
export const VARIANT_PALETTE = 8;

/** One distinct measured digest of an item (T-42): its stable letter, the
 * full blake3 digest and the first measured (provider, release) that carried
 * it. Order = first appearance scanning the providers in bundle order then
 * each stream's own published order — the honest “baseline first” promise
 * of the α/β/… letters (doc-12's blur generations order α = legacy, β =
 * re-signed). Two digests first measured in the same release row tie-break
 * on the digest bytes, so the derivation is deterministic. */
export interface ItemVariant {
  /** Position in the first-measured order (the palette swatch = % 8). */
  index: number;
  label: string;
  digest: string;
  shortDigest: string;
  /** The (provider, version) that first measured this digest — the honest
   * “baseline” anchor of the label order (rule 1: an epoch claim, never). */
  firstSeen: { providerId: string; vers: string } | null;
}

/** The distinct measured digests of `key` over the whole corpus, in
 * first-measured order (T-42). Pure scan of the loaded bundle (RULE-7);
 * rows never measured and rows without the key contribute nothing. */
export function itemVariants(bundle: { providers: Provider[] }, key: string): ItemVariant[] {
  // digest → first-seen (provider index, version index). Scan order IS the
  // corpus order; the version index is compared per provider for the sort.
  const first = new Map<string, { pi: number; vi: number }>();
  bundle.providers.forEach((p, pi) => {
    p.versions.forEach((v, vi) => {
      if (v.surface === null || v.surface === undefined) return;
      const row = new Set<string>();
      for (const item of v.surface) if (item.key === key) row.add(item.digest);
      for (const digest of [...row].sort()) {
        if (!first.has(digest)) first.set(digest, { pi, vi });
      }
    });
  });
  const order = [...first.entries()].sort((a, b) => {
    if (a[1].pi !== b[1].pi) return a[1].pi - b[1].pi;
    if (a[1].vi !== b[1].vi) return a[1].vi - b[1].vi;
    return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0;
  });
  return order.map(([digest, seen], index) => ({
    index,
    label: variantLabel(index),
    digest,
    shortDigest: digest.slice(0, 8),
    firstSeen: {
      providerId: bundle.providers[seen.pi].id,
      vers: bundle.providers[seen.pi].versions[seen.vi].vers,
    },
  }));
}

/** The variant swatch index of a digest (the palette position its dot and
 * legend chip share), or null when the digest is not one of the item's
 * measured variants. */
export function variantSwatch(variants: ItemVariant[], digest: string): number | null {
  const i = variants.findIndex((v) => v.digest === digest);
  return i < 0 ? null : i % VARIANT_PALETTE;
}

/** The short, stable identity of one measured digest for titles/aria:
 * `α a07c1800…` (or null when the digest is not a variant of the item). */
export function variantRef(variants: ItemVariant[], digest: string): string | null {
  const i = variants.findIndex((v) => v.digest === digest);
  if (i < 0) return null;
  return `${variants[i].label} ${variants[i].shortDigest}…`;
}

/** One step of a stream's digest-variant run (T-42): the variant(s) carried
 * by consecutive present rows, and — from the second step on — the release
 * where that run began (its change point). */
export interface StreamVariantStep {
  /** Variant indexes of the run's rows (one for single-variant rows; more
   * when a row is measured under several digests at once — cfg artifacts). */
  indexes: number[];
  /** null on the first step; else the version where this run began. */
  vers: string | null;
}

/** The digest-variant run summary of one stream for `key` (T-42): how many
 * releases carry the item, and the variant steps in published order —
 * consecutive present rows sharing the same variant(s) fold into one step
 * (removed/unmeasured rows are skipped; the removal story stays with the
 * per-stream removal chip). A step that repeats an earlier variant is kept
 * (a reversion is its own step with its own change point). Deterministic
 * scan of the stream's published rows (RULE-7). */
/** The digest-variant run over an ordered set of measured rows (T-42): how
 * many carry the item, and the variant steps in that order — consecutive
 * present rows sharing the same variant(s) fold into one step
 * (removed/unmeasured rows are skipped; the removal story stays with the
 * per-stream removal chip). A step that repeats an earlier variant is kept
 * (a reversion is its own step with its own change point). Deterministic
 * scan (RULE-7). Callers choose the rows: the full published stream, or the
 * *stable backbone only* — pre-release previews are rendered separately and
 * are not steps of the stable variant run (so a preview's new variant never
 * makes a later backport look like a regression to legacy). */
export function variantSteps(
  rows: VersionRow[],
  variants: ItemVariant[],
  key: string,
): { present: number; steps: StreamVariantStep[] } {
  let present = 0;
  const steps: StreamVariantStep[] = [];
  for (const v of rows) {
    if (v.surface === null || v.surface === undefined) continue;
    const ds = digestsOf(v.surface, key);
    if (ds === null || ds.size === 0) continue;
    present += 1;
    const indexes = [...ds]
      .map((d) => variants.findIndex((x) => x.digest === d))
      .filter((i) => i >= 0)
      .sort((a, b) => a - b);
    if (indexes.length === 0) continue;
    const last = steps[steps.length - 1];
    if (last && last.indexes.length === indexes.length && last.indexes.every((x, i) => x === indexes[i])) continue;
    steps.push({ indexes, vers: steps.length === 0 ? null : v.vers });
  }
  return { present, steps };
}

export function streamVariantSteps(
  provider: Provider,
  variants: ItemVariant[],
  key: string,
): { present: number; steps: StreamVariantStep[] } {
  return variantSteps(provider.versions, variants, key);
}

/** The measured fn text of every distinct digest of `key`, resolved from the
 * T-34 sidecar (T-42 — the “signatures by hex” the variant chips and dock
 * show). A sidecar row's text belongs to that row's own single digest of the
 * key — multi-digest rows are absent from the sidecar by design — and equal
 * digest means byte-equal canonical text, so the map is exact (resolution,
 * never inference). Digests that only ever appear in multi-digest rows stay
 * out (their release has no single signature to show); non-fn keys have no
 * text anywhere (rule 2). Null/empty sidecar → empty map. */
export function fnDigestTexts(
  texts: FnTextsBundle | null | undefined,
  providers: Provider[],
  key: string,
): Map<string, string> {
  const out = new Map<string, string>();
  if (!texts) return out;
  for (const p of providers) {
    const tprov = texts.providers.find((x) => x.id === p.id);
    if (!tprov) continue;
    for (const v of p.versions) {
      if (v.surface === null || v.surface === undefined) continue;
      const row = digestsOf(v.surface, key);
      if (row === null || row.size !== 1) continue;
      const digest = [...row][0];
      if (out.has(digest)) continue;
      const text = tprov.versions.find((x) => x.vers === v.vers)?.fn_texts[key];
      if (text !== undefined) out.set(digest, text);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Doc strings (T-43) — the item's measured doc story, resolved from the
// doc-texts sidecar (data/forkmap-doc-texts.json, `gocar.forkmap.doctexts.v1`).
//
// fn digests EXCLUDE doc comments, so a doc change never moves a digest and
// no digest lookup can resolve a doc (T-34's index does not apply): the
// exporter resolved one effective docstring per (release, fn: key) by walking
// the thinning's own measured order, and every derivation here scans exactly
// those bytes over the item's present release rows (RULE-7) — nothing
// inferred, nothing carried past a removal (the exporter's `""` marker leaves
// a release without an entry, and absence here means “no doc on this
// release”). The unit of a doc is therefore the RELEASE, never the digest: a
// digest-variant carries a doc only when every doc-resolving release of that
// digest reads the same text — a doc edit that never re-signs (93 corpus
// transitions) splits a digest across texts, and those variants get no
// variant-level doc and no delta chip (the item-level counts still report the
// divergence honestly).
// ---------------------------------------------------------------------------

/** The measured doc story of one `fn:` key over its present release rows
 * (T-43): the distinct docstrings in first-encountered corpus order, the
 * release counts behind them, the baseline anchor, and the per-digest
 * uniform docs. Deterministic scan in the same provider/published-row order
 * the α/β… variant labels use. */
export interface ItemDocStory {
  /** The distinct docstrings measured for the key, in first-encountered
   * corpus order — `docs[0]` is the baseline that anchors the item title
   * (the docstring of the first release that resolved one). Empty when no
   * release of the item carries a resolved doc (non-fn keys are never
   * ingested; fn keys whose every release is doc-less or multi-digest — cfg
   * variants the sidecar never resolves — have no story either). */
  docs: string[];
  /** Present releases whose doc the sidecar resolved. */
  docReleases: number;
  /** Present releases that resolve no doc (their doc was removed, or the
   * release measures the key under several digests at once). */
  bareReleases: number;
  /** The first present (provider, release) that resolved a doc — the
   * baseline anchor, in the same corpus order the α/β… labels use. */
  anchor: { providerId: string; vers: string } | null;
  /** digest → the variant's doc when every doc-resolving single-digest
   * release of that digest carries the same text. A digest whose releases
   * resolve no doc or more than one doc is absent (no variant-level doc). */
  variantDoc: Map<string, string>;
}

/** The doc story of `key` (T-43). A release row counts as present when its
 * measured surface carries the key; of those, a row resolves a doc when the
 * sidecar has an entry for the (provider, release, key) — single-digest rows
 * only, because the exporter never resolves one text for a multi-digest
 * release (cfg variants). Pure scan of the loaded bundle + sidecar (RULE-7). */
export function itemDocStory(
  bundle: { providers: Provider[] },
  key: string,
  texts: DocTextsBundle | null | undefined,
): ItemDocStory {
  const docs: string[] = [];
  const docIndex = new Map<string, number>();
  const variantSets = new Map<string, Set<string>>();
  let docReleases = 0;
  let bareReleases = 0;
  let anchor: { providerId: string; vers: string } | null = null;
  for (const p of bundle.providers) {
    for (const v of p.versions) {
      if (v.surface === null || v.surface === undefined) continue;
      const ds = digestsOf(v.surface, key);
      if (ds === null || ds.size === 0) continue; // not present in this row
      const doc = docTextsOf(texts, p, v.vers)?.[key];
      const single = ds.size === 1 ? [...ds][0] : null;
      if (single !== null && doc !== undefined) {
        docReleases += 1;
        if (anchor === null) anchor = { providerId: p.id, vers: v.vers };
        let i = docIndex.get(doc);
        if (i === undefined) {
          i = docs.length;
          docIndex.set(doc, i);
          docs.push(doc);
        }
        let set = variantSets.get(single);
        if (!set) {
          set = new Set<string>();
          variantSets.set(single, set);
        }
        set.add(doc);
      } else {
        bareReleases += 1;
      }
    }
  }
  const variantDoc = new Map<string, string>();
  for (const [digest, set] of variantSets) {
    if (set.size === 1) variantDoc.set(digest, [...set][0]);
  }
  return { docs, docReleases, bareReleases, anchor, variantDoc };
}

/** One digest-variant's measured doc delta vs the item's baseline (T-43) —
 * rendered on the variant card when that digest's releases carry one uniform
 * doc that differs from the item's baseline docstring. */
export interface DocDeltaChip {
  digest: string;
  /** The variant's measured docstring (uniform across its doc-resolving
   * releases) — the release text the card's releases actually read. */
  doc: string;
  /** The measured line diff of baseline → variant doc (added/removed lines
   * only — RULE-7: a chip's content is exactly these bytes, never a summary
   * phrase). */
  diff: { added: string[]; removed: string[] };
}

/** The doc-delta chips of an item story (T-43): one per digest-variant whose
 * uniform doc differs from the baseline. Invariant items (one docstring
 * across every release) yield none — the baseline docstring is their one
 * story and the cards stay signature-only (the direction's no-duplication
 * rule). Multi-doc digests yield none either: their releases span texts, so
 * no variant-level doc exists to compare. */
export function itemDocChips(story: ItemDocStory): DocDeltaChip[] {
  const base = story.docs[0];
  if (base === undefined) return [];
  const out: DocDeltaChip[] = [];
  for (const [digest, doc] of story.variantDoc) {
    if (doc === base) continue;
    out.push({ digest, doc, diff: diffDocLines(base, doc) });
  }
  return out;
}

/** The measured line diff of two docstrings (T-43): a longest-common-
 * subsequence over the doc's lines, reported as the added/removed lines —
 * the exact bytes a doc-delta chip may show. Docstrings are short, so the
 * simple DP is fine. */
export function diffDocLines(from: string, to: string): { added: string[]; removed: string[] } {
  const a = from.split("\n");
  const b = to.split("\n");
  const m = a.length;
  const n = b.length;
  const lcs: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const added: string[] = [];
  const removed: string[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      i += 1;
      j += 1;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      removed.push(a[i]);
      i += 1;
    } else {
      added.push(b[j]);
      j += 1;
    }
  }
  while (i < m) {
    removed.push(a[i]);
    i += 1;
  }
  while (j < n) {
    added.push(b[j]);
    j += 1;
  }
  return { added, removed };
}
