# Phase 03 — Render, stability, lift guard at real height

## Context links
- [phase-01](phase-01-stack-model-and-geometry-engine.md): `elevationOf`, `dependentsOf`
- `src/engine/cargo/breakbulk-mesh-builder.ts`: `deckY = cargoBaseHeight(vessel, area_id)`
- `src/features/viewer3d/GhostBreakbulkPreview.tsx`: builds the ghost from `placementOfPose`
- `src/lib/breakbulk-weight-item.ts`: `kg_m = depth + cargoBaseHeight + kg_above_base`
- `src/features/viewer3d/BreakbulkCargoInstances.tsx`: press → `setHand`, click → `cargoClickAction`, `CATEGORY_COLOR`
- `src/features/panels/UnplacedProjectCargoList.tsx`, `src/store/usePlanDraftStore.ts` (`unplaceBreakbulk`)
- Precedent: `src/store/begin-container-move.ts` (`canBeginContainerMove`) + `engine/placement/support-dependents.ts`

## Overview
- **Priority:** high.
- **Status:** done (2026-09-18).
- Draws each item at its real height, feeds stability the real VCG, gives frames a look, and refuses to
  lift or unplace an item that is carrying others, the same rule containers follow.

## Key insights
- One height source: `restingY = cargoBaseHeight(area) + elevationOf(plan, id)`. The mesh builder takes the
  base Y as an argument instead of computing it, so the ghost can pass the height of the support under
  the pointer.
- Stability matters most here. A 3-high stack raises its VCG by metres, and `kg_m` has to include the
  elevation or GM will read optimistic.
- Lifting a support would leave items floating. Containers refuse this with a stated reason, so project
  cargo does the same: only the TOP of a stack can be lifted. `unplaceBreakbulk` and removing custom cargo
  follow the same guard.

## Requirements
- `buildBreakbulkMesh(item, placement, vessel, baseY)`: callers pass `baseY`.
  `BreakbulkCargoInstances` passes `cargoBaseHeight + elevationOf`, and the ghost passes the value for
  its pose's support (phase 04 supplies `onCargoId`. Until then elevation is 0).
- `breakbulkWeightItem`: `kg_m` includes the elevation (it takes the plan, or the elevation as a parameter).
- `support_frame` colour + look: a darker steel colour (`#5B6770`). The shape stays a box at L × W × H
  (YAGNI: no lattice geometry).
- `canBeginBreakbulkMove(plan, id)` in `store/begin-breakbulk-move.ts`: false with the reason
  "`${id}` carries `${n}` item(s) — lift those first" when `dependentsOf` is not empty. It is used by the
  scene press, the scene 2nd-click pick, the list, and `unplaceBreakbulk`/remove, and the reason is
  recorded the way containers record theirs.

## Related code files
- Modify: `breakbulk-mesh-builder.ts`, `BreakbulkCargoInstances.tsx`, `GhostBreakbulkPreview.tsx`,
  `breakbulk-weight-item.ts`, `UnplacedProjectCargoList.tsx`, `usePlanDraftStore.ts` (unplace guard)
- Create: `src/store/begin-breakbulk-move.ts` + test
- Tests: weight item VCG with elevation; lift guard (top ok, carrier refused, reason text)

## Implementation steps
1. Mesh builder signature + both callers.
2. Stability `kg_m` + test: an item 2.5 m up raises `kg_m` by 2.5 m.
3. Frame colour.
4. `canBeginBreakbulkMove` + wire it into the press, the pick, the list, unplace and remove. Read how
   `canBeginContainerMove` records its refusal and copy that path.
5. Browser, with a hand-built stacked plan (a dev-console `loadPlan` or a test fixture): the stack draws
   at the right heights, lifting the bottom item is refused with its reason, lifting the top works, and the
   stability panel's VCG goes up versus the same items on the floor.

## Todo list
- [x] Mesh builder optional `elevationM` + callers
- [x] Stability elevation + test
- [x] Frame colour
- [x] Lift/unplace/remove guard + test
- [x] typecheck + suite green
- [x] Browser: stack drawn at height, Delete on the carrier refused with its reason. Stability VCG: unit test only

## Success criteria
- Stacks render at the heights the rules use.
- There is no way to leave an item floating through lift, unplace or remove.

## Risk assessment
- **"Clear project cargo"** removes everything at once, so no guard is needed. Confirm it does not route
  through the per-item guard.
- **Undo** restores whole plans, so it cannot create a floating item.

## Security considerations
None.

## Next steps
Phase 04.
