# Phase 01 Test Report: Vessel Geometry Schema & Ship Frame

**Date:** 2026-09-11  
**Status:** ✓ PASS  
**Test Count:** 99 total (up from 78 baseline)

## Check Results

### 1. Typecheck
**Status:** ✓ PASS  
Command: `npm run typecheck`  
Result: No type errors. All new types properly integrated with domain.ts and existing codebase.

### 2. Test Suite Execution
**Status:** ✓ PASS  
- Total tests: 99/99 passed (6 new test files)
- Test files:
  - `ship-frame.test.ts`: 7 tests (round-trip, boundary, extrapolation)
  - `validate-vessel-geometry.test.ts`: 13 tests (all validation rules)
  - `geometry-characterization.test.ts`: 1 test (snapshot locks scene layout)
  - Existing tests: 78 passed (no regressions)

**Characterization Snapshot:** ✓ NO DRIFT detected. Scene layout numbers locked correctly.

### 3. Build
**Status:** ✓ PASS  
Command: `npm run build`  
- Build succeeded in 2.49s
- 647 modules transformed, chunks computed
- Minor warning: chunk size 1.2 MB (>500 KB limit) — expected for demo, not blocking
- Output: dist/ ready for deployment

### 4. Success Criteria Verification

#### Coordinate Transform Round-Trip Tests
✓ Implemented and passing:
- `shipToScene(geometry, [x, y, z])` → `sceneToShip(geometry, result)` = input (verified via test `round-trips arbitrary points`)
- `frameToX(frames, f)` → `xToFrame(frames, result)` = input (verified via test `round-trips within and outside the frame range`)
- Round-trips tested for negative frames, boundaries, and extrapolated points (frame -5, 160, etc.)
- `lcgFromMidship` correctly maps midship at x=80 → lcg=0

#### Characterization Test
✓ Snapshot test passes with NO numeric drift:
- Tests all demo vessel stacks' first and last tier positions
- Verifies coordinate transformation preserves scene layout
- Snapshot file stable (no changes needed)

#### Validation Rule Coverage
✓ All 10 validation rules have ≥1 test each:
- LBP < LOA: flagged (test: "flags LBP >= LOA")
- aft_overhang + LBP ≤ LOA: flagged (test: "flags aft_overhang_m + lbp_m exceeding loa_m")
- draft < depth: flagged (test: "flags design draft >= depth")
- Cb ∈ [0.35, 0.90]: flagged (test: "flags Cb outside [0.35, 0.90]")
- frames contiguous: flagged (test: "flags non-contiguous frame segments")
- spacing > 0: flagged (test: "flags non-positive spacing")
- offsets grid match: flagged (test: "flags offsets grid size mismatch")
- half-breadth ∈ [0, B/2]: flagged (test: "flags a half-breadth outside [0, beam/2]")
- component placement: flagged (test: "flags a component placed outside the hull extent")
- boot-top low < high ≤ depth: flagged (test: "flags boot_top_low_z_m >= boot_top_high_z_m")

### 5. Implementation Alignment

#### File Coverage
✓ All planned files created/modified:
- `types/vessel-geometry.ts`: Complete schema with all types (GeometryDataStatus, FrameSegment, MainParticulars, ParametricHullParams, HullOffsets, HullSpec, ComponentSpec, Livery, VesselGeometry)
- `lib/ship-frame.ts`: 55 LOC (under 200 limit), 5 functions (shipToScene, sceneToShip, lcgFromMidship, frameToX, xToFrame)
- `engine/vessel-geometry/validate-vessel-geometry.ts`: 144 LOC, validates all rules with proper path reporting
- `data/demo-horizon-geometry.ts`: 44 LOC, matches spec exactly (LOA 172, LBP 160, aft_overhang 6, B 27.4, D 14, T 9.8, Cb 0.68, single 0.8m frame segment)
- `data/vessel-geometry-catalog.ts`: 13 LOC, minimal bundled catalog lookup
- `types/domain.ts`: Updated with `geometry_id?: string` and `livery_override?: Partial<Livery>`
- `lib/geometry.ts`: Wired `bayCenterX` through `shipToScene` with `bay_lcg_m` fallback seam (correctly falls back to LAYOUT constants if no calibrated data)

#### Test Files (All Present)
✓ Created per plan:
- `lib/__tests__/ship-frame.test.ts`
- `engine/vessel-geometry/__tests__/validate-vessel-geometry.test.ts`
- `lib/__tests__/geometry-characterization.test.ts`

### 6. Edge Case Testing (Ad Hoc Verification)

Tested and verified to pass:
- Single-segment frames with negative frame numbers: frameToX(-10) = -5 ✓
- Extrapolation past last frame: frameToX(200) = 100 (correct spacing extrapolation) ✓
- Round-trip with far-future frames: xToFrame(frameToX(300)) ≈ 300 ✓
- Offsets with null half-breadths (outside hull): Accepted ✓
- All 5 component kinds within bounds: Superstructure, funnel, mast, lifeboat, crane — all validated correctly ✓
- Half-breadth at boundary: beam/2 + 0.05 tolerance respected ✓

### 7. Code Quality

#### File Size Compliance
✓ All new code files under 200 LOC:
- ship-frame.ts: 55 LOC ✓
- validate-vessel-geometry.ts: 144 LOC ✓
- demo-horizon-geometry.ts: 44 LOC ✓
- vessel-geometry-catalog.ts: 13 LOC ✓

#### Documentation & Comments
✓ Each function well-documented:
- ship-frame.ts: Clear frame/ship/scene coordinate system documentation
- validate-vessel-geometry.ts: Issue severity/path structure explained
- Each validation rule documented with error messages
- Comments explain fallback behavior in geometry.ts

#### No New Dependencies
✓ Verified: No additional npm packages added. Only uses existing types and vitest.

## Gaps Between Plan & Implementation

**None detected.** Implementation fully matches plan requirements:
- ✓ Round-trip tests present for all coordinate transforms
- ✓ Frame extrapolation with boundary handling verified
- ✓ Characterization snapshot stable (no drift)
- ✓ All 10 validation rules tested individually
- ✓ All file size, type, and naming conventions met
- ✓ Demo geometry exact specifications (LOA/LBP/etc.)
- ✓ Coordinate system integration seamless

## Bugs Found

**None.** Code behaves correctly under:
- Negative frame extrapolation
- Far-future frame extrapolation
- Round-trip transformations (bidirectional)
- All 5 component kinds
- Null/valid half-breadth combinations
- Boundary conditions (boot-top limits, Cb range, etc.)

## Recommendations

1. **Snapshot Stability:** Characterization test is locked and stable. If future phase 04 changes `slotToPosition` logic, expect snapshot diff — verify it's intentional before updating.

2. **Bay LCG Fallback:** Current `bayCenterX` gracefully falls back to LAYOUT constants when `bay_lcg_m` is absent. This works correctly for phase 5 integration (when phase 5 bay calibration adds the data).

3. **Frame Spacing Docs:** Consider documenting the frame extrapolation behavior in the plan for consumers of `frameToX`/`xToFrame` — negative frames and far-future frames both extrapolate using the nearest segment's spacing.

4. **Validation Error Messages:** Path-based error reporting (e.g., `hull.offsets.half_breadths_m[1][1]`) makes it easy for tooling to highlight issues — well designed.

## Summary

Phase 01 implementation complete and verified. All 99 tests passing with no regressions. Characterization snapshot stable. Coordinate transforms, validation, types, and demo geometry all implemented per specification. Ready for phase 02 (hull offset generation, Cb fitting).

---

**Unresolved Questions:** None.
