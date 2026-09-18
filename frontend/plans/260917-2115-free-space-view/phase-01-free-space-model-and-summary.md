# Phase 01 — The free-space model and its summary line

## Context links

- `src/engine/stowage-model/build-stowage-model.ts` — `model.slots`, `model.areas`
- `src/engine/stowage-model/occupancy.ts` — `occupiedRectsByArea`, `breakbulkOccupancy`
- `src/engine/placement/placeholders.ts` — `freeRegionsFor` (per item; the source of `occupied`/`keepOuts`)
- `src/features/viewer3d/EmptySlotPicker.tsx` — how empty slots are derived today (`model.slots` minus placements)
- `src/lib/drop-verdict.ts` — `slotVisible` / `areaVisible`, the viewer's own visibility rule

## Overview

- **Priority:** high — everything else in this plan renders what this produces.
- **Status:** implemented and cross-checked (2026-09-17).
- One pure function that answers "what is still free on this vessel", plus the sentence that reports it.

## Key insights

- **Occupancy already has ONE definition.** `occupiedRectsByArea` gives container-stack footprints per
  area and `breakbulkOccupancy` gives placed project-cargo footprints, both without an item in hand.
  This phase must call them, not re-fold `plan.placements` — the repo has paid for duplicate occupancy
  folds already (the review's M2 finding, and the `cell-occupancy.ts` extraction that followed).
- **Empty slots are trivially derivable** — `model.slots` minus the slots in `plan.placements`. The
  subtlety is 20'/40': an empty 40' cell and its two 20' halves are the SAME physical space listed three
  times in `model.slots`. Counting raw empty slots would over-report capacity by roughly 2×. Count TEU
  from the 40'-bay cells and say TEU, or count "cells" per bay parity — decide it in the code and state
  it in the header, because a wrong capacity number is worse than none.
- **Area free-ground is an AREA MINUS OBSTACLES figure**, not a packing answer: `area.rect` area minus
  the union of clipped keep-outs and occupied rects. The rects can OVERLAP each other (two stacks
  touching, a keep-out under a stack), so summing their areas double-counts. Either subtract a union
  (needs rect-union area, which is a small sweep) or state the figure as approximate. Do not pretend
  precision that is not there.
- **Nothing here is a promise.** The moment a number implies "you can load 40 more TEU", it will be
  wrong: stack weight, clear height, plugs, parity and overstow all bite per item. Wording is part of
  the deliverable, not decoration.

## Requirements

**Functional**

1. A pure function reports, for the current vessel + plan:
   - empty container capacity, split on deck / under deck, in a unit that does not double-count
     20'/40' (TEU);
   - per stowage area: total ground area, occupied/keep-out ground, and free ground;
   - counts: how many project-cargo items are placed, how many are still unplaced.
2. A summary sentence for the panel, built from that report, worded as "space left" not "you can load".
3. The figures respect the deck toggles and the bay filter when the caller asks them to — the same
   `slotVisible` / `areaVisible` rule the drawn layers use.

**Non-functional**

- Pure module, node-testable, no three/react imports.
- One pass over `model.slots` and one occupancy call; this runs per plan mutation, not per frame.

## Architecture

New pure module `src/engine/free-space.ts`:

```ts
export interface AreaFreeSpace {
  areaId: string;
  label: string;
  totalM2: number;
  takenM2: number;   // occupied + keep-out, union-corrected (see below)
  freeM2: number;
}

export interface FreeSpaceReport {
  teuOnDeck: number;
  teuUnderDeck: number;
  emptyCellsOnDeck: number;    // 40'-bay cells, the unit `allSlots` uses
  emptyCellsUnderDeck: number;
  areas: AreaFreeSpace[];
  projectCargoPlaced: number;
  projectCargoUnplaced: number;
}

export function freeSpaceReport(vessel: Vessel, plan: StowagePlan, view?: SlotViewFilter): FreeSpaceReport;
```

- **Cells, not raw slots.** Iterate the 40'-bay cells (the same grid `engine/all-slots.ts` produces) and
  call a cell empty when neither it nor its two 20' halves is occupied. TEU = empty 40' cells × 2, minus
  cells where only one half is free (those are 1 TEU). Write the rule down in the header; it is the one
  place this report can be quietly wrong.
- **Union-corrected ground.** Add a small `rectUnionArea(rects: Rect[]): number` helper beside the
  existing rect utilities — a sweep over x-edges summing covered z-extents. ~30 lines, pure, and it
  removes the double-count. If that proves fiddly, the honest fallback is to report free ground as a
  RANGE or omit the number and keep the picture; do not ship a silently double-counted figure.

Wording lives in `src/lib/free-space-text.ts` (the codebase keeps sentences out of components — see
`area-fit-hint.ts`):

```ts
export function freeSpaceSummary(report: FreeSpaceReport): string;
// e.g. "Space left: 148 TEU (96 on deck · 52 under deck) · weather deck 310 m² of 1 240 m² free"
```

## Related code files

**Create**
- `src/engine/free-space.ts` + test
- `src/lib/free-space-text.ts` + test
- `src/engine/rect-union-area.ts` (or extend an existing rect module if one fits) + test

**Modify**
- `src/features/panels/ViewOptionsPanel.tsx` or the Checks section — wherever the summary line lands
  (decide in phase 02 with the button placement, so the two ship together)

**Delete** — none.

## Implementation steps

1. `rectUnionArea` + tests: disjoint rects sum; overlapping rects do not double-count; touching edges;
   fully contained rect.
2. `free-space.ts` + tests, on both vessels: empty ship (free = total), fully loaded demo plan (free
   shrinks by the placed footprints), TEU counting with 20' halves, deck split, the bay filter applied.
3. `free-space-text.ts` + test pinning the sentence, including the zero case ("no space left").
4. `npm run typecheck`, `npx vitest run src/`.

## Todo list

- [x] `rectUnionArea` (+ `rectArea`) — **tests deferred** (`--not-test`)
- [x] `free-space.ts` — tests deferred
- [x] `free-space-text.ts` (+ `FREE_SPACE_CAVEAT`) — tests deferred
- [x] typecheck clean; existing suite green (91 files / 719 tests)

### Cross-checked rather than trusted

The 20'/40' double-count trap was the headline risk, so the figure was verified against an independent
count via a throwaway probe (deleted immediately — no test was added):

```
fortyCells 447 · capacity 894 TEU · halves taken 220 (110 forty-foot boxes) · expected free 674
reported 674  ✓
```

Live summary on the loaded BBC demo plan: *"Space left: 674 TEU (326 on deck · 348 under deck) ·
weather deck 789 m² of 2 243 m² free · Hold 2 tank top 284 m² of 1 425 m² free"*, with the caveat line
under it.

**Debt:** five new pure functions (`rectUnionArea`, `rectArea`, `freeSpaceReport`, `freeSpaceSummary`,
plus the cells fold) have no unit tests. `rectUnionArea` is the one that most deserves them — its sweep
is the only non-obvious algorithm in this plan.

## Success criteria

- On an empty ship the report's free ground equals each area's own rect area.
- On the loaded demo plan the figures drop by the placed footprints and never go negative.
- TEU never double-counts a 40' cell and its halves.
- Every sentence reads as space remaining, never as permission to load.

## Risk assessment

| Risk | Mitigation |
|---|---|
| 20'/40' double counting inflates capacity ~2× | Count 40'-bay CELLS, convert to TEU explicitly; a test pins a mixed 20'/40' plan |
| Overlapping rects double-count taken ground | `rectUnionArea`; fallback is to omit the number rather than ship a wrong one |
| The number reads as "you can load this" | Wording is a deliverable with its own test |
| A second occupancy implementation | Call `occupiedRectsByArea` / `breakbulkOccupancy`; do not fold placements here |

## Security considerations

None — read-only over local state.

## Next steps

Phase 02 renders this and adds the toggle.
