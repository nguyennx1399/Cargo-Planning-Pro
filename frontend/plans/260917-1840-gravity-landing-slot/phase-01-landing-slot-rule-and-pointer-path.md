# Phase 01 — Landing-slot rule + the 3D pointer path

## Context links

- `src/engine/placement/can-place-container.ts` — `no_floating` and the cell/column primitives
- `src/engine/placement/support-dependents.ts` — the origin-side support rule; same primitives, same vocabulary
- `src/engine/placement-checks.ts` — `tierBelow`; `src/engine/slot-helpers.ts` — `bayPosition`, `deckOf`
- `src/features/viewer3d/EmptySlotPicker.tsx:116` — `resolveSlot`, the ONE writer of `hoveredSlot`
- `src/lib/nearest-slot.ts` — the precedent: pointer → candidate, pure and swept by tests

## Overview

- **Priority:** high — it is the behaviour change itself.
- **Status:** implemented and verified in the app (2026-09-17).
- Turns "the upper half of every empty column is red" into "aim at the column, the box lands on the
  stack top".

## Key insights

- **One field does all the work.** `hoveredSlot` is read by the ghost, the verdict chip, the cursor
  hook, the Sidebar readout and `commitPlacement`. Mapping the pointer's slot through the landing rule
  BEFORE it is written means every one of those follows automatically, with no second code path and no
  chance of the ghost and the drop disagreeing. Do not sprinkle the rule at the call sites.
- **The rule is not "the tier below is occupied".** It is "the lowest tier of this column that is free
  for this box AND supported", which on an empty column is the stack's bottom tier and on a partly
  loaded one is the first gap above the stack. Both fall out of one ascending scan.
- **Columns are per deck.** `deckOf(tier)` splits them, and the bottom tier of each deck is supported
  by construction (tank top / hatch cover — `tierBelow` returns null there). That is what stops a box
  aimed on deck from sinking into the hold.
- **Halves matter.** For a 20' box only its own half must be free and supported; a 40' box needs both.
  `bayPosition(...).halves` already answers this and must be reused, not re-derived (the support plan's
  H2 finding was exactly this kind of re-derivation).
- The landing slot can still be REFUSED — full column, reefer plug, stack weight, clear height,
  overstow, breakbulk overlap. The rule chooses a target; the predicate remains the authority.

## Requirements

**Functional**

1. With a container in hand, the slot under the pointer resolves to the landing slot of that column:
   the lowest tier that is free for this box and supported.
2. The ghost, the verdict chip, the cursor and the Sidebar readout all show the landing slot.
3. Committing places the box at the landing slot.
4. A column with no free supported tier (full, or every candidate refused) yields no target, and the
   existing refusal wording explains why.
5. `validatePlan`'s `no_floating` count can never increase as a result of a drop.
6. The bottom tier of each deck is a valid landing slot on an empty column.

**Non-functional**

- Pure module, node-tested against both vessels' real models; one column scan per pointer move.
- No change to `canPlaceContainer`, the validator, or the support guard.

## Architecture

New pure module `src/engine/placement/landing-slot.ts`:

```ts
/** The slot a box aimed at this column would actually come to rest in — gravity, not the cursor's
 * tier. `null` when the column has no free supported tier for this box. */
export function landingSlotFor(
  model: StowageModel,
  plan: StowagePlan,
  container: Container,
  aimed: Slot,
  vessel: Vessel,
): Slot | null;
```

Algorithm (one ascending scan of the aimed column):

1. `pos = bayPosition(aimed.bay, vessel.bays)`; `deck = deckOf(aimed.tier)`; find the `StackSpec` for
   `(pos.fortyBay, aimed.row, deck)`. No pos or no stack → return `aimed` unchanged (the predicate owns
   that case and will say `slot_exists` / `size_fits_bay`).
2. Walk `stack.tiers` ascending. For each tier, using the cell occupancy of `pos.halves`:
   - occupied on any of this box's halves → not a candidate, keep walking;
   - free AND (it is the lowest tier, or the cell below is occupied on every half) → **this is the
     landing tier**, return `{bay: aimed.bay, row: aimed.row, tier}`.
3. Nothing qualified → `null`.

Wiring, one line in `EmptySlotPicker`:

```ts
const landed = (slot: SlotDef | null) => slot && (landingSlotFor(model, plan, container, slot, vessel) ?? slot);
// onPointerMove: setHoveredSlot(landed(resolveSlot(e)))
// onClick:       commitPlacement(landed(resolveSlot(e)), "scene")
```

Falling back to the aimed slot when the rule returns `null` is deliberate: the planner then gets the
predicate's own refusal for the slot they pointed at, instead of silent nothing.

**Occupancy source:** reuse the cell view the predicate already builds rather than a third scan of
`plan.placements`. If that index is not reachable from here, a local `occupiedHalves` fold is
acceptable (it is what `support-dependents.ts` does, for the same reason) — but say so in the header.

## Related code files

**Create**
- `src/engine/placement/landing-slot.ts`
- `src/engine/__tests__/landing-slot.test.ts`

**Modify**
- `src/features/viewer3d/EmptySlotPicker.tsx` (map the resolved slot through the rule; extend the header)

**Delete** — none.

## Implementation steps

1. Write `landing-slot.ts` with the algorithm above and a header that states it is a TARGET rule.
2. Tests, on the demo vessel's real model:
   - empty column → the stack's bottom tier;
   - column loaded to tier 06 → aiming at 10 lands at 08;
   - full column → `null`;
   - on-deck aim never returns an under-deck tier;
   - 20' box lands on its own half; a 40' box needs both halves supported;
   - aiming BELOW the stack top (at an occupied tier's neighbour) still lands on top, never inside;
   - the returned slot always passes `canPlaceContainer`'s `no_floating` check.
3. Wire `EmptySlotPicker` for both hover and click.
4. `npm run typecheck`, `npx vitest run src/`.
5. Browser: pick a box, aim high in an empty column → ghost sits at the bottom tier; click → the plan
   gains a placement there; re-run the app's own Checks panel and confirm no new `no_floating`.

## Todo list

- [x] `landing-slot.ts` (tests deferred — see note below)
- [x] `EmptySlotPicker` hover + click mapped through the rule
- [x] typecheck clean; existing suite green (91 files / 719 tests)
- [x] Browser: aiming anywhere resolves to a bottom tier
- [ ] Checks panel `no_floating` count — not re-measured in the browser

### Implemented 2026-09-17 (cook: all phases, `--auto`, no test authoring)

Tests were NOT written for this work at the user's request (`--not-test`). Typecheck is clean and the
EXISTING suite still passes (91 files / 719 tests) — the new modules are untested. **That is the debt
this run leaves behind**, and the pure ones (`landing-slot`, `camera-pan`, `custom-cargo-input`,
`with-custom-cargo`, `cell-occupancy`) were written to be node-testable so it can be paid later.

### Verified in the app

With the cargo cleared (every column empty), a 40' box in hand, three different pointer heights:

| pointer | resolved slot |
|---|---|
| 430,130 | `260502` — bay 26, row 05, tier **02** (lowest under-deck) |
| 500,145 | `140582` — tier **82** (lowest on-deck) |
| 560,120 | `100182` — tier **82** |

No mid-column tier, and no `no_floating` refusal anywhere. Before the change, aiming high gave the
aimed tier with a refusal.

### Deviations from the plan

- **`landingSlotFor` takes no `Container`.** The halves follow from the aimed BAY's parity, and size/bay
  mismatch is the predicate's job — an unused parameter would have implied this rule re-checks size.
- **New shared `engine/placement/cell-occupancy.ts`.** The fold was about to exist three times
  (predicate index, `support-dependents`, here); `support-dependents.ts` was switched to the shared one
  in the same change, which also settles a duplication finding from the earlier code review.

## Success criteria

- Aiming anywhere in a column produces a target on the stack top, and the ghost shows it.
- A drop lands where the ghost was.
- The plan-wide `no_floating` count never rises from a drop.

## Risk assessment

| Risk | Mitigation |
|---|---|
| The ghost and the commit use different slots | Both go through the SAME `landed()` mapping in the one component that owns `hoveredSlot` |
| A box sinks through the deck line into the hold | Columns are per `deckOf`; test asserts it explicitly |
| The rule silently swallows a genuine refusal | `null` falls back to the aimed slot so the predicate's message is still shown |
| A third occupancy implementation drifts from the predicate's | Reuse the predicate's index if reachable; otherwise state the duplication in the header, as `support-dependents.ts` does |
| Planner wants to place high deliberately | Not possible physically; if a use case appears (e.g. a fixed cell), it is a new decision, not a bug |

## Security considerations

None — plan state only.

## Next steps

Phase 02 makes the drawn placeholders and the 2D bay plan agree with this rule.
