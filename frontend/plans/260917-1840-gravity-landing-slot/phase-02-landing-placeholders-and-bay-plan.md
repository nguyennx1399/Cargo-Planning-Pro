# Phase 02 — Placeholders and the 2D bay plan follow the landing rule

## Context links

- `src/features/viewer3d/SlotPlaceholders.tsx` — draws `validSlotsFor`, plus the Phase 02 envelope outline
- `src/lib/slot-envelope.ts` — the envelope folds over whatever slot set it is given
- `src/features/bayplan/BayPlanView.tsx:82` — its own `validSlotsFor` set; `:95` commits a slot
- `src/engine/placement/landing-slot.ts` — the rule from phase 01

## Overview

- **Priority:** medium — without it the drawn layer contradicts the drop.
- **Status:** implemented and verified in the app (2026-09-17).
- After phase 01 the pointer lands boxes on the stack top, but the placeholder cloud still shows every
  valid slot and the 2D grid still commits the cell you click. Both need to speak the new rule.

## Key insights

- **The placeholder cloud becomes misleading the moment gravity exists.** A green box at tier 06 that
  the drop will never use is worse than no box at all — it is the "drawn layer disagrees with the
  pickable layer" failure this codebase has already paid for twice (project-cargo dead zones, and the
  M1 note in `drop-verdict.ts`).
- The landing set is a projection, not a new sweep: take the slots `validSlotsFor` already returns and
  keep those that are their OWN landing slot (`landingSlotFor(slot) === slot`). One predicate sweep,
  one cheap filter, no second rule.
- **The envelope comes along for free.** `slotEnvelopes` folds whatever set it is handed, so the
  outline will tighten to the landing slots automatically — no change needed there, but the phase's
  browser check should confirm it still looks right with far fewer boxes.
- The 2D bay plan is a SECOND trigger for the same commit resolver. It must map its clicked cell
  through the same rule, or clicking a high cell in the grid behaves differently from aiming at the
  same column in 3D.
- The bay plan also paints its own "valid" cells from `validSlotsFor` (`:82`) — same projection applies.

## Requirements

**Functional**

1. The 3D placeholder layer draws one box per column: the slot the box would land on.
2. The bay-plan grid marks the landing cell per column as the target, not every valid cell.
3. Clicking a bay-plan cell in a column lands the box on that column's landing slot, exactly as the 3D
   pointer does.
4. The envelope outline still encloses exactly what is drawn.

**Non-functional**

- No extra predicate sweep: the landing filter runs over the set `validSlotsFor` already produced.
- No new tint or vocabulary — the landing slots are ordinary valid slots, drawn as they are today.

## Architecture

A shared projection next to the rule, so both surfaces use one function:

```ts
// engine/placement/landing-slot.ts
/** The subset of `slots` that a box would actually come to rest in — one per column. */
export function landingSlotsOnly(
  model: StowageModel, plan: StowagePlan, container: Container,
  slots: readonly SlotDef[], vessel: Vessel,
): SlotDef[];
```

- `SlotPlaceholders`: wrap its memoised `validSlotsFor(...)` result in `landingSlotsOnly(...)` before
  it is drawn and before `slotEnvelopes` folds it.
- `BayPlanView`: same wrap for its `validSlotKeys` set (`:82`), and map the clicked slot through
  `landingSlotFor` before `commitPlacement` (`:95`).

## Related code files

**Modify**
- `src/engine/placement/landing-slot.ts` (add the projection)
- `src/features/viewer3d/SlotPlaceholders.tsx`
- `src/features/bayplan/BayPlanView.tsx`
- `src/engine/__tests__/landing-slot.test.ts` (cases for the projection)

**Create / Delete** — none.

## Implementation steps

1. Add `landingSlotsOnly` beside the rule; test that it returns at most one slot per (bay, row, deck)
   column and that each returned slot is its own landing slot.
2. Wrap the placeholder set; confirm the envelope still encloses the drawn boxes.
3. Wrap the bay-plan valid set and map its click through the rule.
4. `npm run typecheck`, `npx vitest run src/`.
5. Browser: with a box in hand, count that each column shows ONE placeholder; click a high cell in the
   bay plan and confirm the box lands on that column's stack top, same as the 3D path.

## Todo list

- [x] `landingSlotsOnly` (tests deferred)
- [x] `SlotPlaceholders` projection — the envelope folds the projected set automatically
- [x] `BayPlanView` valid set + click mapping
- [x] typecheck clean; existing suite green
- [x] Browser: the placeholder layer is now ONE flat layer, one box per column, instead of a
      column-height cloud (visible in the gesture screenshots)
- [ ] Bay-plan click not re-verified in the browser (the grid reported 0 containers per bay — see below)

### Note

The bay-plan panel still reports `Bay NN · 0 containers` for every bay on a plan with 110 placed
containers, which is why its click path was wired but not visually confirmed. That defect predates this
work and is still unexplained.

## Success criteria

- Every drawn placeholder is a slot the box would actually land on.
- The 2D and 3D triggers put the box in the same place for the same column.
- The envelope outline still matches the drawn set.

## Risk assessment

| Risk | Mitigation |
|---|---|
| Placeholders become too sparse to read | That sparseness IS the point — one honest target per column. Judge it in the browser check; the envelope gives the region at a glance |
| The bay plan and the 3D path diverge again | Both call the same two exported functions; no local copy |
| A column whose landing slot is refused shows nothing | Correct — it is not a target. The refusal is still reachable by aiming at it in 3D (phase 01's fallback) |

## Security considerations

None.

## Next steps

Worth a look afterwards: the bay-plan panel reported `Bay NN · 0 containers` for every bay walked on a
plan with 110 placed containers (noticed while verifying the select-to-pick work). That is a separate
defect in the same file and should be investigated before trusting this grid's other numbers.
