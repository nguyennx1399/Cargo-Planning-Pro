# Code Review — Phase B: placement checks + editable plan

- **Date:** 2026-09-16 19:55
- **Reviewer:** code-reviewer (read-only; wrote this report only)
- **Contract:** `plans/260916-1647-drag-drop-stowage-placeholders/phase-02-placement-checks-and-editable-plan.md` incl. its 7 "Deviations from this file, approved 2026-09-16"
- **Spec:** `plans/reports/confluence-260916-1647-…-feature-plan.md` §4.5, §4.7, §7 Phase B, §8 D1
- **Scope:** new `frontend/src/engine/placement/{reason,can-place-container,can-place-breakbulk}.ts` + 3 test files; modified `engine/breakbulk-validation-rules.ts` (183→133 LOC), `store/usePlanDraftStore.ts`, `App.tsx`, `data/build-demo-plan.ts`, `store/usePlanStore.ts` (comments)
- **Did NOT re-run** the coordinator's before/after differential (per brief). All numbers below are independent **mechanism** probes (`vite-node`, read-only scripts in `/tmp`).

## Score: 7/10

The store, the immutability discipline and 6 of 7 deviations are sound; typecheck clean, **62 files / 481 tests green**. Withheld for: one live app-level lockup in the vessel-switch path (the brief's priority-3 area), a measurable predicate-vs-report over-report that breaks the phase's own validator-first invariant, and a latent false-green on a blocking rule.

---

## CRITICAL

### C1. Re-selecting the current vessel permanently wedges the plan view — `App.tsx:69-78` (+`:61-63`, `:91`)

`onVesselChange(id)` calls `loadPlan(null, null)` **unconditionally**, while the plan is reloaded by an effect keyed on `[vessel, containers, cargoLoaded, projectCargoLoaded, loadPlan]` (`:61-63`). When `id === vesselId`: `vessel`/`containers` identities are unchanged (they are catalog-memoised per id, `data/vessel-catalog.ts:28-38`) and `setCargoLoaded`/`setProjectCargoLoaded` re-derive the same values → those `setState`s bail out → the effect **never re-runs** → `plan` stays `null` → `:91` renders "Loading plan…" **forever**.

Trigger verified in the vendored UI source, not assumed: `node_modules/@base-ui/react/select/item/SelectItem.js:111-117` (`commitSelection` → `setValue(itemValue)`) and `select/root/SelectRoot.js:259-266` (`setValue` calls `onValueChange?.(nextValue, …)` with **no equality guard**; the internal setter bails later, after the callback). `Sidebar.tsx:98` passes `onValueChange` straight to `onVesselChange`.

Failure scenario: app opens on BBC SAO PAULO; user opens the Vessel dropdown and clicks "BBC SAO PAULO" (already selected) → the whole stage is replaced by "Loading plan…" and does not recover until they toggle cargo, or pick another vessel and come back. Not a crash and not a stale-data leak (the null path itself is safe — see V4). One-click, deterministic.

Fix (either): `if (id === vesselId) return;` at the top of `onVesselChange`; or better, build+load the plan inside the handler and delete the effect (one reload path instead of an imperative reset racing a declarative reload).

---

## HIGH

### H1. The overstow predicate over-reports vs the plan-wide rule — 18/36 and 99/199 messages on the real plans

`can-place-container.ts:110-127` pairs the candidate with **every** column box above/below it whose POD sequence is higher. The plan rule (`validation-rules.ts:128-141`, unchanged) names only the **nearest** blocker above each lower box (`halfColumn.slice(i+1).find(…)`). Measured on the app's own default toggles:

| vessel | report overstow | predicate overstow | predicate-only | report-only |
|---|---|---|---|---|
| bbc-sao-paulo | 36 | 54 | **+18** | 0 |
| demo-horizon | 199 | 298 | **+99** | 0 |

Concrete case (BBC, column `34|4|on`): tiers t82(seq 2), t84(seq 4), t86(seq 2), t88(seq 3). The report contains `DEMU0000166 blocks DEMU0000150` and `DEMU0000187 blocks DEMU0000171`. The predicate **additionally** emits `DEMU0000187 blocks DEMU0000150` — a pair the report will never list, because t84 is the nearer blocker.

Why it matters: this is exactly what the phase file forbids ("If the UI and the report can disagree, the phase is wrong"), and Phase C will tint/drive the amber tooltip from these reasons, so the ghost will name a different blocker than the violations list. Directionally safe (superset → no false green), but **no deviation records it** and the added parity test cannot catch it: `can-place-container.test.ts:120-138` covers only 5 rules (not `overstow`) on a **2-box** column, where nearest-blocker ≡ all-pairs. The spec's §4.5 wording ("warnings only: overstow by POD") does not name the nearest-blocker selection, so this needs a decision: reproduce the rule's selection, or record it as deviation #8.

### H2. `twenty_on_forty` is missing from the predicate → verified FALSE GREEN (latent)

`canPlaceContainer` implements §4.5's list but not `twenty_on_forty` (`validation-rules.ts:68-81`), which is a **blocking `error`** rule. Verified with a fixture vessel carrying an odd (20') stack bay:

```
predicate: true []                                    // ghost: green
report twenty_on_forty: ["error: TWENTY: 20' stowed on top of 40' FORTY"]   // report: blocks
```

`no_floating`/`cell_conflict`/`stack_weight` all pass in that configuration, so nothing else catches it.

Currently **unreachable**: neither app vessel has an odd stack bay (`vessel.stacks` bays are `[2,6,…]` on both; my probe printed `odd stack bays=[]` for BBC and demo-horizon), `sizeFitsBay` sends 20' boxes to odd bays only, so every 20' placement is already blocked by `size_fits_bay`. phase-03 already books this as latent and asserts `validSlotsFor(20') === []`. It flips live the day a 20'-capable vessel is onboarded — silently, because the predicate's own header claims §4.5 is implemented. Fix now (≈8 lines: for a 20' candidate, look up `tierBelow`'s cell and reject when a non-20' id occupies a covering half) or record it in phase-03/05 as a known predicate gap.

---

## WARNINGS

1. **`areaId: ""` is half-normalised in `canPlaceBreakbulk`** (`can-place-breakbulk.ts:112-116,149,177`). `rawAreaId` is used for the area lookup *with* the falsy remap (`"" → weather_deck`) but **raw** for `containerOccupancy(...).get(rawAreaId)` and for the `onDeck` label/band wording. `BreakbulkPose`'s own doc sanctions `""` as "weather deck", so a Phase C/D preview called with `areaId: ""` skips the container-stack check entirely (`.get("")` misses), while the same drop committed through the store (which normalises to *omitted*) yields `areaIdOf → "weather_deck"` and the report *does* run that check → preview/commit disagreement. Unreachable today (no producer writes `area_id: ""`; `naive-fill-breakbulk.ts:141` and `usePlanDraftStore.ts:62` both omit it), so: medium. Fix = one local `const areaKey = rawAreaId || WEATHER_DECK_AREA_ID` used for both lookups.
2. **Unrecorded spec departure: §4.5's breakbulk warning "source: `generic` area (approximate), hatch opening not checked yet" is not implemented and not in the deviation list.** `grep` finds no `source`/`stability` use in `engine/placement/*`. Phase A built `StowageArea.source` for it; phase D badges it. Cheap to record as deviation #8/#3-adjacent.
3. **LOC headroom:** `can-place-container.ts` is **198/200** and `can-place-breakbulk.test.ts` is **199/200** (`wc -l`). One insertion breaches the phase's own non-functional requirement. Trim the container predicate's comments or split `cellConflicts`/`overstowReasons` into a `placement-reason-builders.ts` before Phase C touches anything here.
4. **Duplicate `cargo_id` placements change both the set and the wording** (`can-place-breakbulk.ts:163-174` vs HEAD `breakbulkOverlap`). Verified: two overlapping placements of "A" → old `["A overlaps A [A]"]`, new `[]` (the `other.cargo_id === item.id` guard skips it); with a third id, old `"D overlaps A"` vs new `"A overlaps D"` (plan-order lookup finds the *first* "A"). Unreachable through the store (strip-then-add) or the packer, so low — but it is a byte-difference inside the "frozen message" contract for an input the guards deliberately allow.
5. **Violation ORDER changes when areas interleave in `plan.breakbulk_placements`.** Old = area-group order (`byArea` insertion); new = plan order. Verified: old `[D overlaps A, B overlaps C]` vs new `[B overlaps C, A overlaps D]`. Set is identical; `validatePlan`'s stable severity sort does not mask it within a rule. Cosmetic (the packer fills area-by-area), no test pins it — note it or accept it.
6. **Deviation 7's perf figure is honest but pessimistic-friendly:** my sweep reproduced **447 slots / 1.56 ms (3.5 µs/slot)** vs the recorded 1.05 ms (2.35 µs/slot) — same order, same conclusion (eager `no_floating` strings dominate). Phase C's memoise-per-drag-start + lazy tooltip requirement stands.
7. **Deviation 5's "provably unread" is slightly imprecise (conclusion still correct).** `breakbulkOverlap`'s wrapper *does* read the placeholder vessel — `violationsFor` → `buildStowageModel(NO_VESSEL)` (a stub weather deck with an inverted z-rect `{zMin: 1.5, zMax: −1.5}` and `xMax: 0`). No vessel-derived reason survives the `reason.rule !== rule` filter, so the message output is unaffected; but each call also wastes a full area/band evaluation that is then discarded.
8. **Band-weight float association differs from the old `sum` (theoretical).** The wrapper sums the band *excluding* the subject and adds it last (`can-place-breakbulk.ts:80-89,147`), while HEAD summed in plan order including the subject in position. Only visible if a total lands within ~1e-10 t of a `.5` `toFixed(0)` boundary; attribution itself is provably identical (below). Not actionable — listed because the demo plans emit **zero** band violations, so the differential cannot cover it.
9. **`canPlaceContainer` assumes the subject is not already in `plan`.** Validating a placed box against the un-stripped plan yields a self-referencing `cell_conflict` ("X and X occupy the same position" — I hit it in my harness) and self-pairs in `overstow`. The store strips correctly (`usePlanDraftStore.ts:107,120`); **Phase C must strip too** when previewing a move of a placed container, or the ghost will show a phantom error.

## Deviation-by-deviation accuracy (all 7 assessed against the code)

| # | Recorded as | Verdict |
|---|---|---|
| 1 | trailing `vessel` on both predicates; `validSlotsFor` becomes `(vessel, plan, container)` | **Accurate.** Both signatures carry `vessel` last; `StowageModel` genuinely lacks `reefer_tiers`/`max_height_m`/rows/bays; phase-03 already patches its call sites and the plan carries the deviation. |
| 2 | `loadPlan(vessel, plan)`; vessel change calls `loadPlan(null, null)` synchronously | **Accurate as stated** (`App.tsx:56,62,76`). Understates the consequence: the sync call is also what makes C1 reachable, and it only works because the effect's deps move — they don't when the id repeats. |
| 3 | per-slot stability warnings NOT implemented | **Accurate.** No stability id in `PLACEMENT_RULES`; §4.5's warning is genuinely absent, not quietly dropped; `overstow` *is* implemented (both directions) — though see H1 for its selection rule. |
| 4 | D1 severity split from report severity; report keeps `error`; Phase C tints 3 states | **Accurate and clean.** `reason.ts:64-83` is the single severity table (`breakbulk_overweight`/`breakbulk_over_pressure` = `warning`), the report hardcodes `severity: "error"` at `breakbulk-validation-rules.ts:80`, and the asymmetry is documented in `reason.ts:16-20` + the wrapper header. Report/KPIs unaffected (`validate-plan.ts:74` counts them as errors). `stack_weight` deliberately stays `error` — consistent with the ghost never promising a slot the report blocks. |
| 5 | `breakbulkOverlap`'s frozen 3-arg signature + `NO_VESSEL` | **Accurate conclusion** (see W7 for the nuance): `planView(..., [])` makes `plan.placements.length === 0`, so `canPlaceBreakbulk` sets `stacks = undefined` and never calls `containerOccupancy`; the overlap reasons are geometry-only. |
| 6 | `teuOf` unused; primitives reused instead | **Accurate.** All the listed primitives are imported; `teuOf` is not (it stays in `validate-plan.ts`'s KPI path). The model barrel is now genuinely used by 5 modules. |
| 7 | perf ≈1.05 ms / 447 slots, dominated by `no_floating` strings; Phase C must memoise + lazify | **Accurate** (my independent measurement: 447 slots / 1.56 ms / 3.5 µs/slot; 447 and 800 slots confirmed). |

**Two unrecorded departures** (H1, W2) plus two low-severity unrecorded deltas (W4, W5).

## Mechanism verification (the brief's priority 1 — cases the differential cannot surface)

The differential's two demo plans emit **0 breakbulk overlap / 0 overweight violations** (my harness: `old=0 new=0` on both vessels), so they provide *no* evidence for the refactored dedup/band logic. That logic rests on the unit tests plus these probes:

| Probe | Result |
|---|---|
| `bandFor` vs HEAD's `for (start; start < xMax; start += 20)` loop, xMin = 25.8 (fractional) | **2408 sample x values, 0 mismatches** — repeated addition lands on identical floats |
| band attribution with 3 members in one band (first in plan order ≠ first by x) | identical message **and** `container_ids=[R]` = HEAD's `inBand[0]` |
| band attribution with an **orphan placement first in the band** | identical (`[R]`, the first *non-orphan*) — HEAD's `byArea` also drops orphans from `entries` |
| pairwise overlap dedup/attribution, both sides of a pair, 3-way chain | set + order + attribution identical to HEAD for unique ids |
| real demo plans, overlap + overweight, old vs new message+attribution | **IDENTICAL** (both empty — hence the synthetic probes above) |
| `area_id: ""` → area lookup, band label, `onDeck` wording | matches HEAD's `areaIdOf` group key (`""` was *never* remapped by HEAD either) — W1 is about `stowage-model` occupancy keys, not about the label |
| `breakbulk_in_keep_out` / `_too_tall` / `_over_pressure` / `_out_of_deck_area` guard structure (unknown area, `Infinity` height, `undefined` rating) | all four keep HEAD's `continue`-equivalent guards via the `else` branch |

**Priority 2 (validate-then-mutate / immutability) — PASS.** No in-place mutation of `plan.placements`/`containers`/`breakbulk_placements` anywhere in `src/` (grep for `push|splice|sort|reverse|pop|shift` on those targets = 0 hits outside the local arrays in the packers). Every action builds a new `StowagePlan` (`usePlanDraftStore.ts:44-46,107,110,120,123`); `past` holds the pre-move plan so undo restores it; an invalid action returns before `apply` (`:109,122`) → same object identity, no history entry (asserted at `use-plan-draft-store.test.ts:58-69`). History cap enforced oldest-dropped on both `past` and `future` (`:49-52`); `undo`/`redo` no-op at the ends; `unplaced` derived on every mutation (`:39-46`) and never stored independently. `loadPlan` resets history.

**Priority 3 (vessel switch) — the null path itself is SAFE, the transition is not (C1).** `plan = draftPlan ?? LOADING_PLAN` (`:65`) keeps `validatePlan` (`:66`) and `useIndicativeStability` (`:67`) fed a real object; I ran both hooks' cores with `LOADING_PLAN` on both vessels: `validatePlan` → `ok=true, 0 violations`, stability computes (lightship only), **no throw**. Sidebar/Scene/BayPlan are not mounted while `draftPlan === null` (`:91`), so no consumer ever sees the previous vessel's plan against the new hull. `resetForVesselChange` is comment-only (verified: the committed baseline already cleared `hoveredSlot`/`draggingContainerId`).

**Priority 4 (store boundary) — PASS.** `usePlanStore` untouched but for comments; `usePlanDraftStore` is the only plan holder; App subscribes with two narrow selectors (`:55-56`) — no whole-store subscription anywhere in `src/` (grep). `unplaced` derived.

**Priority 5 (validator-first) — PARTIAL.** Only two callers today (the store and the 7 wrappers); no UI-side or duplicated placement rule exists yet (grep: `engine/placement` is imported by the store + `breakbulk-validation-rules` only), and the report deliberately keeps the plan-wide rules per §7 Phase B. Undermined by H1 (over-report) and H2 (missing blocking rule), both of which Phase C would inherit.

**Priority 6 (hygiene) — PASS.** Purity: `engine/placement/{reason,can-place-container,can-place-breakbulk}.ts` import only `@/types/domain`, `@/lib/geometry`, `@/engine/*`; no react/three/zustand. kebab-case modules, camelCase store hook matching `usePlanStore.ts`. `frontend/package.json` + lockfile untouched (no new dependency). LOC as in W3. `breakbulk-validation-rules.ts` 183→133, all 7 exports/signatures parked (only bodies changed).

**Priority 7 (§4.5 coverage)** — all 9 container items implemented except the recorded stability warning; all 8 breakbulk items implemented except the *unrecorded* `source: "generic"` warning (W2); the 4-arg → 5-arg signature is deviation 1 (accurately recorded). `twenty_on_forty` (a §4.5-adjacent plan rule) is the H2 gap.

## Verification evidence

| Check | Result |
|---|---|
| `npm run typecheck` | clean |
| `npx vitest run` | **62 files / 481 tests pass** (matches the phase file) |
| Demos, app default toggles | BBC 36 violations (36 overstow, 0 errors); demo-horizon 199 (all overstow) |
| Frozen-message probes (band, pairwise, attribution, guards) | identical to HEAD on synthetic fixtures; see table |
| Purity / new deps / LOC / naming | pass, except W3's 198 + 199 |
| Immutability grep on plan arrays across `src/` | 0 hits |

## Verdict: Phase C MAY be built on this — with three gates

The engine/store foundation is correct, immutable and well-tested; Phase C's plan already consumes the right names (`validSlotsFor(vessel, plan, container)`, 3-state tint, per-drag memoisation). Before Phase C's drop path is considered trustworthy:

1. **Fix C1** (one line at `App.tsx:69`) — otherwise Phase C inherits a wedged app whose recovery path (toggling cargo) rebuilds and reloads the demo plan, silently discarding any edits.
2. **Decide H1** — either reproduce the rule's nearest-blocker selection in `overstowReasons`, or record it as a deviation and adjust phase-03's tint expectation. Leaving it means the amber tooltip and the violations list name different blockers on 18 of 36 BBC cases.
3. **Guard the strip discipline (W9) and the `areaId: ""` normalisation (W1)** in Phase C's preview/commit paths, and add H2 + W2 to the deviation list (or implement H2 before Phase D onboards a 20'-capable vessel).

## Unresolved questions

1. The coordinator's baseline "demo 192 violations" did not reproduce under the app's default toggles (I measure **199** on demo-horizon; BBC 36 matches Phase A's review). Which config produced 192 — worth reconciling so Phase C's regression baseline is trustworthy.
2. Is the over-report in H1 intentional (a broader "anything that could bury it" warning) or an oversight? The plan's Key Insights say "`podSequence` logic from `overstow`", which reads as reproduce-the-rule.
3. Should a rejected drop surface *all* reasons or only blocking ones in the tooltip? `PlacementResult` returns both; D1/phase-03 mention only warnings on the *accepted* path.
4. `LOADING_PLAN` duplicating `id: "loading"`/empty arrays per consumer — should it live in `data/` next to the other plan builders rather than inline in `App.tsx`? Cosmetic.
