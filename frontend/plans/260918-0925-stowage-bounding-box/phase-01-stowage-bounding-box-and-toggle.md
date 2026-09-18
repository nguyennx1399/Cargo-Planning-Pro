# Phase 01 — Stowage bounding box + its toggle

## Context links

- `src/lib/slot-envelope.ts` — `slotEnvelopes(slots, heightM)`: per-deck bounding RECT + floor `y`
- `src/engine/all-slots.ts` — `allSlots(vessel)`, the 40' grid derived from `vessel.stacks`
- `src/engine/stowage-model/types.ts` — `SlotDef` (`rect`, `center`, `deck`)
- `src/lib/geometry.ts` — `DIM` (box dimensions), `slotToPosition`
- `src/features/viewer3d/area-rect-graphics.tsx` — `AreaRectOutline`, the existing rect-outline mesh
- `src/features/viewer3d/FreeSpaceView.tsx` — the most recent example of a view-toggle layer
- `src/features/panels/ViewOptionsPanel.tsx` — where the toggles live

## Overview

- **Priority:** medium — an orientation aid, not a planning rule.
- **Status:** implemented, tested and verified in the app (2026-09-18).
- A "Stowage box" toggle that draws a wireframe around the on-deck and under-deck cargo volumes.

## Key insights

- **`slot-envelope.ts` is 2D today.** It returns a rect and ONE height (the floor of the lowest tier),
  because the drag-time outline lies flat on the deck. A box needs the vertical extent too: the floor of
  the lowest tier to the TOP of the highest. Extend that module — it already owns "the extent of a slot
  set", and a second envelope rule would drift from the outline the drag path draws.
- **The top is a tier top, not a tier centre.** `SlotDef.center` is the middle of the box that would
  stand there, so the volume's ceiling is `max(center.y) + boxHeight / 2`. Using the centre would draw a
  box that slices the top row of cargo in half — the same mistake the existing `y` comment warns about
  for the floor.
- **Which box height?** `DIM.height` (standard) vs `DIM.heightHC` (high cube). The drag-time envelope
  uses the CANDIDATE's height because there is a candidate; here there is none. Use the standard
  `DIM.height` and say so in the header: the box describes the grid, not any particular box, and a
  high-cube on the top tier will poke out by 0.3 m. The alternative (always high-cube) over-states the
  volume for every vessel.
- **Derive from the grid, not the plan.** `allSlots(vessel)` — occupancy is irrelevant to "where can
  cargo go at all", and using placements would make the box shrink as cargo is removed, which is the
  opposite of what it means.
- **Nothing new is needed to draw lines**: drei's `<Edges>` (used by the ghosts and the hull) around a
  `boxGeometry`, or an `EdgesGeometry` like `AreaRectOutline` builds. Prefer `<Edges>` on a box —
  fewer moving parts, and the box is the shape being described.

## Open question — the bay filter

The deck toggles clearly apply. The BAY FILTER is genuinely ambiguous: with one bay selected, should the
box shrink to that bay, or keep describing the whole vessel?

**Proposal, to confirm during implementation:** the box follows the bay filter, because every other
drawn layer does (`slotVisible`) and a box labelled "the stowage volume" that ignores a filter the
planner has set reads as a bug. If it proves confusing, the alternative is to ignore the filter and
always describe the vessel — a one-line change either way.

## Requirements

**Functional**

1. A "Stowage box" toggle in View options, off by default.
2. While on: one wireframe box per deck level that has slots — on deck and under deck — spanning that
   level's full bay/row extent and from its lowest tier's floor to its highest tier's top.
3. The deck toggles apply: hiding a deck hides its box.
4. It stays visible during a drag or a pick (unlike the free-space view, which yields).
5. Nothing drawn is pickable.
6. Turning it off leaves nothing behind.

**Non-functional**

- The extent maths stays in `lib/slot-envelope.ts`, pure and node-testable; the component only draws.
- Computed once per (vessel, toggles) — it does not depend on the plan at all, so it must not be
  recomputed when cargo moves.

## Architecture

**Extend** `src/lib/slot-envelope.ts`:

```ts
export interface SlotEnvelopeBox {
  deck: "on" | "under";
  rect: Rect;      // same convention as SlotEnvelope.rect
  floorY: number;  // base of the lowest tier
  ceilY: number;   // top of the highest tier
}

/** The VOLUME each deck level's slots occupy — the flat `slotEnvelopes` plus a ceiling. */
export function slotEnvelopeBoxes(slots: readonly SlotDef[], boxHeightM: number): SlotEnvelopeBox[];
```

Keep `slotEnvelopes` as it is — the drag-time outline still wants the flat answer, and widening its
return type would touch a path that is already verified.

**New component** `src/features/viewer3d/StowageBoundingBox.tsx`:

```tsx
// one <mesh> per deck level: boxGeometry sized to the envelope, transparent material, <Edges> for the
// wireframe, raycast={() => null}
```

Position: rect centre in scene coordinates (`placementXToSceneX` for x, plain z), y at
`(floorY + ceilY) / 2`; size `[xMax - xMin, ceilY - floorY, zMax - zMin]`.

**Store**: `showStowageBox: boolean` + `toggleStowageBox()` in `usePlanStore`, beside `showFreeSpace`.

**Mount**: in `VesselScene` inside the ship group, NOT gated on the hand:

```tsx
{showStowageBox ? <StowageBoundingBox vessel={vessel} /> : null}
```

**Panel**: a toggle in `ViewOptionsPanel` next to "Show free space".

## Related code files

**Create**
- `src/features/viewer3d/StowageBoundingBox.tsx`

**Modify**
- `src/lib/slot-envelope.ts` (add `slotEnvelopeBoxes`)
- `src/store/usePlanStore.ts` (`showStowageBox`, `toggleStowageBox`)
- `src/features/viewer3d/VesselScene.tsx` (mount)
- `src/features/panels/ViewOptionsPanel.tsx` (toggle)

**Delete** — none.

## Implementation steps

1. `slotEnvelopeBoxes` in `slot-envelope.ts`, with a header note on the standard-height assumption.
2. Store toggle.
3. `StowageBoundingBox` component; `<Edges>` on a transparent box, `raycast={() => null}`.
4. Mount in `VesselScene` (not gated on the hand) + the panel toggle.
5. `npm run typecheck`, `npx vitest run src/`.
6. Browser:
   - toggle on → two wireframe boxes, one hugging the on-deck stacks and one around the hold volume;
   - untick "Under deck" → the lower box goes;
   - pick a container → the box stays (the difference from the free-space view);
   - select a bay → confirm the bay-filter behaviour and record which way it went;
   - toggle off → nothing left behind.

## Todo list

- [x] `slotEnvelopeBoxes` (+ its header note on box height)
- [x] `showStowageBox` / `toggleStowageBox`
- [x] `StowageBoundingBox` component
- [x] Mount (NOT gated on the hand) + panel toggle
- [x] typecheck clean; `npx vitest run src/` = 91 files / 726 tests (+7 new, see below)
- [x] Browser checks, including the bay-filter decision

### Deviation — the fold is SHARED, not duplicated

`slotEnvelopes` (the drag-time outline) and the new `slotEnvelopeBoxes` now both call one private
`foldByDeck`, instead of the box getting its own copy of the min/max loop. The flat outline's output is
unchanged — its existing 8 tests still pass untouched — and the two can no longer disagree about a
level's footprint or floor. One of the new tests pins exactly that agreement.

### Tests added (default cook mode, no `--not-test` this time)

7 cases in `src/lib/__tests__/slot-envelope.test.ts`: empty set; every WHOLE box of each level enclosed
(floor under its base, ceiling over its top) on both vessels; the ceiling is a tier top, not a centre;
box and flat outline agree on footprint and floor on both vessels; the two deck volumes do not overlap.

### Verified in the app (BBC SAO PAULO, hull hidden to see inside)

| Check | Result |
|---|---|
| Toggle on | two wireframes — one around the on-deck stacks, one around the hold volume |
| Untick "Under deck" | the lower box goes, the on-deck one stays |
| Pick a container | both boxes STAY, alongside the green drop placeholders |
| Bay filter → Bay 10 | both boxes shrink to that bay alone |

### Open question — resolved

**The box follows the bay filter**, as proposed: with Bay 10 selected it describes Bay 10. That matches
every other drawn layer (`slotVisible`). If the planner would rather keep the whole-vessel envelope while
filtering, it is a one-line change in `StowageBoundingBox.tsx` (drop the `bayFilter` from the visibility
filter).

## Success criteria

- One click shows where cargo may go, as two clean wireframes.
- The boxes enclose every slot of their deck and no more (spot-check the top row is inside, not bisected).
- Visible during a gesture; hidden per deck toggle; nothing pickable.

## Risk assessment

| Risk | Mitigation |
|---|---|
| Box bisects the top row of cargo | Ceiling is `max(center.y) + height/2`, not a centre; checked in the browser |
| A second envelope rule drifts from the drag-time outline | Extend `slot-envelope.ts`; `slotEnvelopes` untouched |
| Wireframe competes with the drop layers | Thin edges only, no fill; that is why it may stay on during a gesture |
| High-cube boxes poke through the ceiling | Accepted and documented — the box describes the grid, not a particular container |
| Recomputed on every plan change | Derived from `vessel` + toggles only; memo keyed on those |

## Security considerations

None — view state only.

## Next steps

If per-item debug boxes are ever wanted (the option not taken today), that is a different layer and
should not reuse this one: it would be keyed by placement, not by the grid.
