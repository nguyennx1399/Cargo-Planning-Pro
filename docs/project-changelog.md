# Project Changelog

Record of significant changes. **This file starts at 2026-09-16** — earlier changes are in git
history and are not backfilled here. Phase-level status lives in [project-roadmap.md](./project-roadmap.md).

## 2026-09-17 — Drag-drop UX polish: pointer feedback (P1) and bulk retrieval (P2)

Frontend. Plan: [260916-2117-optimize-drag-drop-ux](../plans/260916-2117-optimize-drag-drop-ux/plan.md).

> **Status: implemented 2026-09-16, still UNCOMMITTED as of 2026-09-17, and not browser-verified.**
> Unit tests, typecheck and build are green, but the repo has no DOM test environment
> (`environment: 'node'`; jsdom/testing-library deliberately not installed), so no test and no human
> has driven the pointer. Acceptance steps 22–34 of the
> [manual click-through](../plans/reports/manual-click-through-260916-phase-c.md) are outstanding.
> Nothing here has shipped.

**P1 — pointer feedback & precision**

- Slot resolution is now "nearest slot **centre** to the cursor ray's tier-plane crossing"
  (`lib/nearest-slot.ts`) instead of "whichever pick box the ray entered first". Closes the recorded
  H2 "camera side decides" defect, the 0.402 m BBC bay-boundary hazard and the 0.076 m 20'
  sibling-half dead zone. `EmptySlotPicker` keeps the three.js plumbing; the rule is pure and
  node-tested.
- `lib/drop-feedback.ts` is the ONE wording layer for every surface that describes a drop. The
  refusal and "recorded, not fatal" sentences were previously string literals in
  `ContainerInspector.tsx` *and* `BayPlanView.tsx`, worded differently for the same outcome.
- `DropVerdictChip.tsx` renders that sentence at the cursor. It is deliberately `aria-hidden` — the
  accessible copy stays in `ContainerInspector`, so pointer movement does not spam an `aria-live`
  region. `use-drop-cursor.ts` sets the viewport cursor class and a 2 px "armed" ring.
- `usePlanStore` gains `dropOutcome` (decision D5), replacing `Sidebar`'s local `releaseNotice`;
  `commit-placement.ts` is its only writer, so the "Placed / Not placed" line survives the pointer
  leaving the slot. A refused PICK stays armed; a refused DRAG is cleared.
- Wording contract: clean drop → no notice; overstow → "Placed. Recorded, not blocked — the checks
  below will list it: `<reason>`" in amber; refusal → "Not placed — `<reason>`" in red.
- Release hardening: `e.button` guard plus `pointercancel`/`blur` cancel, so a right-button release or
  a window switch cannot leave a stuck ghost.

**P2 — bulk retrieval over the Unplaced list**

- New pure `lib/unplaced-query.ts` (199 LOC) + presentation-only `UnplacedListControls.tsx`.
  `UnplacedCargoList.tsx` gains a search box, size/type filters, sort (cargo order / POD rotation /
  weight heavy-first / id), grouping (none / POD / type / size, collapsible with per-group counts),
  ArrowUp/Down/Home/End roving focus, and a "Fits bay NN" toggle.
- The list window grows 140 px → 320 px (MV Demo Horizon holds 400 unplaced rows). The header becomes
  `Unplaced (n of N)` when anything is filtered; an empty result shows "No container matches." with a
  Clear filters action. `DEFAULT_UNPLACED_QUERY` reproduces the previous rendering exactly, so BBC
  still reads `Unplaced (20)`.
- **Decision D6:** "Fits bay NN" is a RENDERING-ONLY filter worded as a size/parity claim
  (`BAY_CAVEAT = "Size and parity only — the slot still has to pass every check."`). It never gates a
  drop — `commitPlacement → canPlaceContainer` remains the only gate. The exact-predicate variant was
  measured at ≈11.2k `canPlaceContainer` calls ≈ 39 ms per recompute and rejected.

**Fixed — keyboard safety**

- `use-stowage-keyboard-shortcuts.ts`: Esc and the arrow keys now return early on `INPUT`/`TEXTAREA`.
  Without this the new search box hijacked them — Esc in the box would have cancelled an armed pick
  and the arrows would have paged the bay filter while typing. Load-bearing.

**Verification (2026-09-17):** `npm test` **75 files / 586 tests passing**; `npm run typecheck` clean;
`npm run build` succeeds. Machine-checked only — the browser click-through is not run.
There is no eslint/prettier config and no CI anywhere, so these gates are run by hand.

**Not included:** no new npm dependency (Tailwind 4 utilities + existing shadcn only); no DOM test
tooling (D7); swap, multi-select, keyboard nudging of a placed box and magnet snapping remain
deferred to Phase D/E.

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
