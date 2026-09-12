# Test Report: Phase 01 & 02 — Breakbulk Cargo Catalog & Deck Placement

**Date:** 2026-09-12  
**Tester:** Claude QA Agent  
**Phases Tested:** 01 (Data Model + Catalog), 02 (Deck Area + Naive Fill)  
**Status:** ✅ PASSED

---

## Executive Summary

Phase 01 & 02 implementation verified across all 6 requirements:

- ✅ Typecheck, tests, build all pass clean (316 tests, 46 test files)
- ✅ Regression verified: `generateDemoCargo(42)` produces exactly 470/400 container types unchanged
- ✅ `naiveFillBreakbulk` produces zero overlaps across multiple placement scenarios
- ✅ Deviations fix confirmed: `onDeckBayZones` reads actual placements, not vessel.stacks
- ✅ Validation rules integrated without regression to container-only plans
- ✅ All 7 new files under 200 LOC (max: 91 lines)

---

## Test Results Overview

### Build & Type Safety

```
Command: npm run typecheck
Result: PASS (no errors)

Command: npm test -- --run
Result: PASS (316 tests, 46 test files)
- 6 new test files added (all passing)
- 0 regressions in existing tests
- Test execution time: 2.33s

Command: npm run build
Result: PASS (production bundle generated)
- No typescript errors
- Bundle size: 1,206.65 KB (gzip: 341.46 KB)
```

### Test Breakdown

**Breakbulk Tests (6 new test files, 33 tests):**
- `breakbulk-deck-area.test.ts`: 3 tests ✓
- `breakbulk-overlap-check.test.ts`: 7 tests ✓
- `breakbulk-forbidden-zones.test.ts`: 5 tests ✓
- `naive-fill-breakbulk.test.ts`: 6 tests ✓
- `breakbulk-validation-rules.test.ts`: 8 tests ✓
- `demo-breakbulk-generator.test.ts`: 4 tests ✓

**Existing Tests (283 tests):**
- All existing container validation tests pass unchanged ✓
- Demo cargo regression tests pass ✓
- Edge case tests all pass ✓

---

## Requirement 1: Build & Typecheck Clean ✅

### npm run typecheck
**Result:** PASS  
**Error Count:** 0  
**Verification:** 
- TypeScript compiler runs with `--noEmit` flag
- All `StowagePlan` literals correctly include `breakbulk_cargo` and `breakbulk_placements` fields
- Type inference verified via existing fixture usage (test-vessel-fixture.ts)

**Modified/Created Files Verified:**
- `src/types/domain.ts` — 3 new types added (BreakbulkCategory, BreakbulkCargo, BreakbulkPlacement)
- `src/engine/validate-plan.ts` — Updated to call breakbulk validation rules
- All fixtures updated with `makePlan(..., [], [])` for breakbulk fields

---

## Requirement 2: Container Regression — `generateDemoCargo(42)` ✅

### Default Behavior (No Options)

**Test:** `demo-data.test.ts` lines 47-52
```
generateDemoCargo(42) =>
  - Forties (size="40"): 470 containers ✓
  - Twenties (size="20"): 400 containers ✓
  - Special cargo (size="45", type=OPEN_TOP/FLAT_RACK/TANK): 0 ✓
  - Total unique IDs: 870 ✓
```

**Verification Method:**
```typescript
expect(cargo.filter((c) => c.size === "40")).toHaveLength(470);
expect(cargo.filter((c) => c.size === "20")).toHaveLength(400);
expect(cargo.filter((c) => c.size === "45")).toHaveLength(0);
```

**Result:** EXACT match to specification. Zero regression.

### New Option: `specialCounts` (Additive)

**Test:** `demo-data.test.ts` lines 132-141
```
generateDemoCargo(42, { 
  specialCounts: { "45": 2, OPEN_TOP: 2, FLAT_RACK: 2, TANK: 2 } 
}) =>
  - Forties (DRY|REEFER): 470 ✓
  - Twenties: 400 ✓
  - Size="45": 2 new containers ✓
  - Type=OPEN_TOP: 2 new containers ✓
  - Type=FLAT_RACK: 2 new containers ✓
  - Type=TANK: 2 new containers ✓
```

**Key Finding:** `specialCounts` option is **additive** — it does not disturb the base 470/400 mix. The 470 forties remain exclusively DRY|REEFER when special counts are applied.

**Code Pattern Verified:**
```typescript
// Default: forties=470, twenties=400, specialCounts=undefined
// With specialCounts: same forties/twenties BASE, plus additional specials
```

---

## Requirement 3: No Overlaps in `naiveFillBreakbulk` ✅

### Direct Overlap Verification

**Test:** `naive-fill-breakbulk.test.ts` lines 16-25  
**Method:** Independent `rectsOverlap` check on all placements

```typescript
for (let i = 0; i < rects.length; i++) {
  for (let j = i + 1; j < rects.length; j++) 
    expect(rectsOverlap(rects[i], rects[j])).toBe(false);
}
```

**Test Scenarios Executed:**

**Scenario A: Ample Room (3 items)**
- Input: 20×6m, 15×5m, 10×4m yachts on 200×30m deck
- Output: All 3 placed, 0 overlaps ✓

**Scenario B: Deck Boundaries (2 large items)**
- Input: 30×8m, 25×6m on 200×30m deck
- Verification: All placements fully inside deck area bounds ✓
- Rects checked with floating-point tolerance (±1e-9) ✓

**Scenario C: Forbidden Zone Skip (1 item)**
- Input: 10×4m item with x-range [30, 100] forbidden
- Output: Item placed at x > 100 in same row (z unchanged) ✓
- Demonstrates "skip past obstacle" logic works correctly

**Scenario D: Oversized Item Rejection (1 huge item)**
- Input: 500m length (longer than entire 200m vessel)
- Output: Unplaced list contains item, no force-fit ✓

**Scenario E: Greedy Sort (Large First)**
- Input: 5×3m small item, 40×10m big item in reverse input order
- Output: Big item placed first (largest footprint area), claims prime position ✓

**Scenario F: Row Wrapping (3 full-length items)**
- Input: 3 × ~140m-long items on 200m deck, 8m wide each
- Output: 3 items placed in distinct rows (z values differ), 0 unplaced ✓

### Integration with `footprintRect`

All overlap checks use the actual `footprintRect` utility (shared with validation rules):
```typescript
footprintRect(item: BreakbulkCargo, placement: BreakbulkPlacement): Rect
```
This accounts for rotation_deg (though naiveFill currently only uses 0°).

---

## Requirement 4: Deviations Fix — `onDeckBayZones` Uses Placements ✅

### Fix Verification

**File:** `breakbulk-forbidden-zones.ts` lines 22-28

**Implementation Detail:**
```typescript
export function onDeckBayZones(vessel: Vessel, placements: Placement[]): XZone[] {
  const onDeckBays = new Set(
    placements.filter((p) => p.slot.tier >= ON_DECK_TIER_THRESHOLD).map((p) => p.slot.bay)
  );
  return [...onDeckBays].map((bay) => {
    const center = bayCenterXShipFrame(vessel, bay);
    return { xMin: center - DIM.len40 / 2, xMax: center + DIM.len40 / 2 };
  });
}
```

**Critical Aspect:** Reads `placements`, NOT `vessel.stacks`. This is the Deviations fix explicitly called out in phase-02 plan.

### Test Scenarios

**Test 1: Empty Placements** (lines 11-12)
```
Input: vessel with [bay2, bay6], placements=[]
Output: [] (no zones)
Expected: An empty ship has no forbidden zones ✓
```

**Test 2: Under-Deck Only** (lines 15-17)
```
Input: placements with tier=4 (< 80 threshold), tier=2
Output: [] (no zones)
Expected: Under-deck containers don't block breakbulk ✓
```

**Test 3: On-Deck Deduplication** (lines 20-27)
```
Input: 2 containers in bay 2 (rows 1,2), 1 in bay 6, all tier >= 80
Output: 2 zones (one per bay, no duplication)
Expected: Multi-container same bay = 1 zone ✓
```

**Test 4: Real Demo Vessel Loaded** (lines 36-43)
```
Input: buildDemoVessel() + generateDemoCargo(42) via naiveFillPlan
Output: zones.length > 0 AND zones.length < vessel.bays.length (10)
Expected: ~470/800 cells used → some (not all) bays on-deck
Result: zones.length = 7 (7 of 10 bays have on-deck containers) ✓
```

**Correctness Confirmation:**
The phase-02 plan notes that tàu demo's `vessel.stacks` declares `deck: "on"` for ALL bays (static capacity), but actual placements only occupy some bays. If code had used `vessel.stacks` as originally drafted, ALL 10 bays would be forbidden even on an empty ship. The actual implementation correctly forbids only bays with real containers.

---

## Requirement 5: Validation Rules Integration & No Regression ✅

### Rules Wired Into validate-plan.ts

**File:** `validate-plan.ts` lines 35-38
```typescript
...breakbulkOutOfDeckArea(vessel, plan.breakbulk_cargo, plan.breakbulk_placements),
...breakbulkOverlap(plan.breakbulk_cargo, plan.breakbulk_placements),
...breakbulkOverlapsContainer(vessel, plan.breakbulk_cargo, plan.breakbulk_placements, plan.placements),
...breakbulkOverweight(vessel, plan.breakbulk_cargo, plan.breakbulk_placements),
```

### Four Breakbulk Rules

**Rule 1: breakbulkOutOfDeckArea**
- Test (lines 12-24): Flags placement near stern margin, clears valid placement
- Pattern: Uses `deckArea(vessel)` bounds check
- Result: ✓ Works as expected

**Rule 2: breakbulkOverlap**
- Test (lines 27-45): Flags overlapping pair, clears non-overlapping pair
- Pattern: Uses `rectsOverlap()` on cargo footprints
- Result: ✓ Works as expected

**Rule 3: breakbulkOverlapsContainer**
- Test (lines 47-62): Flags breakbulk over on-deck bay, clears empty deck
- Pattern: Uses `onDeckBayZones()` + `rectsOverlap()`
- Result: ✓ Works as expected

**Rule 4: breakbulkOverweight**
- Test (lines 64-82): Flags 240t in 20m band (> 200t DEMO limit), clears 100t
- Pattern: Sums weights per x-band, compares to DEMO threshold
- Result: ✓ Works as expected

### Regression Test: Empty Breakbulk Arrays

**Test:** `validate-plan.test.ts` full suite
```
Condition: breakbulk_cargo=[], breakbulk_placements=[]
Expected: makePlan() calls always include these empty arrays (test-vessel-fixture.ts line 36)
Result: All existing 283 tests pass unchanged ✓
```

**Full Demo Load Test** (lines 51-65)
```
Vessel: buildDemoVessel()
Cargo: generateDemoCargo(42) [470 forties + 400 twenties, no breakbulk]
Placements: ~870 containers via naiveFill
Validation: 4.73 ms, 0 structural errors
Breakbulk violations: 0 (empty arrays contribute 0 violations)
Result: ✓ No regression, timing still <50ms
```

---

## Requirement 6: File Sizes (All < 200 LOC) ✅

| File | Lines | Status |
|------|-------|--------|
| breakbulk-cargo-catalog.ts | 26 | ✓ |
| demo-breakbulk-generator.ts | 29 | ✓ |
| breakbulk-deck-area.ts | 30 | ✓ |
| breakbulk-overlap-check.ts | 29 | ✓ |
| naive-fill-breakbulk.ts | 88 | ✓ |
| breakbulk-forbidden-zones.ts | 34 | ✓ |
| breakbulk-validation-rules.ts | 91 | ✓ |

**All within project convention limit (< 200 LOC per file).**

---

## Coverage Metrics

| Category | Count | Status |
|----------|-------|--------|
| Total Tests | 316 | ✓ |
| Passing | 316 | ✓ |
| Failing | 0 | ✓ |
| Test Files | 46 | ✓ |
| New Test Files | 6 | ✓ |
| New Tests | 33 | ✓ |

**Test Execution Time:** 2.33s (within acceptable bounds)

---

## Critical Issues

**None.** All requirements met, all tests passing.

---

## Recommendations

1. **Phase 03 Wiring:** When rendering breakbulk in demo, ensure `naiveFillBreakbulk` is called with actual `placements` (not empty) to test forbidden-zone logic in context.

2. **Demo Data Selection:** The 14-item breakbulk generator produces items that may not all fit on a fully-loaded vessel (expected behavior per phase-02 Success Criteria). Phase 03's UI should either:
   - Show empty vessel + breakbulk separately (best visual), or
   - Document that some items unplace due to container deck occupation

3. **Weight Distribution:** Nacelle (70-120t) has low center of gravity (high in footprint). Phase 04 stability integration should validate GM changes are physically reasonable when breakbulk items are added.

4. **Future: Rotation Support** — `naiveFillBreakbulk` currently only uses `rotation_deg=0`. If UI later supports manual rotation, validate that `rectsOverlap` correctly handles 90° rotations (it does via `footprintRect`, tested in overlap-check tests).

---

## Unresolved Questions

None at this time. All test coverage complete for phase scope.

---

## Sign-Off

✅ **PHASE 01 & 02 VERIFICATION COMPLETE**

- Typecheck: PASS
- Tests: 316/316 PASS (0 failures, 0 regressions)
- Build: PASS
- Code Quality: All files < 200 LOC
- Regression: Container-only plans unaffected
- New Features: Fully tested & integrated

**Ready for Phase 03 (Rendering & Demo Wiring).**
