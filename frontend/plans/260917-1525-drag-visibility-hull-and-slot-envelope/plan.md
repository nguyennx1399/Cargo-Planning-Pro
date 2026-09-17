# Drag-time visibility: hide the hull, show the whole drop set, outline it

Request: *when dragging, hide the hull and show all available placeholders and a border, in general, of
the available area.*

## What already exists (checked, not assumed)

| Behaviour | Project cargo | Containers |
|---|---|---|
| Hull hides during the gesture | yes — but only when "Under deck" is ticked (`VesselScene.tsx:107`) | **no** |
| Every valid target drawn | yes (`AreaPlaceholders`: fill per area) | yes (`SlotPlaceholders`: one box per VALID slot, verdict-tinted) |
| Border around the target region | yes (`AreaRectOutline`, plus keep-outs, taken ground, labels) | **no** |

So the gap is entirely on the CONTAINER path, plus a hull rule that is narrower than the request.
"Show all available placeholders" needs no new drawing: `SlotPlaceholders` already draws every valid
slot. They were invisible because the hull stood in front of them.

## Decisions taken (user, 2026-09-17)

1. **Hull hides for ANY gesture, both cargo kinds, regardless of the deck toggles.** Simple rule, one
   condition in `VesselScene`.
2. **A drag does NOT override the bay filter or the deck toggles.** The placeholder layer and the pick
   layer keep sharing `slotVisible` — the invariant in `drop-verdict.ts` ("a box can never be dropped
   into a bay or deck the planner cannot see"). Hiding the hull is what makes the hidden-but-valid
   slots visible; nothing else changes.
3. **The border is one outline per deck level** — the bounding rect of the valid slots on deck, and
   another for the under-deck set — drawn with the same `AreaRectOutline` project cargo already uses,
   so both cargo kinds speak one visual language.

## Phases

| # | Phase | Status | Priority |
|---|-------|--------|----------|
| 01 | [Hull hides for any gesture](phase-01-hide-hull-for-any-gesture.md) | implemented, verified live | high |
| 02 | [Valid-slot envelope outline](phase-02-valid-slot-envelope-outline.md) | implemented, verified live | medium |

Independent: 01 is a one-condition change, 02 adds a layer. 01 first, because 02's outline is mostly
invisible under a hull.

## Ground rules

- No new placement rule and no second visibility rule: `slotVisible` stays the one answer to "is this
  slot part of this gesture", shared by the drawn layer and the pick layer.
- The envelope is a HINT, never a promise: the per-slot placeholders remain the precise answer, and the
  predicate remains the only authority on a specific slot.
- Files stay under 200 LOC; the envelope arithmetic is pure and node-tested, the component only draws.

## Verification constraint (learned the hard way this session)

The browser tooling cannot drive a held-button drag — R3F's 4 px press threshold never fires from
synthetic input. **Verify through the PICK path instead** (click an unplaced row, which arms the same
`inHand` field through `setHand`), and read the scene with screenshots. Both phases are fully
observable that way.
