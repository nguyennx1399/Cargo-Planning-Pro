# Code Review — Phase 02: Parametric Hull Generator & Loft Mesher

## Scope
- Files: `engine/hull/{catmull-rom-spline,section-integrals,parametric-section-shapes,parametric-hull-generator,hull-loft-mesh-builder,hull-half-breadth-query,slots-inside-hull-check}.ts`, `features/viewer3d/Hull.tsx`, `data/demo-horizon-geometry.ts`
- LOC: 589 total across 9 files, all under 200 (max 112, `hull-loft-mesh-builder.ts`)
- Focus: math correctness, mesh topology (hand-traced), Hull.tsx wiring, slots-check sufficiency
- `npm run typecheck`: clean. Test suite not re-run (tester agent covering in parallel).

## Overall Assessment
Solid, well-scoped L1 implementation. Deviations documented in the plan file are legitimate and match what's in the code. Found one real (if low-impact) geometry defect not covered by existing tests/deviations notes, plus the documented single-z slots-check gap is real but acceptable for phase 2. No blocking issues.

## Critical Issues
None.

## High Priority
None.

## Medium Priority

**1. Aft end produces a flat zero-width "blade," not a clean point-taper — verified numerically.**
`stations_x_m[0]` (x = −aft_overhang_m) is hard-forced to zero breadth in `parametric-hull-generator.ts` (`x < 0` branch). Separately, `stations_x_m[1]` = `mainStations[0]` = x = 0 (exactly AP) *also* evaluates to zero breadth for every entrance power — `envelopeHalfBreadth` gives `dist = (pa−0)/pa = 1` whenever `pa > 0`, so `c = 1` → `fullness = 1 − 1^p = 0` regardless of `p`. Confirmed by direct computation against the demo's own params (`parallel_midbody=[0.1,0.9]`, `aft_overhang_m=6`): both x=−6 and x=0 give fullness=0 for p ∈ {0.4,1,2,4,8,10}; x=4 (station 2) already jumps to 0.11–0.94 depending on p. Same holds for the test fixture (`parallel_midbody=[0.3,0.62]`) — this isn't demo-specific, it's structural: any `aft_overhang_m > 0` combined with any `pa > 0` (always true) produces two adjacent zero-breadth stations at the stern.

Consequence: the shell band between station 0 and station 1 is a real (non-degenerate-area) planar quad strip lying entirely in the y=0 centerline plane, spanning the full keel-to-deck height over 6 m of length — a flat "fin" rather than the single degenerate point the `capLoop` doc comment assumes only happens *at* the cap station. It doesn't break volume (zero-thickness → contributes 0, so the volume/Cb tests pass), and it doesn't break the closed-manifold property (still a well-defined 2-manifold), so none of the existing tests catch it. But rendered with `DoubleSide` + transparency in `Hull.tsx`, it'll show as a visible flat trailing panel aft of the AP instead of a tapering counter/overhang shape — a real, if minor, visual defect. The bow doesn't have this problem: the bulb's non-degenerate ellipse sits between the two zero stations there, so there's an actual taper, not a flat band.
- Recommend: either taper `aft_overhang` breadth non-degenerately (give station 0 some width, matching a real counter stern shape) or collapse it to a single station (drop the redundant always-zero AP-coincident point) so the pinch is a genuine single-point cap like the bow. Worth a code comment either way since the current `capLoop` TODO doesn't mention this adjacent-double-zero case.

**2. `checkSlotsInsideHull` single-z check is a real (documented-by-omission) gap, likely acceptable for phase 2.**
`sectionHalfBreadth` is monotonic non-decreasing in z (flat bottom → bilge curve → constant vertical topside), so the narrowest point in any station's cross-section is always at/near the keel. The fixed check at `0.35 * depth` is safe only if every under-deck stack's true lowest physical point sits at or above that z — the code comment rationalizes the choice ("well above the flat bottom so it isn't fooled by the keel") but there's no check against actual stack/tank-top extents, and the function only samples one z per bay/row rather than the stack's real vertical range. If a future stack profile extends lower than 0.35·depth (e.g., once real tank-top heights land), this could produce a false negative (miss a real hull violation) rather than a false positive. Given phase 2's own scope (ship-frame calibration isn't wired yet either — see F5 deviation), this is an acceptable simplification, but it isn't flagged as a TODO in the file itself the way other simplifications are (e.g. the transom TODO in `parametric-hull-generator.ts`). Recommend adding an explicit TODO comment noting the single-z assumption needs revisiting once real stack/tank-top z-extents are available (phase 5).

## Low Priority

**3. `blockCoefficient`'s denominator (`lbp_m · beam_m · draft`) doesn't match the volume integral's domain.** `displacedVolume` trapezoidally integrates over the *full* `stations_x_m` range, which includes the aft-overhang segment (x < 0) and bulb stations (x > lbp_m). Because both end stations of each of those extra segments are zero (per finding #1 and the bow's own zero-taper), the extra volume contribution is currently ~0 in practice, so this doesn't visibly skew the Cb fit today — but it's a latent inconsistency: if `aft_overhang` or bulb geometry ever contributes non-negligible volume outside [0, lbp_m], the reported/fitted "Cb" will drift from the textbook LBP-based definition. Not urgent; just worth a comment noting the assumption.

**4. `Hull.tsx`: no error boundary around `buildHullLoftMesh`.** If offsets are malformed (not just absent) — e.g. a future phase-4 offsets-import bug — `catmullRomEval`/`buildHullLoftMesh` can throw inside `useMemo`, crashing the render instead of falling back to the box hull. Current fallback logic (`geometry?.hull.offsets` truthy-check, both in `Hull` and again in `LoftedHull`) is genuinely crash-safe for the *missing-offsets* case asked about in the review scope — confirmed safe, no repro found. The malformed-offsets case is explicitly out of scope per this phase's own Risk Assessment table ("Phase 04 has fairness check before loft"), so not a phase-2 gap, just flagging for when that lands.

## Math Correctness — verified, no bugs found
- **Catmull-Rom** (`catmull-rom-spline.ts`): correct centripetal (α=0.5) chord-parameterization formula; linear-mirror virtual endpoints avoid needing extra input points; `catmullRomResample`'s binary search over cumulative arc length is a correct lower-bound search. No issues.
- **Trapezoidal integration** (`section-integrals.ts`): `sectionArea`/`displacedVolume`/`trapz` are standard and correctly handle the `zTop` clamp and `null` (outside-hull) waterline entries as 0. No issues.
- **Bisection monotonicity assumption** (`parametric-hull-generator.ts`, "Cb monotone in p"): verified analytically. For any `xi` strictly between the parallel-midbody boundary and the tip, `c ∈ (0,1)` and `d/dp(c^p) = c^p·ln(c) < 0`, so `fullness = 1 − c^p` is strictly increasing in `p` pointwise for every station — this holds regardless of whether p is above or below 1, so the claimed monotonicity is sound, not just empirically true. The bilge-radius term (`r = bilgeRadius·max(fullness,0.15)`, clamped to `≤ halfBreadthM` inside `sectionHalfBreadth`) very slightly reduces area as it grows, but it's dominated by the much larger `b` growth for realistic bilge-radius-to-beam ratios, and the clamp prevents any pathological negative-area case. Confirmed no risk of non-monotone Cb(p) or wrong-root convergence for this envelope shape. The widened `[0.4, 10]` range (vs. plan's `[1.2, 6]`) is a reasonable, well-justified deviation.

## `hull-loft-mesh-builder.ts` topology — hand-traced, valid 2-manifold confirmed
Traced index construction for a general N-station × M-point loop (worked through M=4 by hand): every loop-boundary edge at an interior station is shared by exactly 2 quad bands (left/right neighbor); every "deck cap" closing edge and every longitudinal edge is shared by exactly 2 triangles across adjacent quads within a band; at the two end stations, every boundary edge of the loop is used once by the adjacent shell band and exactly once by the `capLoop` fan (fan triangle `j`'s edges are `(0,j)` [interior, shared with triangle j±1], `(j,j+1)` [boundary], and for the last triangle `(loopSize−1, 0)` [boundary, closes the loop]) — so the full boundary is covered exactly once by the fan, giving edge-count 2 everywhere. This matches the passing "every edge in exactly 2 triangles" test and generalizes beyond the one demo case tested.

The `capLoop` TODO's star-shaped-from-vertex-0 caveat is accurately scoped: it's safe today specifically because end-station loops are *exactly* collinear (all points at y=0, only z varies — confirmed both end stations always degenerate per the generator, see finding #1's more detailed statement of that same fact), so the "fan" triangles are literally zero-area and any triangulation of a degenerate (zero-area) polygon is trivially non-self-intersecting. The comment correctly flags this breaks for a real (non-point) end station from offsets-import in phase 4.

## Positive Observations
- Deviations section in the plan file is unusually honest and specific (bisection range, parallel_midbody tuning, deferred `aHullZ`, F5 signature change) — matches the code exactly, no undocumented drift found.
- Good separation of concerns: integrator, spline, section-shape, generator, mesher, query, and validator are each single-purpose and independently testable.
- `hullHalfBreadthAt`/`halfBreadthAt` binary searches are correct and consistent between the two files (same pattern, no duplication of logic that matters — `halfBreadthAt` reused rather than reimplemented).
- Analytic test cases (box hull, Wigley hull Cb=4/9) for `section-integrals.ts` are a good sanity net for the integrator that both Cb-fitting and future hydrostatics depend on.

## Edge Cases Found by Scout (self-performed, no separate scout agent used — static/math review didn't warrant a separate pass; findings above are the edge-case output)
- Double-zero-breadth aft stations → flat degenerate blade (finding #1)
- Single-z slots check vs. monotonic-in-z hull shape → possible false negative for future stack profiles (finding #2)
- Cb integral domain vs. LBP·B·T denominator mismatch, currently inert (finding #3)

## Recommended Actions
1. (Medium) Fix or explicitly comment the aft double-zero-station flat-blade case in `parametric-hull-generator.ts` / `hull-loft-mesh-builder.ts`.
2. (Medium) Add TODO in `slots-inside-hull-check.ts` documenting the single-z-per-stack limitation and when it should be revisited (phase 5 stack/tank-top data).
3. (Low) Comment the Cb-denominator/integral-domain assumption in `section-integrals.ts` or `parametric-hull-generator.ts`.
4. (Low) No action needed now, but note for phase 4: wrap `buildHullLoftMesh` call in `Hull.tsx` with error handling once offsets-import lands (already anticipated by this phase's own Risk Assessment table).

## Metrics
- Type Coverage: n/a (whole-project tsc clean, `npm run typecheck` passed with 0 errors)
- Test Coverage: not re-measured (tester agent covering in parallel); 36 tests across 7 files per plan's Todo List
- Linting Issues: not run (out of scope per task instructions — static/math review only)
- File size: all 9 files ≤ 200 LOC (max 112)

## Unresolved Questions
- Should finding #1's aft blade be fixed now (phase 2) or deferred alongside the already-deferred transom/keel-rise work? Both are cosmetic L1 simplifications; recommend bundling with whichever follow-up touches `stern`/overhang shape.
- Is there a reference for real stack/tank-top z-extents that would let `checkSlotsInsideHull` check the true lowest point per stack (finding #2), or is that strictly phase 5 scope?
