// T-39 — data load hook. T-33 re-based it on the boot **manifest**: the SPA
// boots on the committed `forkmap-manifest.json` slice (the bundle minus
// every measured surface, plus export-precomputed corpus counts — ~160 KB vs
// the ~35 MB full corpus), so Landing / Configure / the header metrics paint
// before any full-corpus payload arrives. The corpus-diff views (Changes /
// Journal) read the export-derived per-release row data via useCorpusData
// (corpus.ts, T-33 increment 4 — the journal story slice + one per-release
// file per compared release; the whole corpus file is never fetched) and the
// Alignment view fetches its export-derived item index via useAlignIndex
// (alignmentSlice.ts, T-33 increment 5 — the type-ahead key list, plus one
// per-key column fragment per selected item; the whole digest-state slice is
// never fetched).
//
// The fetch path is document-relative — `forkmap/data/…` resolved against
// the page's own base — so the built artifact is self-contained: the build
// mirrors the committed bundle's runtime-fetched files at dist/forkmap/data
// (dataUrls.ts names the namespace, vite.config.ts does the lean copy) and a
// deployment of dist/ alone resolves every data fetch inside itself, wherever
// a host serves it (T-32's hosted shape; no sibling web/forkmap tree is
// consulted). In dev the
// forkmap-dev-sibling middleware answers the same namespace from the source
// tree. The path is assembled from parts at runtime — a static relative
// literal inside new URL(...) would make Vite treat the file as a build
// asset (emitted into dist/) and roll the chunk hash on every data change,
// breaking the deterministic-build requirement. The data is never inlined
// into a chunk or content-hashed at build time.
//
// Loading state is a real, visible phase (never a failure): the response
// body is read as a stream so the boot screen can show byte-accurate
// progress when the host sends a Content-Length (indeterminate otherwise),
// then the parse + validate phases are reported separately — a slow first
// read over plain HTTP must show as progress, never as the fatal box.
import { useEffect, useState } from "react";
import type { ForkmapManifest } from "./types";
import { committedDataUrl } from "./dataUrls";
import { BundleError, validateManifest } from "./validate";

/** The committed boot manifest's URL — the build's own mirror of
 * forkmap/data/forkmap-manifest.json (see dataUrls.ts for the namespace). */
export const MANIFEST_URL = committedDataUrl("forkmap-manifest.json");

/** Report granularity while streaming the response body (~quarter MB). */
const PROGRESS_STEP_BYTES = 256 * 1024;

export type LoadPhase = "fetch" | "parse" | "validate";

export interface LoadProgress {
  phase: LoadPhase;
  /** Bytes received so far (fetch phase); the full byte length afterwards. */
  loaded: number;
  /** The host's Content-Length when it sends one (null = indeterminate). */
  total: number | null;
}

/** Stream a JSON payload from the host and report byte progress — shared by
 * the boot manifest loader and the lazy full-corpus loader (T-33). */
export async function fetchStreamingText(url: string, onProgress: (p: LoadProgress) => void): Promise<string> {
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) {
    throw new BundleError(`could not load ${url} (HTTP ${res.status}) — served over http?`);
  }
  const contentLength = res.headers.get("Content-Length");
  const total = contentLength && /^\d+$/.test(contentLength) ? Number(contentLength) : null;
  let text: string;
  let bytes = 0;
  if (res.body && typeof res.body.getReader === "function") {
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let lastBucket = -1;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        bytes += value.byteLength;
        const bucket = Math.floor(bytes / PROGRESS_STEP_BYTES);
        if (bucket !== lastBucket) {
          lastBucket = bucket;
          onProgress({ phase: "fetch", loaded: bytes, total });
        }
      }
    }
    const buf = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) {
      buf.set(chunk, offset);
      offset += chunk.byteLength;
    }
    text = new TextDecoder("utf-8").decode(buf);
  } else {
    text = await res.text();
    bytes = text.length;
  }
  onProgress({ phase: "parse", loaded: bytes, total });
  return text;
}

export interface BundleState {
  status: "loading" | "ready" | "error";
  /** The validated boot manifest (surface-free slice + exported counts). */
  bundle: ForkmapManifest | null;
  error: string | null;
  progress: LoadProgress;
}

const IDLE: LoadProgress = { phase: "fetch", loaded: 0, total: null };

/** Boot the fork map on the committed manifest (T-33): Landing, Configure and
 * the header/footer metrics need only metadata + counts, never the corpus. */
export function useBundle(): BundleState {
  const [state, setState] = useState<BundleState>({
    status: "loading",
    bundle: null,
    error: null,
    progress: IDLE,
  });
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const text = await fetchStreamingText(MANIFEST_URL, (progress) => {
          if (!cancelled) setState((s) => ({ ...s, progress }));
        });
        if (cancelled) return;
        setState((s) => ({ ...s, progress: { phase: "validate", loaded: text.length, total: text.length } }));
        const raw: unknown = JSON.parse(text);
        const manifest = validateManifest(raw);
        if (!cancelled) {
          setState({
            status: "ready",
            bundle: manifest,
            error: null,
            progress: { phase: "validate", loaded: text.length, total: text.length },
          });
        }
      } catch (e) {
        if (!cancelled) {
          setState({
            status: "error",
            bundle: null,
            error: e instanceof Error ? e.message : String(e),
            progress: { phase: "fetch", loaded: 0, total: null },
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return state;
}
