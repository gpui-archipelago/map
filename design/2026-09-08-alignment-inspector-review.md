# Alignment Inspector — Primary UX Friction Points & Information Design Gaps

## 3.1 The "Dead Strip" Problem (60 Absent Cells Out of 67)

Observed Reality: For struct:accessibility::AccessibilityNode, five out of six forks have zero occurrences:

- gpui: 7 absent dots

- gpui-ce: 3 absent dots

- gpui-unofficial: 44 absent dots

- gpui-pre: 4 absent dots

- gpui-box: 2 absent dots

The Ergonomic Issue: The developer must scroll past 44 empty dots in gpui-unofficial alone just to verify that the item does not exist there. Presenting empty streams at full visual weight pushes the sole active stream (kael) and the telemetry dock far down the viewport.

Impact: High visual fatigue and dilution of the actionable signal.

## 3.2 Eye-Tracking Travel & Spatial Disconnect of #alignment-dock

The Interaction Pattern: A developer hovers over or focuses a cell in the matrix (e.g., kael 0.2.0 (stable): changed).

The Layout Flaw: The detailed feedback panel (#alignment-dock) is anchored at the bottom of the matrix. On desktop viewports, hovering a cell in the upper rows forces the engineer's eye to travel 400px–600px downward to inspect the SHA-256/blake3 digest and prevalence metrics, breaking cognitive continuity.

## 3.3 Visual Role Ambiguity: Kind Pills vs. Active Query

The Markup:

```
<div class="kind-row" id="alignment-kinds">
  <span class="preset-label mono">quick filter · narrows the suggestions</span>
  <span class="kind-pills">
    <button type="button" class="kind-pill active" aria-pressed="true">All 13,344</button>
    <button type="button" class="kind-pill">struct 1,315</button>
  </span>
</div>
```

The Confusion: The active input already contains struct:accessibility::AccessibilityNode, yet the active pill is All.

The User Expectation: Users frequently expect clicking fn to filter the current matrix view or switch the current query. Because these pills only filter future dropdown suggestions (narrows the suggestions), positioning them directly beneath the active query creates a disconnect between what is displayed in the input and what is toggled in the UI.

## 3.4 Missing High-Impact Migration Bridge on Re-Signed Items

When an item has an active successor rule (like profiler::record_frame_timing), a migration card is critical. However, for re-signed items like AccessibilityNode in kael, the matrix displays ~ first re-signed at 0.2.0 without explaining how it re-signed (i.e., the addition of the mandatory bounds parameter).

The dock displays the hash difference (74d0f3... → 31d435...), but hash digests cannot tell an engineer which parameter changed.

## 4. Actionable Refinement Directives

| Friction Area | Current Markup State | Recommended Target State |
| --- | --- | --- |
| Empty Streams | 5 streams render 60 empty button dots spanning full horizontal grid widths. | Group & Dim or Collapse: Auto-sort active streams to the top. Streams with $0\%$ presence collapse into a single condensed row: gpui, gpui-ce, gpui-unofficial, gpui-pre, gpui-box: Not present across 60 recorded releases (expand). |
| Telemetry Dock | #alignment-dock is a static panel placed below the entire matrix. | Co-located Inspection: Provide an immediate floating popover/card adjacent to the active row, or dock the telemetry inspector side-by-side with the stream rows on viewports $\ge 1024\text{px}$. |
| Long Stream Runs | 44 contiguous dots in gpui-unofficial form an undifferentiated horizontal strip. | Epoch Segmentation: Subdivide into visual epochs (0.23x, 1.0–1.2, 1.7–1.16, 1.17+) with subtle vertical dividers to prevent dot counting. |
| Re-signature Details | Cells indicate changed and show blake3 hashes in #alignment-dock. | Signature Delta Chip: Where an item re-signs within a stream, display an inline diff snippet or parameter note directly in the dock: bounds: Bounds<Pixels> added to constructor. |
| Filter Pills | Sits between search input and suggestions container. | Integrated Combobox Toolbar: Move kind pills inside the search dropdown or directly align them as input addons so their role as search query filters is unmistakable. |
