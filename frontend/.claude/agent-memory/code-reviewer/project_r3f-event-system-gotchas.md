---
name: r3f-event-system-gotchas
description: Verified-from-source R3F 9.x / three-stdlib event behaviours that break obvious UI assumptions (unmount kills onPointerOut; stopPropagation flushes farther hover records)
metadata:
  type: project
---

Facts read out of `frontend/node_modules` (R3F 9.7, three-stdlib 2.36), each one a trap that
looks fine in review until you trace the dispatcher. File: `@react-three/fiber/dist/events-<hash>.esm.js`.

**1. Unmounting a mesh deletes its hover record WITHOUT firing `onPointerOut`.**
`removeInteractivity` deletes `internal.hovered` entries for the removed object and returns silently.
So a `key={capacity}` remount (or any conditional unmount) of a pickable mesh leaves whatever React
state the `onPointerOut` handler clears **stale** — and a following `pointerleave`/no-hit
`pointermove` runs `cancelPointer` over an empty map, so nothing clears it. Commit paths that read
that state on `window mouseup` then act on a slot the pointer is nowhere near.
**How to apply:** any reviewer pass over R3F hover state must ask "can this mesh unmount mid-gesture,
and what clears its hovered value then?" Prefer clearing the store value on gesture start over
trusting the out event.

**2. `stopPropagation` in a near handler FLUSHES the farther hovered records (`onPointerOut` fires for them).**
`cancelPointer([...higher, hit])` — objects farther than the stopper get their out event. So a
container's hover handler does clear a pick volume behind it; but a handler that returns early
(guarded, e.g. "skip while dragging") does not, and the behind-object's handler runs instead.

**3. `pointerleave` is bound to the Canvas container** (`onPointerLeave: ['pointerleave', true]`), so
leaving the canvas does fire `onPointerOut` for registered records — but only for records that still
exist (see 1).

**4. three-stdlib `OrbitControls` early-returns on `enabled === false`** in down/move/wheel/contextmenu
and in the drei `useFrame` update — so an "orbit lock" works, and it also freezes damping mid-gesture.
Its `onPointerUp` is NOT gated by `enabled`. drei's wrapper connects to `events.connected || gl.domElement`.

Related: [[vite-node-differential-audit]] (how to prove this class of claim by running the real
predicate over the real plan instead of reasoning about it).
