# "Free space" view — see what room is left on the vessel

Request: *a button that can see all the rest available space on vessel.*

## What exists today

Room is only ever shown **while something is in hand**: `SlotPlaceholders` draws valid slots for the box
being placed, `AreaPlaceholders` draws the areas for the project-cargo item being placed, and both
render nothing when the hand is empty. There is no way to ask "what is still free?" without first
picking something up — and the answer you do get is shaped to that one item.

The raw material is already there, though:

- `model.slots` minus `plan.placements` → every empty container slot (the engine already does this in
  `EmptySlotPicker` to build its pick volumes);
- `freeRegionsFor(...).occupied` → placed project cargo + container stack footprints per area;
- `freeRegionsFor(...).keepOuts` → the area's keep-outs, already clipped to the area rect;
- `occupiedRectsByArea` → the same footprints keyed by area, without needing an item in hand.

## Decisions taken (user, 2026-09-17)

1. **Both a picture and a number.** A toggle draws the free space in 3D, and a summary line reports the
   totals.
2. **Free ground is shown by shading what is TAKEN**, leaving the free ground clear. This reuses data
   the engine already produces and avoids inventing a rectangle-decomposition algorithm the codebase
   does not have. Honest by construction: the shaded rects are real obstacles, and "clear" means
   "nothing known is there", not "a 20 × 6 m item fits here".

## Phases

| # | Phase | Status | Priority |
|---|-------|--------|----------|
| 01 | [Free-space model + summary](phase-01-free-space-model-and-summary.md) | implemented, cross-checked (tests deferred) | high |
| 02 | [The 3D view and its toggle](phase-02-free-space-3d-view-and-toggle.md) | implemented, verified (tests deferred) | high |

01 computes and words the numbers (pure, testable, useful on its own). 02 draws it and adds the button.

## Ground rules

- **No new placement rule and no promises.** This view REPORTS state; it never says an item would fit.
  The moment the planner picks something up, the existing per-item layers take over and remain the
  authority.
- Reuse `validSlotsFor` / `freeRegionsFor` / `occupiedRectsByArea` rather than re-deriving occupancy —
  the codebase already has one definition of "what is taken" and this must not become a second.
- The view respects the deck toggles and the bay filter, like every other drawn layer
  (`slotVisible` / `areaVisible`), or it will show room the planner cannot see or reach.
- Files under 200 LOC; the arithmetic is pure and node-testable, the components only draw.

## Honest limitation to carry into the UI wording

"Free" here means **not occupied and not a keep-out**. It says nothing about whether a specific item
fits: stack weight, clear height, deck rating, reefer plugs, 20'/40' parity and overstow are all
per-item rules. The summary must therefore read as "space left", never "you can load this".
