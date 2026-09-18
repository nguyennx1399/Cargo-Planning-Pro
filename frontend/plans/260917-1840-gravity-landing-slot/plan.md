# Gravity: a drop lands on the stack top, it is not refused

Request: *if there is no container below and you push on top of that container, it's still valid, and
it's automatically set to nearest below.*

Read as: aiming at a tier with nothing under it should not be a refusal. The box should fall to the
first tier in that column that is actually supported, and the drop should succeed there.

## What happens today

- `canPlaceContainer` emits `no_floating` for any tier whose cell below is empty, so the whole upper
  part of an empty column is red. The planner has to find the one supported tier by eye.
- `EmptySlotPicker.resolveSlot` (`:116`) picks the slot nearest the pointer and writes it to
  `hoveredSlot`; the ghost, the chip, the cursor and the commit all read that one field.
- `SlotPlaceholders` draws every slot from `validSlotsFor`, which today means "the supported one per
  column" is buried in a cloud that mostly cannot be used.
- The 2D bay plan commits a slot through the same resolver (`BayPlanView.tsx:95`).

## Decisions taken (user, 2026-09-17)

1. **Gravity, not a special case.** Aim anywhere in a column → the box lands on the lowest FREE and
   SUPPORTED tier of that column. The ghost and the chip show the landing slot, never the cursor's
   tier, so what is drawn is what will happen.
2. **Placeholders show only real landing slots** — one per column. Every drawn target is exactly where
   the box goes.
3. **The `no_floating` rule itself does not change.** Nothing floating is ever written to the plan; the
   TARGET moves down so the placement is supported. The validator, the plan-wide report and the
   support guard from the earlier plan all stay as they are.

## Phases

| # | Phase | Status | Priority |
|---|-------|--------|----------|
| 01 | [Landing-slot rule + pointer path](phase-01-landing-slot-rule-and-pointer-path.md) | implemented, verified (tests deferred) | high |
| 02 | [Placeholders and the 2D bay plan](phase-02-landing-placeholders-and-bay-plan.md) | implemented, verified (tests deferred) | medium |
| 03 | [Arrow-key pan + bay rebind](phase-03-arrow-key-pan-and-bay-rebind.md) | implemented, verified (tests deferred) | medium |
| 04 | [Custom project cargo](phase-04-custom-project-cargo.md) | implemented, verified (tests deferred) | medium |
| 05 | [Auto-pick a new custom item](phase-05-auto-pick-new-custom-cargo.md) | not started | low |

01 first: it defines the rule and makes the 3D drop behave. 02 makes the drawn layer and the other
trigger agree with it — without 02 the placeholder cloud contradicts the new drop.

03 is unrelated to gravity and is carried here at the user's request. It started as "click and drag to
rotate the 3D model", which **already works** (left-drag orbits; the ship was orbited by hand earlier
today). The clarified requirement is different: *"tôi muốn dùng phím sang trái / phải để đẩy dịch
overview modal qua trái hoặc phải"* — the LEFT/RIGHT ARROW KEYS should slide the 3D view sideways.
That is keyboard PANNING, and it is a REBIND: those keys currently step the bay filter, which moves to
`[` / `]`. The already-working drag gestures are documented in that phase rather than rebuilt.

05 is a two-line follow-up to 04: a newly created item goes straight into hand, so typing dimensions
leaves you one click from a placed piece.

04 is also independent: a form to define project cargo by its own dimensions, which then places like
any other item. The drag half is FREE — every gesture path already keys off `plan.breakbulk_cargo`, so
the work is the form, a `general` box shape for the closed category union, and surviving the plan
rebuild that toggles trigger.

## Ground rules

- The landing rule is PURE and node-tested; no component computes it inline.
- It is a TARGET rule, never a placement rule: the landing slot still goes through
  `canPlaceContainer`, so reefer plugs, stack weight, clear height, overstow and cell conflicts are
  unaffected and can still refuse the drop.
- Columns never cross the deck line: a box aimed on deck lands on deck (tier 82 rests on the hatch
  cover), and never falls into the hold.
- 20'/40' halves keep their existing meaning — "free" and "supported" are per half, via `bayPosition`.

## Verification

Both triggers are click-driven, so the whole path is drivable in the browser: pick a box, aim high in
an empty column, confirm the ghost sits on the stack top, click, confirm the plan gained a placement at
that tier and `validatePlan` reports no new `no_floating`.
