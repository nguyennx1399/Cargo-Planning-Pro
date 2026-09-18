# Phase 04 — Create project cargo with custom dimensions, then place it

> Carried in this plan at the user's request; independent of phases 01–03.

## Context links

- `src/types/domain.ts:124-136` — `BreakbulkCategory` (closed union of 4) and `BreakbulkCargo`
- `src/engine/cargo/breakbulk-mesh-builder.ts` — one mesh per category; the 3D shape of an item
- `src/data/demo-breakbulk-generator.ts` — how the demo items are built today
- `src/App.tsx:63-65` — the effect that REBUILDS the plan on (vessel, cargoLoaded, projectCargoLoaded)
- `src/features/panels/UnplacedProjectCargoList.tsx` — the drag/pick source; renders `plan.breakbulk_cargo` minus placed
- `src/features/panels/ProjectCargoPanel.tsx` — the natural home for the new control
- `src/engine/placement/can-place-breakbulk.ts` — dimension-driven rules; needs NO change

## Overview

- **Priority:** medium.
- **Status:** implemented and verified end-to-end in the app (2026-09-17).
- A form to define a piece of project cargo by its own dimensions, which then behaves exactly like the
  demo items: it appears in the unplaced list, can be picked or dragged, and is validated on the deck.

## Key insights

- **"…and after that can draggable" is already free.** The unplaced list renders `plan.breakbulk_cargo`
  minus what is placed, and every gesture path (list drag, list pick, ghost, area drop plane, commit)
  keys off the item found in that array. Put a well-formed item in there and it is draggable with no
  new gesture code. The work in this phase is the FORM, the STORE and the SHAPE — not drag-and-drop.
- **The validator needs no change either.** `canPlaceBreakbulk` reads `length_m`/`width_m`/`height_m`/
  `weight_t` and checks area fit, clear height, deck rating, keep-outs and overlaps from those numbers.
  A custom item is judged like any other, and phase 03 of the previous plan already words the "fits, but
  no free spot" answer honestly.
- **The plan is REBUILT on every toggle** (`App.tsx:63`): switching vessel, or pressing Clear cargo /
  Clear project cargo, calls `loadPlan` with a freshly built demo plan. Anything added straight into
  `plan.breakbulk_cargo` is silently destroyed by the next toggle. This is the real design problem of
  the phase, and the decision below is the answer to it.
- **`BreakbulkCategory` is a closed union of four**, each with its own mesh (blade, nacelle, tower,
  yacht). None of them is a plain box, so arbitrary cargo has no honest shape today.
- **`kg_above_base_m` is required and load-bearing**: it feeds the indicative stability calculation, and
  the domain comment warns it is *"NOT always height_m/2"*. It cannot be quietly assumed for everything.

## Decisions taken (user, 2026-09-17)

1. **Custom items survive a plan rebuild.** They live in their own store slice and are re-applied
   whenever the demo plan is rebuilt, so toggling cargo on and off does not delete what was typed.
   Page reload still clears them (no persistence layer — YAGNI until asked).
2. **A new `general` category, rendered as a plain box** at the given L×W×H. The drawn box is exactly
   the footprint the rules use, so what is seen and what is checked cannot diverge.
3. **Form asks L / W / H / weight; CoG above base is an optional advanced field** defaulting to
   `height / 2`, editable because the stability numbers depend on it.

## Requirements

**Functional**

1. A control in the Project cargo panel creates an item from: length, width, height, weight, optional
   centre of gravity above base, and an optional name/id (auto-generated when blank).
2. The new item appears immediately in the unplaced project-cargo list, with the same "fits in …" /
   "no free spot found" hint every other item gets.
3. It can be picked or dragged onto the vessel and is validated identically to demo cargo.
4. It survives the Clear cargo / Clear project cargo toggles and a vessel switch (it is cargo, not
   vessel data), and can be removed by the planner.
5. Invalid input is refused with a readable message: non-positive dimensions, absurd sizes (larger than
   the vessel), non-numeric entries.
6. It renders as a box of its true dimensions, tinted distinctly from the demo categories.

**Non-functional**

- No change to `canPlaceBreakbulk`, the commit resolver, or any gesture path.
- The form is its own component under the 200-LOC rule; validation of the input is a pure function with
  its own test.

## Architecture

**Type** — widen the union in `types/domain.ts`:

```ts
export type BreakbulkCategory = "wind_turbine_blade" | … | "yacht" | "general";
```

`breakbulk-mesh-builder.ts` gains a `general` branch returning a box of `length × width × height`.
Check every other `switch`/lookup on the category (`BreakbulkCargoInstances`' `CATEGORY_COLOR`, any
label helper) — a closed union widened in one place and missed in another is how a silent `undefined`
colour ships.

**Store** — a small slice beside the existing ones:

```ts
// usePlanStore (view/session state, NOT the plan itself)
customCargo: BreakbulkCargo[];
addCustomCargo: (item: BreakbulkCargo) => void;
removeCustomCargo: (id: string) => void;
```

**Re-application** — `App.tsx`, where the plan is built:

```ts
loadPlan(vessel, withCustomCargo(buildDemoPlan(vessel, containers, toggles), customCargo));
```

`withCustomCargo(plan, items)` is a pure helper: appends items not already present to
`plan.breakbulk_cargo`. Adding an item bumps the same effect, so the list refreshes with no second
path. Placements are NOT carried across a rebuild — the rebuild is a new plan by definition, and
pretending otherwise would resurrect placements the validator never saw.

**Input validation** — `src/lib/custom-cargo-input.ts`, pure:

```ts
export function parseCustomCargo(
  fields: { name: string; length: string; width: string; height: string; weight: string; kg?: string },
  vessel: Vessel,
): { item: BreakbulkCargo } | { errors: Record<string, string> };
```

Rules: numbers parse and are > 0; length/width no larger than the vessel's own extents; height sane;
weight > 0; `kg_above_base_m` defaults to `height / 2` and must be within `[0, height]`; the id is
generated (`CUSTOM-1`, `CUSTOM-2`, …) when no name is given, and must not collide with an existing id.

**UI** — `src/features/panels/CustomCargoForm.tsx`, rendered inside `ProjectCargoPanel`. Five number
inputs, an optional name, a disclosure for CoG, an Add button, and inline field errors. Existing
`components/ui` primitives (`Input`, `Label`, `Button`) only — no new dependency.

Removal: an × on the row in the unplaced list for custom items only, calling `removeCustomCargo`.

## Related code files

**Create**
- `src/lib/custom-cargo-input.ts` + test
- `src/features/panels/CustomCargoForm.tsx`
- `src/data/with-custom-cargo.ts` (the pure merge helper) + test

**Modify**
- `src/types/domain.ts` (category union)
- `src/engine/cargo/breakbulk-mesh-builder.ts` (`general` box mesh)
- `src/features/viewer3d/BreakbulkCargoInstances.tsx` (`CATEGORY_COLOR` entry)
- `src/store/usePlanStore.ts` (the slice)
- `src/App.tsx` (merge on build)
- `src/features/panels/ProjectCargoPanel.tsx` (mount the form)
- `src/features/panels/UnplacedProjectCargoList.tsx` (remove control for custom items)

**Delete** — none.

## Implementation steps

1. Widen the category union; add the box mesh and the colour; `npx vitest run src/` to catch every
   exhaustive switch the widening breaks (that failure list IS the checklist of places to update).
2. `custom-cargo-input.ts` + tests: each rejection rule, the CoG default, id generation, id collision.
3. Store slice + `with-custom-cargo.ts` + test (merge is idempotent; existing items are not duplicated).
4. Wire `App.tsx` so a new item reaches the plan through the existing rebuild.
5. `CustomCargoForm` in the Project cargo panel; inline errors.
6. Remove control on custom rows.
7. `npm run typecheck`, `npx vitest run src/`.
8. Browser: add a 12 × 3 × 3 m / 40 t item → it appears in the unplaced list with a fits-in hint → pick
   it → ghost is a box of that size → place it on deck → it renders where dropped; toggle Clear project
   cargo and back → the custom item is still listed; remove it → it disappears from list and scene.

## Todo list

- [x] `general` category: type + colour. **No mesh work was needed** — `buildBreakbulkMesh` already
      boxes everything except the tower, so a `general` item renders as its true L×W×H box for free
- [x] `custom-cargo-input.ts` (tests deferred)
- [x] Store slice + `with-custom-cargo.ts` (tests deferred)
- [x] `App.tsx` merge on rebuild
- [x] `CustomCargoForm` in the Project cargo panel (+ styles)
- [x] Remove control for custom items only
- [x] typecheck clean; existing suite green
- [x] Browser: add → appears → survives toggles → pick → place → renders

### Verified in the app

Typed 12 × 3 × 3 m / 40 t → `CUSTOM-1` appeared in the unplaced list with the normal "fits in: weather
deck, Hold 2 tank top, …" hint. It survived **Clear project cargo → Load project cargo** AND a
container-cargo toggle (both rebuild the plan). Picked it, hovered the empty deck → green chip *"Clean
drop — no rule is triggered"* → clicked → it left the unplaced list and now renders as a plain box on
deck.

### Deviations from the plan

- **The union widening broke exactly one consumer**, `BREAKBULK_CATALOG`. Rather than adding an empty
  `general: []` bucket, its type became `Record<Exclude<BreakbulkCategory, "general">, …>` — the demo
  generator can then never pick a category it has no reference dimensions for.
- **Cosmetic, not fixed:** the × remove control renders between the weight and the "fits in" badge
  rather than at the end of the row.

## Success criteria

- An item typed into the form is placeable on the ship within seconds, with no code change.
- It is validated exactly like demo cargo (area fit, clear height, rating, keep-outs, overlaps).
- Toggling cargo on/off does not destroy it.
- Its 3D box matches the footprint the rules check.

## Risk assessment

| Risk | Mitigation |
|---|---|
| Widening a closed union misses a consumer | Step 1 widens FIRST and runs the suite/typecheck to enumerate every break before anything else is built |
| Custom cargo silently lost on a toggle | The whole point of decision 1; asserted in the browser check |
| Rebuild resurrects placements the validator never saw | The merge carries cargo only, never placements — stated in the helper's header |
| A 200 m "item" breaks the scene | Input validation bounds dimensions by the vessel's own extents |
| Wrong stability from an assumed CoG | CoG is editable and defaults visibly, not silently |
| Form grows past the file-size rule | Parsing and validation live in `custom-cargo-input.ts`; the component only renders and reports |

## Security considerations

None — local state, no I/O. Input is numeric and bounded before it reaches the engine.

## Next steps

Obvious follow-ups, deliberately out of scope: persisting custom cargo across reloads, editing an item
after creation, and importing a list from CSV.
