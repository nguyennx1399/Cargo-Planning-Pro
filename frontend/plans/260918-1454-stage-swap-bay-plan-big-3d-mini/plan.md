# Swap the stage: bay plan big, 3D as a corner mini-view

## Ask (user, 2026-09-18)

"Switch the 3D preview with the plan section, to display it bigger, with bay detail."

## Decisions (user, 2026-09-18)

| Topic | Decision |
|---|---|
| Layouts | Two. **Normal:** 3D big, bay plan below (today). **Swapped:** the bay plan fills the stage, and 3D becomes a **corner mini-view**. |
| Switching | A **swap button**, or a **click on the mini-view**, switches back. The choice is remembered. |
| Big bay plan | **Overview + bay detail together:** the all-bay overview on top, the selected bay's detail below. No drill-in needed. |
| Cell text | **Yes:** in big cells, print the POD and weight inside the cell (SEACOS info-area style); the colour stays. |

## Where the code stands (verified)

- `App.tsx`: `.stage` holds `.viewport` (VesselScene + DropVerdictChip) and `.bayplan` (BayPlanView);
  `.stage { grid-template-rows: minmax(220px, 65%) minmax(160px, 35%) }`.
- The R3F `<Canvas>` is inside `VesselScene`. **Moving it in the React tree remounts it**, which loses the camera
  and reloads the hull. The swap must therefore be CSS-only: the same JSX, a class on `.stage`.
- `BayPlanView` (all-bay overview plan): `bayFilter === null` → overview, otherwise the detail with "← All bays".
  `bayFilter` also filters 3D.
- Cell sizes are constants: overview 10 px, detail 14 px. Cells have no text (colour + tooltip). Hover/selection
  are painted by `SheetHighlight` (CSS on `data-box`, overriding `--c`).
- The "Vessel onboarding (L2 import)" button floats top-right over the layout, so the big plan's header must leave
  that corner free.
- Nothing in `src` uses `localStorage` yet.

## Phases

| # | Phase | Status | Priority |
|---|-------|--------|----------|
| 01 | [Stage layout swap, canvas kept mounted](phase-01-stage-layout-swap.md) | done | high |
| 02 | [Big bay plan: overview + detail together](phase-02-big-bay-plan-overview-and-detail.md) | done | high |
| 03 | [POD + weight text in big cells](phase-03-cell-text-pod-weight.md) | done | medium |

The order matters: 01 → 02 → 03. Each phase is usable on its own.

## Ground rules

- **The canvas never remounts.** The swap is a class change; the browser check confirms the same `<canvas>`
  element before and after.
- **One sheet component.** The big view reuses `BayPairSheet`/`BayOverview` at other sizes; no second renderer.
- **Normal layout unchanged:** in the normal layout the bay plan behaves exactly as it does today (overview ↔
  drill-in, 10/14 px cells).
- Files under 200 LOC, pure pieces node-tested, `npx tsc --noEmit` (never `tsc -b`).

## Result (2026-09-18)

All 3 phases are done. The suite is 104 files / 825 tests (+10 tests), and `tsc --noEmit` is clean.

**Verified in the browser (BBC SAO PAULO, 1440 × 900):**
- **Swap:** the canvas element is the same object before and after, both ways; the mini-view is 320 × 200 and
  renders; a click on the mini-view returns to 3D at full size.
- **Remembered:** the choice survives a reload (`cpp.stageLayout`).
- **Big layout:** the overview at 14 px (34 stack-tonne cells printed) with the detail below at 28 px (47 POD + weight
  cells, no text on ×).
  - A header click shows the bay below, and the tooltip reads "Show bay 26 below".
  - `]` / `[` step the detail, and the card scrolls into view both ways.
  - ✕ clears it.
- **Text ink:** white on dark weight cells, dark on the yellow selection.
- **Normal layout unchanged:** drill-in, 14 px, no text.
- No console errors while swapping and selecting (a "hooks order" error seen earlier was left over from hot reload
  and did not recur after a clean reload with a fresh error capture).

### Deviations from the phase files
- The layout lives in its own tiny store `store/stage-layout-store.ts` (not a `usePlanStore` field, which is at
  184 lines). `store/view-prefs-storage.ts` is a generic try/catch pref helper that the right-sidebar plan can
  reuse.
- `BayOverview` got an explicit `detailBelow` prop (the header wording), and the placing/notice lines stay with the
  overview in the big layout.
- `.bayplan-big .bay-overview-top` got `min-height: 34px` so the bay cards start below the floating "Vessel onboarding"
  button (measured: the strip top is at 48 px, the button bottom at 40 px).

### Open
- The 3D canvas takes a few seconds to size after a reload (it reads 300 × 150 first). This was seen in both
  layouts and predates this plan; not investigated.
