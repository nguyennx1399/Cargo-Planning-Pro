# Phase 02 — Zoom to pointer + reset view

## Context links

- `src/features/viewer3d/VesselScene.tsx:127` — `<OrbitControls makeDefault target={[0, 0, 0]} maxPolarAngle={…} />`
- `src/features/viewer3d/VesselScene.tsx:36` — `OrbitLock`, which already reaches the controls via `useThree(s => s.controls)`
- `src/features/panels/ViewOptionsPanel.tsx` — where the Hull / On deck / Under deck toggles live
- `src/store/usePlanStore.ts` — the view store the sidebar and the canvas already share

## Overview

- **Priority:** medium — a usability annoyance, not a defect.
- **Status:** implemented and verified in the app (2026-09-17).
- The wheel currently moves the camera along the line to the orbit target (ship centre), so zooming in
  on a specific bay means zoom, orbit, pan, repeat.

## Key insights

- `zoomToCursor` is a first-class OrbitControls option in three 0.170, and drei 10 forwards unknown
  props straight to the controls — so the zoom half is ONE prop, not a custom controller. Resist
  hand-rolling wheel maths.
- The cost of `zoomToCursor` is that it MOVES `controls.target`. After a few zooms the target can sit
  off the ship, and orbiting then swings the camera around empty sea. Nothing in the app re-centres
  today, which is why the reset control is part of this phase rather than a follow-up.
- The sidebar button lives OUTSIDE the Canvas and cannot touch the controls directly. The established
  pattern in this codebase is a store field the in-canvas side reacts to (`playbackCount`,
  `exaggerate`, the deck toggles all work that way) — a counter/nonce, not a controls ref smuggled out
  through a module-level variable.
- `OrbitLock` already disables the controls during a held drag; zoom-to-cursor does not interact with
  it (no wheel events are expected mid-drag, and a disabled control ignores them anyway).

## Requirements

**Functional**

1. The wheel zooms toward/away from the POINTER, not the ship's centre.
2. A "Reset view" control in View options returns the camera to the app's default framing and the orbit
   target to the ship's centre.
3. Reset works from any state, including after the target has drifted, and does not disturb the plan,
   the selection or a gesture in flight.

**Non-functional**

- No custom wheel handling, no per-frame work added to the render loop.
- The reset must not fight `OrbitControls`: set camera position + target, then `controls.update()`.

## Architecture

**Zoom:** add `zoomToCursor` to the existing element. That is the whole change.

```tsx
<OrbitControls makeDefault zoomToCursor target={[0, 0, 0]} maxPolarAngle={Math.PI * 0.49} />
```

**Reset:** a nonce in the view store plus a tiny in-canvas listener.

```ts
// usePlanStore
viewResetCount: number;          // incremented by the button
resetView: () => void;           // viewResetCount + 1
```

```tsx
// VesselScene — sibling of OrbitLock, same useThree(s => s.controls) access
function ViewReset({ initial }: { initial: [number, number, number] }) {
  const count = usePlanStore((s) => s.viewResetCount);
  const controls = useThree((s) => s.controls) as unknown as { target: THREE.Vector3; update(): void } | null;
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    if (!controls || count === 0) return;   // count 0 = never pressed; do not fight the initial camera
    camera.position.set(...initial);
    controls.target.set(0, 0, 0);
    controls.update();
  }, [count, controls, camera, initial]);
  return null;
}
```

The default camera position is already a literal in `VesselScene` (`[90, 55, 90]`); lift it to a named
constant so the Canvas and the reset cannot drift apart. A vessel-aware framing (fit to LOA) is NOT in
scope — the two demo vessels differ by 40 m and the default view covers both.

The button goes in `ViewOptionsPanel` next to the existing toggles, calling `resetView()`.

## Related code files

**Create** — none (the reset component is ~12 lines inside `VesselScene`, beside `OrbitLock`).

**Modify**
- `src/features/viewer3d/VesselScene.tsx` (`zoomToCursor`, `DEFAULT_CAMERA`, `ViewReset`)
- `src/store/usePlanStore.ts` (`viewResetCount`, `resetView`)
- `src/features/panels/ViewOptionsPanel.tsx` (the button)
- `src/store/__tests__/…` — a small test that `resetView()` increments the nonce and that
  `resetForVesselChange` does not clobber it

**Delete** — none.

## Implementation steps

1. Add `zoomToCursor`; verify in the browser that the wheel now tracks the pointer.
2. Lift the camera literal to `DEFAULT_CAMERA`.
3. Add `viewResetCount`/`resetView` to the store, with the nonce test.
4. Add `ViewReset` beside `OrbitLock`; guard `count === 0` so a fresh session does not re-set the
   camera on mount.
5. Add the button to View options.
6. `npm run typecheck`, `npx vitest run src/`.
7. Browser check: zoom with the pointer over the bow → the bow grows under the cursor; zoom repeatedly
   off to one side until the ship is off-centre → press Reset view → the ship is framed again; confirm
   the selection and any in-hand item are untouched by the reset.

## Todo list

- [x] `zoomToCursor` prop
- [x] `DEFAULT_CAMERA` constant, shared by the Canvas and the reset
- [x] `viewResetCount` + `resetView` + 3 tests (`store/__tests__/view-reset.test.ts`)
- [x] `ViewReset` component, with the `count === 0` guard
- [x] Reset button in View options
- [x] typecheck clean + `npx vitest run src/` = 90 files / 719 tests green
- [x] Browser check

### Verified in the app

**Zoom follows the pointer — proven functionally, not by eyeballing.** R3F exposes no `__r3f` handle on
the canvas in this version, so the camera could not be read directly. Instead the app's own hover
readout was used as the instrument: park the pointer on `DEMU0000422` (slot 340588), read the
inspector, scroll 6 ticks at that exact pixel, hover the SAME pixel again — the inspector still reads
`DEMU0000422`. Under centre-zoom that pixel would be over something else entirely after a zoom of that
size. That is the definition of zoom-to-cursor, measured through the product.

**Reset view:** zoomed repeatedly at an off-centre point until the framing had clearly drifted, pressed
the button, and the ship returned to the default framing. Selection and the plan were untouched.

### Deviation from the plan

The `resetView` tests first went into `store/__tests__/hand-in-use.test.ts`, which is the wrong file for
them. Split into `store/__tests__/view-reset.test.ts` so the filename says what it covers (the repo's
own naming rule).

## Success criteria

- Wheel zoom converges on whatever is under the pointer.
- One click re-frames the ship from any drifted state.
- No regression to orbit, pan, the gizmo, or the drag-time orbit lock.

## Risk assessment

| Risk | Mitigation |
|---|---|
| `zoomToCursor` interacts badly with `maxPolarAngle` / the drag lock | Both are independent of the wheel path; covered by the browser check |
| The reset effect fires on mount and overrides the initial camera | `count === 0` guard, called out in the steps |
| Someone later changes the Canvas camera literal and not the reset | One `DEFAULT_CAMERA` constant used by both |
| Drift makes orbiting unusable before the planner finds the button | Button sits with the other view controls; if it proves insufficient, the clamp-the-target option (not taken) is the fallback |

## Security considerations

None — camera state only.

## Next steps

Independent of phase 01.
