# Phase 01 — Idle slot picker yields to visible cargo

## Context links
- [plan.md](plan.md): root cause and raycast table
- `src/features/viewer3d/EmptySlotPicker.tsx`: idle set = empty 40' slots; `onPointerMove`/`onClick` call `stopPropagation`
- `src/features/viewer3d/press-ownership.ts`: `GESTURE_LAYER`, `isFrontmostGestureHit`
- `src/features/viewer3d/BreakbulkCargoInstances.tsx`: item click → `cargoClickAction` (select / pick)

## Overview
- **Priority:** high. This is the reported bug.
- **Status:** done (2026-09-18).
- With NOTHING in hand, when the pointer ray hits any cargo (a `GESTURE_LAYER` object), the slot picker lets
  the event through instead of consuming it.

## Key insights
- The slot volumes are INVISIBLE. When one lies in front of an item, the planner sees the item and points at
  it, so the visible object should own the pointer.
- R3F dispatches nearest-first and `stopPropagation` ends the dispatch. So a picker that just returns
  WITHOUT stopping hands the event on to the item behind it. No reordering is needed.
- `e.intersections` already holds every hit on the ray (the same data `isFrontmostGestureHit` reads), so the
  rule is a pure function over it and can be tested in node with structural fakes.
- Under a container hand, the picker MUST keep priority. The volume above a stack, or one overlapping a
  project-cargo item, is the drop target (green or red verdict). So this rule is gated on `!hand`.

## Requirements
- Idle, pointer over cargo: the cargo's hover tint and click (select, then pick on the 2nd click) work
  anywhere on the item, not only its edges. The same applies to containers behind an empty-slot volume.
- Idle, pointer over empty deck (no cargo on the ray): empty-slot hover inspection is unchanged.
- Container in hand (drag or pick): no change at all.
- Project-cargo in hand: no change (the picker is already unmounted).

## Architecture
```ts
// press-ownership.ts
/** True when any cargo (a GESTURE_LAYER object) lies on this event's ray. */
export const rayHitsCargo = (e: { intersections: readonly Hit[] }): boolean =>
  e.intersections.some(isGestureLayer);
```
```ts
// EmptySlotPicker.tsx: idle only
onPointerMove={(e) => {
  if (!hand && rayHitsCargo(e)) {            // visible cargo owns an idle pointer
    if (usePlanStore.getState().hoveredSlot) setHoveredSlot(null);  // no store churn per move
    return;                                    // NO stopPropagation: the cargo behind gets the event
  }
  e.stopPropagation();
  setHoveredSlot(landed(resolveSlot(e)));
}}
onClick={(e) => {
  if (!hand && rayHitsCargo(e)) return;        // idle click on cargo → cargo's own onClick
  e.stopPropagation();
  ...unchanged
}}
```
Widen `isFrontmostGestureHit`'s parameter type to the same structural `{ intersections, eventObject }` so
both helpers can be tested without R3F. The call sites are unchanged.

## Related code files
- Modify: `src/features/viewer3d/press-ownership.ts` (add `rayHitsCargo`, structural types)
- Modify: `src/features/viewer3d/EmptySlotPicker.tsx` (idle yield in move and click, plus a doc paragraph)
- Create: `src/features/viewer3d/__tests__/press-ownership.test.ts`

## Implementation steps
1. `press-ownership.ts`: export `rayHitsCargo`. Type the hit structurally (`eventObject?.userData`) and reuse
   `isGestureLayer`. Update the header comment: it currently says passive layers "only must not be able to
   block a press". Extend that to hover and click while idle.
2. `EmptySlotPicker.tsx`: add the idle yield to `onPointerMove` and `onClick` as above. Leave `onPointerOut`
   as is. Add a doc paragraph "IDLE YIELDS TO CARGO" next to the "WHICH SET" block.
3. Tests (`press-ownership.test.ts`, node):
   - `rayHitsCargo`: false for `[]`; false for only non-gesture hits; true when a gesture hit is behind a
     non-gesture hit (the exact bug geometry).
   - `isFrontmostGestureHit`: true for the nearest gesture hit even with a slot volume in front; false for a
     gesture hit behind another gesture hit.
4. `npx tsc --noEmit` (the repo's `typecheck` script; NOT `tsc -b`, which emits `.js` into `src/`) and `npx vitest run src/`.
5. Browser, BBC SAO PAULO, default camera. Use the diagnosis probe: import `_roots` from the Vite-served
   `@react-three/fiber` dep, use `root.store.getState()`, project each non-instanced `GESTURE_LAYER` mesh's bbox
   centre, and click there with a real pointer:
   - each of the 8 items: 1st click → `selectedId` = item id (read from the store at the `?t=` URL the app
     loaded); 2nd click → `inHand = {kind:"breakbulk"}`; Esc puts it down;
   - hover over the item → selected/hover tint visible (screenshot);
   - hover over empty hatch cover away from any item → the Container inspector still shows the empty slot;
   - pick a container from the unplaced list, hover the slot above a stack and a slot over a project-cargo
     item → the ghost and verdict still appear (green or red), and the click still commits or refuses.

## Todo list
- [x] `rayHitsCargo` + structural hit types
- [x] Idle yield in `EmptySlotPicker` move + click
- [x] `press-ownership.test.ts`
- [x] typecheck + suite green
- [x] Browser: 8/8 items selectable at centre; empty-slot inspect intact; container placement intact

## Success criteria
- 8/8 placed items on BBC SAO PAULO select on a centre click, where 0/8 select today.
- No change to any container-in-hand behaviour (all existing gesture tests still pass).

## Risk assessment
- **Empty slot fully behind cargo can no longer be hover-inspected while idle.** Intended: the planner is
  pointing at the cargo. Such a slot can still be inspected from another angle, or by taking a container in
  hand, which shows every slot's verdict.
- **Hover churn**: the guarded `setHoveredSlot(null)` writes only when a value is set.
- **Idle click on cargo no longer reaches `commitPlacement`**: it was a no-op with nothing in hand anyway.

## Security considerations
None. This is a client-side pointer routing change.

## Next steps
Phase 02 (independent).
