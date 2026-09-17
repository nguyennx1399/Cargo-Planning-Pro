# Select-to-pick for placed cargo + zoom to pointer

Two unrelated viewer requests, planned together because both are small and both live in the 3D layer.

## What is true today (checked)

- **A click on placed cargo only SELECTS it.** `ContainerInstances`/`BreakbulkCargoInstances`
  `onClick` → `setSelected(id)`, and `setSelected` is a plain setter with no toggle. The ONLY way to
  move a box that is already on board is a held press-drag past the 4 px threshold. The single-pointer
  path (WCAG 2.5.7) exists solely for UNPLACED items, via the sidebar lists — so a placed box cannot be
  moved without a drag at all.
- **Zoom always goes to the orbit target.** `<OrbitControls makeDefault target={[0,0,0]} …>` with no
  `zoomToCursor`, so the wheel pulls the camera toward the ship's centre wherever the pointer is.
  three 0.170 / drei 10 support `zoomToCursor` — it is a prop, not a custom controller.

## Decisions taken (user, 2026-09-17)

1. **Two-step select → pick.** First click selects and inspects (unchanged). A second click on the SAME
   item takes it in hand; then one click on a target places it. Esc or clicking empty water unselects.
   Chosen over one-step because every inspect-by-click would otherwise arm a hand and hide the hull.
2. **`zoomToCursor` plus a "Reset view" control.** Zoom-to-pointer drifts the orbit target over
   repeated zooms, and today nothing re-centres the ship; the reset button is the recovery.

## Phases

| # | Phase | Status | Priority |
|---|-------|--------|----------|
| 01 | [Select-to-pick for placed cargo](phase-01-select-to-pick-placed-cargo.md) | implemented, mostly verified | high |
| 02 | [Zoom to pointer + reset view](phase-02-zoom-to-pointer-and-reset-view.md) | implemented, verified live | medium |

Independent; either order. 02 is the smaller of the two.

## Ground rules

- The new path is a second TRIGGER, never a second rule: picking up a placed container must go through
  the same `canBeginContainerMove` gate the drag path uses (a box carrying others still cannot move),
  and placing still goes through the one commit resolver.
- The click DECISION (select / pick up / put down / ignore) belongs in a pure function with its own
  test — the 3D layers are not node-testable, and this is exactly the kind of state machine that rots
  silently.
- Files stay under 200 LOC; both instance components are already near their budget, so new logic lands
  in its own module rather than inside them.

## Verification constraint

The browser tooling cannot drive a held-button drag (R3F's 4 px threshold never fires from synthetic
input), but it CAN click — which is precisely what both phases add. Both are verifiable end to end
this time, including the drop. Note the pane can serve one stale frame right after an interaction:
confirm on a settled frame.
