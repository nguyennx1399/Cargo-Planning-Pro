# Phase B — Placement checks + editable plan

## Context Links

- Spec: `plans/reports/confluence-260916-1647-drag-drop-stowage-placeholders-feature-plan.md` §4.5 (placement checks), §4.7 (draft store), §7 Phase B, §10 file map.
- Depends on: [phase-01-stowage-model-foundation.md](phase-01-stowage-model-foundation.md) — `StowageModel`, `coords`, `occupancy`.
- Superseded-but-preserved: `plans/260911-0945-p1-frontend-stowage-demo/phase-02-plan-draft-store-history-auto-stow.md` (draft store + undo/redo — this phase is its spec-blessed successor; do not run both).
- Overview: [plan.md](plan.md).

## Overview

- **Priority:** P2
- **Size:** ~1–1.5 days
- **Status:** **DONE + VERIFIED 2026-09-16.** Implemented (62 files / 481 tests passing, `npm run build` succeeds, no new dependency), then verified: tester → "PASS as a behaviour-preserving refactor" with one blocking divergence (the overstow over-report); code-reviewer **7/10**. All four review findings fixed in the follow-up pass — C1 (vessel-reselect wedge), H1 (overstow nearest-blocker parity), W1 (`areaId: ""` normalisation), W3 (LOC headroom) — and recorded as deviations 8–13 below. The latent H2 (`twenty_on_forty` missing from the predicate) was closed in the 20' workstream (deviation 13b, now implemented and pinned). Reports: `plans/reports/tester-260916-1955-phase-b-verification.md`, `plans/reports/code-reviewer-260916-1955-phase-b-review.md`.
- **Blocks:** Phase C (which calls `canPlaceContainer` for placeholders, ghost tint and commit).

**Deviations from this file, approved 2026-09-16 (Phase B implementation).** <!-- Updated: Phase B implementation -->
1. **A trailing `vessel` parameter on both predicates** — `canPlaceContainer(model, plan, container, slot, vessel)`, `canPlaceBreakbulk(model, plan, item, pose, vessel)`. Forced: `StowageModel` carries no vessel (no `reefer_tiers` for `plugOk`, no `rows`/`bays`/`container_layout`) and `containerOccupancy` takes a `Vessel`. Phase C patches its two call sites; `validSlotsFor` becomes `(vessel, plan, container)`.
2. **`loadPlan(vessel, plan)`** — the store runs the predicates, so it needs the vessel (spec §4.7 sketched `loadPlan(plan)`). Vessel change calls `loadPlan(null, null)` synchronously, which is what stops the old vessel's containers being rendered/weighted against a new hull.
3. **Per-slot stability warnings are NOT implemented** (spec §4.5 listed "warnings only: stability"). A per-slot stability reason needs geometry + hydrostatics + lightship — unavailable to a pure predicate and outside the per-slot cost budget. The StabilityPanel covers stability plan-wide. `overstow` warnings *are* implemented, both directions (candidate buried / candidate burying).
4. **D1 severity is deliberately split from report severity.** `breakbulk_overweight` and `breakbulk_over_pressure` are `warning` for the *drop* decision (droppable-with-record) while the plan-wide report keeps reporting them as `error`, because its message strings are frozen. Phase C must therefore tint **three** states (green / amber / red) — see the tint rule in phase-03. `stack_weight` stays `error` on purpose so the ghost never promises a slot the report blocks. <!-- Done in Phase C part 1: `HIGHLIGHT.valid/warning/invalid` driven by one verdict object. -->
5. **`breakbulkOverlap`'s frozen 3-arg signature** has no vessel, so its wrapper passes a documented `NO_VESSEL` placeholder that is provably unread (the predicate skips the vessel-dependent check when `plan.placements` is empty).
6. **`teuOf` is unused** by any §4.5 per-slot check; importing it would be dead code. Reused instead: `sizeFitsBay`, `tierBelow`, `plugOk`, `bayPosition`/`deckOf`/`isFortyBay`, `breakbulkOccupancy`, `containerOccupancy`, `footprintRect`/`rectsOverlap`, the model barrel.
7. **Measured perf:** a full sweep of BBC's 447 real slots with the demo load is ≈**1.05 ms** (≈2.35 µs/slot), dominated by building `no_floating` tooltip strings for the ~437 blocked slots — above the spec's "well under a millisecond" aspiration. Phase C must memoise per drag start and build tooltip strings lazily for the hovered slot only. <!-- Done in Phase C: per-gesture memos + a one-slot hover path (`lib/drop-verdict.ts`); note the 20' reopen grew BBC's grid to 1341 slots, so the same sweep now measures ≈2-6 ms (clock guard 50 ms, `placeholders.test.ts:153-160`). -->

**From the Phase B code review (`plans/reports/code-reviewer-260916-1955-phase-b-review.md`), fixes applied 2026-09-16.** <!-- Updated: Phase B review fixes -->
8. **`overstow` reproduces the plan rule's NEAREST-blocker selection, not just its wording** (review H1 — decided: reproduce the rule). The predicate paired the candidate with *every* higher-POD box in its column, while `validation-rules.ts:128-141` names only the nearest blocker above each lower box, so the ghost could blame a box the violations list never mentions. Measured on the app's own default plan/toggles: **BBC 36 → 36** pairs (was 54, +18 over-reported; 16 of 36 lower boxes named a different blocker), **demo-horizon 199 → 199** (was 298, +99; 75 lower boxes). After: 0 report-only, 0 predicate-only, per-lower-box blocker identity exact on both vessels. `overstowReasons` (now `engine/placement/placement-reason-builders.ts`) rebuilds the rule's own half-column — sorted bottom → top as `buildValidationContext` does, candidate inserted at its commit position — and keeps only the pairs that name the candidate. `predicate-report-parity.test.ts` pins both counts on the real plans; a 3-box column test pins the selection rule where nearest ≠ every box above.
9. **`areaId: ""` is normalised once** (review W1): one `areaKey = pose.areaId || WEATHER_DECK_AREA_ID` used for the area lookup, the `containerOccupancy` lookup, the overlap grouping and the label/band wording. The raw id let a preview called with `areaId: ""` skip the container-stack check — and print the hold wording — that the same drop committed through the store (which stores no `area_id`) then runs. No producer writes `""` today, so no existing message changes; a parity test covers it.
10. **W3 headroom:** reason/message builders extracted to `engine/placement/placement-reason-builders.ts` (83 LOC); `can-place-container.ts` **198 → 164**, `can-place-breakbulk.test.ts` **199 → 192**, `canPlaceContainer`'s behaviour unchanged.
11. **§4.5's breakbulk warning "source: `generic` area (approximate), hatch opening not checked yet" is NOT implemented** (review W2) — it was dropped without a deviation entry. `StowageArea.source` exists for it (`stowage-model/types.ts:35`) and Phase D badges those areas, so deferring is intended but was undocumented until now.
12. **Two known, unreachable deltas inside the frozen-message contract** (review W4/W5), recorded rather than fixed: (a) duplicate `cargo_id` placements change the overlap set and wording (`can-place-breakbulk.ts` skips `other.cargo_id === item.id`, so "A overlaps A" disappears, and the id named first follows plan order) — unreachable through the store's strip-then-add and through the packer; (b) violation ORDER *within* one rule follows plan order instead of area-group order (set-identical; no test pins the order).
13. **Follow-ups booked, not done here:** (a) `App.tsx`'s C1 fix is the minimal early return (`if (id === vesselId) return;`) — **landed and still the shipped form**; the cleaner single reload path — build + `loadPlan` inside the handler and delete the reload effect — is deferred to Phase C/D. <!-- 2026-09-16: Phase C did not take it, so it now belongs to D/E. --> (b) ~~`twenty_on_forty` is missing from `canPlaceContainer` (review H2, latent false green): unreachable today because neither app vessel has an odd stack bay and `sizeFitsBay` blocks every 20' placement first; phase-03 already books it and asserts `validSlotsFor(20') === []`.~~ **CLOSED in the 20' workstream (2026-09-16):** the predicate now emits `twenty_on_forty` for the halves a 20' candidate covers (`placement-reason-builders.ts:41-57`; severity `error` in `reason.ts:71`), pinned by `can-place-container.test.ts:137-161`. It was reachable only once the odd half-bays existed — which is exactly what the reopen did. (c) ~~Phase C must strip a placed box's own placement before previewing a move (review W9), exactly as the store does.~~ **Done in Phase C:** `lib/drop-verdict.ts:69-85` (`subjectStrippedPlan`, memoised per `(plan, candidate)`), measured 0 fresh-drop verdict mismatches on both real vessels (Phase C review §4).

Two deliverables: ONE pure predicate per cargo kind shared by placeholders, drop preview and full-plan validation; and a mutable plan with undo/redo to commit into. Until the draft store exists there is nothing for a drop to write to (`usePlanStore.ts:51-52` says so explicitly).

## Key Insights

**The shared predicates already exist — extend, do not duplicate.** `engine/placement-checks.ts` (27 LOC) exports `isTwenty`, `teuOf`, `sizeFitsBay`, `tierBelow`, `plugOk`, and its header comment already states the contract ("shared by the validation rules and (phase 02) auto-stow, so both enforce exactly the same limits — DRY: validator before optimizer"). `canPlaceContainer` must call these, never reimplement them.

**Container validation is column-based, not per-slot.** `engine/validation-rules.ts` (149 LOC) runs 8 rules over a precomputed `ValidationContext` (`engine/validation-context.ts:55-117`: `containers`, `stacks`, `podSequence`, `columns`, `cells`, `unmapped`, `orphans`, with `HALVES`, `stackKey`, `cellKey`). Rule ids and messages are frozen for this phase: `slot_exists`, `size_fits_bay`, `cell_conflict`, `twenty_on_forty`, `no_floating`, `stack_weight`, `reefer_plug`, `overstow`. Per spec §7 Phase B only the *per-slot* checks are shared; the full-plan rules keep running as today.

**`spec` §4.5's per-slot list maps onto existing primitives:**
| Spec check | Existing source |
|---|---|
| slot exists in the model | `StowageModel.slotByKey` (`bay|row|tier`) |
| slot is empty | `occupiedStacks`/`containerOccupancy` from Phase A |
| size fits bay | `sizeFitsBay(container, slot.bay)` |
| tier below is filled (no floating box); bottom tier exempt | `tierBelow(stack, tier)` + the occupancy of that tier |
| reefer needs a plug tier | `plugOk(container, stack, tier)` |
| stack weight ≤ limit after adding | sum of weights in that bay/row/deck column vs `StackSpec.max_weight_t` (`stack_weight` uses `+ 1e-9` tolerance — keep it) |
| height ≤ `max_height_m` (under deck) | `StackSpec.max_height_m` |
| no breakbulk in the same stack footprint in that area | `breakbulkOccupancy` + `rectsOverlap` |
| warnings only: overstow by POD, stability | `podSequence` logic from `overstow` |

**`StackSpec.max_height_m` — DECIDED (Validation Session 1): per-item check.** It is populated only for under-deck stacks and is the *cargo space's* `clear_height_m` (`data/vessel-from-spec.ts:53`) — a whole-space value, not obviously a per-box limit. Use a **per-candidate-item** comparison (`container.high_cube ? DIM.heightHC : DIM.height` ≤ `max_height_m`): it is the conservative reading and cannot let a taller box through. Accepting a false rejection in a tall hold is the chosen trade-off; the change to a per-space column check is one predicate if a planner reports it. <!-- Updated: Validation Session 1 - max_height_m per-item confirmed -->

**`breakbulk-validation-rules.ts` (183 LOC) is 7 rules that each rebuild `byArea()`.** Spec §4.5 wants them refactored into a loop over one `canPlaceBreakbulk` returning `{ok, reasons}`. Preserve exactly: rule ids `breakbulk_out_of_deck_area`, `breakbulk_overlap`, `breakbulk_overlaps_container`, `breakbulk_overweight`, `breakbulk_in_keep_out`, `breakbulk_too_tall`, `breakbulk_over_pressure`; the `EDGE_TOLERANCE_M = 1e-6` float tolerance and its rationale comment (the IEEE-754 edge-of-deck case at `:33-40`); `OVERWEIGHT_BAND_M = 20` and `OVERWEIGHT_LIMIT_T = 200`; `footprintRect`/`rectsOverlap` from `engine/breakbulk-overlap-check.ts`.

**The one rule that needs care: `breakbulkOverweight` is band-based, not per-item.** It walks `bandStart` from `area.xMin` in 20 m steps and sums the weight of every item whose `x_m` lands in the band (`:114-136`). A per-candidate check must evaluate *the band that contains the candidate* with the candidate added — which needs the other placements in that area. That is exactly why spec §4.4 defines `breakbulkOccupancy`; use it, and keep the `rating ? rating × 20 × (zMax − zMin) : 200` limit formula.

**Code-review guardrails from Phase A (carry these into this phase).** <!-- Updated: Phase A code review, 2026-09-16 -->
- **Keep `Vessel` immutable.** `buildStowageModel` caches by object identity in a `WeakMap` and never invalidates. `App.tsx` holds catalog objects (`getVesselCatalogEntry` memoises by id), so mutating one would leave a stale model for the whole process. A `usePlanDraftStore` action must never patch a vessel — only plans. (Spec §9's optional dev `Object.freeze` was deliberately not added; see `build-stowage-model.ts`'s header.)
- **Don't mutate `StowageArea.keepOuts`.** The model hands out the vessel's own arrays (`build-stowage-model.ts:48,85`). Read-only use is fine; sorting/filtering in place would poison every other reader of the cached model. Copy first if you must reorder.
- **Use the barrel.** `engine/stowage-model/index.ts` exists and is currently imported by nothing — import from `@/engine/stowage-model` in this phase so the single entry point is real rather than decorative (or delete it; do not leave it unused).
- `breakbulk-deck-area.ts` remains the sanctioned surface for the six legacy callers; new code should read `buildStowageModel(vessel)` directly.

**`App.tsx:43-50` is the wiring to move:** `plan` is a `useMemo` over `cargoLoaded`/`projectCargoLoaded`/`vessel`, then `validatePlan(vessel, plan)` memo, then `useIndicativeStability(vessel, plan, playbackCount)`. Build the demo plan once per (vessel, toggles) and `loadPlan` it; `report`, `attitude`, `VesselScene`, `Sidebar`, `BayPlanView` all read the draft plan. `getVesselCatalogEntry` memoises the vessel object, so `vessel` identity is stable — a `useEffect` keyed on `[vessel]` will not loop.

**`plan.unplaced` is read directly by `Sidebar.tsx:82-85`.** Every store action must keep `unplaced` consistent with `placements` + `containers`. Cheapest correct rule: derive it inside the store as `containers.filter(not placed)` on each mutation rather than storing it independently (single source of truth). `bayFilter`, `hoveredSlot`, `draggingContainerId` live in `usePlanStore` and are cleared by `resetForVesselChange`, which this phase extends to also clear drag state and invalidate the draft.

**`ContainerInstances.tsx:109`** uses `key={capacity}` where `capacity = plan.placements.length || 1` — the instanced mesh remounts whenever the placement *count* changes (place/unplace), not on a same-count move. Acceptable and unchanged.

## Requirements

**Functional**
- `canPlaceContainer(model, plan, container, slot) → {ok, reasons: Reason[]}` implementing the spec §4.5 list. <!-- As shipped: a trailing `vessel` argument, see deviation 1 -->
- `canPlaceBreakbulk(model, plan, item, {areaId, x_m, z_m, rotation}) → {ok, reasons: Reason[]}` implementing the 7 existing breakbulk rules for a single candidate item. <!-- As shipped: a trailing `vessel` argument, see deviation 1 -->
- `Reason = {rule, message, severity}` with severity configurable per rule (D1): hard physical rules (`breakbulk_out_of_deck_area`, overlap, keep-out, slot size) → `error`/block; overridable limits (overweight band, over-pressure, overstow) → `warning`/allow-with-record.
- `breakbulk-validation-rules.ts` becomes a loop over `canPlaceBreakbulk`, same exports, same ids, same messages.
- `usePlanDraftStore`: `plan`, `past`, `future` (capped at 100, plain arrays, no library); `loadPlan`, `placeContainer`, `moveContainer`, `unplaceContainer`, `placeBreakbulk`, `moveBreakbulk`, `unplaceBreakbulk`, `undo`, `redo`. Mutating actions run the predicate first and return a `Result`; an invalid move mutates nothing.
- `App.tsx` loads the demo plan into the draft store on vessel change and on demo toggles; the memo-derived plan is gone.
- `resetForVesselChange` also clears drag state.

**Non-functional**
- Every code file < 200 LOC; kebab-case for engine modules (`can-place-container.ts`), PascalCase for React components, camelCase for the store hook — matching the existing `usePlanStore.ts` sibling (the spec's §4.7/§10 names are followed literally).
- No new npm dependency; no history library (`zundo` explicitly not added).
- New engine modules stay pure (no react/three/zustand) — see the Phase A note on the non-recursive RT-8 test.
- Predicates must be cheap enough to run ~900 slot-tiers per drag start without a visible stall (spec §4.6: "well under a millisecond"); keep them allocation-light and avoid rebuilding the `ValidationContext` per call.

## Architecture

```
engine/placement/
  reason.ts            Reason, severity table per rule (D1)
  can-place-container.ts   (model, plan, container, slot) -> {ok, reasons}
  can-place-breakbulk.ts   (model, plan, item, pose)     -> {ok, reasons}

engine/breakbulk-validation-rules.ts  --7 rule fns--> loop over canPlaceBreakbulk
store/usePlanDraftStore.ts            -- the ONLY mutation path (validate-then-mutate)
App.tsx                               -- build demo plan -> loadPlan; read draft plan everywhere
store/usePlanStore.ts                 -- unchanged role (view state); resetForVesselChange clears drag state
```

Validator-first invariant: placeholders (Phase C), the drop preview tint and the violation list all call the same two functions. If the UI and the report can disagree, the phase is wrong.

## Related Code Files

**Create**
- `frontend/src/engine/placement/reason.ts` — `Reason`, `PlacementResult`, the per-rule severity table.
- `frontend/src/engine/placement/can-place-container.ts`
- `frontend/src/engine/placement/can-place-breakbulk.ts`
- `frontend/src/store/usePlanDraftStore.ts`
- `frontend/src/engine/placement/__tests__/can-place-container.test.ts`, `can-place-breakbulk.test.ts`, `frontend/src/store/__tests__/use-plan-draft-store.test.ts` (pure engine/store unit tests — the store test follows `use-plan-store-playback.test.ts`'s `getState()`/`setState()` pattern, no React render).

**Modify**
- `frontend/src/engine/breakbulk-validation-rules.ts` — 7 rules loop `canPlaceBreakbulk`; ids/messages/tolerances unchanged.
- `frontend/src/App.tsx` — `loadPlan` wiring; draft plan flows to `report`, `attitude`, `VesselScene`, `Sidebar`, `BayPlanView`.
- `frontend/src/store/usePlanStore.ts` — extend `resetForVesselChange` to clear drag state.
- `frontend/src/data/build-demo-plan.ts` — expose the demo-plan builder as a single callable (if the `loadPlan` wiring needs it).

**Delete** — none.

## Implementation Steps

1. Read `engine/validation-rules.ts`, `engine/validation-context.ts`, `engine/placement-checks.ts` and `engine/breakbulk-validation-rules.ts` fully; write down the exact message strings — they are the regression contract.
2. Write `engine/placement/reason.ts`: the `Reason`/`PlacementResult` types plus the rule→severity table from D1. Keep it a plain data table (no UI config surface — YAGNI) so Phase C can tint from `severity`.
3. Write `can-place-container.ts` implementing the §4.5 list against `StowageModel` + `plan`. Build the column/occupancy inputs once per call from `occupancy.ts` (Phase A); do not call `buildValidationContext` (it is plan-wide and re-derives much more than a single-slot check needs).
4. Reuse `tierBelow` + occupancy to decide "supported below" (bottom tier exempt) and `plugOk` for reefer; add the stack-weight-after-adding and `max_height_m` checks with the same `1e-9`/tolerance conventions the existing rules use.
5. Add the breakbulk-footprint check: reject when a breakbulk item occupies the same stack footprint in the same area, using `breakbulkOccupancy` + `rectsOverlap`.
6. Emit `warning`-severity reasons for overstow-by-POD (`podSequence` from `plan.ports`) and stability, non-blocking per D1.
7. Write `can-place-breakbulk.ts` by lifting each of the 7 rules' logic to the candidate-item case; the band check uses `breakbulkOccupancy` for the containing 20 m band. Export the same reason rule ids as the existing violation ids so a loop can map 1:1.
8. Refactor `breakbulk-validation-rules.ts` to loop `canPlaceBreakbulk` over the existing placements and map `reasons` back into `Violation` objects. Keep the exported names and signatures (`breakbulkOutOfDeckArea`, `breakbulkOverlap`, `breakbulkOverlapsContainer`, `breakbulkOverweight`, `breakbulkInKeepOut`, `breakbulkTooTall`, `breakbulkOverPressure`) so `validate-plan.ts:35-41` and the existing tests keep compiling.
9. Write `usePlanDraftStore.ts`: `plan | null`, `past: StowagePlan[]`, `future: StowagePlan[]`, capped at 100 (drop the oldest). `loadPlan` resets history. Each mutation: run the relevant predicate → on failure return `{ok:false, reasons}` and touch nothing → on success push the previous plan to `past`, clear `future`, and recompute `unplaced` from `containers` minus `placements`.
10. Wire `App.tsx`: build the demo plan (existing `buildLoadedDemoPlan`/`buildEmptyDemoPlan`/`withBreakbulkCargo` chain) once per (vessel, `cargoLoaded`, `projectCargoLoaded`), then `loadPlan`; switch `report`/`attitude`/render props to the draft plan; keep `validatePlan` a `useMemo` over the draft plan.
11. Extend `usePlanStore.resetForVesselChange` to clear `draggingContainerId`/`hoveredSlot` (it already clears both — confirm) and call the draft store's `loadPlan(null)`/reset from `onVesselChange` (`App.tsx:52-58`).
12. Write the unit tests: `canPlaceContainer` (valid placement ok; occupied slot rejected; 20' in a 40' bay rejected; reefer without a plug rejected; unsupported/float rejected with the bottom tier exempt; overweight stack rejected; breakbulk-footprint clash rejected), `canPlaceBreakbulk` (one test per rule incl. the band), and the store (place/move/unplace/undo/redo, history cap, invalid move leaves the plan byte-identical, `unplaced` stays consistent).
13. Run `npm run typecheck`, `npm test`, then click through both vessels in the browser confirming the violation list is identical to pre-phase (same count, same messages).

## Todo List

- [x] Read the 4 rule/context/check files; record the exact violation message strings
- [x] `engine/placement/reason.ts`: `Reason`, `PlacementResult`, D1 severity table
- [x] `can-place-container.ts`: slot exists, empty, size, support-below, plug, stack weight, max height, breakbulk footprint
- [x] `can-place-container.ts`: warning-severity overstow reasons (non-blocking) — **stability warnings deliberately NOT implemented**, see deviation 3
- [x] `can-place-breakbulk.ts`: area exists, inside rect, keep-out, breakbulk overlap, container-stack overlap, height, footprint pressure, 20 m band
- [x] `breakbulk-validation-rules.ts` loops `canPlaceBreakbulk`; 7 exports, ids and messages unchanged (including the pairwise dedup and the band's float-stepping arithmetic)
- [x] `usePlanDraftStore.ts`: `loadPlan`, place/move/unplace for both kinds, `undo`/`redo`, 100-entry cap
- [x] Store actions reject invalid moves with reasons and leave the plan untouched (asserted byte-identical)
- [x] `unplaced` derived from `containers` − `placements` on every mutation
- [x] `App.tsx`: demo plan → `loadPlan`; `report`/`attitude`/scene/sidebar/bayplan read the draft plan
- [x] `resetForVesselChange` clears drag state; `onVesselChange` resets the draft. **No functional change was needed — the committed baseline already cleared both fields**, so only the stale comments were corrected
- [x] Unit tests for both predicates + the draft store (no React render) — 43 new tests
- [x] `npm run typecheck` clean; `npx vitest run` **481/481** (was 438) with all four guard files green
- [ ] Browser check (both vessels' violation list identical count/messages) — **not performed: no browser and no DOM test capability.** Substitutes: the 4 guard files pass unchanged, a predicate-⊆-rules parity test, and a successful `npm run build`. The new App wiring's runtime behaviour (loading frame on vessel switch, draft-driven render) remains unverified — flag to the tester/reviewer. <!-- 2026-09-16: the App wiring was subsequently exercised by the Phase C work; the violation-list-identity half is pinned by `engine/placement/__tests__/predicate-report-parity.test.ts` and the run-level manual script (plans/reports/manual-click-through-260916-phase-c.md, step 3) — still not executed by a human, so this box stays unticked. -->

## Success Criteria

**Spec acceptance, quoted verbatim (spec §7 Phase B):**
> the same plan gives the same violations as before. Store actions reject invalid moves with reasons.

**Repo-specific additions**
- `cd frontend && npm run typecheck` passes.
- Existing suite still passes: 56 files / 396 tests (395 of 396 is the brief's figure; the suite is 396/396 today — treat any new failure as ours).
- `engine/__tests__/breakbulk-real-vessels-no-violations.test.ts` and `engine/__tests__/validate-plan.test.ts` stay green — the latter pins `validatePlan`'s outputs, which is the strongest available guard that the rule refactor is behaviour-preserving.
- No new entry in `frontend/package.json` dependencies or devDependencies.
- No file over 200 LOC.
- A drop can only ever reach the plan through `usePlanDraftStore`; grepping for direct `plan.placements` mutations outside the store finds none.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Refactoring the 7 breakbulk rules changes a message or the `EDGE_TOLERANCE_M` handling → false violations on the real demo set | High | High | Keep ids/messages byte-identical; keep the tolerance constant and its comment; `breakbulk-real-vessels-no-violations.test.ts` is the guard — run it after step 8, before the store work. |
| The band-based overweight check is subtly wrong per-candidate (band boundaries, items straddling a band) | Medium | Medium | Reproduce the band arithmetic verbatim (start at `area.xMin`, step 20 m, `x_m` inclusive/exclusive as today) and test a candidate landing exactly on a band edge. |
| `canPlaceContainer` diverges from the full-plan rules → ghost says green, report says error | Medium | High | Both call the same predicates for the per-slot checks; add a test that a rejected candidate produces the same reason string the rule would. |
| Draft store causes render storms / playback jank | Medium | Medium | Keep `usePlanStore` and `usePlanDraftStore` separate; select narrowly (existing `useShallow` pattern); do not subscribe whole components to the draft. |
| Undo history grows unbounded or shares references with the live plan | Low | Medium | Cap at 100; never mutate a plan object in place — always produce a new `StowagePlan` so `past`/`future` entries stay valid. |
| `plan` becomes `null` transiently on vessel change → downstream crash | Medium | Medium | Keep `plan: StowagePlan | null` and have `App.tsx` render the loading state; or seed `loadPlan` synchronously in the same effect that selects the vessel. |

## Security Considerations

- No network, no persistence, no auth surface: the draft plan is client-side state. The backend is untouched, so no server-side trust boundary changes.
- Every mutation is validated *before* it is applied — never write a placement and then validate. This is the "validator before optimizer" rule (`docs/PLAN.md:4-6`) and also prevents an invalid plan from reaching the stability panel.
- Treat the plan as untrusted-shaped data when rendering: keep tooltips/messages as React children (auto-escaped). Do not build message strings with `dangerouslySetInnerHTML`.
- Keep the "Verify stability on the approved loading computer" notice — an editable plan makes the decision-support framing more load-bearing, not less.

## Next Steps

- Phase C (`phase-03-container-placeholders-and-drop.md`) consumes `canPlaceContainer` (placeholders + ghost tint + commit) and `usePlanDraftStore` (the commit target). Its perf budget depends on step 3 keeping the predicate cheap.
- Deferred to D/E: `canPlaceBreakbulk`'s candidate pose is already the shape Phase D's `AreaDropPlane` needs; the snap step (D2, 0.5 m) belongs to Phase D, not here.
