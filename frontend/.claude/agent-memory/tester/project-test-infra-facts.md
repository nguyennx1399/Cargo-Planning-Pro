---
name: project-test-infra-facts
description: Non-obvious frontend test-infra facts — broken coverage tooling, the flaky wall-clock assert, git-forensics gotchas, run commands, and the frozen contract guards
metadata:
  type: project
---

Frontend test infra facts. Last verified 2026-09-16 (vitest 3.2.7 / Node v22.23.2) at the
drag-drop-stowage-placeholders A–C sign-off: **70 files / 541 tests, all green; demo report 199
violations, BBC 36** (both pinned in `engine/placement/__tests__/predicate-report-parity.test.ts`).

- Coverage is UNOBTAINABLE: `@vitest/coverage-v8@5.0.0` is incompatible with `vitest@3.2.7` —
  `SyntaxError: The requested module 'vitest/node' does not provide an export named 'BaseCoverageProvider'`.
  Also there is no `test:coverage` script. Don't burn time on it; report coverage as unavailable.
- Wall-clock asserts are pre-existing and must NOT be blamed on the current phase:
  `engine/__tests__/validate-plan.test.ts` (`ms < 50` on ~870 placements; 2.96-3.05 ms observed),
  and `engine/placement/__tests__/placeholders.test.ts:156-160` (50 ms on a full-slot sweep;
  1.45 ms observed). Verify by re-running before calling a regression.
- No DOM/jsdom/happy-dom tests exist and adding that capability is explicitly forbidden.
- Working commands: `npm run typecheck`; `npx vitest run`; `npx vitest run --reporter=json
  --outputFile=/tmp/x.json` for exact per-file counts (dot/verbose do not give them).
- **Frozen contract guards — treat as read-only, verify with `git status --porcelain -uall`, never
  edit:** `engine/__tests__/validate-plan.test.ts`,
  `engine/__tests__/breakbulk-real-vessels-no-violations.test.ts`,
  `data/__tests__/bbc-sao-paulo-containers.test.ts`, `lib/__tests__/geometry-characterization.test.ts`.
- **Git-forensics gotcha (cost me a wrong first pass):** `git status --porcelain` COLLAPSES untracked
  directories to a single `dir/` row, so a whole new `__tests__/` folder looks like one entry and its
  files look "unchanged". **Always use `git status --porcelain -uall`** to decide whether a test file
  is modified vs new — and remember an untracked test file has NO git baseline, so "was it weakened?"
  can only be judged by reading its content.
- Scratch-probe technique when a finding must be *executed* without touching the repo: put the test
  and a plain-object config in `/tmp/<dir>/`, then
  `npx vitest run --config /tmp/<dir>/vitest.config.ts`. A config that does `import {defineConfig}
  from "vitest/config"` FAILS from /tmp (module resolution); export a plain object with
  `resolve.alias = { "@": "<repo>/frontend/src" }`, `test.root`, `environment: "node"` and an
  absolute `include`. Worked harness kept at `/tmp/bvms-parity/`.
- `npm run build` writes a TRACKED `frontend/dist/index.html`; on a clean tree the rebuild is
  byte-identical to HEAD, so `git checkout --` it is a no-op — still run it as instructed.
- Test-vessel fixture limitation (unchanged): `makeTestVessel` declares `bays: [2, 6]` with even-only
  stacks, and `box("dry")` defaults to **size 40**. So any 20'/odd-bay/`twenty_on_forty` case needs a
  hand-built fixture; the real 20' coverage lives in
  `engine/placement/__tests__/twenty-foot-slot-parity.test.ts`. See [[project-standing-test-gaps]].
