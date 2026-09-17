# Phase 02 — Area placeholders, drop plane, breakbulk ghost

## Context Links

- Spec §6 (UX flow), §7 Phase D
- Container equivalents to mirror: `frontend/src/features/viewer3d/{SlotPlaceholders,EmptySlotPicker,GhostContainerPreview}.tsx`
- Verdict plumbing: `frontend/src/lib/drop-verdict.ts`, `frontend/src/features/viewer3d/DropVerdictChip.tsx`
- Mesh builder: `frontend/src/engine/cargo/breakbulk-mesh-builder.ts`
- Prototype with all three layers working: `visuals/area-drag-prototype.html`

## Overview

- **Priority:** P2 · **Status:** IMPLEMENTED 2026-09-17 (working tree, uncommitted) · **Effort:** ~1 d
- The three 3D layers that make an area a drop target: what it looks like, what the pointer hits, and what the drop would do.

## Key Insights

- **`material.visible = false` keeps a mesh raycastable** while invisible — the trick `EmptySlotPicker` uses; the drop plane needs it too (`object.visible = false` would be skipped by the raycaster).
- The **drop plane is a plane, not a volume**: unlike container slots there is nothing to disambiguate, so `nearestSlotIndex`-style resolution is not needed. The pointer's crossing of the area's `surfaceY` plane IS the answer.
- **One predicate call per pointer move.** Ghost, chip and sidebar must read one memoised `verdictForPose` (same one-entry memo as `verdictForSlot`, review M4) or the predicate runs 3× per move.
- Areas can **overlap vertically** (hatch cover above a tank top): mount only the planes whose area passes the deck toggles, so the visible layer and the pickable layer are the same set — the Phase C `slotVisible` rule, applied to areas.
- Hull hides itself while placing under deck (D-P5) — verified in the prototype; without it the shell plating sits between camera and tank top.
- Keep-outs must be clipped for drawing (D-P4) — BBC's crane foundations sit partly outboard of the usable rect.

## Requirements

**Functional**
1. Each visible feasible area: translucent green fill + outline at `surfaceY + 0.02`, keep-outs hatched grey, occupied rects dark, a label (`"weather deck · 4 t/m²"`, `"Hold 2 tank top · clear 14.6 m"`).
2. Infeasible areas for the item in hand: faint red + first reason (`"blade 62 m: 4.5 m tall exceeds the 3.9 m clear height"`).
3. One invisible pickable plane per visible area, sized to `area.rect`, positioned at `surfaceY`, carrying `areaId`.
4. Ghost = `buildBreakbulkMesh(item, placementOf(pose), vessel)` tinted green/amber/red by `DROP_TINT`; never steals the pick (`raycast={() => null}`).
5. `verdictForPose(vessel, plan, item, pose)` mirrors `verdictForSlot`: `{verdict, message}` from `canPlaceBreakbulk`, memoised one entry.
6. Area layers hidden entirely when nothing is in hand (idle scene is unchanged from today).

**Non-functional**
- Each new component ≤ ~120 LOC (200-LOC rule); no new deps.
- No UI-local placement rule anywhere in this phase.

## Architecture

```
usePlanStore (Phase 03)         engine (Phase 01)
   inHand {kind:"breakbulk"}  ──► freeRegionsFor ──► AreaPlaceholders  (draw)
   hoveredPose                                      AreaDropPlane     (pick → pose)
        ▲                                           GhostBreakbulkPreview (tint)
        └──── pointer move ◄── AreaDropPlane ──► clampPoseToArea ──► verdictForPose
```

Phase 02 builds the right-hand column against a temporary local `useState` hand; Phase 03 swaps that for the store. (Keeps this phase reviewable on its own and the store refactor isolated.)

## Related Code Files

**Create:** `features/viewer3d/AreaPlaceholders.tsx`, `features/viewer3d/AreaDropPlane.tsx`, `features/viewer3d/GhostBreakbulkPreview.tsx`, `lib/__tests__/breakbulk-drop-verdict.test.ts`
**Modify:** `lib/drop-verdict.ts` (+`verdictForPose`, `areaVisible`), `features/viewer3d/VesselScene.tsx` (mount the three layers), `features/viewer3d/Hull.tsx` or its caller (auto-hide, D-P5)
**Delete:** none

## Implementation Steps

1. `drop-verdict.ts`: add `areaVisible(area, view)` (deck toggles only — the bay filter is meaningless for areas) and `verdictForPose` with the same one-entry memo + own-placement strip as `verdictForSlot`. Test both.
2. `AreaPlaceholders.tsx`: from `freeRegionsFor` (memoised on vessel/plan/item). Fill + outline + clipped keep-outs + occupied rects + a `<Html>`/`Text` label. Everything `raycast={() => null}`.
3. `AreaDropPlane.tsx`: one `<mesh>` per visible area, `<planeGeometry>` rotated to horizontal, `meshBasicMaterial visible={false}`, `userData.areaId`. `onPointerMove` → world→local → `poseFromScenePoint` → `clampPoseToArea` → publish pose. `onPointerOut` clears.
4. `GhostBreakbulkPreview.tsx`: mesh from `buildBreakbulkMesh` at the hovered pose, `DROP_TINT` + `<Edges>`, opacity 0.35–0.4.
5. Mount all three in `VesselScene` inside the attitude `<group>` (so heel/trim carries them), after `BreakbulkCargoInstances`.
6. Hull auto-hide: `showHull && !(inHandBreakbulk && showUnderDeck)`.
7. Reuse `DropVerdictChip` for the pose message (it is slot-shaped today — widen its prop to a target union or pass the message text).
8. `npm run typecheck && npm run build && npm test`; then a browser pass: hover every area on BBC and the demo vessel.

## Todo List

- [x] `verdictForPose` + `areaVisible` + tests
- [x] `AreaPlaceholders.tsx`
- [x] `AreaDropPlane.tsx`
- [x] `GhostBreakbulkPreview.tsx`
- [x] `VesselScene` wiring + hull auto-hide
- [x] chip reuse for pose messages
- [x] typecheck / build / tests green
- [x] manual: ghost tracks the pointer in all 4 BBC areas, red outside, amber on the band limit

## Implementation status (2026-09-17)

**Landed**

- `lib/drop-verdict.ts` (+`areaVisible`, `toVerdict` now exported) and the new `lib/pose-verdict.ts`
  (`verdictForPose` + its own-placement strip cache + the one-entry pose memo) — the pose half moved to
  a sibling module to keep both files under the 200-LOC rule.
- `features/viewer3d/AreaPlaceholders.tsx`, `AreaDropPlane.tsx`, `GhostBreakbulkPreview.tsx` and their
  shared primitives module `area-rect-graphics.tsx` (fills/outline/label; the unit plane is shared and
  built lazily, so an idle scene allocates no geometry).
- `VesselScene.tsx`: the three layers mount inside the attitude group; the hand is a TEMPORARY local
  `useState` toggled by the `b` key (`useTemporaryBreakbulkHand`, deleted by Phase 03); `EmptySlotPicker`
  is gated on `item === null` ("never both").
- `Hull.tsx`: `hidden` prop → `showHull && !(item in hand && showUnderDeck)` (D-P5), threaded through all
  three hull paths so the (expensive) loft/GLB stays mounted.
- `DropVerdictChip.tsx`: optional `poseText` seam (decision #3). Not wired yet — the chip is rendered by
  `App.tsx`, which this phase does not own; Phase 03 wires it from the store.

**Verified**

- `npx vitest run`: `Tests 617 passed (617)`, `Test Files 30 failed | 78 passed (108)` — the 30 failures
  are the pre-existing `.claude/**` files; `src/**` is green. Baseline was 608 tests / 77 files, +9/+1 here.
- `npm run typecheck` clean; `npm run build` succeeds.
- Idle scene (nothing in hand), driven through CDP + headless Chrome: 75 draw calls/frame (identical to the
  pre-phase baseline), 0 differing pixels in the canvas region, 0 area labels / 0 chips in the DOM.
- With an item in hand: 4 area labels, green feasible / red infeasible-with-reason, hull hidden, ghost +2
  draw calls where the pointer reaches a drop plane, ghost moving with the pointer, tint red over a placed
  blade (the area's own tint stays green — the poses' verdict is what changes).

**Known limitations (for Phase 03)**

1. On-deck container stacks occlude the weather-deck drop plane: `ContainerInstances`' pick volumes sit
   above the surface, are in R3F's interaction list, and call `stopPropagation` on move, so the plane
   behind them publishes no pose there (the ghost freezes/vanishes over a stack). Phase 03 owns
   `BreakbulkCargoInstances`/`EmptySlotPicker`-adjacent work; the same guard the container path uses
   (`if (inHand) return`) is the natural fix.
2. The pose message cannot reach the chip until the hand lives in the store (`poseText` seam above).
3. Amber on the 20 m band limit is pinned by unit test on the demo vessel; BBC's deck rating (4 t/m²) makes
   the band limit unreachable with the demo item set, so it was not reproduced in the browser.

## Success Criteria

- Moving the pointer across an area moves the ghost continuously on a 0.5 m grid; the ghost never leaves the area while clamping is on.
- The tint always equals `canPlaceBreakbulk`'s verdict for the same pose (no third state, no UI-local rule).
- Idle scene (nothing in hand) renders exactly as today — no new geometry, no new draw calls.
- One predicate call per pointer move (assert via a counter in the verdict test).

## Risk Assessment

| Risk | Mitigation |
|---|---|
| Drop plane steals hover from container slots / placed cargo | Mount area layers only when `inHand.kind === "breakbulk"` (open question 2) |
| Overlapping areas (hatch cover over tank top) make the pointer ambiguous | Only areas passing the deck toggles are mounted; the toggle is the disambiguator |
| Predicate called 3× per move by three readers | One-entry memo, pinned by a call-count test |
| `<Html>` labels hurt perf on many areas | ≤ 5 areas per vessel today; use `Text` from drei if it shows up |

## Security Considerations

None — rendering only.

## Next Steps

Phase 03 replaces the local hand state with the store, adds the commit, and makes placed cargo pickable.
