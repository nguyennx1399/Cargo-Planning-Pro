# Phase 02 — Plan draft store, undo/redo history, auto-stow, app wiring

## Context links
- Plan: [plan.md](plan.md) · Depends on [phase-01](phase-01-demo-data-and-rules-engine.md)
- Current: `src/App.tsx` (React Query → backend), `src/store/usePlanStore.ts` (view state only), `backend/app/solver/greedy.py`

## Overview
- **Priority:** P0 · **Size:** M · **Status:** Pending
- The editable plan lives in the browser, every mutation is undoable, and a greedy auto-stow runs client-side. The app starts with no backend.

## Key insights
- Snapshot history is the simplest correct approach. A snapshot is `{containers, placements}` array refs with immutable updates. 200 steps × 800 refs is negligible memory.
- Derive `unplaced` from containers without a placement; never store it (one source of truth).
- Auto-stow reuses `placement-checks.ts` (DRY), so its output passes the same validator (plan principle "validator trước optimizer").

## Requirements
**Functional**
- `usePlanDraftStore` (zustand) holds `vessel`, `voyage`, `ports`, `containers`, `placements`, `past[]`, `future[]` (cap 200), and `lastLabel`.
- Actions return `ActionResult = {ok:true} | {ok:false, reason:string}`:
  - `move(id, slot)`: target must be an empty half or halves in the vessel grid, and the size must match the bay parity.
  - `swap(idA, idB)`: same size only; otherwise `{ok:false, reason:"Swap needs same size — unload first"}`.
  - `load(id, slot)`, `unload(id)`.
  - `updateContainer(id, patch)`: changing size is only allowed while unplaced.
  - `addContainer(input)` (auto ISO 6346 id), `removeContainer(id)`.
  - `autoStow("remaining" | "all")`, `resetDemo()`, `undo()`, `redo()`.
- Every successful mutation pushes one history entry with a label (e.g. `Move DEMU1234567 → 140682`) and clears `future`.
- Initial state is `generateDemoCargo(42)`: auto-stow all but 30 boxes, which stay unplaced as "late bookings".
- `usePlanDerived()` hook: memoised `validatePlan` (+ stability after Phase 06) keyed on the `containers`/`placements` refs. It exposes `computeMs` for the perf overlay.
- `App.tsx` reads from the store; it has no `api` calls and no backend error screen. `api/client.ts` stays untouched for later phases.

**Auto-stow** (`src/engine/greedy-auto-stow.ts`, pure):
- Signature: `autoStow(vessel, ports, containers, placements, mode) → {placements, unplacedIds}`. In `remaining` mode existing placements are locked.
- Order: POD sequence descending (last port at the bottom) → 40' before 20' → weight descending.
- Candidate cells: under deck before on deck, tier bottom→up, rows centre-out alternating port/stbd (TCG balance), bays alternating fwd/aft around midship (trim balance).
- Place only when all hard checks pass: size/bay, free, support, plug, column weight, not 20 on 40. Prefer cells that avoid overstow; fall back to others.

## Architecture
```
data generators ─▶ usePlanDraftStore (state + history + actions) ─▶ usePlanDerived() ─▶ UI
                          │ uses                                   │ uses
                  engine/greedy-auto-stow.ts                engine/validate-plan.ts
```
Keep `usePlanStore` for view state and extend it in Phases 03/04 (`pickedId`, drag payload).

## Related code files
- **Create:** `src/engine/greedy-auto-stow.ts`, `src/store/usePlanDraftStore.ts` (split `plan-draft-actions.ts` if >200 LOC), `src/store/plan-history.ts` (push/undo/redo helpers), `src/hooks/usePlanDerived.ts`, tests for the store and auto-stow.
- **Modify:** `src/App.tsx`, `src/features/panels/Sidebar.tsx` (take the report from `usePlanDerived`), `src/features/viewer3d/*` and `BayPlanView.tsx` (plan prop from the store).
- **Delete:** none.

## Implementation steps
1. `plan-history.ts`: `commit(state, next, label)`, `undo`, `redo`, with a cap of 200.
2. Store + actions with invariant guards (unknown id or invalid slot → `ok:false`, no history entry).
3. `greedy-auto-stow.ts` + tests: the demo cargo gives 0 hard errors; `remaining` never moves locked boxes; results are deterministic.
4. `usePlanDerived` with `useMemo` + `performance.now()`.
5. Rewire `App.tsx`: stopping the backend must not matter.
6. Keyboard: Cmd/Ctrl+Z undo, Shift+Cmd/Ctrl+Z / Ctrl+Y redo (`src/hooks/useKeyboardShortcuts.ts`, extended in Phase 03).

## Todo
- [ ] history helpers + tests
- [ ] store actions + guards + tests
- [ ] greedy auto-stow + tests
- [ ] derived hook
- [ ] App rewiring, backend-free
- [ ] undo/redo shortcuts

## Success criteria
- The app loads with the backend stopped.
- The initial plan has 0 errors, ~840 placed, 30 unplaced.
- 20 random actions followed by 20 undos restore the initial plan exactly (test).
- Auto-stow runs in ≤ 150 ms.

## Risks
- Auto-stow is slow on the full grid → precompute the cell list once and use O(1) predicate checks; there are only ~1,500 half-cells.
- Stale derived data → key memos on array identity only, and never mutate arrays in place.

## Security
Client-only, synthetic data. Validate numeric patches (finite, within range) in the actions, not only in the UI.

## Next
Phases 03, 04 and 05 in parallel.
