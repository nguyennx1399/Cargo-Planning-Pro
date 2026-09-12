---
name: project-vessel-3d-pipeline-phase02-followups
description: Known gaps left open after phase-02 review of vessel-3d-model-pipeline (parametric hull generator + loft mesher) — check if addressed in phase-03+ reviews
metadata:
  type: project
---

Phase-02 of `plans/260911-1409-vessel-3d-model-pipeline/` (`engine/hull/*` parametric generator +
shared loft mesher) shipped with two open items, noted in
`reports/code-reviewer-260911-1630-phase-02-hull-generator.md`:

1. **Aft double-zero-breadth station "blade"**: `parametric-hull-generator.ts` forces
   `stations_x_m[0]` (x = −aft_overhang_m) to zero breadth, and separately `stations_x_m[1]`
   (= mainStations[0], x=0=AP) *also* always evaluates to zero via `envelopeHalfBreadth` whenever
   `parallel_midbody[0] > 0` (always true in practice) — `dist=(pa−0)/pa=1` regardless of entrance
   power `p`. Verified numerically against both the demo params and the test fixture. Result: a
   real (non-zero-area) flat quad band lying entirely in the y=0 centerline plane between those two
   stations, full keel-to-deck height, over the whole `aft_overhang_m` length — renders as a visible
   flat "fin" aft of the AP with `DoubleSide` transparent material, instead of a tapered counter
   stern. Doesn't break volume/Cb (zero-thickness → 0 contribution) or the closed-2-manifold
   property, so no existing test catches it. Bow doesn't have this problem (bulb ellipse sits
   between the two zero stations there, giving a real taper).
2. **`checkSlotsInsideHull` single-z check** (`0.35 * depth_m`, fixed fraction): safe only if every
   stack's true lowest point is at/above that z. `sectionHalfBreadth` is monotonic non-decreasing in
   z (narrowest at keel), so a stack extending lower than the check point could produce a false
   negative. Accepted as a phase-2 simplification (no real stack/tank-top z-extent data yet — that's
   phase-5's `bay_lcg_m` territory) but has no TODO comment in the file itself flagging it.

**Why:** Phase-04 (offsets-import/L2) and phase-06 (hydrostatics expansion of `section-integrals.ts`)
both build directly on `hull-loft-mesh-builder.ts` and `section-integrals.ts`, so item 1's assumption
("end stations always exactly degenerate") and item 2's z-sampling approach are load-bearing for
whatever comes next, not just demo cosmetics.

**How to apply:** When reviewing phase-03+ of this pipeline, check whether these were fixed (aft
blade given real shape or collapsed to single station; slots-check either sweeps a real z-range or
gained an explicit TODO) — if not, re-flag. Also see [[project-vessel-3d-pipeline-phase01-followups]]
for phase-01's still-open items (beam-bound component check, frame[0] anchor).
