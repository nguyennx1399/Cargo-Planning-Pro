# Project Changelog

Record of significant changes. **This file starts at 2026-09-16** — earlier changes are in git
history and are not backfilled here. Phase-level status lives in [project-roadmap.md](./project-roadmap.md).

## 2026-09-16 — Drag-and-drop stowage editor, Phases A–C

Frontend. Spec: [confluence feature plan](../plans/reports/confluence-260916-1647-drag-drop-stowage-placeholders-feature-plan.md) ·
Plan: [260916-1647-drag-drop-stowage-placeholders](../plans/260916-1647-drag-drop-stowage-placeholders/plan.md).
Phases D–E deferred.

**Added — one shared stowage model (`frontend/src/engine/stowage-model/`)**

- `StowageModel` (types, `build-stowage-model`, `slot-enumeration`, `occupancy`, `coords`) is the single
  source of truth for stowage areas and container slots; `coords.ts` is the only home of the
  x_m↔scene-x offset. Slots are enumerated from the validator's own `bayPosition`, so 40' bays and
  their 20' odd half-bays cannot disagree with the rules.
- `engine/breakbulk-deck-area.ts` became a thin wrapper over the model (11 exports, behaviour
  preserved); it is marked for deletion in Phase E.

**Added — one predicate per cargo kind (`frontend/src/engine/placement/`)**

- `canPlaceContainer` / `canPlaceBreakbulk` with `reason.ts` (rule ids + `RULE_SEVERITY`),
  `placement-reason-builders.ts` and `placeholders.ts` (`validSlotsFor`, `blockedSlots`,
  `blockedReasonFor`, `verdictOf`).
- Severity rule (D1): hard physical limits block; overridable limits are accepted AND recorded rather
  than refused. `overstow` is a warning in both the drop check and the plan-wide report. The breakbulk
  overweight/pressure band is deliberately asymmetric: overridable at drop time, still an `error` in the
  plan-wide report (see the header note in `engine/placement/reason.ts`).
- `engine/breakbulk-validation-rules.ts` is now a loop over `canPlaceBreakbulk`; rule ids and messages
  are unchanged (pinned by a parity test).

**Added — editable plan (`frontend/src/store/`), replacing plan data in the React Query cache**

- `usePlanDraftStore`: the only place a plan is mutated from the UI. Validate-then-mutate, never
  mutates a plan in place, derived `unplaced`, undo/redo capped at 100 entries. `usePlanStore` is view
  state only; `commit-placement.ts` is the one resolver the drop and pick paths share.
- `App.tsx` no longer derives the plan with a `useMemo`; the demo plan is built in the frontend and
  loaded into the draft store.

**Added — the editor**

- Translucent placeholders on every valid slot, a ghost with a three-state tint (green clean / amber
  accepted-with-warnings / red blocked + reason), and one verdict (`lib/drop-verdict.ts`) behind the
  ghost, placeholders, 2D bay plan and sidebar wording.
- Commit on release (3D placeholder or 2D bay cell) or on a click for the picked item — the WCAG 2.5.7
  single-pointer path, no drag gesture required. Drag start pauses playback (D3); Esc cancels;
  Ctrl/Cmd+Z undo, Shift+Ctrl/Cmd+Z (or Ctrl+Y) redo.
- Sidebar split into sections to stay under the 200-LOC rule: `ContainerInspector`, `UnplacedCargoList`,
  `ProjectCargoPanel`, `ViewOptionsPanel`, `use-stowage-keyboard-shortcuts`; bay plan split into
  `BayPlanView` + `BayPlanDeckBlock`.

**Verification (2026-09-16):** `npm test` 70 files / 541 tests passing; `npm run typecheck` clean;
`npm run build` succeeds. The manual browser click-through
([script](../plans/reports/manual-click-through-260916-phase-c.md)) is the outstanding acceptance step —
the repo has no DOM test environment, so the browser interactions are not machine-verified.

**Not included (deferred):** Phase D project-cargo placeholders/drop; Phase E hardening
(hatch-opening check, tweendeck pontoon levels, multi-select/nudging, magnet snapping, Playwright) and
the `breakbulk-deck-area.ts` shim deletion. Swapping two containers is not implemented.
