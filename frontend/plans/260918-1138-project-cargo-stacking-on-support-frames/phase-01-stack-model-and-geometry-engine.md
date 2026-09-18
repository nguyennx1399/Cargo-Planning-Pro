# Phase 01 — Stack model + geometry engine

## Context links
- [plan.md](plan.md): decisions and data model
- `src/types/domain.ts`: `BreakbulkCategory`, `BreakbulkCargo`, `BreakbulkPlacement`
- `src/engine/breakbulk-deck-area.ts`: `cargoBaseHeight(vessel, areaId)`
- `src/engine/breakbulk-overlap-check.ts`: `footprintRect`, `rectsOverlap`, `Rect`
- `src/engine/placement/can-place-breakbulk.ts`: the `occupancyCache` WeakMap pattern (memoise on the
  placements array's identity)

## Overview
- **Priority:** high. Everything else reads this.
- **Status:** done (2026-09-18).
- Adds the three fields and one pure module that answers "how high does this item stand, what is it
  standing on, and what rests on it". No UI and no rule changes yet.

## Key insights
- Height above the area floor is a chain walk: `elevation(p) = p.on_cargo_id ? elevation(support) +
  support.height_m : 0`. The absolute scene height is `cargoBaseHeight(area) + elevation`.
- Plans come from files and undo, so a chain can be BROKEN: a missing support, an unplaced support, a cycle
  (A on B on A), a different area, or a support that is not stackable. The engine must never loop or throw on
  one of these. It reports it, and phase 02 turns the report into a violation.
- Load on a support = the weight of EVERYTHING above it, transitively, not only what touches it.
- `height_m` of a tower is its diameter (catalog note), so the top of a lying tower is `height_m` as well.
  No special case is needed.

## Requirements
- Types: `"support_frame"` category, `stacking?`, `on_cargo_id?` (see plan.md). Add `"support_frame"` to
  the catalog's `Exclude<…>` (as was done for `general`), and give it a colour in `BreakbulkCargoInstances`
  in phase 03.
- `engine/placement/breakbulk-stack.ts` exports:
  - `supportChain(plan, cargoId)`: the ids below, nearest first. It stops at a missing/unplaced/cycling
    support and reports `{ chain, broken?: "missing" | "cycle" | "not_stackable" | "other_area" }`.
  - `elevationOf(plan, cargoId)`: metres above the area floor. A broken chain counts from the last valid support.
  - `loadAbove(plan, cargoId)`: total t resting on it, transitively.
  - `dependentsOf(plan, cargoId)`: the ids resting directly on it (used by the lift guard in phase 03).
  - `topRect(plan, cargoId)`: its footprint rect (the resting surface for items above).
- All of these are memoised per `plan.breakbulk_placements` identity (WeakMap), because a drag evaluates
  hundreds of poses against one plan.

## Architecture
```ts
interface StackIndex {
  byId: Map<string, BreakbulkPlacement>;
  cargo: Map<string, BreakbulkCargo>;
  above: Map<string, string[]>;      // support id → direct dependents
}
const indexCache = new WeakMap<readonly BreakbulkPlacement[], StackIndex>();
```
`supportChain` walks `on_cargo_id` with a `visited` set (cycle guard) and a hard limit of
`placements.length` steps.

## Related code files
- Modify: `src/types/domain.ts`, `src/data/breakbulk-cargo-catalog.ts` (Exclude)
- Create: `src/engine/placement/breakbulk-stack.ts`
- Create: `src/engine/placement/__tests__/breakbulk-stack.test.ts`

## Implementation steps
1. Add the types, with doc comments stating the invariants (same area as the support, no floor pressure
   for an upper item).
2. Write `breakbulk-stack.ts` using the index + WeakMap.
3. Tests: floor item → elevation 0, empty chain; 3-high chain → elevations 0 / h1 / h1+h2; loadAbove on the
   bottom = the two above; cycle A↔B → broken "cycle", no hang; support not placed → "missing"; support in
   another area → "other_area"; support without `stacking` → "not_stackable"; memo returns the same object
   for the same array.
4. typecheck + `npx vitest run src/`.

## Todo list
- [x] Types + catalog Exclude
- [x] `breakbulk-stack.ts`
- [x] Tests incl. broken chains
- [x] typecheck + suite green

## Success criteria
- The existing suite is unchanged and green (no plan has `on_cargo_id` yet).
- Every broken-chain case terminates and is classified.

## Risk assessment
- **Adding a union member** can break exhaustive `Record<BreakbulkCategory, …>` maps. The typecheck finds
  each one. Fix each at its site (colour, catalog Exclude), not with a cast.

## Security considerations
None.

## Next steps
Phase 02.
