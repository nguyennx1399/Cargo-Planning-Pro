# Phase 02 — The 3D free-space view and its button

## Context links

- `src/features/viewer3d/SlotPlaceholders.tsx` — the instanced translucent-box technique, and `raycast={() => null}`
- `src/features/viewer3d/AreaPlaceholders.tsx` — area fill / outline / keep-out / occupied drawing, and the `LIFT` stacking order
- `src/features/viewer3d/area-rect-graphics.tsx` — `AreaRectFill`, `AreaRectOutline`
- `src/features/panels/ViewOptionsPanel.tsx` — where the view toggles and `Reset view` live
- `src/lib/drop-verdict.ts` — `slotVisible` / `areaVisible`
- `src/engine/free-space.ts` — phase 01's report

## Overview

- **Priority:** high — it is the button that was asked for.
- **Status:** implemented and verified in the app (2026-09-17).
- A toggle in View options that draws what is still free, with nothing in hand, plus phase 01's summary
  line beside it.

## Key insights

- **The drawing technique already exists twice** — `SlotPlaceholders` (one InstancedMesh over a slot set,
  `raycast={() => null}`) and `AreaPlaceholders` (fill + outline + grey obstacle rects). This phase
  composes those, it does not invent a renderer.
- **It must never become a pick layer.** Everything drawn here is `raycast={() => null}`. The free-space
  view is a hint with nothing in hand; the moment the planner picks something up, the per-item layers
  own the pointer and this layer should get out of the way.
- **Mutual exclusion with a gesture.** With an item in hand, `SlotPlaceholders`/`AreaPlaceholders` are
  already drawing the per-item answer. Two translucent layers over the same slots would read as noise
  and would disagree (the free view shows empty space, the gesture layer shows VALID space — different
  things). Decide one way: the free-space layer renders only while the hand is empty. State it in the
  component header.
- **"Taken", not "free", is what gets shaded** (the user's choice): placed footprints and keep-outs are
  painted grey over each area; whatever stays clear is free. That reuses `freeRegionsFor`-style data and
  makes no claim about what fits.
- **Empty container slots are drawn as ghost boxes** at 40'-cell size. The 20'/40' subtlety from phase 01
  applies visually too: draw the 40' cell, not the cell AND its two halves, or the picture triple-draws
  the same space.
- The deck toggles and the bay filter must apply (`slotVisible` / `areaVisible`), or the view shows room
  inside a hull the planner has hidden.

## Requirements

**Functional**

1. A "Free space" toggle in View options, off by default.
2. While on and NOTHING is in hand:
   - every empty container cell is drawn as a translucent ghost box, deck-split by the toggles;
   - each area's taken ground (placed cargo footprints + container stacks + keep-outs) is shaded, with
     the area outlined so the free remainder reads as a region;
   - phase 01's summary line is shown in the panel next to the toggle.
3. While something IS in hand, the free-space layer does not render — the per-item layers own the view.
4. Turning it off removes every drawn object; nothing is left behind.
5. Nothing drawn is pickable, and the pointer behaves exactly as it does today.

**Non-functional**

- One InstancedMesh for the empty cells, as `SlotPlaceholders` does; area rects are a handful of meshes.
- Computed once per (vessel, plan, view) via `useMemo` — never per frame.

## Architecture

New component `src/features/viewer3d/FreeSpaceView.tsx`, mounted inside the ship group in
`VesselScene`, beside the existing placeholder layers:

```tsx
{showFreeSpace && !handInUse ? <FreeSpaceView vessel={vessel} plan={plan} /> : null}
```

Inside:

- **Empty cells** — `allSlots(vessel)` (the 40' grid) minus occupied, filtered by `slotVisible`, drawn
  as one InstancedMesh of translucent boxes, distinctly tinted from the drop vocabulary (`DROP_TINT` is
  green/amber/red and means "this drop would…"; free space is not a verdict — use a neutral tint).
- **Areas** — for each visible area: `AreaRectOutline` for the boundary, plus grey `AreaRectFill` rects
  for each occupied footprint and keep-out, reusing `AreaPlaceholders`' own `KEEP_OUT`/`OCCUPIED` colours
  so "taken" looks the same everywhere in the app.

Store: `showFreeSpace: boolean` + `toggleFreeSpace()` in `usePlanStore`, beside the other view toggles.

Panel: the toggle and phase 01's `freeSpaceSummary(...)` line in `ViewOptionsPanel`, under the existing
checkboxes.

## Related code files

**Create**
- `src/features/viewer3d/FreeSpaceView.tsx`

**Modify**
- `src/store/usePlanStore.ts` (`showFreeSpace`, `toggleFreeSpace`)
- `src/features/viewer3d/VesselScene.tsx` (mount it, gated on the hand)
- `src/features/panels/ViewOptionsPanel.tsx` (toggle + summary line)

**Delete** — none.

## Implementation steps

1. Store toggle + a nonce-style test like `view-reset.test.ts`.
2. `FreeSpaceView`: empty cells first (it is the bigger visual), then the area shading.
3. Mount in `VesselScene`, gated on `showFreeSpace && !handInUse`.
4. Toggle + summary in `ViewOptionsPanel`.
5. `npm run typecheck`, `npx vitest run src/`.
6. Browser:
   - loaded demo plan → toggle on → ghost boxes appear only where slots are genuinely empty (spot-check
     one against the inspector's "Empty slot …" readout);
   - untick "Under deck" → the under-deck ghosts and hold shading disappear;
   - pick a container → the free-space layer disappears, the per-item placeholders take over; Esc →
     it comes back;
   - toggle off → the scene is exactly as before;
   - clear the cargo → free space grows and the summary line rises.

## Todo list

- [x] `showFreeSpace` + `toggleFreeSpace` in the store (test deferred)
- [x] `FreeSpaceView` — empty 40' cells as one InstancedMesh + taken-ground shading per area
- [x] Mounted in `VesselScene`, gated on `showFreeSpace && !gestureActive`
- [x] Toggle + summary + caveat in View options
- [x] typecheck clean; existing suite green
- [x] Browser checks

### Verified in the app

| Check | Result |
|---|---|
| Toggle on | summary line appears; with the hull hidden, a pale haze of empty cells fills the unused stow volume, areas outlined |
| Pick a container | the free-space layer disappears and the GREEN per-item placeholders take its place — the toggle stays on and the layer returns on Esc |
| Toggle off | scene returns exactly as before |

### Judgment call worth revisiting

The ghost cells are drawn at **opacity 0.12** in a neutral blue. That reads as a soft haze rather than
distinct boxes — deliberately unobtrusive, but arguably too faint to count cells by eye. It is a
one-number change in `FreeSpaceView.tsx` (`FREE_CELL_COLOR` / the material opacity) if a stronger
picture is wanted.

## Success criteria

- One click shows where the room is, with nothing in hand.
- The picture agrees with the summary numbers and with the app's own empty-slot readout.
- The layer never intercepts a click and never coexists with a gesture's own placeholders.

## Risk assessment

| Risk | Mitigation |
|---|---|
| The view is drawn over a gesture's placeholders | Gated on `!handInUse`; stated in the component header |
| Ghost boxes steal the pointer | `raycast={() => null}`, like every other drawn layer |
| Free-space tint reads as a verdict | A neutral colour, deliberately outside `DROP_TINT` |
| The same space drawn three times (40' cell + two halves) | Draw the 40' grid only — same rule as phase 01's counting |
| Hundreds of ghost boxes hurt the frame rate | One InstancedMesh, the technique already used for ~900 slot volumes |

## Security considerations

None — view state only.

## Next steps

If "where does THIS item fit" is wanted later, that is a different feature: it needs the per-item sweep
(`validSlotsFor` / the free-space scan), not this occupancy picture.
