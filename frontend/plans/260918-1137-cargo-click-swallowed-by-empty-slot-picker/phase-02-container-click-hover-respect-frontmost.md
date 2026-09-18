# Phase 02 — Container click/hover respect frontmost

## Context links
- [plan.md](plan.md)
- `src/features/viewer3d/ContainerInstances.tsx`: `onPointerDown` already guards with `isFrontmostGestureHit`;
  `onPointerMove` (hover) and `onClick` do not
- `src/features/viewer3d/BreakbulkCargoInstances.tsx`: guards press and hover; its click never stops propagation
  (by design, for the area drop plane)

## Overview
- **Priority:** medium.
- **Status:** done (2026-09-18).
- A project-cargo item standing IN FRONT of a container stack: clicking the item selects it, then the stack's
  `onClick` runs next in the same dispatch and overwrites `selectedId` with the container. Hover does the same
  thing to `hoveredId`. The fix applies the rule the press already follows: only the frontmost cargo acts.

## Key insights
- Dispatch is nearest-first. The item's handler runs, then the container's. `cargoClickAction` reads
  `getState()`, sees `selectedId = item` (not this container), returns `select`, and the container wins.
- The breakbulk file already says so: "the container layer's own hover writes after this one in the same
  dispatch". Only the breakbulk side was guarded.
- When the container IS frontmost, its `stopPropagation` already stops anything behind it, so the guard
  changes nothing for the common case.

## Requirements
- Item in front of a stack: click selects the item (2nd click picks it); hover tints the item.
- Stack in front of an item: unchanged (the container wins).
- Under a project-cargo hand (`breakbulkHand`): unchanged early returns.

## Architecture
```ts
onPointerMove: after the drag-threshold block, before the hover write
  if (!isFrontmostGestureHit(e)) return;   // an item in front owns the hover
  e.stopPropagation(); setHovered(idAt(e));
onClick:
  if (breakbulkHand) return;
  if (!isFrontmostGestureHit(e)) return;   // an item in front owns the click: do not stop, do not select
  e.stopPropagation(); ...unchanged
```
The drag-threshold block in `onPointerMove` stays ABOVE the guard: a press this layer armed must still turn
into a move even if the pointer later passes over an item.

## Related code files
- Modify: `src/features/viewer3d/ContainerInstances.tsx` (two guards and comments)
- Tests: covered by phase 01's `isFrontmostGestureHit` cases (the component itself cannot be reached from node)

## Implementation steps
1. Add the two guards and a one-line comment each, pointing to `press-ownership.ts`.
2. Update the comment in `BreakbulkCargoInstances.tsx` that describes the container overwriting the hover,
   since that no longer happens.
3. typecheck + `npx vitest run src/`.
4. Browser: turn the camera until an item on a hatch cover is in front of a stack (the probe's hit list
   shows `Mesh[GESTURE]` before `Mesh[GESTURE](inst …)`). Click there → `selectedId` = item. Click a stack
   with nothing in front → `selectedId` = container. Drag a container off a stack → still moves.

## Todo list
- [x] Frontmost guard on container hover
- [x] Frontmost guard on container click
- [x] Breakbulk comment updated
- [x] typecheck + suite green
- [x] Browser: item-in-front selects the item; plain container select and drag unchanged

## Success criteria
- An item in front of a stack keeps the selection it was clicked for.
- No regression in container select, pick, or drag.

## Risk assessment
- **A container partly hidden behind an item** can only be clicked where it is actually visible. This is correct
  and matches the press rule.

## Security considerations
None.

## Next steps
None. Close the plan after both phases pass in the browser.
