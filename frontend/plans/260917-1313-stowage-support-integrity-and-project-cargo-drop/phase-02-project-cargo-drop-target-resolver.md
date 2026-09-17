# Phase 02 — Project-cargo drop-target resolver (fix "dragging does nothing")

## Context links

- `src/features/viewer3d/AreaDropPlane.tsx` — one invisible plane per area, current pick layer
- `src/features/viewer3d/VesselScene.tsx:108-118` — layer order under the attitude group
- `src/features/viewer3d/ContainerInstances.tsx:156-177` — the `breakbulkHand` early return
- `src/lib/nearest-slot.ts` — the PRECEDENT: pointer-ray arithmetic pulled out of three's dispatch
- `src/engine/placement/breakbulk-pose.ts` — `poseFromScenePoint`, `clampPoseToArea`
- `src/store/hand-slice.ts` — `setHoveredPose` / `clearHoveredPose`

## Overview

- **Priority:** high — from the planner's seat, project-cargo drag is broken.
- **Status:** not started.
- The gesture machinery is fine (hand, ghost, chip, commit doors all fire). The **target resolution**
  is not: the pointer often produces no pose, and when it does it is frequently the wrong area.

## Key insights (all observed in the browser, BBC SAO PAULO, demo plan)

1. Pick BB013, "Under deck" OFF: one deck point → `weather deck 97.0 / 7.0 m`; two other deck points →
   **no pose at all** (no chip, no ghost, release does nothing). Dead zones over the deck.
2. "Under deck" ON: every probed deck point → `Hold 2 tank top …`. The weather-deck plane is above the
   tank-top plane along the view ray, so three should hit it first — it does not win.
3. `AreaPlane.onPointerMove` calls `e.stopPropagation()` and relies on R3F dispatching nearest-first
   across several invisible planes; that is exactly the class of "which object did the ray enter
   first" ambiguity `nearest-slot.ts` already removed for container slots (see its header: camera
   azimuth deciding the winner).
4. `ContainerInstances`/`BreakbulkCargoInstances` do NOT stop propagation under a breakbulk hand, so
   plain occlusion is not a sufficient explanation — the resolution rule itself is the suspect.
5. A synthetic-event drag (`PointerEvent` dispatched from JS) never produces a pose; real pointer
   moves do. Useful when writing the manual script: drive it with real input, not JS events.

## Requirements

**Functional**

1. Every pointer position over a visible area produces a pose — no dead zones.
2. The area under the pointer is the TOPMOST visible area whose rect contains the crossing point;
   it never silently resolves to a deeper area the planner is not pointing at.
3. The pose the ghost draws, the pose the chip words and the pose the commit receives stay one object.
4. A release over a resolved pose commits (or is refused with a reason) — never "nothing happened".
5. Deck toggles keep deciding which areas are pickable (an area the planner cannot see is not a target).

**Non-functional**

- One resolution per pointer move, no predicate call inside the resolver, no allocation beyond the pose.
- Pure module, node-testable without three/react/store — same shape as `nearest-slot.ts`.

## Architecture

Replace "several invisible planes + three's dispatch order" with an explicit, pure rule:

```ts
// src/lib/nearest-area.ts  (sibling of nearest-slot.ts)
/** Where the cursor ray crosses a horizontal plane at `surfaceY`, ship-frame. */
export function cursorOnAreaPlane(surfaceY: number, origin: Vec3, dir: Vec3): Vec3 | null
/** Topmost area whose rect contains the crossing point; -1 when none. */
export function areaUnderCursor(areas: readonly AreaProbe[], origin: Vec3, dir: Vec3): number
```

`AreaDropPlane` keeps ONE pick surface for the whole gesture (a single large invisible plane, or the
existing per-area planes with `raycast` left to three but the pose decided by the resolver), and:

- converts `e.ray` into the ship frame via the same transform `poseAt` already uses (`worldToLocal`);
- asks `areaUnderCursor` for the area, `poseFromScenePoint` for the raw pose, then `clampPoseToArea`;
- writes `setHoveredPose` exactly once per move, as today.

This keeps the module boundaries the codebase already argues for: the geometry rule is pure and swept
by tests over every real area of both vessels; the component keeps only the three.js plumbing.

### MECHANISM — captured 2026-09-17, step 1 done

Temporary instrumentation in `AreaPlane.onPointerMove` (dumping `e.intersections` to `window.__areaHits`),
BBC SAO PAULO, BB005 picked, both deck toggles on, pointer walked down ONE screen line (x=500 in the
800×500 frame), hand armed throughout:

| screen y | pose | intersections |
|---|---|---|
| 145 | `weather deck 81.0 / -1.0 m` | `[weather_deck @ 115.1]` — one hit, handler fired |
| 170 | **none** | handler never fired (`__areaHits` stale) |
| 195 | `Hold 2 tank top 86.5 / 4.5 m` | handler fired for the hold |
| 220 | **none** | handler never fired |

So it is NOT dispatch order, and not occlusion: at the working point there is exactly ONE intersection,
and in the gaps there are NONE. The pick surface is a set of DISJOINT RECTANGLES AT DIFFERENT HEIGHTS.
A plane only fires where the cursor ray crosses that plane's own height INSIDE that rect, so:

- between the rects the ray crosses nothing and the UI says nothing at all (the dead zones);
- pointing at the deck can yield the HOLD, whenever the deck-level crossing falls outside the deck rect
  while the hold-level crossing (further along the same ray) falls inside the hold rect.

Same failure class `nearest-slot.ts` removed for container slots: a *position* question answered by
"which surface did the ray happen to enter". The resolver below is the fix; the pick surface must also
stop being N rectangles, or the gaps survive any resolution rule.

**Original step-1 instructions, kept for the record:** temporarily log
`e.intersections.map(i => i.object.userData.areaId)` in `AreaPlane.onPointerMove` and hover the dead
zones. Two outcomes:
- the weather-deck plane is absent from the list → geometry/height/rect problem, fix that first and
  the resolver becomes a smaller change;
- it is present but not the one that wrote the pose → dispatch-order problem, the resolver is the fix.
Record the answer in this file before step 3.

## Related code files

**Create**
- `src/lib/nearest-area.ts`
- `src/lib/__tests__/nearest-area.test.ts`

**Modify**
- `src/features/viewer3d/AreaDropPlane.tsx` (resolve through the new rule; keep the single clamp here)
- possibly `src/features/viewer3d/VesselScene.tsx` (pass the area probes it already computes)

**Delete** — none.

## Implementation steps

1. Start the dev server, pick a project-cargo item, and reproduce both symptoms; capture the
   intersection log described above.
2. Write down the mechanism in this file (one paragraph).
3. Implement `nearest-area.ts` with its header comment and a test sweeping both vessels' areas,
   including points over stacks, over the hatch, at rect edges, and outside every rect.
4. Rewire `AreaDropPlane` to the resolver; keep `stopPropagation` only where it is still needed.
5. `npm run typecheck`, `npm run test`.
6. Manual verification with real pointer input: hover a grid of ~8 points across the deck with under-
   deck both on and off; every point either names the area under the cursor or is honestly outside
   every area. Then drag one item from the list and release it on the deck — it must land or be
   refused with a reason.

## Todo list

- [x] Reproduce + capture intersections in the dead zones
- [x] Record the mechanism in this file (table above)
- [x] `nearest-area.ts` + sweep test (11 cases, both vessels, every point of every area rect)
- [x] Rewire `AreaDropPlane` — N planes → ONE pick box + the pure resolver
- [x] typecheck clean + `npx vitest run src/` = 86 files / 686 tests green
- [x] Manual hover check, instrumented with per-area crossing data
- [~] Manual drag-and-release lands an item — **not demonstrated**, see below

### Verification after the fix (same method, BBC SAO PAULO, item picked)

The dead zone is gone. Down the same screen line that used to read
`weather deck → nothing → Hold 2 tank top → nothing`:

| screen y | before | after |
|---|---|---|
| 145 | `weather deck 81.5 / -0.5` | `weather deck 81.5 / -0.5` |
| 170 | **nothing** | `Hold 2 tank top 74.0 / -6.0` |
| 195 | `Hold 2 tank top 86.5 / 4.5` | `Hold 2 tank top 86.5 / 4.5` |
| 220 | nothing | nothing — off every area (the hull side below the hold), an honest answer |

Per-area crossing data (temporary probe, since removed) confirms the rule rather than the outcome:

- pointer at one spot → `weather_deck inside=true`, everything else false → deck pose;
- pointer 70 px away → `weather_deck inside=false, tank_top_hold2 inside=true` → hold pose.

So the area is now chosen by WHERE THE RAY CROSSES EACH SURFACE, and all four areas
(`weather_deck`, `tank_top_hold2`, `main_deck_aft_hold2`, `tank_top_hold1`) were reachable by pointing
at them. Every resolved pose renders a verdict chip; nothing is silent over an area any more.

**What is still NOT proven:** an actual landing. On the demo plan every pose for the unplaced items is
refused (`BB00x overlaps …`) — that is phase 03's subject, not a targeting failure — so the live check
ended at "refused with a reason" rather than "placed". The commit path itself is covered in node
(`store/__tests__/commit-breakbulk-placement.test.ts`). Needs one human drop on a free deck spot, or
phase 03 first.

## Success criteria

- No deck point under a visible area returns "no pose".
- With "Under deck" on, pointing at the weather deck resolves to the weather deck.
- A list drag released over the deck either places the item or shows a refusal reason.
- `nearest-area.test.ts` passes over every area of both vessels.

## Risk assessment

| Risk | Mitigation |
|---|---|
| The real cause is area geometry, not ordering, and the resolver hides it | Step 1-2 forbid writing code before the mechanism is known |
| Regressing the container slot path | The container layers are untouched; `EmptySlotPicker` still unmounts under a breakbulk hand |
| Attitude group (heel/trim) breaking the ray maths | Reuse the existing `worldToLocal` conversion; test with `exaggerate` on |
| A single big pick plane swallowing clicks meant for cargo selection | Mounted only while an item is in hand, exactly as the planes are today |

## Security considerations

None.

## Next steps

Phase 03 ("nowhere to drop" honesty) is only hand-verifiable once this lands.
