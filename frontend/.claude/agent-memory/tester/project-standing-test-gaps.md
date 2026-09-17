---
name: project-standing-test-gaps
description: Known-unfixed test gaps and residuals in the stowage/placement work, plus the concurrent-docs-writer hazard — check before re-reporting as new
metadata:
  type: project
---

Known residuals as of the 2026-09-16 A–C sign-off. **Why:** these were each found and reported once
already, so re-discovering them wastes a run and looks like a new defect. **How to apply:** confirm
still-present, then cite as "known, previously reported" rather than reporting as new.

**Standing test gaps (reported in Phase B, still unfixed at final verification):**
1. `engine/placement/__tests__/can-place-breakbulk.test.ts` — "predicts only messages the plan-wide
   rules actually produce" is structurally tautological: `breakbulk-validation-rules.ts:77` *calls*
   `canPlaceBreakbulk`, so `reported ⊇ predicted` cannot fail. It is a rule-id→wrapper coverage check,
   not message parity.
2. `engine/placement/__tests__/can-place-container.test.ts` — "keeps ports on the plan so the overstow
   sequence survives a plan copy" asserts only `makePlan([], []).ports === TEST_PORTS`, i.e. it tests
   the fixture builder. Zero coverage of `canPlaceContainer`.
3. `engine/placement/__tests__/twenty-foot-slot-parity.test.ts` 20'-reefer case (l.168-184) asserts
   `plugSlots > 0` (that `reefer_plug` FIRED) but has **no `valid > 0`** assertion, unlike its dry
   20'/40' case. So it cannot detect an unplaceable 20' reefer.

**Product residual (documented in phase-03, not a hidden regression):** on BBC SAO PAULO,
`validSlotsFor(20' REEFER) = 0` and `validSlotsFor(40' REEFER) = 1`, so the shipped BBC plan's single
unplaced 20' reefer **`DEMU0001136`** (pol VNSGN, pod SGSIN, 22.7 t) is the only container in either
plan with no valid drop target — this is the "19/20" the phase file records. Demo is healthy
(20' reefer → 44, 40' → 22). Likely cause: BBC plugs are declared only on even bays 26/30/34.

**Concurrent-writer hazard:** another agent writes to `docs/` **during** tester runs (observed
2026-09-16 ~21:11-21:15: `docs/project-changelog.md` created, `docs/DOMAIN.md` modified). **Why it
matters:** a `git status` diff taken before/after a run will show unfamiliar entries that are NOT
yours. **How to apply:** before reporting "the tree changed during my run", separate your own writes
(the only legitimate ones are test files you own plus `dist/index.html` via `npm run build`) from
`docs/` writes, and say explicitly that a concurrent agent is active. Verify your claim with
`find frontend/src -newermt "<run start>"` and a test-file hash.
