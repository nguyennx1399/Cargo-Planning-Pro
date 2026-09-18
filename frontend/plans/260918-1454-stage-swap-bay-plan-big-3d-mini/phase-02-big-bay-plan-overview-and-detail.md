# Phase 02 — Big bay plan: overview + detail together

## Context links
- [phase-01](phase-01-stage-layout-swap.md): `stageLayout`
- `src/features/bayplan/BayPlanView.tsx`: overview ↔ detail branch on `bayFilter`
- `src/features/bayplan/BayOverview.tsx`, `BayPairCard.tsx` (`OVERVIEW_CELL_PX = 10`), `BayPairSheet.tsx`
  (`detailed`), `SheetStrips.tsx` (stack tonnes only when `numbers`)
- `src/store/usePlanStore.ts`: `bayFilter` (also filters 3D)

## Overview
- **Priority:** high.
- **Status:** done (2026-09-18).
- In the "plan" layout, `BayPlanView` shows the overview (larger cells) on top and the selected bay's detail
  (much larger cells) below it. Picking a bay no longer navigates away. The normal layout is unchanged.

## Key insights
- **One mode flag.** `BayPlanView` reads `stageLayout`:
  - "3d" → today's compact behaviour;
  - "plan" → both overview and detail.
  The sizes are constants in one place:
  ```ts
  const SIZES = { compact: { overview: 10, detail: 14 }, big: { overview: 14, detail: 28 } };
  ```
- **The bay header means "show its detail"** in the big view (`setBayFilter(bay)`), and the overview stays. The
  selected card is highlighted (`aria-current`). In the compact view it still drills in. The same button is used,
  and the view decides what it means.
- **Detail placeholder** when no bay is selected: "Click a bay number above to see its detail." A small "✕"
  clears the selection (`setBayFilter(null)`), which also unfilters the mini 3D.
- **Overview numbers:** at 14 px the stack rows fit two digits, so `numbers` becomes `cellPx >= 14` instead of
  `detailed`. The compact overview (10 px) keeps the tint. This answers the earlier open question for the big view.
- **Height budget (1440 × 900, stage ≈ 900 px):** overview at 14 px ≈ 290 px, detail at 28 px ≈ 480 px, plus the
  legend and headers ≈ 60 px, so about 830 px fits. Shorter screens scroll inside the panel.
- **Scroll:** the overview strip keeps its per-vessel scroll memory. Selecting a bay also scrolls its card into
  view (`scrollIntoView({ inline: "nearest" })`) when it was picked from elsewhere (sidebar, `[` / `]` keys).

## Requirements
- `BayPlanView`: a `big` branch rendering `<BayOverview cellPx=14 selectedBay>` + `<BayDetail cellPx=28>`
  (extract today's detail JSX into `BayDetail.tsx`; the compact branch reuses it at 14 px with "← All bays").
- `BayOverview`/`BayPairCard`: `cellPx` and `selected` props; the header's action chosen by the caller (drill vs select).
- `SheetStrips`: `numbers` is decided by the caller from `cellPx`.
- CSS: `.bayplan-big` (a two-row grid: overview auto, detail 1fr, scroll), `.pair-card-selected`.

## Related code files
- Create: `src/features/bayplan/BayDetail.tsx`, `src/features/bayplan/bay-plan-sizes.ts`
- Modify: `BayPlanView.tsx`, `BayOverview.tsx`, `BayPairCard.tsx`, `BayPairSheet.tsx` (`numbers` prop), `styles.css`

## Implementation steps
1. `bay-plan-sizes.ts` + `BayDetail.tsx` extracted; the compact behaviour stays byte-identical.
2. The big branch in `BayPlanView`; the header action and selected state in cards.
3. `scrollIntoView` for an externally selected bay.
4. `npx tsc --noEmit` + suite.
5. Browser, both ships, "plan" layout:
   - overview + detail visible together; a bay header → detail below, and the mini 3D filters to that bay;
   - ✕ → the detail placeholder, and 3D unfiltered;
   - `[` / `]` step bays → the detail follows, and the card scrolls into view;
   - hover/select/place work in both the overview and the detail (the same interaction object);
   - stack tonnes readable in the 14 px overview;
   - the normal layout is unchanged (drill-in, 10/14 px).

## Todo list
- [x] Sizes module + `BayDetail` extraction
- [x] Big branch, header action, selected card
- [x] scrollIntoView on external selection
- [x] `npx tsc --noEmit` + suite green
- [x] Browser checks on both ships

## Success criteria
- In the plan layout, the planner sees the whole ship and one bay in detail at the same time, and working in either
  works everywhere.

## Risk assessment
- **Render cost** at 14 px: the same cell count as the compact overview (only bigger), plus one detail pair. The
  highlight is already CSS-only, so this is fine.
- **The meaning of the header click differs by layout:** each tooltip says what it does ("Show bay 22 below" vs
  "Open bay 22").

## Security considerations
None.

## Next steps
Phase 03.
