# Phase 05 — A newly created custom item goes straight into hand

> Follow-up to phase 04, at the user's request: *"after create custom cargo please auto select that
> cargo"*.

## Context links

- `src/features/panels/CustomCargoForm.tsx` — `submit()`: parses, `addCustomCargo(item)`, clears the form
- `src/store/hand-slice.ts` — `setHand({ kind, id }, mode)`, the ONE writer of the hand
- `src/features/panels/UnplacedProjectCargoList.tsx` — the row click that does exactly this today
- `src/App.tsx` — the effect that rebuilds the plan and merges `customCargo` into it

## Overview

- **Priority:** low — a two-line convenience on top of a working feature.
- **Status:** not started.
- Today: type the dimensions, press Add, then FIND the new row in the unplaced list and click it. This
  phase removes that middle step — the item is in hand the moment it exists.

## Decision taken (user, 2026-09-17)

**Take it straight into hand, ready to place.** The same state a row click produces: hull hidden, area
placeholders lit, one click on the deck places it. The accepted cost is that the 3D view changes the
instant Add is pressed, which interrupts anyone about to type a second item.

## Key insights

- **`setHand` is all it takes.** The gesture machinery keys off `inHand`, and a picked project-cargo item
  needs nothing else: the ghost, the area drop plane, the chip and the commit all follow. This is one
  call, not a new path.
- **ORDERING IS THE WHOLE RISK.** `addCustomCargo` only writes the store slice; the item does not exist
  in `plan.breakbulk_cargo` until `App.tsx`'s effect re-runs and `withCustomCargo` merges it. Every
  consumer of the hand resolves the id AGAINST THE PLAN (`VesselScene`'s `item` lookup,
  `UnplacedProjectCargoList`'s `handItem`, `commitBreakbulkPlacement`). So for one render the hand can
  hold an id the plan does not know.
  - Those lookups are written defensively — `?? null`, and "an id that no longer resolves simply means
    no hand" (`VesselScene`) — so the transient state renders as "nothing in hand" rather than crashing.
    The effect then runs and everything resolves. **Verify this in the browser rather than trusting it**:
    an unresolved hand for one frame could leave the ghost or the drop plane unmounted.
  - If it does misbehave, the fix is to arm the hand in an effect that waits for the id to appear in
    `plan.breakbulk_cargo`, NOT to write the item into the plan directly (that reintroduces the
    rebuild-wipes-it problem phase 04 exists to solve).
- **A second Add replaces the hand.** That is `setHand`'s documented behaviour — one hand, always — and
  it is the right outcome: the newest item is the one being placed.

## Requirements

1. A successful Add leaves the new item in hand in PICK mode (not drag: no button is held).
2. The form still clears, and the panel still shows the "… is in hand" line for the new item.
3. A failed parse arms nothing and leaves the previous hand untouched.
4. Esc puts the item down; it stays in the unplaced list, exactly like any other picked item.
5. No change to the gesture machinery, the merge, or the placement rules.

## Architecture

In `CustomCargoForm.submit()`, after `addCustomCargo(result.item)`:

```ts
addCustomCargo(result.item);
// Straight into hand: the planner asked for it by typing it, so the next click should place it. PICK
// mode, not drag — no button is held. `setHand` replaces whatever was in hand, which is what a second
// Add should do.
setHand({ kind: "breakbulk", id: result.item.id }, "pick");
```

That is the whole change. `setHand` comes from `usePlanStore` in the same component.

## Related code files

**Modify**
- `src/features/panels/CustomCargoForm.tsx`

**Create / Delete** — none.

## Implementation steps

1. Add the `setHand` call after a successful add.
2. `npm run typecheck`, `npx vitest run src/`.
3. Browser, in this order — step 3b is the one that matters:
   a. add an item → the panel says "… is in hand", the hull hides, area placeholders appear;
   b. **watch for a one-frame gap**: the ghost and the drop plane must be live immediately, not after a
      pointer move. Hover the deck straight away and confirm a verdict chip appears;
   c. click the deck → it places;
   d. add a second item while the first is still in hand → the hand switches to the second;
   e. submit invalid input → nothing is armed, errors show.

## Todo list

- [ ] `setHand` after a successful add
- [ ] typecheck + existing suite green
- [ ] Browser: armed immediately, ghost live without a pointer move
- [ ] Browser: second Add replaces the hand; invalid input arms nothing

## Success criteria

- Typing dimensions and pressing Add leaves you one click away from a placed item.
- No frame where the hand is armed but the ghost/drop plane are missing.
- Invalid input changes nothing.

## Risk assessment

| Risk | Mitigation |
|---|---|
| Hand armed before the plan knows the id | The lookups already fail soft to "no hand"; step 3b verifies it. Fallback: arm in an effect once the id appears in `plan.breakbulk_cargo` |
| The view jumping on Add is unwelcome in practice | It is the chosen trade-off; the alternative (highlight only) is a one-line revert |
| Someone "fixes" the ordering by writing into the plan | Explicitly forbidden here — that is what phase 04's store slice exists to avoid |

## Security considerations

None — local state only.

## Next steps

None. If batch entry becomes a need, the "keep the form filled" variant is the natural extension.
