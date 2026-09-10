// T-39 — bundle validation: fail visibly, never partially (T-30 acceptance).
// A 1:1 TS port of validateBundle in web/forkmap/app.js; keep in lockstep.

import {
  ALIGNMENT_SCHEMA,
  ALIGN_INDEX_SCHEMA,
  COLUMN_BUCKET_KEYS,
  COLUMN_SCHEMA,
  DOC_TEXTS_SCHEMA,
  FORKMAP_SCHEMA,
  FN_TEXTS_SCHEMA,
  JOURNAL_SCHEMA,
  MANIFEST_SCHEMA,
  PAYLOAD_BUCKET_KEYS,
  PAYLOAD_SCHEMA,
  RELEASE_SCHEMA,
  SRC_LOCS_SCHEMA,
  TYPE_MEMBERS_SCHEMA,
  type AlignIndex,
  type AlignmentSlice,
  type ColumnBucket,
  type DocTextsBundle,
  type ForkmapBundle,
  type ForkmapManifest,
  type FnTextsBundle,
  type JournalRowDiff,
  type JournalSlice,
  type PayloadBucket,
  type ReleaseFile,
  type SrcLocsBundle,
  type TypeMembersBundle,
} from "./types";
import { compareKeys } from "./derive";

export class BundleError extends Error {}

function requireString(v: unknown, where: string): void {
  if (typeof v !== "string" || v.length === 0) {
    throw new BundleError(`${where}: expected a non-empty string, got ${JSON.stringify(v)}`);
  }
}

/** Throws BundleError with every problem joined when the fn-texts sidecar is
 * invalid. Shape-strict like validateBundle: a stale or truncated file must
 * fail visibly rather than render half-truths next to resolved signatures. */
export function validateFnTexts(raw: unknown): FnTextsBundle {
  const problems: string[] = [];
  const fail = (msg: string) => {
    problems.push(msg);
  };
  if (typeof raw !== "object" || raw === null) fail("fn-texts sidecar is not a JSON object");
  const obj = raw as Record<string, unknown>;
  if (obj.schema !== FN_TEXTS_SCHEMA) fail(`fn-texts schema must be "${FN_TEXTS_SCHEMA}"`);
  if (obj.dataset_synced_at !== null && obj.dataset_synced_at !== undefined) {
    requireString(obj.dataset_synced_at, "fn-texts dataset_synced_at");
  }
  requireString(obj.dataset_schema, "fn-texts dataset_schema");
  if (!Array.isArray(obj.providers)) fail("fn-texts providers must be an array");
  const cast = (f: () => void) => {
    try {
      f();
    } catch (e) {
      if (e instanceof BundleError) fail(e.message);
      else throw e;
    }
  };
  cast(() => {
    for (const p of (obj.providers as Record<string, unknown>[]) ?? []) {
      requireString(p?.id, "fn-texts provider.id");
      if (!Array.isArray(p?.versions)) fail(`${p?.id ?? "?"}: fn-texts versions must be an array`);
      for (const v of (p.versions as Record<string, unknown>[]) ?? []) {
        requireString(v?.vers, `${p.id ?? "?"} fn-texts version.vers`);
        const map = v?.fn_texts as Record<string, unknown> | undefined;
        if (!map || typeof map !== "object" || Array.isArray(map)) {
          fail(`${p.id} ${v?.vers ?? "?"}: fn_texts must be an object`);
          continue;
        }
        for (const [key, text] of Object.entries(map)) {
          requireString(key, `${p.id} ${v?.vers ?? "?"} fn_texts key`);
          requireString(text, `${p.id} ${v?.vers ?? "?"} fn_texts[${key}]`);
        }
      }
    }
  });
  if (problems.length) throw new BundleError(problems.join("; "));
  return raw as FnTextsBundle;
}
/** Throws BundleError with every problem joined when the doc-texts sidecar
 * is invalid. Shape-strict like validateFnTexts: a stale or truncated file
 * must fail visibly rather than render half-truths next to resolved
 * docstrings (T-43). */
export function validateDocTexts(raw: unknown): DocTextsBundle {
  const problems: string[] = [];
  const fail = (msg: string) => {
    problems.push(msg);
  };
  if (typeof raw !== "object" || raw === null) fail("doc-texts sidecar is not a JSON object");
  const obj = raw as Record<string, unknown>;
  if (obj.schema !== DOC_TEXTS_SCHEMA) fail(`doc-texts schema must be "${DOC_TEXTS_SCHEMA}"`);
  if (obj.dataset_synced_at !== null && obj.dataset_synced_at !== undefined) {
    requireString(obj.dataset_synced_at, "doc-texts dataset_synced_at");
  }
  requireString(obj.dataset_schema, "doc-texts dataset_schema");
  if (!Array.isArray(obj.providers)) fail("doc-texts providers must be an array");
  const cast = (f: () => void) => {
    try {
      f();
    } catch (e) {
      if (e instanceof BundleError) fail(e.message);
      else throw e;
    }
  };
  cast(() => {
    for (const p of (obj.providers as Record<string, unknown>[]) ?? []) {
      requireString(p?.id, "doc-texts provider.id");
      if (!Array.isArray(p?.versions)) fail(`${p?.id ?? "?"}: doc-texts versions must be an array`);
      for (const v of (p.versions as Record<string, unknown>[]) ?? []) {
        requireString(v?.vers, `${p.id ?? "?"} doc-texts version.vers`);
        const map = v?.doc_texts as Record<string, unknown> | undefined;
        if (!map || typeof map !== "object" || Array.isArray(map)) {
          fail(`${p.id} ${v?.vers ?? "?"}: doc_texts must be an object`);
          continue;
        }
        for (const [key, text] of Object.entries(map)) {
          requireString(key, `${p.id} ${v?.vers ?? "?"} doc_texts key`);
          requireString(text, `${p.id} ${v?.vers ?? "?"} doc_texts[${key}]`);
        }
      }
    }
  });
  if (problems.length) throw new BundleError(problems.join("; "));
  return raw as DocTextsBundle;
}

/** Throws BundleError with every problem joined when the normalized
 * type-members sidecar is invalid (T-50). Shape-strict like its siblings: a
 * stale or truncated file must fail visibly rather than render half-truths
 * next to a resolved member delta. */
export function validateTypeMembers(raw: unknown): TypeMembersBundle {
  const problems: string[] = [];
  const fail = (msg: string) => {
    problems.push(msg);
  };
  if (typeof raw !== "object" || raw === null) fail("type-members sidecar is not a JSON object");
  const obj = raw as Record<string, unknown>;
  if (obj.schema !== TYPE_MEMBERS_SCHEMA) fail(`type-members schema must be "${TYPE_MEMBERS_SCHEMA}"`);
  if (obj.dataset_synced_at !== null && obj.dataset_synced_at !== undefined) {
    requireString(obj.dataset_synced_at, "type-members dataset_synced_at");
  }
  requireString(obj.dataset_schema, "type-members dataset_schema");
  const vectors = obj.vectors as Record<string, unknown> | undefined;
  if (!vectors || typeof vectors !== "object" || Array.isArray(vectors)) {
    fail("type-members vectors must be an object");
  }
  const cast = (f: () => void) => {
    try {
      f();
    } catch (e) {
      if (e instanceof BundleError) fail(e.message);
      else throw e;
    }
  };
  cast(() => {
    for (const [key, byDigest] of Object.entries(vectors ?? {})) {
      requireString(key, "type-members vectors key");
      if (!/^(struct|enum|union|trait):/.test(key)) {
        fail(`type-members vectors[${key}]: not a member-bearing kind`);
      }
      if (!byDigest || typeof byDigest !== "object" || Array.isArray(byDigest)) {
        fail(`type-members vectors[${key}] must be a digest map`);
        continue;
      }
      for (const [digest, segs] of Object.entries(byDigest as Record<string, unknown>)) {
        if (!/^[0-9a-f]{64}$/.test(digest)) {
          fail(`type-members vectors[${key}]: digest must be blake3 64-hex, got ${digest}`);
        }
        if (!Array.isArray(segs)) {
          fail(`type-members vectors[${key}][${digest}] must be an array`);
          continue;
        }
        // An empty vector is honest measured data (`[]`: a member-bearing type
        // with no pub member). A non-string or empty segment is not: it could
        // not be the digest's preimage.
        for (const seg of segs as unknown[]) {
          if (typeof seg !== "string" || seg.length === 0) {
            fail(`type-members vectors[${key}][${digest}] segments must be non-empty strings`);
            break;
          }
        }
      }
    }
  });
  if (problems.length) throw new BundleError(problems.join("; "));
  return raw as TypeMembersBundle;
}

export function validateBundle(raw: unknown): ForkmapBundle {
  const problems: string[] = [];
  const fail = (msg: string) => {
    problems.push(msg);
  };
  if (typeof raw !== "object" || raw === null) fail("bundle is not a JSON object");
  const obj = raw as Record<string, unknown>;
  if (obj.schema !== FORKMAP_SCHEMA) fail(`schema must be "${FORKMAP_SCHEMA}"`);
  if (!Array.isArray(obj.providers) || (obj.providers as unknown[]).length === 0) fail("providers must be a non-empty array");
  const cast = (f: () => void) => {
    try {
      f();
    } catch (e) {
      if (e instanceof BundleError) fail(e.message);
      else throw e;
    }
  };
  if (problems.length) throw new BundleError(problems.join("; "));

  // Structural shape pass — strict enough to catch a stale/mismatched file.
  cast(() => {
    if (obj.dataset_synced_at !== null && obj.dataset_synced_at !== undefined) {
      requireString(obj.dataset_synced_at, "dataset_synced_at");
    }
    requireString(obj.dataset_schema, "dataset_schema");
    requireString(obj.contract, "contract");
    if (!Array.isArray(obj.rules)) fail("rules must be an array");
    const templates = obj.templates as Record<string, unknown> | undefined;
    if (!templates || !Array.isArray(templates.scaffold)) fail("templates.scaffold must be an array");
    for (const s of (templates?.scaffold as Record<string, unknown>[]) ?? []) {
      requireString(s?.provider, "templates.scaffold[].provider");
      requireString(s?.cargo_toml, `${s?.provider ?? "?"} scaffold.cargo_toml`);
      requireString(s?.main_rs, `${s?.provider ?? "?"} scaffold.main_rs`);
    }
    if (!templates || !Array.isArray(templates.bindings)) fail("templates.bindings must be an array");
    for (const set of (templates?.bindings as Record<string, unknown>[]) ?? []) {
      requireString(set?.provider, "templates.bindings[].provider");
      if (!Array.isArray(set?.entries) || (set.entries as unknown[]).length === 0) {
        fail(`${set?.provider ?? "?"}: bindings.entries must be non-empty`);
        continue;
      }
      for (const e of set.entries as Record<string, unknown>[]) {
        requireString(e?.vers, `${set.provider} binding.vers`);
        requireString(e?.cargo_toml, `${set.provider} ${e?.vers ?? "?"} binding.cargo_toml`);
        if (e.note !== undefined && e.note !== null) {
          requireString(e.note, `${set.provider} ${e?.vers ?? "?"} binding.note`);
        }
      }
    }
    if (!Array.isArray(obj.kit_probes)) fail("kit_probes must be an array");
    if (obj.contract_description !== undefined && obj.contract_description !== null) {
      requireString(obj.contract_description, "contract_description");
    }
    for (const p of obj.providers as Record<string, unknown>[]) {
      requireString(p.id, `provider.id`);
      requireString(p.package, `${p.id}.package`);
      requireString(p.lib_name, `${p.id}.lib_name`);
      if (!Array.isArray(p.versions) || (p.versions as unknown[]).length === 0) fail(`${p.id}.versions must be non-empty`);
      for (const v of p.versions as Record<string, unknown>[]) {
        requireString(v.vers, `${p.id} version.vers`);
        if (typeof v.yanked !== "boolean") fail(`${p.id} ${v.vers}: yanked must be boolean`);
        if (typeof v.prerelease !== "boolean") fail(`${p.id} ${v.vers}: prerelease must be boolean`);
        if (v.surface !== null && v.surface !== undefined) {
          if (!Array.isArray(v.surface)) fail(`${p.id} ${v.vers}: surface must be null or an array`);
          for (const item of v.surface as Record<string, unknown>[]) {
            requireString(item?.key, `${p.id} ${v.vers} surface item.key`);
            requireString(item?.digest, `${p.id} ${v.vers} surface item.digest`);
          }
        }
      }
    }
    // T-31: the configurator's per-version offers mirror the version rows 1:1.
    for (const p of obj.providers as Record<string, unknown>[]) {
      const set = ((templates?.bindings as Record<string, unknown>[]) ?? []).find((b) => b.provider === p.id);
      const scaffold = ((templates?.scaffold as Record<string, unknown>[]) ?? []).find((s) => s.provider === p.id);
      if (!set) {
        fail(`${p.id}: missing templates.bindings entry`);
        continue;
      }
      if (!scaffold) fail(`${p.id}: missing templates.scaffold entry`);
      const want = (p.versions as Record<string, unknown>[]).map((v) => v.vers).join("\u0000");
      const got = (set.entries as Record<string, unknown>[]).map((e) => e.vers).join("\u0000");
      if (got !== want) {
        fail(`${p.id}: binding rows must mirror the version rows 1:1 (stale export?)`);
      }
    }
    for (const r of obj.rules as Record<string, unknown>[]) {
      requireString(r.id, "rule.id");
      const from = r.from as Record<string, unknown> | undefined;
      const to = r.to as Record<string, unknown> | undefined;
      requireString(from?.key, `${r.id}.from.key`);
      requireString(to?.key, `${r.id}.to.key`);
      if (typeof r.human_confirmed !== "boolean") fail(`${r.id}: human_confirmed must be boolean`);
    }
  });
  if (problems.length) throw new BundleError(problems.join("; "));
  return raw as ForkmapBundle;
}

/** Throws BundleError with every problem joined when the boot manifest is
 * invalid. Shape-strict like validateBundle: a stale or truncated file — or a
 * full bundle served at the manifest URL (its rows carry `surface`, which the
 * boot slice never does) — must fail visibly rather than render half-truths
 * next to missing data (T-33). */
export function validateManifest(raw: unknown): ForkmapManifest {
  const problems: string[] = [];
  const fail = (msg: string) => {
    problems.push(msg);
  };
  if (typeof raw !== "object" || raw === null) fail("boot manifest is not a JSON object");
  const obj = raw as Record<string, unknown>;
  if (obj.schema !== MANIFEST_SCHEMA) fail(`boot manifest schema must be "${MANIFEST_SCHEMA}"`);
  const cast = (f: () => void) => {
    try {
      f();
    } catch (e) {
      if (e instanceof BundleError) fail(e.message);
      else throw e;
    }
  };
  if (problems.length) throw new BundleError(problems.join("; "));

  cast(() => {
    if (obj.dataset_synced_at !== null && obj.dataset_synced_at !== undefined) {
      requireString(obj.dataset_synced_at, "manifest dataset_synced_at");
    }
    requireString(obj.dataset_schema, "manifest dataset_schema");
    requireString(obj.contract, "manifest contract");
    if (!Array.isArray(obj.providers) || (obj.providers as unknown[]).length === 0) {
      fail("manifest providers must be a non-empty array");
    }
    // The counts are export-precomputed corpus numbers the boot views render.
    const counts = obj.counts as Record<string, unknown> | null | undefined;
    if (typeof counts !== "object" || counts === null || Array.isArray(counts)) {
      fail("manifest counts missing");
    } else {
      for (const field of ["providers", "versions", "items", "keys", "facades"]) {
        const n = counts[field];
        if (!Number.isInteger(n) || (n as number) < 0) {
          fail(`manifest counts.${field} must be a non-negative integer`);
        }
      }
    }
    for (const p of (obj.providers as Record<string, unknown>[]) ?? []) {
      requireString(p.id, "manifest provider.id");
      requireString(p.package, `${p.id}.package`);
      requireString(p.lib_name, `${p.id}.lib_name`);
      if (!Array.isArray(p.versions) || (p.versions as unknown[]).length === 0) {
        fail(`${p.id}.versions must be non-empty`);
      }
      for (const v of p.versions as Record<string, unknown>[]) {
        requireString(v.vers, `${p.id} manifest version.vers`);
        if (typeof v.yanked !== "boolean") fail(`${p.id} ${v.vers}: yanked must be boolean`);
        if (typeof v.prerelease !== "boolean") fail(`${p.id} ${v.vers}: prerelease must be boolean`);
        if (v.surface !== undefined) {
          fail(`${p.id} ${v.vers}: the boot manifest never carries surfaces (full bundle booted here?)`);
        }
      }
    }
    if (!Array.isArray(obj.rules)) fail("manifest rules must be an array");
    const templates = obj.templates as Record<string, unknown> | undefined;
    if (!templates || !Array.isArray(templates.scaffold)) fail("manifest templates.scaffold must be an array");
    if (!templates || !Array.isArray(templates.bindings)) fail("manifest templates.bindings must be an array");
    if (!Array.isArray(obj.kit_probes)) fail("manifest kit_probes must be an array");
    if (obj.contract_description !== undefined && obj.contract_description !== null) {
      requireString(obj.contract_description, "manifest contract_description");
    }
    // T-31's configurator mirror holds on the manifest too: bindings rows
    // must mirror the version rows 1:1 (stale export detection).
    for (const p of (obj.providers as Record<string, unknown>[]) ?? []) {
      const set = ((templates?.bindings as Record<string, unknown>[]) ?? []).find((b) => b.provider === p.id);
      if (!set) {
        fail(`${p.id}: missing manifest templates.bindings entry`);
        continue;
      }
      const want = (p.versions as Record<string, unknown>[]).map((v) => v.vers).join("\u0000");
      const got = (set.entries as Record<string, unknown>[]).map((e) => e.vers).join("\u0000");
      if (got !== want) {
        fail(`${p.id}: manifest binding rows must mirror the version rows 1:1 (stale export?)`);
      }
    }
  });
  if (problems.length) throw new BundleError(problems.join("; "));
  return raw as ForkmapManifest;
}

/** Throws BundleError with every problem joined when the source-location
 * sidecar is invalid. Shape-strict like the other validators: a stale or
 * truncated file must fail visibly rather than build a permalink from a
 * coordinate the export never measured (T-44, RULE-7). */
export function validateSrcLocs(raw: unknown): SrcLocsBundle {
  const problems: string[] = [];
  const fail = (msg: string) => {
    problems.push(msg);
  };
  if (typeof raw !== "object" || raw === null) fail("source-locs sidecar is not a JSON object");
  const obj = raw as Record<string, unknown>;
  if (obj.schema !== SRC_LOCS_SCHEMA) {
    fail(`source-locs schema must be "${SRC_LOCS_SCHEMA}"`);
  }
  if (obj.dataset_synced_at !== null && obj.dataset_synced_at !== undefined) {
    requireString(obj.dataset_synced_at, "source-locs dataset_synced_at");
  }
  requireString(obj.dataset_schema, "source-locs dataset_schema");
  if (!Array.isArray(obj.providers)) fail("source-locs providers must be an array");
  const cast = (f: () => void) => {
    try {
      f();
    } catch (e) {
      if (e instanceof BundleError) fail(e.message);
      else throw e;
    }
  };
  cast(() => {
    for (const p of (obj.providers as Record<string, unknown>[]) ?? []) {
      requireString(p?.id, "source-locs provider.id");
      if (!Array.isArray(p?.versions)) {
        fail(`${p?.id ?? "?"}: source-locs versions must be an array`);
      }
      for (const v of (p.versions as Record<string, unknown>[]) ?? []) {
        requireString(v?.vers, `${p.id ?? "?"} source-locs version.vers`);
        const map = v?.source_locs as Record<string, unknown> | undefined;
        if (!map || typeof map !== "object" || Array.isArray(map)) {
          fail(`${p.id ?? "?"} ${v?.vers ?? "?"}: source_locs must be an object`);
          continue;
        }
        for (const [key, locs] of Object.entries(map)) {
          requireString(key, `${p.id} ${v?.vers ?? "?"} source_locs key`);
          if (!Array.isArray(locs) || locs.length === 0) {
            fail(`${p.id} ${v?.vers ?? "?"} source_locs[${key}]: must be a non-empty array`);
            continue;
          }
          for (const loc of locs as Record<string, unknown>[]) {
            requireString(loc?.file, `${p.id} ${v?.vers ?? "?"} source_locs[${key}].file`);
            if (!Number.isInteger(loc?.start) || (loc?.start as number) < 1) {
              fail(`${p.id} ${v?.vers ?? "?"} source_locs[${key}].start must be a positive line`);
            }
            if (!Number.isInteger(loc?.end) || (loc?.end as number) < (loc?.start as number)) {
              fail(`${p.id} ${v?.vers ?? "?"} source_locs[${key}].end must be >= start`);
            }
          }
        }
      }
    }
  });
  if (problems.length) throw new BundleError(problems.join("; "));
  return raw as SrcLocsBundle;
}

/** The digest-index bounds / ordering discipline the slice's cells must
 * satisfy: indexes into the item's own `ds` pool, unique and sorted within a
 * cell, cells strictly ordered by (provider, version). */
const HEX64 = /^[0-9a-f]{64}$/;

/** Throws BundleError with every problem joined when the alignment
 * digest-state slice is invalid. Shape-strict like the other validators: a
 * stale or truncated file must fail visibly rather than render a matrix with
 * a broken index — the view renders from this file alone (T-33 increment 2).
 */
export function validateAlignmentSlice(raw: unknown): AlignmentSlice {
  const problems: string[] = [];
  const fail = (msg: string) => {
    problems.push(msg);
  };
  if (typeof raw !== "object" || raw === null) fail("alignment slice is not a JSON object");
  const obj = raw as Record<string, unknown>;
  if (obj.schema !== ALIGNMENT_SCHEMA) fail(`alignment schema must be "${ALIGNMENT_SCHEMA}"`);
  if (obj.dataset_synced_at !== null && obj.dataset_synced_at !== undefined) {
    requireString(obj.dataset_synced_at, "alignment dataset_synced_at");
  }
  requireString(obj.dataset_schema, "alignment dataset_schema");
  if (!Array.isArray(obj.streams) || (obj.streams as unknown[]).length === 0) {
    fail("alignment streams must be a non-empty array");
  }
  if (!Array.isArray(obj.items)) fail("alignment items must be an array");
  const cast = (f: () => void) => {
    try {
      f();
    } catch (e) {
      if (e instanceof BundleError) fail(e.message);
      else throw e;
    }
  };
  cast(() => {
    const streamIds = new Set<string>();
    for (const s of (obj.streams as Record<string, unknown>[]) ?? []) {
      requireString(s?.id, "alignment stream.id");
      if (streamIds.has(s!.id as string)) fail(`alignment duplicate stream id ${s!.id}`);
      streamIds.add(s!.id as string);
      if (!Array.isArray(s?.unmeasured)) {
        fail(`${s!.id}: alignment stream.unmeasured must be an array`);
        continue;
      }
      let last: number | null = null;
      for (const vi of s.unmeasured as unknown[]) {
        if (!Number.isInteger(vi) || (vi as number) < 0) {
          fail(`${s!.id}: alignment stream.unmeasured rows must be non-negative integers`);
          continue;
        }
        if (last !== null && (vi as number) <= last) {
          fail(`${s!.id}: alignment stream.unmeasured rows must be sorted and unique`);
        }
        last = vi as number;
      }
    }
    const nStreams = streamIds.size;
    const seenKeys = new Set<string>();
    for (const item of (obj.items as Record<string, unknown>[]) ?? []) {
      requireString(item?.key, "alignment item.key");
      if (seenKeys.has(item!.key as string)) fail(`alignment duplicate item key ${item!.key}`);
      seenKeys.add(item!.key as string);
      if (!Array.isArray(item?.ds) || (item.ds as unknown[]).length === 0) {
        fail(`${item!.key}: alignment item.ds must be a non-empty array`);
        continue;
      }
      const seenDs = new Set<string>();
      for (const d of item.ds as unknown[]) {
        if (typeof d !== "string" || !HEX64.test(d)) {
          fail(`${item!.key}: alignment digest must be a 64-hex string`);
          continue;
        }
        if (seenDs.has(d)) fail(`${item!.key}: alignment item.ds digests must be unique`);
        seenDs.add(d);
      }
      const nDs = seenDs.size;
      if (!Array.isArray(item?.cells)) {
        fail(`${item!.key}: alignment item.cells must be an array`);
        continue;
      }
      let lastCell: [number, number] | null = null;
      for (const cell of item.cells as unknown[]) {
        if (!Array.isArray(cell) || cell.length !== 3) {
          fail(`${item!.key}: alignment cell must be [provider, version, digestIndexes]`);
          continue;
        }
        const [pi, vi, idxs] = cell as [unknown, unknown, unknown];
        if (!Number.isInteger(pi) || (pi as number) < 0 || (pi as number) >= nStreams) {
          fail(`${item!.key}: alignment cell provider index out of bounds`);
        }
        if (!Number.isInteger(vi) || (vi as number) < 0) {
          fail(`${item!.key}: alignment cell version index must be a non-negative integer`);
        }
        if (!Array.isArray(idxs) || (idxs as unknown[]).length === 0) {
          fail(`${item!.key}: alignment cell digest indexes must be a non-empty array`);
          continue;
        }
        let lastIdx: number | null = null;
        for (const i of idxs as unknown[]) {
          if (!Number.isInteger(i) || (i as number) < 0 || (i as number) >= nDs) {
            fail(`${item!.key}: alignment cell digest index out of bounds`);
            continue;
          }
          if (lastIdx !== null && (i as number) <= lastIdx) {
            fail(`${item!.key}: alignment cell digest indexes must be sorted and unique`);
          }
          lastIdx = i as number;
        }
        const here: [number, number] = [pi as number, vi as number];
        if (lastCell !== null && (here[0] < lastCell[0] || (here[0] === lastCell[0] && here[1] <= lastCell[1]))) {
          fail(`${item!.key}: alignment cells must be ordered by (provider, version)`);
        }
        lastCell = here;
      }
    }
  });
  if (problems.length) throw new BundleError(problems.join("; "));
  return raw as AlignmentSlice;
}

/** Throws BundleError with every problem joined when the alignment item index
 * is invalid. Shape-strict like the other validators: a stale or truncated
 * file must fail loudly, never render a broken type-ahead or a wrong matrix
 * (T-33 increment 5). The index's `keys` order is the ordinal authority the
 * column + payload buckets are addressed on, so its shape is the view's
 * contract exactly like the slice's `items` was. */
export function validateAlignIndex(raw: unknown): AlignIndex {
  const problems: string[] = [];
  const fail = (msg: string) => {
    problems.push(msg);
  };
  if (typeof raw !== "object" || raw === null) fail("align index is not a JSON object");
  const obj = raw as Record<string, unknown>;
  if (obj.schema !== ALIGN_INDEX_SCHEMA) fail(`align index schema must be "${ALIGN_INDEX_SCHEMA}"`);
  if (obj.dataset_synced_at !== null && obj.dataset_synced_at !== undefined) {
    requireString(obj.dataset_synced_at, "align index dataset_synced_at");
  }
  requireString(obj.dataset_schema, "align index dataset_schema");
  if (!Array.isArray(obj.streams) || (obj.streams as unknown[]).length === 0) {
    fail("align index streams must be a non-empty array");
  }
  if (!Array.isArray(obj.keys) || (obj.keys as unknown[]).length === 0) {
    fail("align index keys must be a non-empty array");
  }
  const cast = (f: () => void) => {
    try {
      f();
    } catch (e) {
      if (e instanceof BundleError) fail(e.message);
      else throw e;
    }
  };
  cast(() => {
    const streamIds = new Set<string>();
    for (const s of (obj.streams as Record<string, unknown>[]) ?? []) {
      requireString(s?.id, "align index stream.id");
      if (streamIds.has(s!.id as string)) fail(`align index duplicate stream id ${s!.id}`);
      streamIds.add(s!.id as string);
      if (!Array.isArray(s?.unmeasured)) {
        fail(`${s!.id}: align index stream.unmeasured must be an array`);
        continue;
      }
      let last: number | null = null;
      for (const vi of s.unmeasured as unknown[]) {
        if (!Number.isInteger(vi) || (vi as number) < 0) {
          fail(`${s!.id}: align index stream.unmeasured rows must be non-negative integers`);
          continue;
        }
        if (last !== null && (vi as number) <= last) {
          fail(`${s!.id}: align index stream.unmeasured rows must be sorted and unique`);
        }
        last = vi as number;
      }
    }
    const seenKeys = new Set<string>();
    let lastKey: string | null = null;
    for (const key of (obj.keys as Record<string, unknown>[]) ?? []) {
      requireString(key?.k, "align index key.k");
      const k = key!.k as string;
      if (seenKeys.has(k)) fail(`align index duplicate item key ${k}`);
      seenKeys.add(k);
      // Type-ahead order contract: kind rank, then key bytes — the same
      // compareKeys order the client sorts the full-bundle index into (and
      // the same order the slice's items and the buckets' addressing use).
      if (lastKey !== null && compareKeys(lastKey, k) > 0) {
        fail(`align index keys out of type-ahead order (${lastKey} after ${k})`);
      }
      lastKey = k;
      if (!Number.isInteger(key?.n) || (key!.n as number) < 1) {
        fail(`${k}: align index key.n must be a positive release-row count`);
      }
    }
  });
  if (problems.length) throw new BundleError(problems.join("; "));
  return raw as AlignIndex;
}

/** Throws BundleError with every problem joined when a column bucket file is
 * invalid. Shape-strict like the other validators: a stale or truncated file
 * must fail loudly, never render a broken matrix or an invented digest deck
 * (T-33 increment 5). Per-item checks mirror validateAlignmentSlice's; the
 * bucket's `from` anchors its ordinal range, and cross-file bounds (version
 * indexes vs the manifest's rows) are the parity suite's job. */
export function validateColumnBucket(raw: unknown): ColumnBucket {
  const problems: string[] = [];
  const fail = (msg: string) => {
    problems.push(msg);
  };
  if (typeof raw !== "object" || raw === null) fail("column bucket is not a JSON object");
  const obj = raw as Record<string, unknown>;
  if (obj.schema !== COLUMN_SCHEMA) fail(`column schema must be "${COLUMN_SCHEMA}"`);
  if (obj.dataset_synced_at !== null && obj.dataset_synced_at !== undefined) {
    requireString(obj.dataset_synced_at, "column dataset_synced_at");
  }
  requireString(obj.dataset_schema, "column dataset_schema");
  if (!Number.isInteger(obj.from) || (obj.from as number) < 0) {
    fail("column from must be a non-negative integer");
  } else if ((obj.from as number) % COLUMN_BUCKET_KEYS !== 0) {
    fail(`column from must be a multiple of the ${COLUMN_BUCKET_KEYS}-key bucket size`);
  }
  if (!Array.isArray(obj.items) || (obj.items as unknown[]).length === 0) {
    fail("column items must be a non-empty array");
  }
  const cast = (f: () => void) => {
    try {
      f();
    } catch (e) {
      if (e instanceof BundleError) fail(e.message);
      else throw e;
    }
  };
  cast(() => {
    const seenKeys = new Set<string>();
    for (const item of (obj.items as Record<string, unknown>[]) ?? []) {
      requireString(item?.k, "column item.k");
      const key = item!.k as string;
      if (seenKeys.has(key)) fail(`column duplicate item key ${key}`);
      seenKeys.add(key);
      if (!Array.isArray(item?.ds) || (item.ds as unknown[]).length === 0) {
        fail(`${key}: column item.ds must be a non-empty array`);
        continue;
      }
      const seenDs = new Set<string>();
      for (const d of item.ds as unknown[]) {
        if (typeof d !== "string" || !HEX64.test(d)) {
          fail(`${key}: column digest must be a 64-hex string`);
          continue;
        }
        if (seenDs.has(d)) fail(`${key}: column item.ds digests must be unique`);
        seenDs.add(d);
      }
      const nDs = seenDs.size;
      if (!Array.isArray(item?.cells)) {
        fail(`${key}: column item.cells must be an array`);
        continue;
      }
      let lastCell: [number, number] | null = null;
      for (const cell of item.cells as unknown[]) {
        if (!Array.isArray(cell) || cell.length !== 3) {
          fail(`${key}: column cell must be [provider, version, digestIndexes]`);
          continue;
        }
        const [pi, vi, idxs] = cell as [unknown, unknown, unknown];
        if (!Number.isInteger(pi) || (pi as number) < 0) {
          fail(`${key}: column cell provider index must be a non-negative integer`);
        }
        if (!Number.isInteger(vi) || (vi as number) < 0) {
          fail(`${key}: column cell version index must be a non-negative integer`);
        }
        if (!Array.isArray(idxs) || (idxs as unknown[]).length === 0) {
          fail(`${key}: column cell digest indexes must be a non-empty array`);
          continue;
        }
        let lastIdx: number | null = null;
        for (const i of idxs as unknown[]) {
          if (!Number.isInteger(i) || (i as number) < 0 || (i as number) >= nDs) {
            fail(`${key}: column cell digest index out of bounds`);
            continue;
          }
          if (lastIdx !== null && (i as number) <= lastIdx) {
            fail(`${key}: column cell digest indexes must be sorted and unique`);
          }
          lastIdx = i as number;
        }
        const here: [number, number] = [pi as number, vi as number];
        if (lastCell !== null && (here[0] < lastCell[0] || (here[0] === lastCell[0] && here[1] <= lastCell[1]))) {
          fail(`${key}: column cells must be ordered by (provider, version)`);
        }
        lastCell = here;
      }
    }
  });
  if (problems.length) throw new BundleError(problems.join("; "));
  return raw as ColumnBucket;
}

/** A payload row key: `"<provider index>:<version index>"` into the shared
 * (provider, version) row space — the same indexes the digest-state slice's
 * cells and the boot manifest's release rows use. */
const PAYLOAD_ROW_KEY = /^\d+:\d+$/;

/** Throws BundleError with every problem joined when a payload bucket file is
 * invalid. Shape-strict like the other validators: a stale or truncated file
 * must fail visibly rather than render half-truths beside resolved digest
 * state — the item box and popover render from this file's rows alone (T-33
 * increment 3). Cross-file bounds (row indexes vs the manifest's rows) are
 * the parity suite's job; the runtime reconstruction guards them too. */
export function validateKeyPayload(raw: unknown): PayloadBucket {
  const problems: string[] = [];
  const fail = (msg: string) => {
    problems.push(msg);
  };
  if (typeof raw !== "object" || raw === null) fail("payload bucket is not a JSON object");
  const obj = raw as Record<string, unknown>;
  if (obj.schema !== PAYLOAD_SCHEMA) fail(`payload schema must be "${PAYLOAD_SCHEMA}"`);
  if (obj.dataset_synced_at !== null && obj.dataset_synced_at !== undefined) {
    requireString(obj.dataset_synced_at, "payload dataset_synced_at");
  }
  requireString(obj.dataset_schema, "payload dataset_schema");
  if (!Number.isInteger(obj.from) || (obj.from as number) < 0) {
    fail("payload from must be a non-negative integer");
  } else if ((obj.from as number) % PAYLOAD_BUCKET_KEYS !== 0) {
    fail(`payload from must be a multiple of the ${PAYLOAD_BUCKET_KEYS}-key bucket size`);
  }
  if (!Array.isArray(obj.items)) fail("payload items must be an array");
  const cast = (f: () => void) => {
    try {
      f();
    } catch (e) {
      if (e instanceof BundleError) fail(e.message);
      else throw e;
    }
  };
  cast(() => {
    const seenKeys = new Set<string>();
    const items = (obj.items as Record<string, unknown>[]) ?? [];
    for (const item of items) {
      requireString(item?.k, "payload item.k");
      const key = item!.k as string;
      if (seenKeys.has(key)) fail(`payload duplicate item key ${key}`);
      seenKeys.add(key);
      const maps: Array<[string, unknown]> = [
        ["d", item?.d],
        ["s", item?.s],
        ["l", item?.l],
      ];
      const kinds = maps.filter(([, m]) => m !== undefined).map(([name]) => name);
      if (kinds.length === 0) fail(`${key}: payload item carries no rows (d/s/l all absent)`);
      for (const [name, map] of maps) {
        if (map === undefined) continue;
        if (typeof map !== "object" || Array.isArray(map)) {
          fail(`${key}: payload item.${name} must be an object`);
          continue;
        }
        for (const [row, value] of Object.entries(map as Record<string, unknown>)) {
          if (!PAYLOAD_ROW_KEY.test(row)) {
            fail(`${key}: payload row key "${row}" must be \`<provider>:<version>\``);
            continue;
          }
          if (name === "l") {
            if (!Array.isArray(value) || (value as unknown[]).length === 0) {
              fail(`${key}: payload l[${row}] must be a non-empty array of [file, start, end]`);
              continue;
            }
            for (const loc of value as unknown[]) {
              if (!Array.isArray(loc) || loc.length !== 3) {
                fail(`${key}: payload l[${row}] entries must be [file, start, end]`);
                continue;
              }
              const [file, start, end] = loc as [unknown, unknown, unknown];
              requireString(file as string, `${key} payload l[${row}].file`);
              if (!Number.isInteger(start) || (start as number) < 1) {
                fail(`${key}: payload l[${row}].start must be a positive line`);
              }
              if (!Number.isInteger(end) || (end as number) < (start as number)) {
                fail(`${key}: payload l[${row}].end must be >= start`);
              }
            }
          } else {
            requireString(value, `${key} payload ${name}[${row}]`);
          }
        }
      }
    }
  });
  if (problems.length) throw new BundleError(problems.join("; "));
  return raw as PayloadBucket;
}

/** A release surface row: `[key, digest, …cfg]` — at least the key and the
 * 64-hex measured digest, then any recorded cfg gates. */
function requireSurfaceRow(row: unknown, where: string): void {
  if (!Array.isArray(row) || row.length < 2) {
    throw new BundleError(`${where}: surface rows must be [key, digest, …cfg]`);
  }
  const [key, digest, ...gates] = row as unknown[];
  requireString(key as string, `${where} surface row key`);
  if (typeof digest !== "string" || !HEX64.test(digest)) {
    throw new BundleError(`${where}: surface row digest must be a 64-hex string`);
  }
  for (const g of gates) {
    requireString(g as string, `${where} surface row cfg gate`);
  }
}

/** Throws BundleError with every problem joined when a per-release payload
 * file is invalid. Shape-strict like the other validators: a stale or
 * truncated file — or a corpus/sidecar served at a release URL — must fail
 * visibly rather than render half-truths beside a resolved diff (T-33
 * increment 4). The p/v header is the validator's self-check against a
 * misaddressed fetch; cross-file row bounds are the parity suite's job. */
export function validateRelease(raw: unknown): ReleaseFile {
  const problems: string[] = [];
  const fail = (msg: string) => {
    problems.push(msg);
  };
  const cast = (f: () => void) => {
    try {
      f();
    } catch (e) {
      if (e instanceof BundleError) fail(e.message);
      else throw e;
    }
  };
  if (typeof raw !== "object" || raw === null) fail("release file is not a JSON object");
  const obj = raw as Record<string, unknown>;
  if (obj.schema !== RELEASE_SCHEMA) fail(`release schema must be "${RELEASE_SCHEMA}"`);
  cast(() => {
    if (obj.dataset_synced_at !== null && obj.dataset_synced_at !== undefined) {
      requireString(obj.dataset_synced_at, "release dataset_synced_at");
    }
    requireString(obj.dataset_schema, "release dataset_schema");
    requireString(obj.p, "release provider id");
    requireString(obj.v, "release version");
    if (!Number.isInteger(obj.n) || (obj.n as number) < 0) {
      fail("release n must be a non-negative integer");
    }
    if (!Array.isArray(obj.s)) fail("release s must be an array");
    for (const [i, row] of ((obj.s as unknown[]) ?? []).entries()) {
      cast(() => requireSurfaceRow(row, `release s[${i}]`));
    }
    if (obj.f !== undefined) {
      const f = obj.f as Record<string, unknown>;
      if (typeof f !== "object" || Array.isArray(f)) {
        fail("release f must be an object");
      } else {
        for (const [key, text] of Object.entries(f)) {
          requireString(key, `release f key`);
          requireString(text, `release f[${key}]`);
        }
      }
    }
  });
  if (problems.length) throw new BundleError(problems.join("; "));
  return raw as ReleaseFile;
}

/** A journal `d` object: the identical flag (`{ id: 1 }`) or the measured
 * counts with at least one > 0 — never both, never all-zero counts. */
function requireJournalDiff(d: unknown, where: string): JournalRowDiff {
  if (typeof d !== "object" || d === null || Array.isArray(d)) {
    throw new BundleError(`${where}: d must be an object`);
  }
  const obj = d as Record<string, unknown>;
  const keys = Object.keys(obj);
  if (keys.length === 1 && keys[0] === "id") {
    if (obj.id !== 1) throw new BundleError(`${where}: the identical flag must be 1`);
    return { id: 1 };
  }
  if (keys.length === 3 && ["rm", "ad", "rs"].every((k) => keys.includes(k))) {
    const counts: number[] = [obj.rm, obj.ad, obj.rs].map((v) => (Number.isInteger(v) ? (v as number) : -1));
    if (counts.some((v) => v < 0)) {
      throw new BundleError(`${where}: rm/ad/rs must be non-negative integers`);
    }
    if (counts.every((v) => v === 0)) {
      throw new BundleError(`${where}: an identical pair carries the id flag, never zero counts`);
    }
    return { rm: counts[0], ad: counts[1], rs: counts[2] };
  }
  throw new BundleError(`${where}: d must be { id: 1 } or { rm, ad, rs }`);
}

/** Throws BundleError with every problem joined when the journal story slice
 * is invalid. Shape-strict like the other validators: a stale or truncated
 * file must fail visibly rather than render feed lines that disagree with
 * the dataset (T-33 increment 4). Cross-row constraints hold inside the
 * slice: a `d` requires its `pr` predecessor and both rows measured. */
export function validateJournal(raw: unknown): JournalSlice {
  const problems: string[] = [];
  const fail = (msg: string) => {
    problems.push(msg);
  };
  const cast = (f: () => void) => {
    try {
      f();
    } catch (e) {
      if (e instanceof BundleError) fail(e.message);
      else throw e;
    }
  };
  if (typeof raw !== "object" || raw === null) fail("journal slice is not a JSON object");
  const obj = raw as Record<string, unknown>;
  if (obj.schema !== JOURNAL_SCHEMA) fail(`journal schema must be "${JOURNAL_SCHEMA}"`);
  cast(() => {
    if (obj.dataset_synced_at !== null && obj.dataset_synced_at !== undefined) {
      requireString(obj.dataset_synced_at, "journal dataset_synced_at");
    }
    requireString(obj.dataset_schema, "journal dataset_schema");
    if (!Array.isArray(obj.streams) || (obj.streams as unknown[]).length === 0) {
      fail("journal streams must be a non-empty array");
    }
  });
  cast(() => {
    const streamIds = new Set<string>();
    for (const s of (obj.streams as Record<string, unknown>[]) ?? []) {
      requireString(s?.id, "journal stream.id");
      if (streamIds.has(s!.id as string)) fail(`journal duplicate stream id ${s!.id}`);
      streamIds.add(s!.id as string);
      const rows = s?.rows;
      if (!Array.isArray(rows) || (rows as unknown[]).length === 0) {
        fail(`${s!.id}: journal rows must be a non-empty array`);
        continue;
      }
      for (const [vi, row] of (rows as Record<string, unknown>[]).entries()) {
        const where = `${s!.id} row ${vi}`;
        requireString(row?.v, `${where} v`);
        const m = row?.m;
        if (m !== 0 && m !== 1 && m !== 2) fail(`${where}: m must be 0, 1 or 2`);
        if (!Number.isInteger(row?.n) || (row?.n as number) < 0) {
          fail(`${where}: n must be a non-negative integer`);
        }
        if (row.pr !== undefined) {
          if (!Number.isInteger(row.pr) || (row.pr as number) < 0 || (row.pr as number) >= rows.length) {
            fail(`${where}: pr must index a row of the same stream`);
          }
        }
        if (row.d !== undefined) {
          if (row.pr === undefined) fail(`${where}: d requires its pr predecessor`);
          if (m === 0) fail(`${where}: a never-measured row carries no diff state`);
          if (m !== undefined && m !== 2) fail(`${where}: d requires a measured row`);
          const prRow = (rows as Record<string, unknown>[])[row.pr as number];
          if (prRow !== undefined && prRow.m === 0) {
            fail(`${where}: d requires a measured predecessor`);
          }
          if (row.d !== undefined) {
            cast(() => requireJournalDiff(row.d, `${where} d`));
          }
        }
      }
    }
  });
  if (problems.length) throw new BundleError(problems.join("; "));
  return raw as JournalSlice;
}
