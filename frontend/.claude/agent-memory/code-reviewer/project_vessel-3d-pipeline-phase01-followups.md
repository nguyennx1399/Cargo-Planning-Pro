---
name: project-vessel-3d-pipeline-phase01-followups
description: Known gaps left open after phase-01 review of the vessel-3d-model-pipeline plan (ship-frame geometry schema) — check if addressed in phase-02+ reviews
metadata:
  type: project
---

Phase-01 of `plans/260911-1409-vessel-3d-model-pipeline/` (schema `VesselGeometry` + `lib/ship-frame.ts` +
`engine/vessel-geometry/validate-vessel-geometry.ts`) shipped with two open items, noted in the phase-01
plan file's "Next Steps" and in `reports/code-reviewer-260911-1430-phase-01-vessel-geometry.md`:

1. `validateVesselGeometry`'s `checkComponents` only checks the LOA/X envelope, not the beam/Y envelope,
   even though plan F3 explicitly requires both ("LOA/B"). No test covers a Y-out-of-bounds component.
2. `frameToX`/`xToFrame` in `lib/ship-frame.ts` implicitly anchor ship-frame x=0 at `frames[0].from_frame`,
   not literal frame 0 — silently wrong if that invariant is violated. The validator only warns (not
   errors) on `frames[0].from_frame !== 0`.

**Why:** Phase-02 builds `HullOffsets`/`ParametricHullParams` generation directly on top of `ship-frame.ts`
and the validator (per phase-01 plan "Next Steps"), so both gaps are load-bearing for correctness of
anything built after phase-01, not just cosmetic.

**How to apply:** When reviewing phase-02+ of this pipeline, check whether these two items were fixed
(beam bound check added to `checkComponents`; `frames[0].from_frame` invariant either enforced as an error
or explicitly made a non-issue via an anchor param) — if not, re-flag rather than assuming they were
addressed silently.

**Update (phase-02 review, 2026-09-11):** Neither item was exercised — phase-02's demo geometry
(`data/demo-horizon-geometry.ts`) has `components: []` (so `checkComponents`'s beam-bound gap wasn't
hit) and `frames: [{from_frame: 0, ...}]` (satisfies the from_frame=0 invariant, so item 2 wasn't hit
either). Both items remain genuinely open — still re-flag when phase-03 (components: superstructure/
funnel/cranes) or any phase touching non-zero `frames[0].from_frame` lands. See
[[project-vessel-3d-pipeline-phase02-followups]] for phase-02's own new findings.

**Update (phase-03 review, 2026-09-11): item 1 (beam-bound component check) is now FIXED.**
`validate-vessel-geometry.ts`'s `checkComponents` gained `componentYExtents`/`halfBeam` checks,
covered by tests in `validate-vessel-geometry.test.ts`. Phase-03's demo geometry now has real
components (superstructure/funnel/masts/lifeboats) whose Y-extents stay inside the beam envelope
by hand-check, consistent with a clean validator run. Close this item — do not re-flag.
Item 2 (`frames[0].from_frame` anchor) is still open — phase-03's demo still uses
`from_frame: 0`, so it's still never been exercised against a non-zero first frame. Keep
re-flagging in phase-04+ until a geometry with non-zero `frames[0].from_frame` actually lands.
