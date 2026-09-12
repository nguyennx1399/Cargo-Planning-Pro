# Phase 07 — Demo polish, perf gate, docs

## Context links
- Plan: [plan.md](plan.md) · Depends on phases 03–06
- Docs: `README.md`, `docs/codebase-summary.md`, `docs/design-guidelines.md`, `docs/project-roadmap.md`, `docs/system-architecture.md`

## Overview
- **Priority:** P1 · **Size:** S · **Status:** Pending
- Prove the demo works (script + perf gate), fix the rough edges, and bring the docs in line with the code.

## Requirements
**Functional**
- A first-run hint card (dismissible, remembered in localStorage) listing the 5 key actions and shortcuts.
- Shortcut help on `?`.
- An empty or error state for any engine exception: catch it in `usePlanDerived`, show "Checks unavailable", and never blank the app.

**Perf gate** (RT-8):
- Record the fps orbiting at full load and at a synthetic 2× load (duplicate cargo, dev flag).
- Record the recompute ms and the auto-stow ms.
- Fail the gate if fps < 55 or recompute > 16 ms at 1×.
- If it fails, fix it before calling Phase 1 done. Likely levers: selectors, memo keys, not recomputing matrices on hover.

**Build:** `npm run build` produces a static `dist/` that works when served by `npx vite preview` with no backend.

**Docs** (via docs-manager):
- README: "Frontend demo" quick start (`cd frontend && npm i && npm run dev`, no backend needed) and `npm test`. Correct the "20k @ 60fps" claim to the measured numbers.
- codebase-summary / system-architecture: the `src/engine`, `src/data` and store sections, and the frontend-only data flow.
- design-guidelines: side-by-side layout, bay plan interactions, pick/drag model, stability panel, DEMO banner.
- project-roadmap: Phase 1 demo status; known gap "TS rules ahead of Python (mixed sizes); port with golden fixtures in Phase 2".

## Related code files
- **Create:** `src/features/common/FirstRunHint.tsx`, `src/features/common/ShortcutHelp.tsx`, `plans/260911-0945-p1-frontend-stowage-demo/reports/perf-gate-report.md`
- **Modify:** `src/hooks/usePlanDerived.ts` (error boundary logic), `README.md`, `docs/*.md` listed above.

## Implementation steps
1. Run the full demo script (plan.md) in Chrome with the backend stopped. File bugs, then fix them.
2. Perf measurements → write the perf gate report (numbers, machine, pass/fail).
3. Add the hint card and shortcut help.
4. Harden engine errors.
5. Build + preview smoke test.
6. Docs update; `code-reviewer` review; tester runs `npm test`, typecheck and build.

## Todo
- [ ] demo script pass
- [ ] perf gate report
- [ ] hint + shortcut help
- [ ] engine error handling
- [ ] static build smoke test
- [ ] docs updated
- [ ] code review + tests green

## Success criteria
- Every item in the plan.md success criteria is met and recorded in the perf gate report.
- The docs match the code (no stale claims).

## Risks
- Scope creep during polish → only fix what the demo script or the perf gate exposes; anything else goes to the backlog in project-roadmap.

## Next
- Optional: host the static demo (e.g. Vercel preview) once the user decides.
- Roadmap Phase 1 continues: persistence + security baseline (RT-1, RT-3), then the shipment connector with anonymised data.
