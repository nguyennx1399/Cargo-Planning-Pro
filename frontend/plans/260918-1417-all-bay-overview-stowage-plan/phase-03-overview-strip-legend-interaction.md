# Phase 03 — Overview strip + legend + interaction

## Context links
- [phase-01](phase-01-bay-sheet-model.md) · [phase-02](phase-02-bay-pair-renderer-and-detail-view.md)
- `src/App.tsx`: `.stage` → `.bayplan` → `<BayPlanView vessel plan />`; `report` is already computed here
- `src/store/usePlanStore.ts`: `setBayFilter`, `setSidebarTab("check")`, `colorMode`, `paletteMode`, `playbackCount`
- `src/styles.css`: `.stage` rows `65% / 35%`, `.bayplan`

## Overview
- **Priority:** high.
- **Status:** done (2026-09-18).
- With no bay picked, the panel shows the whole ship as a SEACOS-style sheet: a colour legend on top, then every
  bay pair bow → stern (fore | aft odd sections), each with a header, marks and a footer. It has the same
  hover/select/place behaviour as the single-bay view.

## Key insights
- **Size:** at `cellPx = 10`, a BBC section (about 10 rows) is about 115 px wide, and a pair with its gap about
  245 px. 9 pairs ≈ 2 200 px, so the strip scrolls sideways (accepted with the odd-bay choice). Height: about
  13 tiers × 11.5 px + two stack lines + header/footer ≈ 230 px, which fits the ~315 px panel.
- **Scroll position must survive re-renders** (every placement changes the plan). Keep the strip element stable
  (keyed by vessel), and never re-key per plan.
- **Drill-in** is the pair header ("22 · 21|23"), never a cell, so one click never means two things. It calls
  `setBayFilter(22)`, which also filters 3D (today's behaviour). "← All bays" undoes both.
- **Problem dot** on the pair header: warning amber, error red. A click opens the Check tab and does not drill in.
- **PC marker:** a thin labelled bar above the deck block and/or below the hold block, over the width of the
  pair, with the item ids in its tooltip.
- **Footer:** `12×20' 8×40' · 184 t · 20 TEU free`.
- **Legend:** one line of chips from `colorLegend` for the current mode, with counts. It updates when the colour
  mode changes in the View tab.
- **Placing across the sheet:** with cargo in hand, the line "Placing DEMU0000021 (20') — outlined cells in any
  bay are valid." is shown, and the valid cells in every pair are outlined through the shared hook.
- **Performance:** BBC ≈ 1 500 positions × 2 sections ≈ 3 000 cells. Memoise `bayPairs` on (vessel, plan, report,
  playbackCount). Keep hover/select OUT of the memoised pair data, and give each cell a cheap render: colour,
  class and a couple of booleans. If hovering lags in the browser, move the highlight to a CSS class keyed by
  box id (`data-box` + a single style rule) instead of re-rendering cells.

## Requirements
- `BayOverview.tsx`: legend, the "placing" line, the horizontal strip of `BayPairCard`s.
- `BayPairCard.tsx`: header (drill button + problem dot), PC markers, `BayPairSheet` (phase 02) at `cellPx = 10`
  without numbers or tier labels, and the footer.
- `ColorLegend.tsx`: chips from `colorLegend`.
- `BayPlanView`: `bayFilter === null` → `<BayOverview>`; otherwise the detail view. `App.tsx` passes `report`.

## Related code files
- Create: `src/features/bayplan/BayOverview.tsx`, `BayPairCard.tsx`, `ColorLegend.tsx`
- Modify: `BayPlanView.tsx`, `App.tsx` (pass `report`), `styles.css` (`.bay-overview*`, `.pair-card*`, `.legend-chips`)

## Implementation steps
1. `ColorLegend` + `BayPairCard` + `BayOverview`.
2. Wire the null-bay branch and pass `report`.
3. CSS: horizontal scroll, the gap between pairs, a subtle bracket over each pair, and the × style at 10 px.
4. `npx tsc --noEmit` + suite.
5. Browser, both ships (bbc-sao-paulo, demo-horizon):
   - all pairs bow → stern; Σ footer counts = "placed" in the status strip;
   - the legend's counts sum to the placed boxes, and its colours match the cells; switching colour mode
     updates both;
   - pair header → the detail of that bay plus a 3D filter; "← All bays" → back, 3D unfiltered, and the scroll
     position kept;
   - hover a cell → the 3D box highlights; click → selected in 3D and in the sidebar inspector;
   - pick a 20' / a 40' → valid cells outlined in several pairs; click one → placed, and that pair's footer
     updates;
   - an overstow bay has an amber dot, and the dot opens the Check tab;
   - the demo blades show PC bars on the bays they span;
   - an over-limit stack is red in the overview's stack line (force one on a fixture plan if the demo has none);
   - hover responsiveness on BBC is acceptable (no visible lag);
   - screenshots for the user.

## Todo list
- [x] `ColorLegend`, `BayPairCard`, `BayOverview`
- [x] Null-bay branch + `report` prop + CSS
- [x] `npx tsc --noEmit` + suite green
- [x] Browser checks on both ships + screenshots

## Success criteria
- The whole ship's stow reads like a SEACOS/printed bay-plan sheet in one panel: every box, stack loads,
  problems and project cargo, with a legend.
- Everything the single-bay view can do works in the overview.

## Risk assessment
- **Horizontal scroll on large ships:** accepted with the odd-bay choice. Zoom was not requested (YAGNI). If
  needed later, it is a `cellPx` control.
- **Panel height on tall ships:** allow vertical scroll inside the strip rather than shrinking cells below 10 px.
- **Render cost:** see Key insights. Measure hover in the browser before optimising.

## Security considerations
None.

## Next steps
Close the plan. Possible follow-ups (not requested): zoom/fit, a resizable panel, the deck filter, cell text
(POD/weight) at higher zoom, print/export of the sheet, and a longitudinal profile view.
