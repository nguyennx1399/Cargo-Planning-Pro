# Phase 03 — Arrow keys pan the 3D view; bay stepping moves to `[` / `]`

> Carried in this plan at the user's request; unrelated to the gravity rule in phases 01–02.
>
> **What was asked, after clarification:** *"tôi muốn dùng phím sang trái / phải để đẩy dịch overview
> modal qua trái hoặc phải"* — the LEFT/RIGHT ARROW KEYS should shift the 3D view sideways. This is
> keyboard PANNING of the camera, not rotation. (My first reading was drag-to-rotate; that already
> works and is only documented here, not built.)

## Context links

- `src/features/panels/Sidebar.tsx` — the `useEffect` that currently binds ArrowLeft/ArrowRight to the BAY FILTER
- `src/features/panels/use-stowage-keyboard-shortcuts.ts` — the other global key handler (undo/redo, Esc, R, Delete); its header states the two handler sets are deliberately disjoint
- `src/features/viewer3d/VesselScene.tsx` — `ViewReset` + `DEFAULT_CAMERA`, the established "sidebar asks, canvas acts" pattern via a store nonce
- `src/features/panels/ViewOptionsPanel.tsx` — the bay stepper buttons (`ChevronLeft`/`ChevronRight`), which must keep working

## Overview

- **Priority:** medium — a direct usability request.
- **Status:** implemented and verified in the app (2026-09-17).
- Arrow keys currently step the bay filter. They will pan the camera instead, and bay stepping moves to
  `[` and `]`.

## Key insights

- **This is a rebind, not just an addition.** ArrowLeft/ArrowRight are taken today (`Sidebar.tsx`), and
  the app's own bay-navigation hint text mentions them. Both the binding AND its documentation move.
- **The sidebar cannot touch the camera.** Same constraint `Reset view` hit: the key handler lives
  outside the `<Canvas>`. Reuse the pattern that phase already established — the store carries a
  request, an in-canvas component applies it. Do NOT smuggle the controls object out.
- **Panning must move BOTH `camera.position` and `controls.target`.** Moving only the camera orbits;
  moving both translates the view. three's `OrbitControls.pan()` is internal, so this is a small vector
  computation: the screen-right vector is `direction × up`, flattened to the horizontal plane.
- **Step size should scale with zoom**, as a fraction of the camera-to-target distance (~8%). A fixed
  metre step feels enormous when zoomed in and useless when zoomed out.
- **Up/Down arrows are deliberately NOT bound.** They are the browser's own scroll keys for the sidebar
  column, and hijacking them globally would break scrolling in a panel-heavy UI. Left/Right are safe
  because nothing scrolls horizontally. The user asked for left/right only.
- **Already works, document only:** left-drag on empty water orbits the ship in all directions
  (`maxPolarAngle 0.49π` stops it at the horizon); right-drag / two-finger drag pans; the wheel zooms to
  the pointer. Left-drag starting ON cargo moves that box instead — by design. `OrbitLock` suspends the
  controls only while a cargo DRAG is held, not while an item is merely PICKED.

## Requirements

**Functional**

1. ArrowLeft / ArrowRight pan the 3D view horizontally, by a step proportional to the current zoom.
2. Bay stepping is rebound to `[` (previous bay) and `]` (next bay); the sidebar's chevron buttons are
   unchanged and remain the discoverable path.
3. The bay-navigation hint text in the UI names the new keys.
4. Typing in a text field is never hijacked — the existing INPUT/TEXTAREA guard still applies, and it is
   load-bearing because of the Unplaced search box.
5. Arrow keys do nothing while a cargo DRAG is in flight (the controls are locked then anyway).
6. `Reset view` still recovers the framing after panning.

**Non-functional**

- One keyboard handler owns arrows; the two existing handler sets stay disjoint (see the hook's header).
- The pan maths is a pure function with its own test; the component only wires it.

## Architecture

**Pure rule** — `src/lib/camera-pan.ts`:

```ts
/** How far one key press moves the view: a fraction of the camera-to-target distance, so the step
 * feels the same at every zoom level. */
export const PAN_STEP_FRACTION = 0.08;

/** The world-space offset for one horizontal pan step. `dx` is -1 (left) or +1 (right). Pure vector
 * maths: screen-right = normalize(flatten(direction × up)), scaled by the distance-proportional step. */
export function horizontalPanOffset(
  cameraPos: Vec3, target: Vec3, up: Vec3, dx: -1 | 1,
): Vec3;
```

**Store** — the request, following `viewResetCount`:

```ts
viewPan: { seq: number; dx: -1 | 1 };   // seq bumped per press
panView: (dx: -1 | 1) => void;
```

**In canvas** — beside `ViewReset`:

```tsx
function ViewPan() {
  const { seq, dx } = usePlanStore((s) => s.viewPan);
  // on seq change: offset = horizontalPanOffset(camera.position, controls.target, camera.up, dx);
  //                camera.position.add(offset); controls.target.add(offset); controls.update();
}
```

**Keys** — in `use-stowage-keyboard-shortcuts.ts`, which already owns the global handler and its typing
guard:

| Key | Before | After |
|---|---|---|
| ArrowLeft / ArrowRight | step bay filter | **pan view** |
| `[` / `]` | — | **step bay filter** |

Delete the arrow `useEffect` from `Sidebar.tsx` in the same change — the hook's header explicitly says
that if arrow navigation ever moves into the hook, that effect must go with it, or one press will be
acted on twice.

## Related code files

**Create**
- `src/lib/camera-pan.ts`
- `src/lib/__tests__/camera-pan.test.ts`

**Modify**
- `src/store/usePlanStore.ts` (`viewPan`, `panView`)
- `src/features/viewer3d/VesselScene.tsx` (`ViewPan` beside `ViewReset`; header note on the gestures)
- `src/features/panels/use-stowage-keyboard-shortcuts.ts` (arrows → pan, brackets → bay)
- `src/features/panels/Sidebar.tsx` (remove the arrow effect)
- `src/features/panels/ViewOptionsPanel.tsx` or wherever the bay hint text lives (name the new keys)

**Delete** — none.

## Implementation steps

1. `camera-pan.ts` + tests: offset is perpendicular to the view direction, horizontal (y ≈ 0), scales
   with distance, and `dx = -1` is the exact negation of `dx = +1`.
2. Store field + action, with a nonce test like `view-reset.test.ts`.
3. `ViewPan` in the canvas.
4. Move the key bindings; delete the Sidebar effect; update the hint text.
5. `npm run typecheck`, `npx vitest run src/`.
6. Browser: press Left/Right → the ship slides sideways, does not rotate; hold a pick and pan → still
   works; type in the Unplaced search box and press arrows → the caret moves, the view does not; press
   `[` / `]` → the bay filter steps; `Reset view` re-frames.

## Todo list

- [x] `camera-pan.ts` (tests deferred)
- [x] `viewPan` / `panView` in the store
- [x] `ViewPan` component beside `ViewReset`
- [x] Arrows → pan, `[` / `]` → bay; the Sidebar arrow effect DELETED (with its now-dead `gotoBay`,
      `bayIndex` and `useEffect` import)
- [ ] Hint text naming the new keys — NOT done, the bay hint still implies arrows
- [x] typecheck clean; existing suite green
- [x] Browser: ArrowLeft ×5 slid the ship across the frame at an unchanged viewing angle (a
      translation, not an orbit); `]` twice stepped Bay 02 → Bay 06
- [ ] Text-field guard not re-verified in the browser (the existing INPUT/TEXTAREA guard was left intact)

## Success criteria

- Left/Right arrows slide the view horizontally at any zoom level.
- Bay stepping still available, on `[` / `]` and on the existing buttons, and no key is handled twice.
- Typing in the search box is unaffected.

## Risk assessment

| Risk | Mitigation |
|---|---|
| Arrow press handled twice (hook + Sidebar effect) | The Sidebar effect is deleted in the same change; the hook's own header calls this out |
| Panning drifts the view with no way back | `Reset view` already exists (previous plan) and is part of the browser check |
| Step feels wrong at some zoom | Proportional to camera-to-target distance; tune `PAN_STEP_FRACTION` in the browser check |
| Users lose bay stepping because `[` `]` are undiscoverable | The sidebar chevron buttons remain the primary path; the hint text names the keys |
| Up/Down expected too | Deliberately not bound (browser scrolling); trivially added later if asked |

## Security considerations

None — camera and view state only.

## Next steps

If horizontal panning proves useful, vertical panning is the obvious follow-up — but it needs a key
that is not the browser's scroll key.
