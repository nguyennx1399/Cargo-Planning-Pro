# "Bounding box" — a wireframe around the stowage volume

Request: *a button that shows the bounding box*, clarified to mean **the stowage envelope — the volume
cargo can occupy**, not the hull and not per-item debug boxes.

## Decisions taken (user, 2026-09-18)

1. **One box per deck level** — an on-deck volume and an under-deck volume, not one box spanning both.
   The decks are physically separate spaces split by the hatch covers, `slot-envelope.ts` already splits
   its rects that way, and a single box would enclose deck structure that is not stowage space.
2. **Always available** — a plain view toggle beside Hull / On deck / Under deck. It stays on during a
   gesture: a thin wireframe does not compete with the drop layers the way a translucent mass would.

## What already exists

`src/lib/slot-envelope.ts` computes, per deck level, the bounding RECT of a slot set plus that level's
floor `y`. It was built for the drag-time outline and is used by `SlotPlaceholders`. It is 2D — a rect
and one height — so this plan's work is the **vertical extent** (floor of the lowest tier to the top of
the highest) and the wireframe that draws it.

Also relevant: `AreaRectOutline` (`area-rect-graphics.tsx`) draws a rect outline from an `EdgesGeometry`,
and drei's `<Edges>` is used by the ghosts and the hull for wireframes — so nothing new is needed to
render lines.

## Single phase

| # | Phase | Status | Priority |
|---|-------|--------|----------|
| 01 | [Stowage bounding box + toggle](phase-01-stowage-bounding-box-and-toggle.md) | implemented, tested, verified | medium |

One phase: the extension is small and the toggle is trivial; splitting them would create a phase whose
only deliverable is an unused function.

## Ground rules

- Extend `slot-envelope.ts` rather than writing a second envelope rule — it already owns "the bounding
  extent of a slot set", and a second definition would drift from the drag-time outline.
- The box is derived from the SLOT GRID (`allSlots` / `model.slots`), not from the hull geometry or from
  what is currently placed: it answers "where can cargo go at all", which does not change as the plan
  changes.
- Deck toggles apply (an envelope for a deck the planner has hidden is clutter). The bay filter is an
  open question — see the phase file.
- `raycast={() => null}` on everything drawn, like every other hint layer.
