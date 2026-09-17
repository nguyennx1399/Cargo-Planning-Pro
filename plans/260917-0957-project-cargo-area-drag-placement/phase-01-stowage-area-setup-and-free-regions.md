# Phase 01 — Stowage area setup + free regions + pose helpers

## Context Links

- Spec §4.6 (`freeRegionsFor`), §5 (data checklist): `plans/reports/confluence-260916-1647-drag-drop-stowage-placeholders-feature-plan.md`
- Existing model: `frontend/src/engine/stowage-model/{types,build-stowage-model,coords}.ts`
- Existing predicate: `frontend/src/engine/placement/can-place-breakbulk.ts`
- Spec→vessel derivation: `frontend/src/engine/vessel-spec/deck-layout-from-spec.ts`
- Prototype (verified in browser): `visuals/area-drag-prototype.html`

## Overview

- **Priority:** P2 · **Status:** planned · **Effort:** ~0.5 d
- Pure engine + docs. No UI. Answers "how do I set up the available area", and gives the UI layers the two pure functions they need: what to DRAW per area, and where a pointer position LANDS.

## Key Insights

- **Nothing new is needed to declare an area.** `buildStowageModel(vessel)` already returns `StowageArea[]` with `rect`, `keepOuts`, `surfaceY`, `maxHeight`, `loadRating`, `source`. BBC SAO PAULO yields 4 areas today (weather deck + Hold 2 tank top + Hold 2 aft main-deck level + Hold 1 tank top); MV Demo Horizon yields 1 generic weather deck.
- **`canPlaceBreakbulk(model, plan, item, pose, vessel)` already validates an arbitrary pose** — 7 rules, message-identical to the plan-wide report. Phase D adds no placement rule.
- **`usePlanDraftStore.placeBreakbulk/moveBreakbulk/unplaceBreakbulk` already exist** and already strip the subject's own placement before validating.
- The gap is only: (a) per-area DRAW data, (b) pointer→pose arithmetic, (c) the UI.
- **Snap/clamp order is load-bearing** (D-P1) — the prototype produced a silent 0.15 m out-of-area placement with the naive order.

### How an "available area" is set up (the documented path)

```
frontend/src/data/vessel-specs/<vessel>.stowage.json
  cargo_spaces[]  { id, label, level: weather_deck|tweendeck|tank_top, hold?,
                    x_aft_m, x_fwd_m, width_m, center_z_m?,
                    surface_above_baseline_m, clear_height_m, max_load_t_per_m2, provenance }
  obstructions[]  { id, label, kind, x_aft_m, x_fwd_m, z_min_m, z_max_m, levels[] }
        │
        ├─ deckLayoutFromSpec()  → vessel.breakbulk_deck   (weather-deck envelope + keep-outs)
        └─ holdAreasFromSpec()   → vessel.breakbulk_holds[] (one per level+hold+surface height)
        │
        └─ buildStowageModel(vessel) → StowageArea { rect, keepOuts, surfaceY, maxHeight, loadRating, source }
```

No vessel spec → generic fallback: 15 %/85 % LOA × (beam − 1.5 m each side), `surfaceY = LAYOUT.hatchHeight`, no keep-outs, `source: "generic"` (badge + warning, D4). Onboarding a vessel = writing JSON, never code.

## Requirements

**Functional**
1. `freeRegionsFor(vessel, plan, item)` → one entry per area: the area, `feasible` + first blocking reason when not, keep-out rects **clipped to the area rect**, occupied rects (breakbulk placements + container stacks from `containerOccupancy`).
2. `clampPoseToArea(area, item, pose)` → snap 0.5 m, then clamp into grid-rounded inward bounds; return the pose unchanged when the item cannot fit the area at that rotation.
3. `poseFromScenePoint(vessel, areaId, sceneX, sceneZ, rotation)` → `BreakbulkPose`, via `sceneXToPlacementX` only (never a hand-rolled offset).
4. Area feasibility is the item-vs-area part of `canPlaceBreakbulk` only (height, pressure, does the footprint fit at all) — never a second rule set.

**Non-functional**
- Pure modules: no react/three/zustand imports. Node-env vitest tests only (repo decision).
- `freeRegionsFor` is a per-gesture call (memoised at the call site), not per pointer move.

## Architecture

- `engine/placement/placeholders.ts` gains `freeRegionsFor` + `FreeRegion` (sibling of `validSlotsFor`, same "one predicate, two shapes" rule).
- **New** `engine/placement/breakbulk-pose.ts` — `snapPose`, `clampPoseToArea`, `poseFromScenePoint`, `rotationNext` (0↔90). Kept out of `coords.ts`, which stays pure geometry with no item/area semantics.
- Keep-out clipping helper lives next to `rectFromCenter` in `stowage-model/coords.ts` (`clipRect`).

## Related Code Files

**Modify:** `engine/placement/placeholders.ts`, `engine/stowage-model/coords.ts`
**Create:** `engine/placement/breakbulk-pose.ts`, `engine/placement/__tests__/breakbulk-pose.test.ts`, `engine/placement/__tests__/free-regions.test.ts`
**Delete:** none (the `breakbulk-deck-area.ts` shim dies in Phase E)

## Implementation Steps

1. Add `clipRect(inner, outer): Rect | null` to `coords.ts` + test (touching edges → null).
2. Create `breakbulk-pose.ts`:
   - `snapPose(pose, step = 0.5)`;
   - `clampPoseToArea(area, item, pose)` — bail (return pose) when `area.rect` is smaller than the rotated extent; else `lo = ceil((min+half)/step)*step`, `hi = floor((max-half)/step)*step`, clamp the **snapped** centre into `[lo, hi]`;
   - `poseFromScenePoint(...)` using `sceneXToPlacementX`;
   - `rotationNext(deg)` → `deg === 90 ? 0 : 90` (D-P3).
3. Add `FreeRegion` + `freeRegionsFor` to `placeholders.ts`; reuse `containerOccupancy` through the existing `occupancyFor` cache pattern; clip keep-outs with `clipRect`.
4. Tests:
   - the D-P1 regression: 6.5 m wide item, `z ∈ [−9.1, 9.1]`, pointer at −6.0 → clamped pose's footprint is inside the rect (this fails with clamp-then-snap);
   - an item longer than the area is returned unclamped and `canPlaceBreakbulk` refuses it with `breakbulk_out_of_deck_area`;
   - rotation 90 swaps which bound clamps;
   - `freeRegionsFor` on BBC: 4 regions; a 62 m blade is `feasible` on the weather deck and infeasible in Hold 1 tank top; keep-outs outside the rect are dropped;
   - occupied rects include a container stack (loaded plan) and a placed breakbulk item.
5. `npm run typecheck && npm test`.

## Todo List

- [x] `clipRect` + test
- [x] `breakbulk-pose.ts` (snap, clamp, pose-from-scene, rotationNext)
- [x] D-P1 regression test
- [x] `freeRegionsFor` + `FreeRegion`
- [x] free-regions tests (BBC + demo vessel)
- [x] typecheck + full suite green (baseline was 586, not 541: `Tests 608 passed (608)`, +22 new)

## Implementation Status (2026-09-17, complete)

- Shipped as specified. `Tests 608 passed (608)`, `Test Files 77 passed` (`src/**`; the 30 `.claude/**` file failures are pre-existing — `vite.config.ts` has no `test` block). Typecheck clean.
- `freeRegionsFor`'s `feasible` selects the item-vs-AREA rules (`breakbulk_out_of_deck_area`/`breakbulk_too_tall`/`breakbulk_over_pressure`) OUT of `canPlaceBreakbulk`'s reasons — projection, not a second rule set — because a single centre-pose probe would wrongly mark BBC's weather deck infeasible (a container stack sits under that pose).
- Extra guard beyond the plan's formula: when the grid-rounded bounds cross (a rect that is not a whole number of steps across), the pose is returned unchanged like the oversized case, instead of clamping to `hi` and moving an already-valid pose out of the area.
- `previewPlan` was generalised to take a subject id so a project-cargo subject gets the same own-placement strip as a container; the untouched placements list keeps its array identity (occupancy cache).

## Success Criteria

- Every new function is pure and covered; suite green with no change to existing counts other than additions.
- `freeRegionsFor` never re-implements a rule: feasibility comes from `canPlaceBreakbulk`.
- No behaviour change anywhere in the app (no UI consumes this yet).

## Risk Assessment

| Risk | Mitigation |
|---|---|
| Clamp maths drifts from the predicate's `EDGE_TOLERANCE_M` | Clamp inward, never outward; assert the clamped footprint passes the predicate |
| `freeRegionsFor` called per pointer move | Documented in the module header like `validSlotsFor`; call sites memoise |
| Envelope rect includes unusable deck (open question 1) | Out of scope here — data fidelity, not a code bug |

## Security Considerations

None — pure client-side geometry, no I/O, no user input beyond pointer coordinates.

## Next Steps

Phase 02 consumes `freeRegionsFor` (drawing) and `breakbulk-pose.ts` (pointer→pose).
