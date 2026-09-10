// T-39 (increment 6, 2026-09-08) — the retired static renderer's bound ids,
// frozen as the id-coverage contract the SPA tripwires diff against.
//
// The static renderer (web/forkmap/{index.html,app.js,style.css,check.py})
// was deleted when the SPA became the served implementation (recorded in the
// T-39 task Outcome); the files live on in git history. These arrays were
// generated from those files with the exact extraction rules the tests used
// (app.js getElementById/closest bindings per view + the index.html
// view-configure section's configure-* ids), so the swap can never silently
// drop an id the recorded stories / smoke relied on.

export const STATIC_RENDERER_IDS: Record<string, string[]> = {
  changes: [
    "changes-a",
    "changes-a-provider",
    "changes-about",
    "changes-b",
    "changes-b-provider",
    "changes-caption",
    "changes-diff",
    "changes-filter",
    "changes-filter-clear",
    "changes-filter-kind",
    "changes-filter-note",
    "changes-filter-search",
    "changes-hint",
    "changes-release-detail",
    "changes-swap",
    "view-changes",
  ],
  alignment: [
    "alignment-about",
    "alignment-back",
    "alignment-docs",
    "alignment-docs-body",
    "alignment-hint",
    "alignment-item",
    "alignment-preset-chips",
    "alignment-presets",
    "alignment-query",
    "alignment-search-panel",
    "alignment-suggest",
    "view-alignment",
  ],
  configure: [
    "configure-about",
    "configure-commands",
    "configure-files-body",
    "configure-hint",
    "configure-name",
    "configure-provider",
    "configure-scope",
    "configure-status",
    "configure-version",
    "view-configure",
  ],
  journal: [
    "journal-about",
    "journal-feed",
    "journal-hint",
    "journal-stream",
    "view-journal",
  ],
  configureStatic: [
    "configure-about",
    "configure-commands",
    "configure-files",
    "configure-files-body",
    "configure-hint",
    "configure-name",
    "configure-provider",
    "configure-scope",
    "configure-status",
    "configure-version",
    "view-configure",
  ],
};
