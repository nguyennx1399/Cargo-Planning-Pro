# Code Review — Phase 01-02, Cargo Catalog + Breakbulk (container full-size + project cargo)

## Scope
- Files: `types/domain.ts`, `data/breakbulk-cargo-catalog.ts`, `data/demo-breakbulk-generator.ts`, `data/demo-cargo-generator.ts`, `lib/geometry.ts`, `engine/breakbulk-deck-area.ts`, `engine/breakbulk-overlap-check.ts`, `engine/breakbulk-forbidden-zones.ts`, `engine/naive-fill-breakbulk.ts`, `engine/breakbulk-validation-rules.ts`, `engine/validate-plan.ts`, `data/build-demo-plan.ts` + touched test fixtures. All `< 200` LOC (largest is `naive-fill-breakbulk.ts` at 87).
- Verified myself: `npm run typecheck` clean, `npm test -- --run` green (316/316 at start of review).
- **Environment note**: mid-review, the tree gained phase-03 files (`BreakbulkCargoInstances.tsx`, `engine/cargo/breakbulk-mesh-builder.ts`, `App.tsx` wiring) that weren't there on my first read of `VesselScene.tsx` — re-ran both commands after, now 321/321, typecheck still clean. Concurrent work landed live during this review; see Critical finding below, which this new code directly confirms.

## Overall Assessment
Phase 1-2 code is clean, well-tested (each engine file has a matching test file, rules have pass+fail pairs), and follows the plan's stated constraints (container path untouched, breakbulk kept as a parallel system, required-not-optional `StowagePlan` fields to force `tsc` to enumerate call sites). The one substantive issue is a real ship-frame coordinate convention mismatch between the new breakbulk subsystem and the codebase's established AP/LBP-referenced ship-frame — self-consistent within phase 1-2 alone, but demonstrably wrong once phase-03 rendering (now present in the tree) converts it via `shipToScene`.

## Critical Issues

### 1. Breakbulk ship-frame x uses `vessel.length_m` (LOA) where the rest of the codebase uses `geometry.particulars.lbp_m` (LBP) — real 6m divergence on the demo vessel, now provably manifesting in rendering
`engine/breakbulk-forbidden-zones.ts`'s `bayCenterXShipFrame` and `engine/breakbulk-deck-area.ts`'s `deckArea` both treat ship-frame x as spanning `[0, vessel.length_m]` (length_m=172 for the demo vessel). The codebase's actual AP-referenced ship-frame convention (`lib/ship-frame.ts`: `shipToScene`/`sceneToShip`, used by `cargoWeightItem`, `hatch-and-lashing-geometry.ts`, the whole hull/hydrostatics engine) is anchored to `geometry.particulars.lbp_m`, which for the demo vessel (`demo-horizon-geometry.ts`) is **160**, not 172 (LOA 172 = LBP 160 + 6m fwd overhang + 6m aft overhang).

Traced the exact divergence for bay 2 (i=0), pitch=13.392, bowMargin=22:
- `bayCenterXShipFrame` (breakbulk convention): `172 - 22 - 6.696 = 143.304`
- True AP-referenced ship-frame x for the same bay, via `cargoWeightItem`'s own inverse-of-`shipToScene` formula (`sceneX + lbp_m/2`) with the real geometry: `(86 - 22 - 6.696) + 80 = 137.304`
- **Diverge by exactly 6.0m = (length_m − lbp_m)/2**, for every bay, on the real demo vessel — not a contrived edge case.

`BreakbulkPlacement.x_m`'s own doc comment (`domain.ts`) says "ship-frame x ... from AP" — the same terminology `ship-frame.ts` uses for its lbp_m-anchored frame. So the breakbulk subsystem's coordinate is mislabeled: it's actually LOA-symmetric, not AP-referenced in the sense the rest of the codebase means.

**This is not hypothetical** — the phase-03 code that landed mid-review confirms it: `engine/cargo/breakbulk-mesh-builder.ts` renders every breakbulk item via `shipToScene(geometry, [placement.x_m, ...])`, i.e. `placement.x_m - lbp_m/2` (using the REAL lbp_m=160). Meanwhile containers render via `ContainerInstances.tsx` → `slotToPosition` → `bayCenterX(vessel, slot.bay)` called **without** a geometry argument, i.e. always the `vessel.length_m`-symmetric fallback. Net effect: a breakbulk item placed by `naiveFillBreakbulk` to just clear an `onDeckBayZones` forbidden zone (computed in the length_m convention) will render ~6m further toward the bow than intended once converted via `shipToScene`+lbp_m — i.e. it can visually clip into or hang past the container it was placed to avoid. This directly contradicts the plan's stated success criterion ("không chồng lấn container" / no overlap with containers).
`engine/cargo/__tests__/breakbulk-mesh-builder.test.ts`'s alignment test only cross-checks against `shipToScene` itself (self-consistent by construction) — it never cross-checks against where a container actually renders, so this gap is untested.

**Fix options** (either is workable, pick one and document it explicitly in `domain.ts`'s comment for `BreakbulkPlacement.x_m`):
- (a) Make `deckArea`/`onDeckBayZones`/`naiveFillBreakbulk` geometry-aware: accept optional `VesselGeometry`, use `geometry?.particulars.lbp_m ?? vessel.length_m` exactly like `VesselScene.tsx` already does — then align phase-03's mesh builder to the same. This restores agreement with `cargoWeightItem`/`shipToScene`, at the cost of coupling breakbulk to `VesselGeometry` (contradicts plan.md's stated Key Insight that breakbulk should work without one — would need the same fallback-to-length_m pattern for vessels without geometry).
- (b) Keep breakbulk fully independent of `VesselGeometry` (as designed), but make phase-03's `breakbulk-mesh-builder.ts` convert scene position the same way `ContainerInstances.tsx` does — `sceneX = x_m - vessel.length_m / 2` — NOT `shipToScene`+real lbp_m. This is more aligned with plan.md's explicit YAGNI intent, and is the smaller change since it only touches the one already-landed phase-03 file.

Recommend flagging this explicitly for whoever reviews phase-03, since option (b) requires editing code outside this review's nominal scope.

## High Priority

None beyond the item above (which I rated Critical given it's a live, demonstrable rendering/collision bug once phase-03 is in the tree, not merely a style concern).

## Medium Priority

### 2. `api/client.ts` builds `StowagePlan` via `res.json() as Promise<T>` — untyped source, would silently miss the 2 new required fields if ever revived
`api.demoPlan()`/`api.validate()` cast a raw `fetch().json()` response to `StowagePlan`/`Vessel`/`ValidationReport` with zero runtime validation. Confirmed via grep this file is currently **dead code** — no import anywhere in `src/` besides itself, so it's not a live risk today. But it's exactly the "evades `tsc`'s exhaustiveness check" pattern item #4 asked about: if a future phase wires this up against the Python backend (`backend/app/domain/models.py`, which this file's comment says `domain.ts` mirrors) before that backend model gains `breakbulk_cargo`/`breakbulk_placements`, every consumer of the returned `StowagePlan` (e.g. `validate-plan.ts`'s `plan.breakbulk_cargo.map(...)`) will throw on `undefined` at runtime — `tsc` won't catch it because the cast bypasses structural checking. Low urgency today (dead code), but worth a one-line TODO or runtime guard before this file is ever wired up.

### 3. `deckArea`/`onDeckBayZones` treat AP=0 as the physical stern tip, ignoring `aft_overhang_m`
Related to Critical #1 but distinct: even setting aside LOA-vs-LBP, the codebase's true AP is 6m *forward* of the physical stern (per `aft_overhang_m: 6` in the demo geometry — AP is a perpendicular, not the hull's physical end). `deckArea`'s comment claims "Ship-frame x range is `[0, length_m]`" as if x=0 were the physical stern — under the real convention x=0 (AP) to the physical stern tip is actually `x = -aft_overhang_m` (negative), and the bow tip is beyond `lbp_m`. This is subsumed by fix option (a) above if adopted; if option (b) is adopted instead this is moot since breakbulk would deliberately stay in its own self-consistent frame. Documenting either way avoids a second implementer independently re-deriving (and re-guessing) this.

## Low Priority

### 4. `breakbulkOverweight`'s per-item weight attribution ignores footprint width
Weight of an item is entirely assigned to the 20m band containing `placement.x_m` (its center), even though its footprint may span into the adjacent band. Given `OVERWEIGHT_LIMIT_T`/`OVERWEIGHT_BAND_M` are explicitly labeled DEMO-approximate constants (not real structural limits), this is a reasonable simplification — just noting it slightly under-counts boundary-straddling items. No action needed given stated scope.

### 5. `DIM.len45` and `specialCounts`-generated 45'/OPEN_TOP/FLAT_RACK/TANK containers are inert in rendering
`ContainerInstances.tsx` still scales every instance by `DIM.len40` regardless of `container.size` — a 45' container (if `specialCounts` were ever passed by a caller) would render at 40' length. This is pre-existing, already called out by name in the phase-01 plan's own Risk Assessment as deferred to a later phase, and the current demo (`App.tsx`) never passes `specialCounts`, so it's unreachable today. No new issue introduced by this diff; flagging only for continuity since it's adjacent to what this phase touched.

### 6. Catalog dimensions don't model taper (documented as approximate, consistent with stated intent)
`breakbulk-cargo-catalog.ts` stores a single `width_m` per blade/tower entry even though Key Insights describe tapering root-to-tip diameters. Comment already states these are DEMO reference figures, not authoritative — consistent use across catalog → generator → placement → (now) mesh builder, single source of truth, no drift found. No action needed.

## Answers to the specific focus areas

1. **Ship-frame correctness in `breakbulk-forbidden-zones.ts`**: Diverges from `cargoWeightItem`'s ship-frame by 6m on the real demo vessel (LOA≠LBP) — see Critical #1. The code comment's claim of "mirroring bayCenterX's fallback... expressed directly in ship-frame" is algebraically true only under the (silent, undocumented, and false-for-the-demo-vessel) assumption `lbp_m == length_m`.
2. **`onDeckBayZones` reading `plan.placements` not `vessel.stacks`**: Reasoning holds — confirmed `buildDemoVessel()` declares `deck: "on"` `StackSpec`s for every one of the 10 bays regardless of load state, so a `vessel.stacks`-based implementation would indeed mark the whole deck off-limits even when empty. `validate-plan.ts` correctly passes `plan.placements` (container placements) as the 4th arg to `breakbulkOverlapsContainer`, not any breakbulk array — confirmed by reading the call site directly.
3. **`naive-fill-breakbulk.ts` shelf-packing**: Traced `findXInRow`'s loop — both the forbidden-zone branch and the placed-rect branch only match when the blocking span's upper bound is strictly greater than the current `x`, so `x` strictly increases every iteration a block is found; loop terminates in at most `forbiddenXZones.length + placedRects.length` skips or by exceeding `area.xMax`. No infinite-loop or stuck-at-zero-width-zone scenario found with the zone shapes this codebase actually produces. Sort by `length_m * width_m` descending is applied before packing (`naive-fill-breakbulk.ts:50`), test `"larger items are placed first regardless of input order"` locks this in.
4. **`StowagePlan`'s 2 new required fields**: grepped every `StowagePlan`-typed construction site in `src/` (excluding the one in `types/domain.ts` itself) — all 4 real object-literal sites (`build-demo-plan.ts` ×2 via `basePlanFields`, `naive-fill-plan.test.ts`, `test-vessel-fixture.ts`) include both fields. No `as StowagePlan` casts found anywhere. One latent gap: `api/client.ts`'s untyped-JSON path (Medium #2) — currently dead code, not a live risk, but does evade `tsc` by construction and should be remembered if that file is ever wired up.
5. **Validation rule design / `validate-plan.ts` merge**: No inconsistency found. Breakbulk rules use severity `"error"` uniformly, matching the existing convention for hard capacity/physical constraints (`stackWeight` in `validation-rules.ts` is also always `"error"`; only the soft `overstow` rule is `"warning"`). The stable sort (errors before warnings) correctly reorders across both rule sets while preserving intra-severity order (orphans → `ALL_RULES` → breakbulk rules). `kpis.errors`/`kpis.ok` correctly fold in breakbulk violations since they're spliced into the same `violations` array before the KPI computation; no separate/duplicate counting logic was introduced. No breakbulk-specific KPIs (e.g. breakbulk placed/unplaced count) were added, but nothing in the phase-02 plan's Success Criteria required them.
6. **Code quality**: all files under 200 LOC, kebab-case naming throughout, comments are substantive (explain *why*, not just *what*) and consistently flag DEMO-approximate constants. Catalog dimensions are used consistently end-to-end (catalog → generator → placement → phase-03 mesh builder) with no unit/scale drift found.

## Positive Observations
- Required-not-optional `StowagePlan` fields, verified by rerunning `typecheck` myself rather than trusting the todo list — genuinely forced every call site to be visited (confirmed no site missed, module modulo the dead `api/client.ts` cast).
- Every new engine file is pure (no React/three/zustand imports) and has 1:1 test coverage, following the existing `ALL_RULES`/rule-per-test convention.
- `demo-cargo-generator.ts`'s `specialCounts` opt-in is correctly proven not to change default output — explicit regression test (`"defaults to zero special... unchanged from before"`) plus the untouched 470/400-count assertions still pass.
- `onDeckBayZones`'s deviation from the phase-02 draft (`plan.placements` instead of `vessel.stacks`) is documented in the phase file's own "Deviations" section with the concrete reasoning and was verified against real numbers (12/14 and 2/14 placed, empty vs full ship) rather than just asserted.
- `rectsOverlap`'s touching-edge-is-not-overlap semantics is deliberate and tested both ways.

## Recommended Actions
1. (Critical) Resolve the ship-frame convention for `BreakbulkPlacement.x_m` before/alongside phase-03 review — either make breakbulk geometry-aware (option a) or make `breakbulk-mesh-builder.ts` use the `vessel.length_m`-symmetric conversion to match `ContainerInstances.tsx` (option b). Add a cross-system test (breakbulk item placed adjacent to a known on-deck bay's forbidden zone, rendered, position compared against that bay's actual container scene position) to catch this class of bug going forward.
2. (Medium) Add a one-line guard or TODO comment on `api/client.ts`'s cast sites noting the new required fields, so a future integration doesn't get bitten silently.
3. (Low, optional) Update `deckArea`'s doc comment to acknowledge it's LOA-symmetric, not AP/LBP-referenced, until/unless fix option (a) is adopted.

## Metrics
- Files reviewed: 13 source + ~10 test files, ~730 LOC in the reviewed source files.
- `npm run typecheck`: clean (both before and after phase-03 files appeared).
- `npm test -- --run`: 316/316 green at review start, 321/321 after phase-03 files appeared mid-review.
- No lint script found wired for a separate check beyond `tsc`.

## Unresolved Questions
1. Was phase-03 intentionally started concurrently with this phase 1-2 review, or is this an accidental interleaving of sessions? `BreakbulkCargoInstances.tsx`/`engine/cargo/breakbulk-mesh-builder.ts`/`App.tsx` wiring appeared in the tree between my first and second read of `VesselScene.tsx` in this same session.
2. Which fix option (a: geometry-aware breakbulk, b: length_m-symmetric mesh builder) is preferred for Critical #1 — this affects whether the fix belongs to a phase-02 patch or a phase-03 patch.
3. Is `api/client.ts` planned to be revived for a real backend integration, or is it fully dead code slated for removal? Affects whether Medium #2 needs a fix now or can stay noted.
