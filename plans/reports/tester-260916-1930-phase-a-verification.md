# Phase A verification — StowageModel refactor

Date: 2026-09-16 19:30 | CWD: frontend/ | Vitest 3.2.7, Node v22.23.2, macOS
Scope: read-only verification. No source or test file modified.

## VERDICT: PASS (3 non-blocking notes, 1 test-name defect)

## 1. Numbers

| Command | Result |
|---|---|
| `npm run typecheck` | PASS, 0 errors, 2.9s |
| `vitest run --reporter=dot` (run 1) | 59 files / 432 tests — 432 passed, 0 failed, 0 skipped, 3.40s |
| `vitest run --reporter=dot` (run 2) | 59 files / 432 tests — 432 passed, 3.32s |
| `vitest run src/engine/stowage-model -v` | 3 files / 36 tests — all passed, 432ms |

Per-file: coords 12, occupancy 12, build-stowage-model 12 = 36.

## 2. Flakiness verdict — NOT flaky here; pre-existing at worst

`src/engine/__tests__/validate-plan.test.ts:65` `expect(ms).toBeLessThan(50)` (warm-up call at :56).

- Run 1: `validatePlan: 870 placements in 5.03 ms`
- Run 2: `7.99 ms`
- Run 3 under load (8 spinning node loops): `4.19 ms`

Bound 50 ms → 6-12x margin, 3/3 green. No intermittent failure seen. Assertion is pre-existing and untouched by Phase A — if it ever fires under CI load, it is NOT this phase's regression.

## 3. Tautology assessment (36 new tests)

Mostly genuine: literal coordinate values, occupancy area routing (weather_deck vs hold_1), cache identity, `areaId: null`, deck-from-tier branch, orphan-placement skip, rotated-extent swap. Flags:

- **DEFECT (a)** `build-stowage-model.test.ts` "takes each slot centre from slotToPosition, so the model can't disagree with the renderer" — name overstates. It never calls `slotToPosition` and never compares `center` against the renderer position; it asserts only `center.length === 3`, key-format string, and a bay echo. The claimed invariant is **untested**. Only real gap found.
- (b) `coords.test.ts` "centres a footprint on the placement's x_m/z_m" — expectation recomputed with the impl's own expression (`x_m - lengthM_/2`). Contract-pinning only; the companion 90° case uses literals, so the function is genuinely covered elsewhere.
- (c) `build-stowage-model.test.ts` "produces one SlotDef per grid slot" — `toHaveLength(allSlots(vessel).length)` reuses the impl's own source; the load-bearing half is `slotByKey.size === slots.length` (key uniqueness).
- (d) `occupancy.test.ts` "flattens container stacks to plain rects per area" — `toMatchObject({xMin: expect.any(Number), ...})` proves nothing about values; real assertions are key set + length 1.
- (e) `build-stowage-model.test.ts` "reproduces the generic deck rect of the pre-refactor approximation exactly" — self-same expression, BUT stated purpose is exactly contract-pinning and it adds literal spot-checks (25.8, 12.2). Acceptable.
- (f) `occupancy.test.ts` "blocks the full beam…" / "sizes the footprint as one 40' x 2.438 m slot" — mirror impl expressions, but the asserted fact is branch selection + DIM constants. Acceptable.
- `purity` test is a source-text regex over its own file — real architectural constraint, brittle to refactors.

No fully vacuous test. Nothing passing for the wrong reason inside the new files.

## 4. Named guards — all green, not vacuous

`breakbulk-real-vessels-no-violations` 2 | `validate-plan` 12 | `all-slots` 5 | `naive-fill-breakbulk` 7 | `breakbulk-weight-item` 5 | `geometry-characterization` 1 (snapshot). Also ran `bbc-sao-paulo-containers` 7 and `breakbulk-validation-rules` 10.

- `git status` shows 7 modified src files, **0 modified test files, 0 modified `.snap`**. Every guard is an unchanged characterization test passing against refactored code — that is the behaviour-preservation evidence.
- Changed rule `breakbulkOverlapsContainer` still has a **positive** test ("flags a breakbulk placement over an on-deck container bay", expects exactly 1) → the per-stack rewrite can still fire; negatives are not green by default.
- `bbc-sao-paulo-containers.test.ts` (unchanged, 7 tests) asserts 0 `breakbulk_overlaps_container` on a real >50-container BBC plan packed through the new `occupiedRects` seeding → new option + rule covered end-to-end.

## 5. Passing-for-the-wrong-reason / coverage gaps

1. **Dead code kept alive by its own tests**: `onDeckBayZones`/`underDeckBayZones` have no production caller now (only `breakbulk-forbidden-zones.test.ts`, 5 tests, references them; `naive-fill-breakbulk.ts` imports just the `XZone` type). Those 5 tests guard nothing shipped. Banner was intentional per plan — schedule deletion in Phase D.
2. `breakbulk-real-vessels-no-violations.test.ts` calls `naiveFillBreakbulk(vessel, cargo, [])` with no options → never exercises `occupiedRects`, and it never asserts `breakbulkOverlapsContainer`. Still valid for its 5 rules, but it is NOT a guard for the changed rule.
3. New `occupiedRects` option has no unit test at `packIntoArea` level — integration-only coverage (thin, not broken).
4. Shared-source blind spot: packer (`occupiedRectsByArea`) and validator (`containerOccupancy`) read the same module, so a common frame error shifts both sides consistently and the BBC integration test cannot see it. Only coords literals + geometry snapshot defend it. Low risk.

## 6. Environment issues (pre-existing, not Phase A)

- Coverage unavailable: `@vitest/coverage-v8@5.0.0` vs `vitest@3.2.7` → `SyntaxError: The requested module 'vitest/node' does not provide an export named 'BaseCoverageProvider'`. No `test:coverage` script in package.json either. Coverage % cannot be reported.
- No DOM tests exist; none added. Confirmed.

## 7. Unresolved questions

1. Test-name defect (a): add the real `slotToPosition` comparison, or rename to match what it asserts?
2. Delete `breakbulk-forbidden-zones.ts` + its 5 now-dead tests in Phase D, or keep the banner?
3. Add a `naive-fill-breakbulk.test.ts` case where an `occupiedRects` entry blocks a row, so the new option isn't integration-only?
4. Align `@vitest/coverage-v8` to ^3.x (or drop it) so coverage is obtainable at all?
