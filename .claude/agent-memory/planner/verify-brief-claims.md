---
name: verify-brief-claims
description: Task briefs in this repo have carried stale facts (test counts, file:line references) — verify against the repo before planning
metadata:
  type: feedback
---

Verify factual claims inside orchestration task briefs against the repo before planning against them.

**Why:** The 2026-09-16 drag-drop/stowage planning brief stated "395 of 396 tests pass today" and named a pre-existing failure at `frontend/src/engine/__tests__/validate-plan.test.ts:65`. Measured reality: 56 files / 396 tests, all passing; the cited assertion is at line 66 (`expect(ms).toBeLessThan(50)`, a wall-clock perf bound, so flaky rather than deterministically failing). The same brief called a 20'-pick-box hazard "live" when the app has no odd (20') bay on any vessel, making it latent. Two other referenced paths were also off (`data/deck-layout-from-spec.ts` is really `engine/vessel-spec/deck-layout-from-spec.ts`; `engine/naive-fill-plan.ts` was assumed missing but exists).

**How to apply:** Before writing a plan or acceptance criteria, run `npm test` / `npm run typecheck` and grep for any file or symbol the brief names. Put the measured numbers in the plan and explicitly correct the brief's figures (with the reason) rather than silently propagating them — in this run that meant recording "the suite is 396/396, the assertion is line 66, it is flaky" in `plan.md` instead of planning a fix for a failure that does not reproduce.
