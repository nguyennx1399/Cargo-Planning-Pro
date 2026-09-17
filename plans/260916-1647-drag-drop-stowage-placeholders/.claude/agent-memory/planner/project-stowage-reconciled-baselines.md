---
name: stowage-reconciled-baselines
description: Reconciled stowage baselines and the stale figures that circulated before them (demo 199/36 violations, 400 unplaced of 886, 1520 not 2400 sibling pairs, 0.402 m BBC worst-case boundary overlap) — do not re-derive these
metadata:
  type: project
---

Figures that were disputed during the drag-drop feature (Phases A–C, 2026-09-16) and how they were
settled. Treat these as authoritative; do not re-measure them from scratch.

- **Demo/BBC report baselines: MV Demo Horizon 199 violations, BBC SAO PAULO 36** (both all
  `overstow`), pinned in `predicate-report-parity.test.ts`. A "192" that circulated was a
  coordinator's baseline that never reproduced — it is not a measurement and not a regression.
- **Unplaced on MV Demo Horizon: 400 of 886** containers. `naiveFillPlan` deliberately places no 20'
  box, so they load unplaced — **placing them by hand is the feature, not a bug**.
- **20' sibling-half pick-box overlaps: 1520 pairs (demo) / 1554 (BBC).** The "2400" still quoted in
  `EmptySlotPicker.tsx`'s comment is a **unit error** — it is the demo's *slot* count (boxes
  participating in ≥1 overlap) reported as a pair count. The consistent pair definition is the one
  that also yields BBC 1554.
- **BBC 40' neighbour-bay pick-box overlap: 0.402 m total / 0.201 m per side** at the vessel's
  *minimum* declared pitch 12.99 m. The "~0.36 m / ~0.18 m per side" quoted in phase-03 and in the
  Phase-C click-through script is the same quantity at the *mean* pitch 13.0388 — an understatement,
  not a different measurement. MV Demo Horizon's pitch is exactly 13.392 m → 0.000 m overlap.
- **20' sibling dead zone: 0.076 m** — introduced by the size-aware (`DIM.len20`) pick volume that
  fixed the sibling-half ambiguity. Phase-03's risk table separately forbids shrinking the pick box
  ("that reintroduces dead zones").

**Why:** these numbers were reproduced three times by three agents with two different definitions,
and the wrong value is still in a source comment. Re-deriving them wastes a day and risks re-opening
settled decisions.

**How to apply:** cite these figures rather than measuring again; if a plan touches
`EmptySlotPicker.tsx`'s comment or the click-through script's boundary note, fix the stale value in
place as part of that change. Related: [[verification-reality-no-dom-tests]].
