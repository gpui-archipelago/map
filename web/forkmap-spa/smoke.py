#!/usr/bin/env python3
"""T-39 smoke: render the built SPA over plain HTTP with headless Chrome and
assert the Overview's data-driven + static content actually appears.

Prereqs: a prior `bun run build` (web/forkmap-spa/dist/) and google-chrome on
PATH. Serves dist/ alone at the origin root — the built artifact is
self-contained (the build mirrors the committed bundle's runtime-fetched
files into dist/forkmap/data, so every data fetch resolves inside the
artifact, with no sibling web/forkmap
tree served) — renders #/ + #/changes + #/alignment + #/configure +
#/journal, and greps the serialized DOM for the honest-rule ids,
bundle-driven numbers, and the nav.

Run: python3 web/forkmap-spa/smoke.py
"""
import json
import os
import socket
import subprocess
import sys
import threading
import time
from http.server import ThreadingHTTPServer
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent  # web/ — the source tree, oracle for the data-driven assertions
DIST_URL = "http://127.0.0.1:8767/"
PORT = 8767
# Prove a deployed origin instead of the local build:
#   SMOKE_ORIGIN=https://gpui-archipelago.github.io/map python3 smoke.py
# (the local server is skipped; the source tree stays the data oracle).
ORIGIN = os.environ.get("SMOKE_ORIGIN", "").rstrip("/")
# CI's Chrome may be named differently; override with CHROME_BIN (a missing
# browser is a hard failure — this is the served-artifact proof).
CHROME = os.environ.get("CHROME_BIN", "google-chrome-stable")
# Per-invocation Chrome profile counter (see chrome_dom).
_PROFILE_SEQ = 0


def wait_port(port: int, timeout: float = 10.0) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with socket.create_connection(("127.0.0.1", port), timeout=1):
                return True
        except OSError:
            time.sleep(0.1)
    return False


def chrome_dom(url: str) -> str:
    env = os.environ.copy()
    env["HOME"] = "/tmp/gocar-chrome-home"
    os.makedirs(env["HOME"], exist_ok=True)
    # A profile per *invocation*: a shared one would leave a stale bundle in its
    # HTTP cache across runs, and rapid sequential launches contend on the same
    # profile's lock (a partial dump). The counter keeps each launch isolated.
    global _PROFILE_SEQ
    _PROFILE_SEQ += 1
    profile = f"/tmp/gocar-chrome-profile-{os.getpid()}-{_PROFILE_SEQ}"
    out = subprocess.run(
        [
            CHROME,
            "--headless=new",
            "--disable-gpu",
            "--no-sandbox",
            "--disable-crash-reporter",
            f"--user-data-dir={profile}",
            # Virtual time is a budget, not a wait: the app burns it in its
            # loading/backoff timers while real fetches are pending, so a tight
            # budget dumps a still-booting DOM on a remote origin (the Alignment
            # matrix makes more fetches than the other routes). Generous + cheap:
            # the budget costs ~1s of wall time per page regardless.
            "--virtual-time-budget=300000",
            "--dump-dom",
            url,
        ],
        capture_output=True,
        text=True,
        timeout=90,
        env=env,
    )
    if out.returncode != 0:
        raise RuntimeError(f"chrome failed: {out.stderr[:500]}")
    return out.stdout


# A dumped DOM still showing one of these is a page that had not finished
# booting — a slow runner or a cold CDN, not a content failure. Retrying it
# keeps the smoke honest (the assertions still decide) without turning Chrome's
# timing into a red build.
BOOTING_MARKERS = ('id="view-booting"', '<div id="root"></div>')


def chrome_dom_settled(url: str, *, expect: str | None = None, tries: int = 5) -> str:
    """Render `url`, retrying while the page has not settled.

    A DOM still showing a booting marker, or missing the route's own first
    expectation, is a page that had not finished loading — a slow runner, a
    cold CDN, a transient network stall — not a content failure. Retrying keeps
    the smoke honest (the assertions still decide) without turning Chrome's
    timing into a red build.
    """
    dom = ""
    for attempt in range(tries):
        dom = chrome_dom(url)
        booting = any(marker in dom for marker in BOOTING_MARKERS)
        if not booting and (expect is None or expect in dom):
            return dom
        if attempt + 1 < tries:
            print(f"  … retry {attempt + 1}/{tries - 1}: {url} (not settled)")
    return dom


def main() -> int:
    sys.path.insert(0, str(HERE))

    server = None
    if ORIGIN:
        base = ORIGIN + "/"
    else:
        import serve_web  # noqa: PLC0415

        server = ThreadingHTTPServer(("127.0.0.1", PORT), serve_web.QuietHandler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        base = DIST_URL
    try:
        if server is not None and not wait_port(PORT):
            print("server did not start")
            return 1

        dom = chrome_dom_settled(base + "#/", expect="The GPUI fork map")
        # The dump is the *rendered* DOM (React mounted): if the bundle fetch
        # failed the fatal box renders, if nothing mounted #root stays empty.
        if "<div id=\"root\"></div>" in dom and "gpui-archipelago" not in dom:
            print("  ✗ app did not mount (empty #root) — check the browser console")
            return 1
        if "could not render" in dom:
            print("  ✗ fatal box rendered — bundle fetch/validation failed")
            return 1

        # Resolve the default Configure offer from the committed bundle so the
        # assertions stay data-driven (RULE-7), not literals about a version.
        # The oracle is the source tree's web/forkmap/data; the served artifact
        # carries a byte-identical mirror by construction (vite.config.ts).
        bundle_data = json.loads((ROOT / "forkmap" / "data" / "forkmap.json").read_text())
        rec_id = bundle_data.get("recommended_provider")
        rec = next((p for p in bundle_data["providers"] if p["id"] == rec_id), bundle_data["providers"][0])
        rec_vers = rec["latest_stable"]
        rec_set = next(s for s in bundle_data["templates"]["bindings"] if s["provider"] == rec["id"])
        rec_cargo = next(e["cargo_toml"] for e in rec_set["entries"] if e["vers"] == rec_vers)
        kael = next(p for p in bundle_data["providers"] if p["id"] == "kael")
        kael_note = next(
            e.get("note", "")
            for s in bundle_data["templates"]["bindings"]
            for e in s["entries"]
            if s["provider"] == "kael" and e["vers"] == "0.2.0"
        )
        kael_rust = next(v["rust_version"] for v in kael["versions"] if v["vers"] == "0.2.0")

        # RULE-7: every corpus-specific expectation below is recomputed here
        # from the same committed bundle/sidecars the SPA serves, so the smoke
        # proves the viewer renders *whatever* the corpus holds — never a
        # version, digest or count frozen at a past release.
        manifest = json.loads((ROOT / "forkmap" / "data" / "forkmap-manifest.json").read_text())
        doc_texts = json.loads((ROOT / "forkmap" / "data" / "forkmap-doc-texts.json").read_text())
        docs_by_stream = {
            p["id"]: {v["vers"]: v.get("doc_texts", {}) for v in p["versions"]}
            for p in doc_texts["providers"]
        }

        def digests_of(surface, key: str) -> set[str]:
            """The measured digests a row's surface carries for `key` (empty
            when the item is absent there — derive.ts digestsOf, minus the
            null-surface distinction only cellState reads)."""
            if surface is None:
                return set()
            return {it["digest"] for it in surface if it["key"] == key}

        def doc_story(key: str):
            """itemDocStory over the bundle + doc-texts sidecar (derive.ts):
            the distinct docstrings, the releases that resolved one, the bare
            releases and the first-measured anchor."""
            docs: list[str] = []
            doc_releases = bare = 0
            anchor = None
            for p in bundle_data["providers"]:
                for v in p["versions"]:
                    ds = digests_of(v.get("surface"), key)
                    if not ds:
                        continue
                    doc = docs_by_stream.get(p["id"], {}).get(v["vers"], {}).get(key)
                    if len(ds) == 1 and doc is not None:
                        doc_releases += 1
                        if anchor is None:
                            anchor = (p["id"], v["vers"])
                        if doc not in docs:
                            docs.append(doc)
                    else:
                        bare += 1
            return docs, doc_releases, bare, anchor

        def doc_title_cap(docs, doc_releases: int, bare: int, anchor) -> str:
            """ItemDocTitle's caption for the story (AlignmentView)."""
            s = "" if doc_releases == 1 else "s"
            if len(docs) == 1:
                if bare == 0:
                    return f"one docstring · measured on all {doc_releases} release{s}"
                total = doc_releases + bare
                return (
                    f"one docstring · measured on {doc_releases} of {total} release{'' if total == 1 else 's'}"
                    f" — {bare} carry no doc comment"
                )
            return (
                f"{len(docs)} docstrings across {doc_releases} release{s}"
                f" — showing the first measured ({anchor[0]} {anchor[1]})"
            )

        def diff_doc_lines(base: str, other: str):
            """diffDocLines (derive.ts): the added/removed doc lines of a
            variant against the item baseline — the chip's measured counts."""
            a, b = base.split("\n"), other.split("\n")
            m, n = len(a), len(b)
            lcs = [[0] * (n + 1) for _ in range(m + 1)]
            for i in range(m - 1, -1, -1):
                for j in range(n - 1, -1, -1):
                    lcs[i][j] = lcs[i + 1][j + 1] + 1 if a[i] == b[j] else max(lcs[i + 1][j], lcs[i][j + 1])
            added: list[str] = []
            removed: list[str] = []
            i = j = 0
            while i < m and j < n:
                if a[i] == b[j]:
                    i, j = i + 1, j + 1
                elif lcs[i + 1][j] >= lcs[i][j + 1]:
                    removed.append(a[i])
                    i += 1
                else:
                    added.append(b[j])
                    j += 1
            removed.extend(a[i:])
            added.extend(b[j:])
            return added, removed

        def item_variants(key: str) -> list[str]:
            """itemVariants (derive.ts): the key's distinct measured digests in
            first-measured corpus order — the α β γ… the deck cards, the matrix
            dots and the summary chips share."""
            first: dict[str, tuple[int, int]] = {}
            for pi, p in enumerate(bundle_data["providers"]):
                for vi, v in enumerate(p["versions"]):
                    surf = v.get("surface")
                    if surf is None:
                        continue
                    row = sorted({it["digest"] for it in surf if it["key"] == key})
                    for digest in row:
                        first.setdefault(digest, (pi, vi))
            order = sorted(first.items(), key=lambda kv: (kv[1][0], kv[1][1], kv[0]))
            return [digest for digest, _ in order]

        def run_chip(provider, key: str, order: list[str]) -> str | None:
            """The stream-summary variant chip (MatrixStream over variantSteps of
            the *stable* rows): a single step reads `Variant α`, a run reads the
            α → β (1.17.2) sequence — the run alone, no release-count prefix.
            None when the fork's stable line never carried the item (the chip is
            then the honest never-measured / preview-only wording)."""
            steps: list[tuple[tuple[int, ...], str | None]] = []
            for v in provider["versions"]:
                if v.get("prerelease"):
                    continue
                ds = digests_of(v.get("surface"), key)
                idx = tuple(sorted(i for i, d in enumerate(order) if d in ds))
                if not idx:
                    continue
                if steps and steps[-1][0] == idx:
                    continue
                steps.append((idx, None if not steps else v["vers"]))
            if not steps:
                return None

            def letters(ix: tuple[int, ...]) -> str:
                return "+".join(greek[i] for i in ix)

            if len(steps) == 1:
                return f"Variant {letters(steps[0][0])}"
            return " → ".join(
                letters(ix) if vers is None else f"{letters(ix)} ({vers})" for ix, vers in steps
            )

        # The default Changes pair (routing.ts resolveChanges over the boot
        # manifest): an empty hash anchors on the first provider, whose B side
        # is its latest stable — the caption names it; derive the fragment.
        default_provider = manifest["providers"][0]
        changes_default_caption = f"before {default_provider['latest_stable']}, the latest stable of {default_provider['id']}"

        # The recommended Configure offer's RULE-5 reach: the badge is honest
        # data, so branch on whether the default release is the provider's own
        # compile-verified row (compileStatus) — never assume a default badge.
        rec_marker = rec.get("compile_verified")
        configure_badge_ok = "Compile-verified — this exact row through"
        configure_badge_no = "Not compile-probed for"
        configure_compiled = bool(rec_marker and rec_marker.get("vers") == rec_vers)
        configure_badge_want = configure_badge_ok if configure_compiled else configure_badge_no
        configure_badge_not = configure_badge_no if configure_compiled else configure_badge_ok

        # kael's AccessibilityNode: the distinct measured digests in
        # first-measured order (itemVariants) — the checks assert their 8-char
        # short forms and the α…last labels, never a frozen hex. The T-41
        # collapse's text and count come from the same presence partition.
        node_key = "struct:accessibility::AccessibilityNode"
        greek = "αβγδεζηθικλμνξοπρστυφχψω"
        node_digests = item_variants(node_key)
        node_first_short = node_digests[0][:8]
        node_last_short = node_digests[-1][:8]
        node_last_label = greek[len(node_digests) - 1] if len(node_digests) <= len(greek) else f"#{len(node_digests)}"
        node_swatches = sorted({0, (len(node_digests) - 1) % 8})
        node_absent = [
            p for p in bundle_data["providers"] if not any(digests_of(v.get("surface"), node_key) for v in p["versions"])
        ]
        node_absent_rows = sum(len(p["versions"]) for p in node_absent)
        node_absent_text = (
            f"never measured on {' · '.join(p['id'] for p in node_absent)}"
            f" — absent from {node_absent_rows} release{'' if node_absent_rows == 1 else 's'}"
        )
        node_run_wants = [c for p in bundle_data["providers"] if (c := run_chip(p, node_key, node_digests))]

        # fn:Window::blur (the T-44 deep link) and fn:FileWatcher::new (the
        # T-43 doc-delta story): every doc byte and caption derived from the
        # bundle's presence + the doc-texts sidecar.
        blur_docs, blur_releases, blur_bare, blur_anchor = doc_story("fn:Window::blur")
        blur_doc = blur_docs[0] if blur_docs else ""
        blur_cap = doc_title_cap(blur_docs, blur_releases, blur_bare, blur_anchor)
        fw_docs, fw_releases, fw_bare, fw_anchor = doc_story("fn:FileWatcher::new")
        fw_cap = doc_title_cap(fw_docs, fw_releases, fw_bare, fw_anchor)
        fw_added, fw_removed = diff_doc_lines(fw_docs[0], fw_docs[1]) if len(fw_docs) > 1 else ([], [])
        fw_chip_wants = [f"-{len(fw_removed)} +{len(fw_added)}</span>"]
        if len(fw_docs) > 1:
            fw_chip_wants.append(fw_docs[1])
            fw_chip_wants += [f"- {line}" for line in fw_removed] + [f"+ {line}" for line in fw_added]
        fw_first_line = fw_docs[0].split("\n")[0] if fw_docs else ""

        # T-40: the Alignment kind pills' counts must be bundle-computed
        # (RULE-7) — derive the expected pill markup from the same bundle the
        # SPA loads, exactly as buildIndex does (a version counts once per
        # key; the pill counts are the corpus's distinct keys per kind).
        def kind_of(key: str) -> str:
            return key.split(":", 1)[0] if ":" in key else "?"

        per_kind: dict[str, set[str]] = {}
        for p in bundle_data["providers"]:
            for v in p["versions"]:
                surf = v.get("surface")
                if surf is None:
                    continue
                for item in surf:
                    per_kind.setdefault(kind_of(item["key"]), set()).add(item["key"])
        total_keys = sum(len(keys) for keys in per_kind.values())
        top_kinds = sorted(per_kind.items(), key=lambda kv: (-len(kv[1]), kv[0]))[:2]
        fmt = lambda n: f"{n:,}"  # noqa: E731
        pill_html = [
            f">All<span class=\"kind-pill-count\">{fmt(total_keys)}</span>",
            *[
                f">{kind}<span class=\"kind-pill-count\">{fmt(len(keys))}</span>"
                for kind, keys in top_kinds
            ],
        ]
        rule_keys: set[str] = set()
        for r in bundle_data["rules"]:
            rule_keys.add(r["from"]["key"])
            rule_keys.add(r["to"]["key"])
        rule_pill_html = (
            f">⚡ </span>has a migration recipe<span class=\"kind-pill-count\">{fmt(len(rule_keys))}</span>"
        )

        # The empty mode's lead line (AlignmentView): the page's own statement
        # of what it answers, with the fork count the manifest carries.
        alignment_empty_lead = (
            f"Search a symbol above to compare presence, signature drift and hash parity"
            f" across all {len(bundle_data['providers'])} forks."
        )

        checks = [
            ("landing hero", "#/", ["The GPUI fork map", "id=\"honest-rule-1\"", "id=\"honest-rule-7\"",
                                    "id=\"data-layers\"", "id=\"compile-badges\"", "id=\"data-facts\""], []),
            ("nav chrome", "#/", ["gpui-archipelago", "Changes", "Alignment", "Configure", "Journal",
                                  "header-schema"], []),
            ("changes route", "#/changes", ["id=\"view-changes\"", "id=\"changes-controls\"",
                                             changes_default_caption], []),
            ("changes story (same-fork changelog)",
             "#/changes?a=gpui-unofficial:1.16.3&b=gpui-unofficial:1.17.2",
             ["Changelog.", "profiler::record_frame_timing", "frame_trace_enabled",
              "measured item differences", "id=\"changes-filter\""],
             ["Snapshot comparison."]),
            ("changes story (cross-fork snapshot, never a changelog — RULE-1)",
             "#/changes?a=gpui-ce:0.2.2&b=gpui-unofficial:1.18.1",
             ["Snapshot comparison."],
             ["Changelog."]),
            ("changes exact-copy pair (identical panel, no filter bar)",
             "#/changes?a=gpui-unofficial:1.16.1&b=gpui-unofficial:1.16.2",
             ["identical measured surface"], ["id=\"changes-filter\""]),
            ("changes same-release hash (pick-a-different hint)",
             "#/changes?a=kael:0.2.0&b=kael:0.2.0",
             ["Pick two different releases to diff."], ["id=\"changes-filter\""]),
            ("changes honest rules (AboutNote ids)",
             "#/changes", ["id=\"honest-rule-1\"", "id=\"honest-rule-7\""], []),
            ("study reader affordance (study doc rows announce the excerpt dialog)",
             "#/changes", ["aria-haspopup=\"dialog\"", "id=\"honest-rule-1\""], []),
            ("study reader affordance (landing doc rows + compile-badge evidence)",
             "#/", ["id=\"landing-link-doc07\"", "id=\"landing-link-doc12\"", "id=\"landing-link-doc13\"",
                     "aria-haspopup=\"dialog\""], []),
            ("study reader affordance (alignment docs panel rows)",
             "#/alignment", ["<summary>Methodology &amp; studies</summary>", "aria-haspopup=\"dialog\""], []),
            ("alignment empty mode (title bar + box one line, examples, guide card)",
             "#/alignment", ["id=\"view-alignment\"", "Search measured items", "examples",
                              "<summary>Cross-Fork API Longevity &amp; Digest Parity</summary>",
                              "<summary>Methodology &amp; studies</summary>",
                              alignment_empty_lead,
                              "id=\"alignment-empty-state\"",
                              "id=\"honest-rule-1\""], ["class=\"matrix\""]),
            ("alignment story (kael AccessibilityNode matrix + chips)",
             "#/alignment?item=struct:accessibility::AccessibilityNode",
             ["struct:accessibility::AccessibilityNode", "id=\"alignment-variants\"", "Signature variants",
              f"Variant {greek[0]}", f"Variant {node_last_label}",
              f">{node_first_short}</code>", f">{node_last_short}</code>",
              *node_run_wants,
              *[f'class="cell cell-dv{s}"' for s in node_swatches],
              "class=\"matrix\"", "pre-split", "legend-info mono"], ["class=\"cell cell-same\""]),
            ("alignment inspector (T-41: never-measured streams collapse; the matrix owns the stage)",
             "#/alignment?item=struct:accessibility::AccessibilityNode",
             ["id=\"alignment-absent\"", "aria-expanded=\"false\"",
              node_absent_text,
              "class=\"matrix-stage\""],
             ["hide", "id=\"alignment-dock\"", "id=\"release-popover\""]),
            ("alignment inspector (T-41: a present-everywhere item collapses nothing)",
             "#/alignment?item=fn:Window::blur",
             ["class=\"matrix-stage\"", "data-cell-provider=\"gpui-unofficial\""],
             ["id=\"alignment-absent\"", "id=\"alignment-dock\"", "no cell pinned"]),
            ("alignment story (uno removal + rule box + T-38 return chip)",
             "#/alignment?item=fn:profiler::record_frame_timing&back=journal%3Fs%3Dgpui-unofficial%26v%3D1.17.2",
             ["Confirmed migration rules", "✕ first removed at ",
              "← return to Journal — gpui-unofficial 1.17.2"], []),
            ("alignment inspector (T-40 kind pills — bundle-computed counts, All active)",
             "#/alignment",
             ["id=\"alignment-kinds\"", "class=\"suggest-panel\"", "title=\"filter the suggestions by kind\">kind<",
              *pill_html, rule_pill_html, "aria-pressed=\"true\""], []),
            ("alignment inspector (T-44: the dock is retired — a deep link renders no popover until a cell is pinned)",
             "#/alignment?item=fn:Window::blur",
             [
              # T-43: the promoted Title docstring rendered from the lazy
              # doc-texts sidecar (fetched + validated + derived at runtime)
              "id=\"alignment-item-doc\"", blur_doc, blur_cap,
              # T-44: the popover is inert until a pin — no dock placeholder,
              # no release-popover node, no stale describedby target
              "class=\"matrix-stage\"",
              f'data-cell-provider="{blur_anchor[0]}" data-cell-vers="{blur_anchor[1]}"'],
             ["SHA-256", "Release inspector", "no cell pinned", "id=\"alignment-dock\"",
              "id=\"release-popover\"", "aria-describedby=\"alignment-dock-status\""]),
            ("alignment doc story (T-43: FileWatcher::new baseline Title + measured doc-delta chip on the β card)",
             "#/alignment?item=fn:FileWatcher::new",
             ["id=\"alignment-item-doc\"", fw_first_line, fw_cap, "class=\"doc-delta mono\"", *fw_chip_wants],
             []),
            ("alignment inspector (T-40 recipe copy on the confirmed-rule box)",
             "#/alignment?item=fn:profiler::record_frame_timing",
             ["Confirmed migration rules", ">copy recipe</button>", "role=\"status\"",
              "aria-live=\"polite\""], []),
            ("alignment inspector (T-40 successor-side copy on record_frame_event)",
             "#/alignment?item=fn:profiler::record_frame_event",
             ["← successor of", ">copy recipe</button>"], []),
            ("journal story (kael 0.2.0 deep link: counts + anchors)",
             "#/journal?s=kael&v=0.2.0",
             ["id=\"view-journal\"", "id=\"journal-entry-kael-0.2.0\"", "id=\"journal-stream\"",
              "id=\"journal-filter\"", "id=\"journal-hint\"", "Journal honesty specifics",
              "count-resigned", "Diff in Changes", "class=\"stream-rule\""], []),
            ("journal flagged entry (gpui 0.1.0-test)",
             "#/journal?s=gpui&v=0.1.0-test",
             ["id=\"journal-entry-gpui-0.1.0-test\"", ">pre-release</span>", ">yanked</span>",
              "0 items (empty)"], []),
            ("journal stable-only filter (the previews stand down, the stables stay)",
             "#/journal?st=stable",
             ["releases across 6 forks · stable only", "id=\"journal-entry-kael-0.2.0\""],
             ["id=\"journal-entry-gpui-unofficial-1.19.0-pre\""]),
            ("configure route (recommended offer, RULE-5 badge + pickers + scope)",
             "#/configure",
             ["id=\"view-configure\"", "id=\"configure-provider\"", "id=\"configure-version\"",
              "id=\"configure-name\"", configure_badge_want,
              f"📋 cargo gocar new gpui-app --provider {rec_id}",
              "Platform binding", "Compiler floor",
              f'min-version = "{rec_vers}"', 'name = "gpui-app"', "cargo gocar verify-env",
              "Kit-rebase alias-shim bundles are not offered here (v2).",
              "id=\"honest-rule-1\"", "id=\"honest-rule-7\"", "aria-haspopup=\"dialog\""],
             ["status-flag", configure_badge_not]),
            ("configure story (kael 0.2.0: honest warn + curated note + resolved name)",
             "#/configure?p=kael&v=0.2.0&name=my-app",
             [f"Not compile-probed for 0.2.0",
              "Why this row is not in the matrix:", kael_note[:80],
              'min-version = \"0.2.0\"', 'name = \"my-app\"',
              f"declared rust-version {kael_rust} · advisory only — no attested floor yet"],
             ["Compile-verified — this exact row through"]),
            ("configure story (yanked gpui-ce 0.3.2: RULE-6 flag + reading commands)",
             "#/configure?p=gpui-ce&v=0.3.2",
             ["Yanked on crates.io — do not bind a new project to it (rule 6).",
              "cargo generate-lockfile",
              "# The offer above is for reading an era; binding it needs plain cargo:"],
             ["# Pin the artifact (MVS+)", "cargo gocar verify-env"]),
            ("configure story (prerelease uno 1.17.0-pre: never a default choice)",
             "#/configure?p=gpui-unofficial&v=1.17.0-pre",
             ["A pre-release — never a default choice (rule 6).",
              "1.17.0-pre (pre-release)", "cargo generate-lockfile"],
             ["# Pin the artifact (MVS+)"]),
        ]
        failures = []
        for name, frag, wants, not_wants in checks:
            page = chrome_dom_settled(base + frag, expect=wants[0]) if frag != "#/" else dom
            for w in wants:
                if w not in page:
                    failures.append(f"{name}: missing {w!r}")
            for w in not_wants:
                if w in page:
                    failures.append(f"{name}: unexpected {w!r}")

        # The bundle-driven numbers must be real (RULE-7), not placeholders —
        # read them straight from the committed bundle and compare.
        bundle = bundle_data
        nprov = len(bundle["providers"])
        nvers = sum(len(p["versions"]) for p in bundle["providers"])
        # Assert the numbers land in the page, not the prose around them: the
        # labels are copy and change; the id and the rendered counts do not.
        for w in [f"{nprov}</span>", f"{nvers}</span>", "data as of", "id=\"data-facts\""]:
            if w not in dom:
                failures.append(f"bundle-driven header metrics: missing {w!r}")

        if failures:
            print("\n".join(f"  ✗ {f}" for f in failures))
            return 1
        print("  ✓ headless render: Overview + all five routes show their content, metrics are bundle-driven")
        return 0
    finally:
        if server is not None:
            server.shutdown()


if __name__ == "__main__":
    sys.exit(main())
