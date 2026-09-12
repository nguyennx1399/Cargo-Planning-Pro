# Code Review — Phase 03/04 Follow-up: LOA/LBP Coordinate Fix Verification

## Scope
- Files: `engine/cargo/breakbulk-mesh-builder.ts`, `lib/breakbulk-weight-item.ts`, `types/domain.ts` (BreakbulkPlacement doc), `engine/breakbulk-forbidden-zones.ts` (rename), `features/viewer3d/BreakbulkCargoInstances.tsx`, `engine/cargo/__tests__/breakbulk-mesh-builder.test.ts`, `lib/__tests__/breakbulk-weight-item.test.ts`
- Also re-checked (claimed unchanged, verified): `engine/breakbulk-deck-area.ts`, `engine/naive-fill-breakbulk.ts`, `engine/breakbulk-validation-rules.ts`, `engine/breakbulk-overlap-check.ts`, `data/build-demo-plan.ts`
- `npm run typecheck`: clean. `npm test -- --run`: 329/329 pass (48 files). Confirmed live, not from memory.

## Overall Assessment
The Critical LOA-vs-LBP bug is **genuinely fixed and complete** for the rendering path (`breakbulk-mesh-builder.ts`) and the stability path (`breakbulk-weight-item.ts`). Both now correctly treat `BreakbulkPlacement.x_m`/`z_m` as `vessel.length_m/2`-symmetric and convert to whatever target frame they actually need, matching `ContainerInstances`/`cargoWeightItem` exactly where traced side by side. All remaining call sites (`deck-area`, `forbidden-zones`, `naive-fill-breakbulk`, `validation-rules`) were already internally consistent in the same convention — confirmed by grep, not just trusted.

Two real gaps found, both smaller/lower-severity than the original bug: (1) the phase-03 "cross-system regression test" does not actually discriminate old-vs-new behavior — it would pass under the old buggy code too, due to which side of the bay it places the item on; (2) `breakbulkWeightItem`'s `kg_m` omits `LAYOUT.hatchHeight` (0.6m) that the renderer applies as the deck reference, a small same-bug-class inconsistency the task asked to watch for.

## Critical Issues
None. The coordinate-convention bug reported in the phase-01/02 review is resolved.

## High Priority

### 1. Phase-03 "cross-system" regression test does not actually catch the regression it claims to
`engine/cargo/__tests__/breakbulk-mesh-builder.test.ts:68-91` ("a breakbulk item placed just clear of an on-deck bay's x-zone does not render inside that bay's actual scene x range").

Traced numerically on the demo vessel (`length_m=172, lbp_m=160, bowMargin=22, pitch=13.392`, bay `i=0`, which per `demo-container-vessel.ts` line 4 is the **bow-most** bay):
- `bayCenterSceneX = 57.304`, `bayHalfWidth = 6.096`, `bayCenterXM = 143.304`, `placedXM = 159.4` (5m clearance, `itemLength=10`).
- Correct/current formula (`sceneX = x_m - length_m/2 = 86`): `meshSceneXMin = 68.4` vs bay edge `63.4` → clear by 5m. Test passes.
- Old buggy formula (`shipToScene`, i.e. `sceneX = x_m - lbp_m/2 = 80`): `meshSceneXMin = 74.4` vs bay edge `63.4` → clear by **11m**, i.e. still passes, even more comfortably.

Reason: the old bug is a constant `+(length_m−lbp_m)/2 = +6m` shift in the scene-+x/bow direction, applied uniformly regardless of placement. The test places the item on the **bow side** of the bow-most bay (`placedXM > bayCenterXM`), which is exactly the side where the +6m shift moves the item *further away* from the bay, not into it. A test that would actually have failed under the old code needs the item on the **opposite side** (aft/stern side of a bay, or bow side of a bay that isn't the bow-most one), so the +6m shift moves it *toward* the bay instead of away.

**Impact**: this specific test provides false confidence — it's presented (in the phase-03 file's "Bug NGHIÊM TRỌNG" section and Todo list) as the regression guard for this exact bug class, but a future refactor that reintroduces `x_m - lbp_m/2` (or any similar wrong-anchor mistake) would NOT be caught by it. The bug itself is fixed; only this specific test's discriminating power is the issue.

**Fix**: flip the clearance side, e.g. place the item at `bayCenterXM - bayHalfWidth - clearance - itemLength/2` (aft of the bay) so the uniform bow-ward shift under the old bug would have pushed it into the bay's zone. Recommend adding this as a second case rather than replacing, to also keep the current (harmless) one.

## Medium Priority

### 2. `breakbulkWeightItem`'s `kg_m` omits `LAYOUT.hatchHeight`, unlike the renderer's deck reference
`lib/breakbulk-weight-item.ts:19`: `kg_m: geometry.particulars.depth_m + item.kg_above_base_m`.

`item.kg_above_base_m` is documented (phase-01, `domain.ts:77`) as CG height above the item's own resting surface ("mặt đặt" = the deck it's placed on). Per `breakbulk-mesh-builder.ts:51`, that resting surface is rendered at `deckY = LAYOUT.hatchHeight` (0.6m) above the deck reference — the SAME reference `tierCenterY`'s on-deck base uses for containers (`lib/geometry.ts:52`, `base = LAYOUT.hatchHeight` for `onDeck`). `cargoWeightItem` correctly folds this in because `sceneY = tierCenterY(tier)` already includes `hatchHeight` in its base before `+ depth_m` is added (`cargo-weight-item.ts:17`). `breakbulkWeightItem` skips this term entirely, so the computed `kg_m` is 0.6m lower than the item's actual rendered height implies — same shape of mistake as the original bug (an implicit reference-frame offset silently dropped), just far smaller magnitude (0.6m here vs up to 12m for the original x_m bug).

**Impact**: understates VCG for every breakbulk item by 0.6m → slightly overstates GM/stability margin when project cargo is loaded. Not safety-critical at this magnitude relative to typical vessel GM tolerances, but it is a real, silent inconsistency between what's rendered and what's used for stability math — exactly the class of bug this review was asked to watch for. The existing test (`breakbulk-weight-item.test.ts:32-36`, "kg_m is the deck level plus...") is tautological (asserts the code equals itself) and would not catch this.

**Fix**: `kg_m: geometry.particulars.depth_m + LAYOUT.hatchHeight + item.kg_above_base_m` (import `LAYOUT` from `lib/geometry.ts`), or reduce risk further by having `breakbulk-mesh-builder.ts` and `breakbulk-weight-item.ts` share the same `deckY`/base-height constant rather than duplicating `LAYOUT.hatchHeight` in one and hardcoding a different assumption in the other.

## Low Priority

### 3. Tower cylinder taper direction after `rotateZ` is unverified (cosmetic only)
`breakbulk-mesh-builder.ts:38-40`: `cylinder.rotateZ(Math.PI/2)` maps the cylinder's local +Y axis to local −X (standard rotation-matrix result for +90° about Z), then `translate(...)` — order is correct (rotate in local/origin-centered space before translating to final position), and this correctly re-axes the cylinder along scene x as intended. Confirmed this doesn't affect the position/overlap-safety fix being reviewed here: `breakbulk-overlap-check.ts`'s `footprintRect` is purely AABB-based off `placement.x_m/z_m` and never consults the mesh, so a flipped taper direction (narrow end pointing aft instead of fwd) cannot cause a collision/validation error — purely cosmetic, and already flagged as a known limitation in the code comment (rotation_deg=90 unsupported) for a different reason. No action required.

### 4. Rename (`bayCenterXShipFrame` → `bayCenterXVesselRelative`) applied cleanly
Grepped `src/` for the old name — zero stale references. New name is used consistently at definition and both call sites in `breakbulk-forbidden-zones.ts`. Good rename, arguably clearer than before ("VesselRelative" reads better against "ShipFrame" which is a loaded term elsewhere in the codebase).

## Completeness Check (item 4 of the request)
Verified by reading each file in full, not just grepping:
- `engine/breakbulk-deck-area.ts`: `deckArea` uses `vessel.length_m` symmetric bounds throughout — consistent, comment now correctly disclaims "x is NOT AP-referenced ship-frame."
- `engine/breakbulk-forbidden-zones.ts`: `bayCenterXVesselRelative`/`onDeckBayZones` use `vessel.length_m` — consistent with `x_m`.
- `engine/naive-fill-breakbulk.ts`: consumes `deckArea`/`onDeckBayZones` (both in the same convention) and produces `placement.x_m`/`z_m` directly from those bounds — never touches `shipToScene`/`VesselGeometry`. Consistent.
- `engine/breakbulk-validation-rules.ts`: `breakbulkOutOfDeckArea`/`breakbulkOverlap`/`breakbulkOverlapsContainer`/`breakbulkOverweight` all compare `x_m`/footprints only against `deckArea`/`onDeckBayZones`/other placements — never mixes in true ship-frame or `VesselGeometry`. Consistent.
- `engine/breakbulk-overlap-check.ts`: pure AABB math on `x_m`/`z_m`, no frame assumptions. Consistent.
- `data/build-demo-plan.ts`'s `withBreakbulkCargo`: composes `onDeckBayZones(vessel, plan.placements)` → `naiveFillBreakbulk` → plan; no direct `x_m` consumption, no geometry involvement. Consistent.

No remaining call site treats `x_m`/`z_m` as true AP-referenced ship-frame outside of the two files that correctly convert it (`breakbulk-mesh-builder.ts` → scene, `breakbulk-weight-item.ts` → true ship-frame for `WeightItem`).

## `BreakbulkCargoInstances.tsx` geometry removal (item 5)
Confirmed: no `VesselGeometry` prop, no `if (!geometry) return null` guard remains. `VesselScene.tsx` still computes `geometry` locally for `Hull`/`ContainerInstances`/depth fallback but does not pass it to `BreakbulkCargoInstances`. This is a net improvement, not a regression — the old guard existed only because `shipToScene` (which needed `geometry.particulars`) was in the call path; now that rendering is scene-native like `ContainerInstances`, the guard is correctly unnecessary. Nothing depended on breakbulk being suppressed for geometry-less vessels (no such requirement in Success Criteria/Requirements of phase-03, and `StowagePlan.breakbulk_cargo`/`breakbulk_placements` are required non-optional fields on every plan, so there's no undefined-access risk either).

## `lib/breakbulk-weight-item.ts` two-step inversion — side-by-side confirmation (item 2)
```
cargoWeightItem:      sceneX = bayCenterX(...)              lcg_m = sceneX + lbp_m/2
breakbulkWeightItem:  sceneX = x_m - vessel.length_m/2       lcg_m = sceneX + lbp_m/2
```
Identical second step, correctly ordered (length_m/2 subtraction first, lbp_m/2 addition second, no swapped halving). `tcg_m` in both cases passes the transverse scene coordinate straight through (no LOA/LBP ambiguity on that axis) — confirmed identical. Only `kg_m` diverges (see Medium #2 above), and that divergence is not part of the LOA/LBP fix's scope — it's a separate, smaller reference-height gap in the same file.

## Test Coverage Assessment (item 3)
- `breakbulk-mesh-builder.test.ts`'s "centers a box item's scene position..." test: valid, direct numeric check of the fixed formula, not tautological in a harmful way (it hard-codes the expected formula, which is fine for a unit test of the position math itself).
- `breakbulk-mesh-builder.test.ts`'s "does not render inside that bay's actual scene x range" test: **does NOT discriminate old vs new code** — see High #1. Passes under both.
- `breakbulk-weight-item.test.ts`'s "does NOT treat x_m as already true ship-frame" test: **valid regression test** — confirmed by hand: old (buggy, pass-through) code gives `lcg_m = 100`; fixed code gives `lcg_m = 94` (`(100-86)+80`); assertion `w.lcg_m !== placement.x_m` correctly fails under old code, passes under new. This one does what phase-04's Todo claims.

## Positive Observations
- Comments in `types/domain.ts`, `breakbulk-forbidden-zones.ts`, `breakbulk-mesh-builder.ts`, `breakbulk-weight-item.ts` are unusually thorough and specifically warn future editors away from re-introducing this exact bug class (naming the wrong function `shipToScene` explicitly, pointing at the phase file). This is good defensive documentation regardless of the test gap above.
- Choosing option (b) (convert at the consumer, not the producer) kept `BreakbulkCargoInstances` geometry-free as originally intended — a genuine simplification, not just a bug fix.
- All files stayed well under the 200-line guideline after the rewrite.

## Recommended Actions
1. (High) Add a second `breakbulk-mesh-builder.test.ts` case placing the item on the aft/opposite side of a bay so the regression test actually fails under a reintroduced `shipToScene`-based bug.
2. (Medium) Fix `kg_m` in `breakbulk-weight-item.ts` to include `LAYOUT.hatchHeight`, matching the renderer's deck reference; add a test comparing against `cargoWeightItem`'s lowest-on-deck-tier `kg_m` for the same nominal deck level to catch this class going forward.

## Metrics
- Typecheck: clean (0 errors)
- Tests: 329/329 passing (48 files)
- Files reviewed in full: 10 source + 2 test files

## Unresolved Questions
- Is the 0.6m `hatchHeight` KG omission acceptable for this project's stated stability-accuracy bar (demo-grade, per plan.md), or does it need fixing now? Given the plan explicitly frames stability numbers as "indicative," this may be an accepted tradeoff — confirm with plan owner before treating as blocking.
- None on the core LOA/LBP fix itself — confirmed correct and complete for both rendering and stability paths.
