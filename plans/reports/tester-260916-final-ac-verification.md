# Tester — final A–C acceptance verification (Phase B sign-off + disputed-figure reconciliation)

Date: 2026-09-16 · Node v22.23.2 · vitest 3.2.7 · `environment: 'node'`
Scope: FINAL state of `plans/260916-1647-drag-drop-stowage-placeholders/` (Phases A–C), all uncommitted.
Verdict: **Phase B = PASS. Whole A–C run = PASS**, with 2 recorded non-blocking residuals + 1 unexecuted manual step.

## Exact numbers

| Check | Result |
|---|---|
| `npm run typecheck` | **PASS**, 0 errors, 2.78s |
| `npx vitest run --reporter=dot` #1 | **70 files / 541 tests, 541 pass**, 3.98s (wall 4.703s) |
| `npx vitest run --reporter=dot` #2 | **70 files / 541 tests, 541 pass**, 3.94s (wall 4.675s) |
| `npm run build` | **PASS** exit 0, built in 3.98s (wall 7.0s). Only pre-existing warning: 1.552 MB chunk > 500 kB |
| `git checkout -- frontend/dist/index.html` | run, exit 0 — **no-op**, see disclosure below |
| Coverage | **unobtainable** (pre-existing: `@vitest/coverage-v8@5` vs `vitest@3.2.7`) |

**Flakiness: not flaky.** The two runs are byte-identical in counts; only drift is wall clock 4.703→4.675s. The suite's only wall-clock assert (`validate-plan.test.ts`, bound 50 ms) measured **2.96 ms** (run 1) / **3.05 ms** (verbose) — ~16x margin.

## Frozen-contract guards — clean and unmodified

`git status --porcelain -uall` on all four: **CLEAN** (no entry). Ran individually: **4 files / 22 tests, all green**.

- `engine/__tests__/validate-plan.test.ts` (11 tests) — incl. "validates ~870 boxes" at 3.05 ms
- `engine/__tests__/breakbulk-real-vessels-no-violations.test.ts` (2)
- `data/__tests__/bbc-sao-paulo-containers.test.ts` (7) — incl. the frozen "~13 m apart" bay-position test
- `lib/__tests__/geometry-characterization.test.ts` (snapshot, 1)

`git diff --name-only` shows **no frozen guard modified**. Whole-suite test-file hash identical to my pre-run baseline: `240284e4ffe34529f533a56e151b42b634a5fb34` (70 files).

## No test weakened anywhere

**Correction to the brief's framing:** only **two TRACKED** test files were modified — `breakbulk-validation-rules.test.ts` (+24) and `naive-fill-breakbulk.test.ts` (+31) = **+55 insertions, 0 deletions**. `commit-placement.test.ts` and `placeholders.test.ts` are **untracked (new) files** — no git baseline exists, so I judged them by content.

- **`commit-placement.test.ts`** (12 tests) — H1 claim verified as intent-preserving: the `hoveredSlot` setState moved to *after* the gesture start (l.148) with the assertion `toEqual(slot(2,1,82))` preserved verbatim, plus **one new** H1 invariant test ("clears a stale hovered slot when a gesture starts", l.157-171). No assertion deleted, relaxed or made vacuous; all 12 carry real expectations (`toEqual`/`toBe`/`toBeNull`, referential plan identity at l.66).
- **`placeholders.test.ts`** (12 tests) — comments/header only. Assertions are **count-agnostic** (`valid.size + blocked.length === model.slots.length`, `toBeGreaterThan(0)`, `toContain`, `toEqual([])`), so the slot tripling scaled them rather than weakening them.
- The two +55 additions are genuine Phase A bound tests (per-stack rect bounds; `occupiedRects` blocking + area isolation), not rewrites.
- **Independent confirmation:** no `frontend/src` file has an mtime after my run start (21:10:40) — `find -newermt` returned empty. Implementation and tests were frozen throughout.

## Claim A — the 20' fix: **VERIFIED**

- **`slot_exists` fires 0 times** for a 20' candidate across **all 2400 demo + 1341 BBC slots** (pre-fix: every slot). The original divergence is gone in both directions.
- **The exact reported failure reproduces fixed.** BBC SAO PAULO `20' @ bay 3 row 6 tier 82` was `{ok:false, reasons:[slot_exists]}`; now `ok=true, reasons=[]`, report errors **0**, `bayPosition={fortyBay:2,halves:["aft"]}`. Bay-3 droppable 20' slots: **7 of 28** (was 0).
- **`validSlotsFor(20')` = 122 (MV Demo Horizon) / 18 (BBC)** — matches recorded exactly, **100% odd bays**. `validSlotsFor(40')` = 80 / 10, **100% even bays**.
- **My own differential (independent of the guard test):** 122 + 18 valid 20' slots and 80 + 10 valid 40' slots committed into `validatePlan` → **0 predicate-clean/report-error mismatches**.
- **Full-sweep guard green:** `twenty-foot-slot-parity.test.ts` (10 tests) sweeps *every* slot on both vessels for 20'/40'/20'-reefer in both directions, plus an unreduced-plan cross-check.
- **`twenty_on_forty` is now in the predicate** — fires **1158** (demo) / **249** (BBC) times, severity `error`; not vacuous. (`can-place-container.ts:136-138`, `reason.ts:71`.)
- Phase file's own claims re-measured: unplaced 20' with ≥1 valid slot = **400/400** demo, **19/20** BBC — matches.

## Claim B — demo report unchanged: **VERIFIED**

| Vessel | Violations | Composition | Plan SHA-256 |
|---|---|---|---|
| MV Demo Horizon | **199** | all `overstow` | `dd95f3bc715c036433b6a6077186d5eff7b8eb32799dcdd5a2a1dcdec3a216af` |
| BBC SAO PAULO | **36** | all `overstow` | `658cf67175278611ce8cb687c4f9c7a9c1ee8e95ebdceb0dc66943e8a30d7037` |

Both are pinned in `predicate-report-parity.test.ts` (hard-coded 36 / 199) which also asserts predicate ≡ report on the pairs — green.

**The stale "192" is explained, not a regression.** It was the *coordinator's* baseline, never a measurement. The Phase B code-reviewer already flagged it: `code-reviewer-260916-1955-phase-b-review.md:133` — *"The coordinator's baseline 'demo 192 violations' did not reproduce under the app's default toggles (I measure 199 on demo-horizon; BBC 36 matches)"*. The Phase B tester report then inherited it (l.56, l.59). **199 has been stable from Phase B through Phase C.**

## Disputed figure 1 — 1520 vs 2400: **RESOLVED — 1520 is right**

Both figures were measured in my /tmp harness (repo untouched). Definition that reproduces the **agreed** BBC figure:
> 20'-candidate gesture set (empty slots the size can use) × pitch-sized pick box (13.392 m) × AABB overlap

| Vessel | Pairs | Neighbour-degree histogram |
|---|---|---|
| MV Demo Horizon | **1520** | `{1: 160, 2: 1440}` |
| BBC SAO PAULO | **1554** | `{1: 14, 2: 142, 3: 142, 4: 596}` |

**1554 is the figure both disputed reports agree on**, so this is the definition both used — therefore the demo value under the same definition is **1520**. Internal consistency confirms it: `(160×1 + 1440×2)/2 = 1520`; `(14 + 284 + 426 + 2384)/2 = 1554`. ✓

**Where 2400 came from: a unit error, not a different definition.** Loading the *whole model* (all 2400 slots) with the pitch box gives 4560 pairs, and **boxes participating in ≥1 overlap = 2400 = every slot = exactly the demo's model slot count**. So 2400 is a **box/slot count mistakenly reported as a pair count**, and it coincides with the demo's documented slot total. The phase file itself mixes units: line 19 says "2400 (demo) / 1554 (BBC)" (one box-count + one pair-count) while line 67 says "1520 (demo) / 1554 (BBC)" (two pair-counts). **Line 67 is the consistent one.**

Ruled out: AABB-vs-x-only. Same set, x-only gives 184800, not 2400 — neither report used x-only. Also ruled out: different candidate set (both reports cite the same gesture-set sizes 1600/894, which I reproduce exactly).

## Disputed figure 2 — BBC 40' neighbour-bay overlap: **RESOLVED — both are total lengths; the difference is pitch statistic**

Measured adjacent BBC 40' bay pitches (from declared `bay_center_x_m`): **13.09, 12.99, 13.09, 12.99, 13.09, 13.01, 13.06, 12.99** — **not uniform** (min 12.99, max 13.09, mean 13.0388).

With the 13.392 m pick box:

| Basis | Total x-intersection | Per side |
|---|---|---|
| **min pitch 12.99** (worst case) | **0.4020 m** ← reviewer's figure | 0.2010 m |
| **mean pitch 13.0388** | 0.3532 m ≈ file's ~0.36 | 0.1766 m |
| file's rounded "≈13.03" | 0.362 m | 0.181 m ← file's "~0.18 m into each neighbour" |

**Truth:** 0.402 m and ~0.36 m are the *same quantity* (total intersection length) at different pitch statistics — **minimum vs mean** — not total-vs-per-side. The reviewer's 0.402 m is the correct **worst-case** bound a planner can hit; the phase file's ~0.36 m is a nominal/average value, and its "~0.18 m per side" understates the worst case by ~0.02 m (0.201 vs 0.181). MV Demo Horizon's pitch is exactly 13.392 (min = max = mean) → **0.0000 m overlap**, confirming the file's "exact tiling" claim for that vessel.

## Tests passing for the wrong reason

1. **`twenty-foot-slot-parity.test.ts` 20'-reefer case (l.168-184) — the only structural gap.** It asserts `plugSlots > 0` (i.e. `reefer_plug` *fired*) and 0 mismatches, but has **no `valid > 0` assertion** — unlike its dry 20'/40' case (l.110-132) which asserts `droppable > 0`. Consequence: **BBC SAO PAULO's 20' reefer has ZERO valid slots and this test cannot detect it.** Measured: BBC `validSlotsFor(20' REEFER) = 0`, `validSlotsFor(40' REEFER) = 1` (bay 26 tier 84). Demo is healthy: 20' → 44, 40' → 22.
   - **Planner impact:** BBC's shipped plan contains exactly **one stranded container in either plan — `DEMU0001136` (20' REEFER, pol VNSGN, pod SGSIN, 22.7 t)** — the only cargo with 0 valid drop targets. This *is* the "19/20" the phase file documents, so it is a **known, documented residual, not a hidden regression**. Root cause candidate: BBC's plugs are declared only on even bays 26/30/34, and no odd half inherits a reachable plug tier.
2. **`can-place-breakbulk.test.ts` l.168-198 "predicts only messages the plan-wide rules actually produce"** — still tautological: `breakbulk-validation-rules.ts:77` *calls* `canPlaceBreakbulk`, so `reported ⊇ predicted` is structurally guaranteed. It is a rule-id→wrapper coverage check, not message parity. Flagged in Phase B; **still present, unfixed**.
3. **`can-place-container.test.ts:195-197` "keeps ports on the plan"** — `expect(makePlan([], []).ports).toEqual(TEST_PORTS)` tests the fixture builder, not `canPlaceContainer`. **Zero coverage value.** Flagged in Phase B; **still present, unfixed**.
4. **Non-issue:** `placeholders.test.ts` clock guard threshold stayed at 50 ms while the sweep tripled (447 → 1341). Measured warm sweep **1.45 ms** → ~34x margin. Comment's "≈2-6 ms" is pessimistic. Fine.
5. **Non-issue (safe direction):** `placeholders.test.ts`'s local `hasPlug` looks up `vessel.stacks` by the slot's *own* bay; for an odd half slot that is always false, so the assertion over-constrains rather than under-constrains. The half-slot plug path is genuinely covered only by `twenty-foot-slot-parity.test.ts`.
6. **Note:** `box("dry")` in `test-vessel-fixture` defaults to **size 40**, so every "dry box" sweep in `placeholders.test.ts` is a 40' candidate. The 20' coverage lives in `twenty-foot-slot-parity.test.ts` + the new half-slot files.

New-in-feature test files: `can-place-container` 21, `can-place-breakbulk` 13, `commit-placement` 12, `use-plan-draft-store` 12, `placeholders` 12, `drop-verdict` 10, `twenty-foot-slot-parity` 10, `slot-enumeration` 9, `predicate-report-parity` 4, `half-slot-geometry` 3, `half-slot-occupancy` 2.

## Sign-off

- **Phase B: PASS.** The blocking predicate-vs-report divergence that caused the earlier FAIL is fixed and independently re-verified (0 `slot_exists` emissions for 20' across both vessels; 0 mismatches in my own differential; the exact reported case now clean).
- **Whole A–C run: PASS.** typecheck clean, 70/541 green twice, build clean, frozen guards clean and unmodified, no test weakened, both demo-report counts match (199 / 36).
- **Residuals (non-blocking, recorded):** BBC 20' reefer unreachable; 2 standing tautology/zero-coverage tests from Phase B.
- **Blocking for release (not for this sign-off):** the manual browser click-through remains unexecuted (21 steps).

## Not verified (no DOM/browser — none added)

- `App.tsx` runtime wiring: vessel-switch `LOADING_PLAN` fallback, toggle behaviour, draft-driven render of report/attitude/scene/sidebar/bay plan.
- The manual click-through script incl. **WCAG 2.5.7** single-pointer placement (click-pick → click-target) in 3D and 2D, Esc cancel, and the two [H] H1/H2 defect checks.
- Actual raycast/pick behaviour: pick-volume sizing was verified *arithmetically and by set composition* only. The 0.076 m sibling dead zone and the 0.402 m BBC overlap are **geometric** claims, not pointer-verified.
- Coverage % (tooling broken, pre-existing).

## Disclosure / concurrent writer

- `frontend/dist/index.html` was **already dirty at my baseline**. My build regenerated it **byte-identical to HEAD**, so `git diff` is now empty and the requested `git checkout --` was a **no-op (exit 0)**. Net effect of my run on the tree: that one build artifact now matches HEAD; I modified no source or test file.
- During my run a **concurrent agent** wrote `docs/project-changelog.md` (new, 21:11:33) and `docs/DOMAIN.md` (21:14:50) — both after my 21:10:40 start, neither by me. This reproduces the Phase B report's unresolved question about a concurrent teammate. No `frontend/src` file was affected (hash + mtime verified).

## Unresolved questions

1. Is BBC's 20' reefer (`DEMU0001136`) genuinely unplaceable by design, or a half-slot plug-resolution gap? Needs a decision before Phase D/E.
2. Should `twenty-foot-slot-parity.test.ts`'s reefer case assert `valid > 0`? It would currently **fail on BBC** — turning a silent gap into a red test.
3. The two Phase-B tautology/zero-coverage findings are still unfixed — in scope for Phase E?
4. Realign `@vitest/coverage-v8` to v3 so coverage is obtainable?
5. Who owns the concurrent `docs/` writes, and do they affect the A–C docs-sync sign-off?

Findings only; no source or test file modified. Scratch harness: `/tmp/bvms-parity/` (4 probe files, re-runnable via `npx vitest run --config /tmp/bvms-parity/vitest.config.ts`).
