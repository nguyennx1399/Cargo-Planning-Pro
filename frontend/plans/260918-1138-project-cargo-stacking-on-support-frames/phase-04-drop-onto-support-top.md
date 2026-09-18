# Phase 04 — Drop onto a support's top

## Context links
- [phase-02](phase-02-stacking-rules-in-can-place-breakbulk.md): `pose.onCargoId`
- `src/features/viewer3d/AreaDropPlane.tsx`: mounted while a breakbulk item is in hand; one volume per area;
  `poseAt(e)` → `clampPoseToArea` → `setHoveredPose`; the click → `commitBreakbulkPlacement`
- `src/engine/placement/breakbulk-pose.ts`: `poseFromScenePoint`, `clampPoseToArea`
- `src/store/hand-slice.ts`: `hoveredPose`, `clearHoveredPose(areaId)`, `poseTarget`
- `src/store/usePlanDraftStore.ts`: `breakbulkPlacementOf(cargoId, pose)`
- `src/features/viewer3d/DropVerdictChip.tsx`: `verdictForPose`
- `src/features/viewer3d/press-ownership.ts`: the drop layers must not stop cargo-in-front routing

## Overview
- **Priority:** high. This is the phase that makes stacking usable.
- **Status:** done (2026-09-18).
- With a project-cargo item in hand, the top of every placed STACKABLE item becomes a drop surface. Aim at
  it, and the ghost sits on top, the verdict chip judges the stack, and a click or release commits it with
  `on_cargo_id`.

## Key insights
- It is a second kind of drop surface, not a second commit path. `SupportTopDropPlanes` publishes the
  same `hoveredPose` (now with `onCargoId`), and the same `commitBreakbulkPlacement` commits it.
- **Nearest surface wins.** A support's top is above the area floor, so along the view ray it is hit
  BEFORE the floor volume under it. R3F dispatches nearest first, so the top's handler runs first and
  `stopPropagation` keeps the floor from overwriting the pose. The floor keeps working everywhere the ray
  misses a top.
- **Clamp to the support, not the area.** Clamping the pointer into the support's top rect makes the ghost
  snap fully onto the item. Aiming near the edge then gives a supported pose instead of an overhang error.
  If the item is larger than the top, the clamp centres it, and `breakbulk_unsupported` refuses it with a
  reason. The limit itself is never relaxed.
- Exclude the item in hand and everything resting on it, so nothing can be dropped onto itself.
- `clearHoveredPose(areaId)` is keyed by area. A top surface clears with its support's area id, so moving
  from a top to the floor of the same area cannot blink the ghost off. The top's `onPointerOut` has to clear
  only if the current pose's `onCargoId` is its own.

## Requirements
- A top surface per placed item where `cargo.stacking` is present, visible under the deck toggles, and
  neither the hand item nor a dependent of it: a thin invisible box at
  `cargoBaseHeight + elevationOf + height_m`, size = footprint (rotation-aware).
- `poseOnSupport(support, item, scenePoint, rotation)` in `breakbulk-pose.ts`: `areaId` = the support's
  area, `onCargoId` = the support id, x/z clamped into the top rect.
- `breakbulkPlacementOf` copies `onCargoId` → `on_cargo_id`, and the ghost's `placementOfPose` does too.
- The verdict chip needs no change (it calls the predicate). Check that its wording reads well for the
  three new rules.
- R (rotate) re-clamps to the support's rect, the same way `AreaDropPlane` re-clamps to the area.

## Related code files
- Create: `src/features/viewer3d/SupportTopDropPlanes.tsx`
- Modify: `breakbulk-pose.ts` (`poseOnSupport` + test), `usePlanDraftStore.ts` (`breakbulkPlacementOf`),
  `GhostBreakbulkPreview.tsx`, `VesselScene.tsx` (mount next to `AreaDropPlane`, same hand gate), and the
  `BreakbulkPose` doc
- Tests: `poseOnSupport` clamp (inside, at the edge, larger than the top → centred); draft store round-trips
  `on_cargo_id`; commit → plan has the stack; move the top item back to the floor → `on_cargo_id` is gone

## Implementation steps
1. `poseOnSupport` + tests.
2. `breakbulkPlacementOf` / `placementOfPose` carry the support. `putBreakbulk` strips the old placement,
   so a move from a top to the floor drops `on_cargo_id` naturally. Add a test.
3. `SupportTopDropPlanes.tsx`: pointer move → `setHoveredPose(poseOnSupport(...))`; click → commit;
   out → the guarded clear; R re-clamp effect.
4. Mount it in `VesselScene`, gated like `AreaDropPlane`.
5. Browser (BBC SAO PAULO): add a frame (phase 05, or a test item with `stacking`), place it on the hatch
   covers, pick a blade, hover the frame's top → the ghost sits on the frame, green; commit → the stack
   renders and the Check tab is clean; hover a heavy item → red "max top load"; aim at the edge → the
   ghost stays fully on top; move the blade off → the frame is liftable again.

## Todo list
- [x] Clamp onto a top: `clampPoseToArea` now takes any `{ rect }` (no separate `poseOnSupport`) + tests
- [x] Placement carries `on_cargo_id` (+ round-trip test)
- [x] ~~`SupportTopDropPlanes`~~ replaced by top-surface probes in `AreaDropPlane` (see plan.md Deviations)
- [x] `AreaDropPlane` receives `plan` (VesselScene)
- [x] typecheck + suite green
- [x] Browser: stack, overload refusal, floor beside the frame. Edge clamp and 3-high by drag: unit tests only

## Success criteria
- A planner can build a 3-high stack by drag or by click-to-place, and every refusal shows its reason
  before the release.

## Risk assessment
- **Pose flicker between the top and the floor** at a support's edge: nearest-first dispatch and the
  guarded out-clear handle it. Verify in the browser at a grazing camera angle.
- **Many stackable items → many surfaces:** a few dozen meshes at most, which is fine (the same budget as
  `BreakbulkCargoInstances`).

## Security considerations
None.

## Next steps
Phase 05 (if not already done).
