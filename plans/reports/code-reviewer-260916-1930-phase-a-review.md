# Code Review — Phase A: StowageModel foundation

- **Date:** 2026-09-16 19:30 (re-verified 19:45 after concurrent edits landed mid-review)
- **Reviewer:** code-reviewer (read-only; only this report + one agent-memory file written)
- **Contract:** `plans/260916-1647-drag-drop-stowage-placeholders/phase-01-stowage-model-foundation.md` (spec: `plans/reports/confluence-260916-1647-drag-drop-stowage-placeholders-feature-plan.md` §4.1–4.4, §7 Phase A)
- **Scope:** new `frontend/src/engine/stowage-model/{types,coords,build-stowage-model,occupancy,index}.ts` + 3 test files; modified `engine/breakbulk-deck-area.ts`, `engine/naive-fill-breakbulk.ts`, `engine/` `__tests__/naive-fill-breakbulk.test.ts`, `engine/breakbulk-validation-rules.ts`, `engine/breakbulk-forbidden-zones.ts`, `engine/cargo/breakbulk-mesh-builder.ts`, `lib/breakbulk-weight-item.ts`, `data/build-demo-plan.ts`
- **Review state:** the implementer pushed follow-up changes while this review ran (3 new packer tests, a real `center` identity assertion, the rect-identity assertion, plan file maintained). All findings below were re-verified against the **current** tree; the source files I judged were not touched by those follow-ups (line counts unchanged).

## Score: 9/10

No critical correctness defect. The shim is empirically behaviour-identical (135 accessor comparisons, 0 diffs), the demo stowage plans are **byte-identical** old-vs-new on both real vessels, the loosening is provably cannot-introduce-a-new-violation, and every Success Criterion is now met. Withheld for two remaining coverage gaps on plan-stated requirements (multi-area column; validator-side loosening) plus minor hygiene items.

## CRITICAL issues

None found. Three candidates were investigated and disposed of — recorded so they are not re-raised:

1. **Coordinate convention regression (the phase's #1 risk)** — NOT PRESENT. `occupancy.ts:25` and `build-stowage-model.ts:112` invert `bayCenterX` via `sceneXToPlacementX`. Verified numerically against the pre-refactor `bayCenterXVesselRelative` on both branches: the declared `container_layout.bay_center_x_m` path (BBC, 9 declared bays) and the LAYOUT/bowMargin/pitch fallback. All 34 occupied-stack x_m centres match the old `onDeckBayZones`/`underDeckBayZones` centres to 1e-9; the undeclared-row case reproduces the same x-range (`x[137.208, 149.400]`) plus the full-beam z fallback. `ContainerInstances.tsx:64` also calls `slotToPosition` **without** geometry, so model rects agree with what is drawn (the geometry-aware `cargo-weight-item.ts:10` path is a pre-existing, out-of-scope divergence).
2. **`breakbulkOverlapsContainer` missing a case the old rule caught (priority 2)** — NOT PRESENT, and provably so. Each new stack rect occupies exactly the same x-range as the bay zone it replaces (verified above) and is a subset of the full beam in z, so `new_block ⟹ old_block`: the rule is **strictly weaker**, i.e. it cannot flag anything the old rule missed. Unintended-miss vectors checked: 40' footprint (a 20' box is over-covered — conservative), undeclared row (full-beam rect kept, `occupancy.ts:28-36`), column through a tweendeck (`occupancy.ts:63-65` blocks every overlapping under-deck area), and holds whose declared envelope is narrower than the physical hold (on BBC all 14 under-deck stacks register — `tank_top_hold2:7`, `main_deck_aft_hold2:7`, `tank_top_hold1:0` — none is lost). Tie-breaker resolves in favour of keeping the loosening: **no new violation**, and the packer output is byte-identical (evidence table).
3. **Shim drift (priority 1)** — NOT PRESENT. A differential harness re-implementing the pre-refactor `breakbulk-deck-area.ts` verbatim from `git HEAD` ran against the new shim over 3 vessels (demo-horizon = generic deck; BBC = declared deck + 3 holds; synthetic = holds but **no** `breakbulk_deck`) × 5 area ids (`undefined`, `""`, `weather_deck`, unknown hold, each real hold id) × 9 accessors incl. `stowageAreaIds`/`areaIdOf` = **135 comparisons, 0 diffs**. Covers the three load-bearing states (unknown hold → empty rect / `isKnownArea === false` / `unknown area "X"`; no `breakbulk_deck` → generic 15%/85%/1.5 m rect; falsy `areaId` → weather deck) and the `cargoBaseHeight` (0.6) / `maxCargoHeight` (Infinity) / `deckLoadRating` (undefined) fallbacks.

## Warnings

1. **`slotKey` separator divergence — `stowage-model/build-stowage-model.ts:39,126` vs `engine/all-slots.ts:17`.** Model keys use `bay|row|tier`; `emptySlots`'s internal key uses `bay:row:tier`. Failure scenario: Phase B resolves a hovered empty slot with `emptySlots` (`:`) then looks it up in `model.slotByKey` (`|`) → `undefined`, silently treating every empty slot as unknown. Fix now, or use one key format throughout Phase B.
2. **`Object.freeze` (spec §9) deliberately not implemented — `build-stowage-model.ts:9-12`.** The risk table's mitigation ("dev-only freeze") is documented-but-absent, so the cache invariant is convention only. Failure scenario: Phase B implements placement by mutating the catalog vessel (`vessel.stacks.push(...)`); `buildStowageModel` then returns the stale model **for the whole process** and the new slot is invisible to picker/validator (`App.tsx:30-47` holds catalog vessel objects, so the cache never invalidates). Phase B must treat `Vessel` as immutable — worth stating in Phase B's plan.
3. **No test for the multi-area under-deck column** — plan requirement "under-deck stacks block every hold area they overlap (a column passes through the tweendeck above the tank top)". `occupancy.test.ts` uses a fixture with a **single** hold, so `occupancy.ts:63-65`'s loop is only exercised one iteration deep; on BBC the tweendeck (`main_deck_aft_hold2`, x[11.5,31.1]) and the tank top (`tank_top_hold2`, x[37.6,115.9]) are x-disjoint, so no real vessel exercises it either. Failure scenario: a later refactor collapses the loop to a single-area lookup; every test stays green while a tweendeck above a loaded tank top is reported free. Cheap fix: give the fixture a second overlapping hold.
4. **The loosening is still untested on the validator side.** The follow-up tests correctly cover the *packer's* seeding (blocked rect → cargo packs around it; wrong-area rect ignored; full block → unplaced) and the new `occupancy.test.ts` assertion that the seed rect is **identical** to `model.slotByKey.get(...).rect` is a genuinely strong invariant. But nothing asserts the new rule reports clean for cargo legitimately beside a stack, nor that it still fires for cargo overlapping one — the two behaviours that changed. Phase D needs that pair.
5. **Purity test scans one file of seven — `build-stowage-model.test.ts:152-158`.** It reads only `../build-stowage-model.ts`; `coords.ts`, `occupancy.ts`, `types.ts`, `index.ts` are unguarded by it and the regex misses dynamic `import("three")`. Purity itself holds — verified by inspection across all 7 model files: only `@/types/domain`, `@/engine/*`, `@/lib/geometry`; RT-8 (`validate-plan.test.ts:69-79`) remains non-recursive, as the plan warned.
6. **Model aliasing through the process-wide cache.** `keepOuts` is `declared.keep_out ?? []` / `h.keep_out ?? []` (`build-stowage-model.ts:48,85`) — the vessel's array identity, reachable via `deckKeepOuts` (`breakbulk-deck-area.ts:62`) without a copy, and now cached and shared. Pre-existing aliasing, but newly shareable. Failure scenario: a caller does `deckKeepOuts(vessel, id).push(phantom)`; packer, validator and every test see a phantom keep-out for the rest of the process. No current caller mutates (verified: `naive-fill-breakbulk.ts:88` copies, `breakbulk-validation-rules.ts:149` and `bbc-sao-paulo-deck-layout.test.ts:26` only read).
7. **Unrelated file in the change set: `.claude/hooks/.logs/hook-log.jsonl` (+349 lines).** Appended by the tooling, not part of this phase — exclude from the phase commit or gitignore it (content is benign: hook name/tool/duration/status).
8. **`validate-plan.test.ts:66` wall-clock bound now includes lazy model construction.** `validatePlan` reaches the model on first use (`validate-plan.ts:37` → `containerOccupancy` → `buildStowageModel`: 447/800 slots for BBC/demo). Measured fine, and the assertion was **not** weakened (file unmodified) — noting only that the 50 ms bound gets more fragile if a vessel's grid grows.
9. **Plan-file evidence contains one non-reproducing number.** The step-13 deviation note claims BBC "391 containers / **0 breakbulk**". The phase's own `bbc-sao-paulo-containers.test.ts:70` requires `breakbulk_placements.length > 0` and passes, and my measurement gives **8 placed / 6 unplaced** on BBC, identical in both the old and new configurations (see unresolved questions). The demo numbers in that note (2 breakbulk, `BB004 @ 31.80,-10.20`, `BB010 @ 75.05,-10.20`) reproduce **exactly** in my independent harness, so only the BBC row is suspect.

## Verification evidence

| Check | Result |
|---|---|
| `npm run typecheck` | clean (no output) |
| `npx vitest run` | **59 files / 435 tests pass** (baseline 56/396 → +3 files / **+39 tests**: 36 model + 3 packer follow-ups) |
| Shim differential (old vs new: 3 vessels × 5 ids × 9 accessors) | **0 diffs** |
| Old-vs-new `withBreakbulkCargo`, MV Demo Horizon app path (486 containers, 119 occupied stacks) | **placements byte-identical** (2 placed: BB004, BB010); 0 breakbulk/stack-weight violations both ways |
| Old-vs-new `withBreakbulkCargo`, BBC SAO PAULO (110 containers, 34 occupied stacks) | **placements byte-identical** (8 placed / 6 unplaced); 0 breakbulk/stack-weight violations both ways |
| x_m centres vs pre-refactor zone centres | 34/34 identical (1e-9); undeclared-row x-range identical |
| Purity of all 7 model files | clean (inspection) |
| LOC | max 190 (`breakbulk-validation-rules.ts`); model files max 171; tests max 161 — all < 200 |
| `frontend/package.json` / lockfile | untouched — zero new deps |
| Contract files untouched (`lib/geometry.ts`, `engine/all-slots.ts`, `engine/breakbulk-overlap-check.ts`, `validate-plan.test.ts`) | unmodified → `allSlots`/`emptySlots`/`slotToPosition`/`footprintRect` signatures and the flaky assertion preserved by construction |

Rule id (`breakbulk_overlaps_container`) and message shape preserved, now naming the stack (`breakbulk-validation-rules.ts:114`, e.g. `overlaps on-deck container stack bay 30 row 04`) as required. `naiveFillBreakbulk`'s positional `forbiddenXZones` is untouched and `occupiedRects` is an options field (`naive-fill-breakbulk.ts:65`) — `breakbulk-real-vessels-no-violations.test.ts:27`'s positional `[]` still compiles and passes. All 7 rule exports and all 11 `breakbulk-deck-area` exports keep their names/signatures (`areaIdOf`'s parameter widened to `{ area_id?: string }` — structurally identical to the old `Pick<BreakbulkPlacement, "area_id">`).

## Priority-ordered conclusions

1. **Shim semantics — PASS** (0 diffs over the cases the plan names, incl. the falsy-`""` and holds-without-deck combinations).
2. **Per-stack loosening — ACCEPT, land it.** Strictly weaker than the old rule, x-ranges identical, BBC packer output unchanged, no new violation → the Session-1 revert condition is not met. Only remaining work is test coverage (warning 4).
3. **`coords.ts` as the only offset home — PASS for production code.** No hand-rolled `x_m ∓ length_m/2` remains in `src/` outside `coords.ts`. Remaining hits are a different conversion (scene → true ship-frame `lbp_m/2`: `lib/breakbulk-weight-item.ts:19`, `lib/cargo-weight-item.ts:15`, `vessel-components/hatch-and-lashing-geometry.ts:20`) or test-local re-derivations (`engine/cargo/__tests__/breakbulk-mesh-builder.test.ts:76,81,104,106`) that now duplicate the formula `coords.ts` owns — consider importing `coords` there.
4. **Purity — PASS** (inspection; test-scope gap = warning 5).
5. **Contract preservation — PASS** (frozen third parameter, options-field `occupiedRects`, no signature changed; only `breakbulkOverlapsContainer`'s body changed among the 7 rules).
6. **LOC / naming / `center` identity / footprint — PASS.** `center = slotToPosition(vessel, slot)` verbatim (`build-stowage-model.ts:110`) and now asserted per-slot against `slotToPosition` directly; `rect = rectFromCenter(x_m, z_m, DIM.len40, DIM.width)` = 12.192 × 2.438 m with the plan's one-line 20'-bay TODO on `SlotDef.rect` (`types.ts:45-46`). kebab-case throughout; existing files updated in place, no "enhanced" copies.
7. **Test quality — good, two residual gaps.** Strong: generic-rect equality against the old 0.15/0.15/1.5 constants with literal 25.8/12.2 spot-checks; per-slot `center` identity; cache identity; `areaId` null/hold/weather-deck assignment; empty-plan occupancy; full-beam undeclared-row fallback; 40'×2.438 footprint; packer seeding (3 tests) and seed-rect == model-rect identity; `rectContainsPoint`/`rectContainsRect`/`snap` boundary literals. Gaps: warnings 3 and 4.
8. **Success Criteria — all met** (table below).

| Success Criterion | Status |
|---|---|
| tsc passes | MET (`npm run typecheck` clean) |
| Both vessels render as before apart from cargo beside stacks | MET at data level — placements byte-identical on both vessels incl. the real app path, independently reproduced; the author's step-13 deviation note records the same measurement. Live pixel eyeball still unconfirmed (open question 1) |
| BBC demo plan 0 breakbulk/stack-weight errors | MET — 0 breakbulk/stack_weight violations on the loaded BBC plan, old and new; the 36 `overstow` violations there are pre-existing and identical in both versions |
| Existing 396 tests pass, flaky assertion untouched | MET — 435/435 (396 + 39); `validate-plan.test.ts` unmodified |
| `breakbulk-real-vessels-no-violations.test.ts` green; third parameter frozen | MET |
| `naive-fill-breakbulk.test.ts` + `breakbulk-weight-item.test.ts` green | MET (7 → 10 tests in the former; the latter has 2 tests, not the 5 the plan claims — file unmodified, green) |
| No new dependency | MET (package.json + lockfile untouched) |
| No file over 200 LOC | MET (max 190) |
| Plan Todo list + status updated | MET (follow-up: status `implemented`, all boxes ticked, deviation recorded) |

## Verdict: Phase B may be built on this — yes, with three guardrails

The foundation is sound and behaviour-preserving, verified by measurement rather than argument. Before/while starting Phase B:

1. Keep `Vessel` immutable (warning 2) — a mutated catalog vessel yields a permanently stale model.
2. Pick one slot-key format and use it on both sides (warning 1), or import the model's key construction into `emptySlots`/the picker.
3. Add the three cheap tests (warnings 3 and 4) so Phase D does not build `freeRegionsFor` on unverified corners.

Housekeeping: keep `hook-log.jsonl` out of the phase commit (warning 7); reconcile or correct the BBC "0 breakbulk" figure in the plan note (warning 9); `docs/` impact for this phase is minor — `docs/system-architecture.md` should gain a StowageModel entry when Phase B lands, nothing required now.

## Positive observations

- The `||`-vs-`??` falsy check in `areaFor` (`breakbulk-deck-area.ts:33`) and placing `WEATHER_DECK_AREA_ID`/`areaIdOf` in `types.ts` to avoid a `breakbulk-deck-area → occupancy → breakbulk-deck-area` cycle (`types.ts:5-8`) are exactly the right calls, both commented.
- `weatherDeckArea`'s conditional spreads preserve `undefined` for a declared `0` load rating, matching the old accessor.
- Reusing `slotToPosition` for `center` and inverting `bayCenterX` for rects means the model *cannot* disagree with the renderer — the phase's core objective.
- Packer blockers and validator blockers come from the same `containerOccupancy` map, and both use `rectsOverlap`, so packing and validation cannot drift and boundary placements behave consistently.
- The follow-up tests added mid-review (seed-rect == model-rect identity; packer packs around `occupiedRects`; wrong-area rect ignored) are the right tests — they check invariants rather than restating arithmetic.
- Documentation quality is high throughout, and the deprecation banners name their Phase E deletion.

## Unresolved questions

1. Was the live `npm run dev` visual diff on both vessels performed? The plan's step-13 note explicitly says the criterion was verified by measuring data, not pixels — the data measurement is independently reproduced here, so the residual risk is only in the render path (whose only change is `placementXToSceneX`, an identical function). A one-minute eyeball would close it.
2. **Discrepancy to reconcile:** the plan note claims BBC "0 breakbulk" placements post-phase; my harness measures 8 placed / 6 unplaced on BBC, identical in the old and new configurations, and `bbc-sao-paulo-containers.test.ts:70` requires `> 0`. Either the note's BBC row is mis-measured or it describes a different plan — worth correcting so Phase B's baseline is trustworthy.
3. Is `Object.freeze` (spec §9) dropped for good or deferred? Currently documented in code only; Phase B's mutation discipline depends on the answer.
4. `index.ts` is imported by nothing (all callers use deep paths). Should Phase B import through the barrel, or delete it to avoid a second public surface?
5. Theoretical-only divergence, no action needed: if a hold ever carried the id `"weather_deck"`, the old `deckArea`/`areaLabel` resolved the *declared deck* while the new `areaById` map resolves the *hold* (last insert wins). Unreachable via `holdAreasFromSpec`, which filters `cargo_spaces` by level.
