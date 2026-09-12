## Code Review Summary — Phase 01: Vessel Geometry Schema & Ship Frame

### Scope
- Files: `types/vessel-geometry.ts` (100), `lib/ship-frame.ts` (54) + test (54), `engine/vessel-geometry/validate-vessel-geometry.ts` (143) + test (118), `data/demo-horizon-geometry.ts` (44), `data/vessel-geometry-catalog.ts` (12), `lib/__tests__/geometry-characterization.test.ts` (18), `types/domain.ts` (+2 fields), `data/demo-container-vessel.ts` (+1 field), `lib/geometry.ts` (+optional param, 57 LOC total)
- LOC: ~747 across new/changed files, all under 200 LOC cap
- Focus: full diff for phase-01 per plan file
- `npm run typecheck`: clean pass (first run hit a transient `TS6053: ship-frame-edge-cases.test.ts not found` — file doesn't exist on disk, no references in source; almost certainly a race with the tester agent's parallel file I/O. Rerun was clean. Not a real issue in this diff.)

### Overall Assessment
Solid, well-scoped implementation. Matches the plan's architecture almost verbatim. Ship-frame math is correct and round-trips cleanly; tests cover boundary/negative-extrapolation cases well. `geometry.ts` change is genuinely backward-compatible (optional param, no call sites updated, fallback path unchanged). One real gap versus the plan's explicit validator requirement (components must stay within LOA **and** beam), and one lower-severity coordinate-system correctness caveat.

### Critical Issues
None.

### High Priority
1. **`validate-vessel-geometry.ts` `checkComponents` only checks the X/LOA envelope, not beam (Y).** Plan F3 explicitly requires "Linh kiện nằm trong LOA/B" (components within LOA **and** beam). `componentXs()` (lines 118-129) only extracts X coordinates (`x_aft_m`/`x_fwd_m`, `x_m`, `pedestal[0]`); nothing checks `y_center_m`, `pedestal[1]`, or funnel/mast/lifeboat `y_m` against `±beam_m/2`. A crane pedestal or superstructure `y_center_m` placed outside the hull's beam would pass validation silently. No test exercises this either (`validate-vessel-geometry.test.ts` "flags a component placed outside the hull extent" only tests an out-of-range `x_m`).
   - Fix: add a beam bound check (e.g. `|y| <= beam_m/2 + tolerance`) for the Y-bearing fields per `ComponentSpec` variant, mirroring the existing `componentXs` pattern with a `componentYs` helper, plus a test case.

### Medium Priority
1. **`frameToX`/`xToFrame` silently anchor ship-frame x=0 at `frames[0].from_frame`, not literal frame 0, when the convention is violated** — but `checkFrames` only emits a `warning` (not `error`) for `frames[0].from_frame !== 0` (validate-vessel-geometry.ts:46-48). The doc comment in `ship-frame.ts` ("frame 0 = AP (x=0)") and the whole ship-frame coordinate system assume this invariant. If a geometry document sets `frames[0].from_frame = 5` (allowed today — only a warning), `frameToX(frames, 0)` would NOT return `0` as documented; it extrapolates backward from the wrong anchor, silently shifting the entire ship-frame origin. Given this underpins every downstream conversion (`shipToScene`, component placement, phase-2 hull generation), recommend promoting this to `severity: "error"`, or explicitly documenting/handling non-zero anchors in `frameToX`/`xToFrame` if that's meant to be legal.
2. `xToFrame`'s `if (xM < x)` backward-extrapolation branch (ship-frame.ts:48) is unreachable for any segment after the first — by loop invariant, once a prior segment's `xM <= x + segLenM` check fails, `xM` is already `> x` for the next segment, so the check only ever fires on segment 0. Harmless (correct today) but slightly misleading; consider hoisting the negative-extrapolation check out of the loop (mirroring how `frameToX`'s equivalent branch is also only meaningfully reachable pre-loop) for clarity, or leave a comment noting it's effectively first-segment-only.

### Low Priority
- `checkLivery` doesn't check `boot_top_low_z_m >= 0` (a negative low-band edge, below baseline, is physically nonsensical). Not required by the plan's listed rules, so not a defect against spec — just a future-hardening suggestion.
- `bayCenterX`'s `calibratedLcg !== undefined && geometry` double-check (geometry.ts:34) looks redundant at first glance but is actually required for TS to narrow `geometry` from `VesselGeometry | undefined` before passing it to `shipToScene` — no change needed, noting only because it reads oddly on first pass.

### Edge Cases Found by Scout
(Static review in lieu of live scout — findings folded into Medium/High above.) Additional edge cases checked and found correctly handled:
- `frameToX`/`xToFrame` round-trip at exact segment boundaries (from_frame/to_frame inclusive) — correct, tests cover this (ship-frame.test.ts:36-53).
- Negative frame / negative x extrapolation (aft overhang) — correct, tested.
- `shipToScene`/`sceneToShip` axis convention: code matches the doc comment exactly (verified by hand: midship→scene x=0, deck→scene y=0, ship +y stbd→scene +z). Tests independently confirm (ship-frame.test.ts:7-20).
- `HullSpec.offsets` discriminated-union access (`g.hull.offsets` in validate-vessel-geometry.ts:64) — compiles cleanly; TS correctly widens to `HullOffsets | undefined` across all three `source` variants. Confirmed via `npm run typecheck`.
- `geometry.ts` backward compatibility: `bayCenterX`'s new `geometry?: VesselGeometry` param is unused at all call sites (`slotToPosition` doesn't pass it), and `buildDemoHorizonGeometry()` has no `bay_lcg_m`, so the new branch is dead until phase 5 — matches plan intent exactly, `geometry-characterization.test.ts` snapshot is unaffected.
- `frameToX`/`xToFrame`/`validateVesselGeometry` are not called from any production code path yet (only tests + the mutually-referencing doc comment) — intentional per plan (consumed starting phase 2), not dead code since exported with tests as public API for next phase.

### Positive Observations
- Ship-frame axis convention doc comment (ship-frame.ts:1-4) is accurate and matches implementation exactly — verified by hand, not just by tests.
- Test coverage for `validateVesselGeometry` is thorough: one test per rule from the plan's RT-2 list, plus a "no issues on valid geometry" baseline and a "valid offsets accepted" positive case.
- `checkComponents`' X-bound derivation (`minX = -aft_overhang_m`, `maxX = loa_m - aft_overhang_m`) correctly reconstructs `[−aft_overhang, LBP + fwd_overhang]` from stored fields without needing a redundant `fwd_overhang_m` field — good YAGNI call, matches plan's key insight.
- All new files respect the 200-LOC cap and kebab-case naming; no component-file exception needed since these are all pure `.ts`.
- `provenance.source_docs` correctly restricted to doc-title strings only, per plan's security note — no file paths or content stored.
- `Vessel`/`geometry.ts` changes are genuinely additive/backward-compatible: optional fields, optional param, no existing call sites touched, fallback formula untouched.

### Recommended Actions
1. (High) Add beam/Y envelope check to `checkComponents` in `validate-vessel-geometry.ts`, plus a test case for a component placed outside the beam.
2. (Medium) Decide whether `frames[0].from_frame !== 0` should be an `error` (recommended, given it silently breaks the x=0 anchor) or explicitly document/support non-zero anchors in `ship-frame.ts`.
3. (Medium, optional) Hoist/clarify the dead backward-extrapolation branch in `xToFrame`'s loop.
4. (Low, optional) Consider `boot_top_low_z_m >= 0` sanity check.

### Metrics
- Type Coverage: n/a (no `any` introduced; `npm run typecheck` clean)
- Test Coverage: every exported function in `ship-frame.ts` and every listed RT-2 validator rule has ≥1 test; characterization test locks current slot layout via snapshot
- Linting Issues: not run (out of scope per task instructions; typecheck used instead)

### Unresolved Questions
- Is a non-zero `frames[0].from_frame` intended to be legal (e.g. for a future geometry where AP isn't frame 0)? If yes, `frameToX`/`xToFrame` need an explicit anchor parameter instead of implicit x=0; if no, the warning should be an error. Left to the implementer/planner to decide before phase 2 builds `HullOffsets` generation on top of this.
