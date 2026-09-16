# Tester — Phase B verification (placement checks + editable plan)

Date: 2026-09-16 19:55 · Scope: `plans/260916-1647-drag-drop-stowage-placeholders/phase-02-*.md`
Verdict: **FAIL for phase sign-off / PASS as a behaviour-preserving refactor**. Suite green; one blocking divergence found (below).

## Exact numbers
| Check | Result |
|---|---|
| `npm run typecheck` | PASS, 0 errors |
| `npx vitest run --reporter=dot` #1 | 62 files / 481 tests, 481 pass, 3.43s |
| `npx vitest run --reporter=dot` #2 | 62 files / 481 tests, 481 pass, 3.10s |
| `vitest run src/engine/placement src/store --reporter=verbose` | 4 files / 50 tests pass (50 − 7 pre-existing playback = **43 new** ✓) |
| `npm run build` | PASS (exit 0); only pre-existing warning: 1.54 MB chunk > 500 kB |
| Coverage | **unavailable** — pre-existing break: `@vitest/coverage-v8@5` vs `vitest@3.2.7` → `SyntaxError: ... does not provide an export named 'BaseCoverageProvider'` |
| Deps / LOC | `package.json`+lock unchanged; largest new file 199 LOC (`can-place-container.ts`) |

New tests per file: can-place-container 18, can-place-breakbulk 13, use-plan-draft-store 12.

**Flakiness verdict: not flaky.** Two identical runs; only drift is total wall clock 3.43→3.10s (cached transform) and test-time 1.48→1.11s. The suite's only wall-clock assert is `validate-plan.test.ts`'s `ms < 50`, at **5.44 ms / 3.79 ms** (~9–13x margin, known-flaky-but-pre-existing per memory).

## Guard tests: not weakened
- `git diff --stat -- 'frontend/src/**/__tests__/**'` → 2 files, **+55 / −0**. Zero deleted lines anywhere.
- Modified: `breakbulk-validation-rules.test.ts` (+24), `naive-fill-breakbulk.test.ts` (+31) — both additions are **Phase A** tests (per-stack rect bound; `occupiedRects`), not Phase B rewrites.
- `breakbulk-real-vessels-no-violations`, `validate-plan`, `bbc-sao-paulo-containers`, `bbc-sao-paulo-deck-layout` are **untouched** (absent from `git status`) and green.

## Tautology assessment
1. **Named offender: `can-place-breakbulk.test.ts` → "predicts only messages the plan-wide rules actually produce" (l.171-198).** `breakbulk-validation-rules.ts:77` now *calls* `canPlaceBreakbulk`, so `reported` is produced by the same function the test compares against, with the same model/plan/item/pose. `reported ⊇ predicted` is structurally guaranteed; it can only fail if the predicate emits a rule id no wrapper maps. It is a rule-id→wrapper coverage check, **not** message parity — the file's header claim ("MESSAGE CONTRACT: every message below is byte-identical") is unverifiable by construction.
2. **Named offender: `can-place-container.test.ts` → "keeps ports on the plan…" (l.140-142)** asserts `makePlan([],[]).ports === TEST_PORTS`, i.e. it tests the fixture builder, not `canPlaceContainer`. Zero coverage value; drop or replace with a real overstow-copy assertion.
3. **Genuine, not tautological: the `it.each` message-parity block (`can-place-container.test.ts` l.120-138).** `validation-rules.ts` does not import the predicate (grep verified), so this really is predicate-vs-independent-implementation for 5 rules. Strongest new test in the phase.
4. Minor: the store's `expectUnplacedConsistent` re-derives `unplaced` using the store's own expression (same-source oracle), mitigated because two tests hard-code `["b"]` and `["a","b"]`.
5. Real breakbulk parity coverage exists elsewhere: `bbc-sao-paulo-deck-layout.test.ts:121-129` pins the band message ("1576t hatch-cover limit") on the real vessel — the 20 m band *is* correctly attributed after the refactor.

## BLOCKING FINDING — predicate blocks placements the report calls clean (20' bays)
Executed via a scratch harness in `/tmp` (repo untouched). Vessels: demo-horizon stacks bays [2…38 even], 800 model slots, **0 odd-bay slots**; BBC 447 slots, 0 odd.
- BBC SAO PAULO, real demo plan: `canPlaceContainer(20' box @ bay 3 row 6 tier 82)` → `{ok:false, reasons:[slot_exists "DEMU0000021: slot does not exist on vessel"]}`.
- `validatePlan` for that same placement → `[]` (completely clean).
- Cargo census: demo-horizon 886 containers (**400 are 20'**), 486 placements, **400 unplaced = exactly the 20' population**. BBC 130 containers (20 are 20'), 110 placed, 20 unplaced = the 20' population.

So **400/886 (45%) of demo-horizon cargo and 20/130 of BBC cargo have no droppable slot**, and Phase C's placeholders/ghost tint (derived from the same model) will paint the correct 20' bays red with a false "slot does not exist". Root cause: `build-stowage-model.ts:slotDefs` keys slots off `allSlots(vessel)` → `vessel.stacks[].bay`, i.e. 40' parent bays only (`stackFor`'s comment even anticipates "a 20' box in an odd bay"), while `validation-rules.ts:slotExists` accepts an odd bay whenever `bayPosition` maps it. Phase B is the first consumer of `model.slotByKey` for slot existence (per the phase file's own mapping table), so it violates the phase's stated invariant: "If the UI and the report can disagree, the phase is wrong."
Why it escaped: `makeTestVessel` also declares only even stack bays → the fixture **cannot express a 20' bay**, so no parity row could ever cover it.

## Latent gap (masked by the above)
`twenty_on_forty` (plan-wide `error`) has **no** predicate counterpart (`grep twenty src/engine/placement` → none). The ghost-green/report-red case is currently unreachable only because every 20' candidate is already blocked by `slot_exists`; fixing that exposes it. Inverse asymmetry: `max_height` is predicate-only (no plan-wide rule), so a drop can be refused with no report entry — safe direction, but undocumented.

## Coverage gaps
`canPlaceContainer` — 9/9 §4.5 checks have a test (slot exists, empty/cell_conflict, sizeFitsBay, no_floating + bottom-tier exemption, reefer_plug, stack_weight, max_height, breakbulk footprint, overstow). Missing: (a) **20' candidate in a 20' bay — where the bug lives**; (b) overstow "candidate burying a box below" direction (only candidate-buried is tested, though deviation 3 claims both); (c) `stackFor` undefined → 4 checks silently skipped; (d) `no_floating` "aft half" wording; (e) overstow half-non-overlap skip.
`canPlaceBreakbulk` — all 7 rules covered incl. band edge and rated band. Missing: (f) **every hold/`area_id` path** — no test passes a real area id (only `hold_99` unknown), so hold labels, "rated limit", hold keep-outs/clear height and the `{label} band` wording are untested; (g) `containerOccupancy` "under-deck" label; (h) `bandFor` returning null; (i) non-zero `rotation_deg`; (j) cross-area overlap skip.

## Store-test verdict (brief's checklist)
- undo/redo across **both** kinds: **NO** — container-only; no breakbulk undo/redo test (gap, though `applyBreakbulk` shares `apply`).
- 100-entry cap *enforced*: **YES** — 105 moves → `past` exactly 100 (would be 105 without the slice). "Dropping the oldest" not verified (length only).
- invalid action → plan **byte-identical**: **YES, stronger than asked** — referential identity (`toBe(before)`) + JSON snapshot + `past` empty.
- `unplaced` stays consistent: **YES** — asserted after every mutation, with hard-coded expected arrays in two tests.

## Cannot verify (no DOM, no browser)
App.tsx runtime wiring is unverified: `LOADING_PLAN` fallback on vessel switch, `loadPlan(null,null)`-then-effect ordering (flash of old plan / stale render), draft-driven render of report/attitude/scene/sidebar/bayplan, and `useIndicativeStability` surviving the null gap. Also: **no UI calls any store mutation action yet** — the "editable plan" has no user-reachable mutation path (Phase C). Human click-through needed: switch demo-horizon → bbc-sao-paulo and watch for a flash of the old plan; toggle cargo + project cargo; confirm violation counts still 192 (demo-horizon) / 36 (BBC).

## Recommendation
**FAIL for sign-off** — but as a *regression* the phase passes: 481/481 green, build clean, and the coordinator's differential (192/36 byte-identical) plus guard files confirm the 7-rule refactor is behaviour-preserving, which was the phase's stated acceptance criterion. Fix the slot enumeration (or make the predicate's `slot_exists` defer to `bayPosition` + StackSpec like the rule does) **before Phase C**, and add a fixture with an odd stack bay so the 20' bay case is testable. Do not start Phase C's tint work on the current predicate.
Findings only; no source or test file modified. `/tmp/phaseb-scratch/` holds the scratch harness if the probes need re-running.

## Unresolved questions
1. Is a 20' bay a **real** slot on these vessels (intended semantics: 40'-parent StackSpec, per `stackFor`) — or is the demo's 400-box 20' population itself wrong? This decides which side to fix.
2. `plans/.../phase-03-*.md` shows modified in `git status` mid-run; not by me (concurrent teammate?).
3. Is realigning `@vitest/coverage-v8` to v3 in scope for a later phase? Coverage is unobtainable until then.
4. `frontend/dist/index.html` is a tracked build artifact — running `npm run build` as a verification step dirties the tree (I restored it).
