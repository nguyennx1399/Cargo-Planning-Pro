# Phase C — Container placeholders + drop

## Context Links

- Spec: `plans/reports/confluence-260916-1647-drag-drop-stowage-placeholders-feature-plan.md` §4.6 (`validSlotsFor`), §6 (UX flow), §7 Phase C, §9 (risks), §10 file map.
- Depends on: [phase-01-stowage-model-foundation.md](phase-01-stowage-model-foundation.md) (model, `coords`) and [phase-02-placement-checks-and-editable-plan.md](phase-02-placement-checks-and-editable-plan.md) (`canPlaceContainer`, `usePlanDraftStore`).
- Recon: `plans/reports/scout-260916-1628-viewer3d-placeholders.md` (component tree, picking, OrbitControls), `plans/reports/researcher-260916-1628-dnd-intent-and-patterns.md` (why no DnD library; WCAG 2.5.7).
- Overview: [plan.md](plan.md).

## Overview

- **Priority:** P2
- **Size:** ~1.5 days
- **Status:** pending
- **Completes** the A–C scope: after this phase a 40' box can be dragged from the Unplaced list onto a valid empty slot and the plan updates with undo.

## Key Insights

**The pick/raycast half already exists and is wired in.** `EmptySlotPicker.tsx` (60 LOC, **untracked in git**) renders one invisible `InstancedMesh` over `emptySlots(vessel, plan.placements)` (`engine/all-slots.ts:22-25`), writes translation-only matrices from `slotToPosition`, and sets `hoveredSlot` on `onPointerMove` / clears on `onPointerOut`. `VesselScene.tsx:51-52` mounts it and `GhostContainerPreview` inside the attitude group. What is missing is the commit (E3-04c/d) — `Sidebar.tsx:76-81` clears `draggingContainerId` on window `mouseup` and nothing consumes `hoveredSlot`. `Sidebar.tsx:215` states this in the UI copy and must be updated.

**Tiling math — verified against both real vessels, because the pick volume's correctness is the whole snapping mechanism.**
- Pick box is `[DIM.len40 + LAYOUT.bayGap, LAYOUT.tierPitch, DIM.width + LAYOUT.rowGap]` = `[13.392, 2.65, 2.498]` (`EmptySlotPicker.tsx:56`).
- **MV Demo Horizon: exact tiling.** Its bay pitch *is* `DIM.len40 + LAYOUT.bayGap` = 13.392 (`geometry.ts:60-62` fallback), and `rowCenterZ` uses `DIM.width + LAYOUT.rowGap` = 2.498 — so boxes tile with zero dead zones and no overlap.
- **BBC SAO PAULO: ~0.36 m overlap.** Real declared bay pitch is ≈13.03 m (`bay_center_x_m` = 119.06, 105.97, 92.98, 79.89, 66.90, 53.81, 40.80, 27.74, 14.75), so a 13.392 m pick box extends ~0.18 m into each neighbour. A pointer landing within ~0.18 m of a bay boundary can therefore resolve to the **adjacent bay**. This is the live form of the hazard both recon reports flagged.
- **Vertically there are NO dead zones.** `tierCenterY` (`geometry.ts:74-86`) always steps by exactly `LAYOUT.tierPitch` for a given bay (only the per-bay *base* varies), so tier centres tile exactly with the 2.65 m pick box. The recon's open question about vertical dead zones is answered: not a risk.
- **Rows: no risk either.** `rowCenterZ` ignores the spec's `row_pitch_m: 2.5` and always uses `DIM.width + LAYOUT.rowGap` = 2.498 = the pick box width.

**The 20'-in-odd-bay hazard is LATENT, not live — do not build a fix for it.**
- `sizeFitsBay` (`placement-checks.ts:14-15`) sends 20' boxes to **odd** bays and 40'/45' to even ones.
- **No vessel in the app has an odd bay.** BBC builds `vessel.bays` only from `spec.containers.stowage.bays` = `[2, 6, 10, 14, 18, 22, 26, 30, 34]`; its `twenty_foot_only` field is explicitly not planned (`types/vessel-stowage-spec.ts:156-157`) and `containerGridFromSpec` never reads it. MV Demo Horizon uses `FORTY_BAYS = 2 + 4i` = `[2…38]`.
- **Consequence:** `validSlotsFor(model, plan, twentyFootBox)` returns `[]` on every vessel today, so a 20' drag shows no placeholders and can never turn green. Do **not** treat that as a bug.
- **Action:** keep the pitch-sized pick volume (its zero-dead-zone property is what makes raycasting the snapping algorithm), restrict the picker to the drag's valid+blocked set, and **add a unit test asserting the 20' result is `[]`** so the invariant is documented rather than rediscovered. Revisit the pick volume only when a vessel with a real 20' grid is onboarded (spec §5: "Onboarding a new vessel = write its `*.stowage.json`").

**Spec's acceptance line "A 20' box shows no placeholders in 40' bays" is therefore TRUE and directly testable** — but on today's two vessels it means "no placeholders at all", which is correct behaviour, not a defect.

**`HIGHLIGHT` has no valid/invalid tint yet.** `lib/colors.ts:66-70` defines only `hover: #FFFFFF`, `selected: #FFD23F`, `ghost: #42A5F5`. Add `valid`/`invalid` constants there and tint the ghost + placeholder material from `canPlaceContainer`'s severity — not from a UI-local rule (validator-first).

**OrbitControls will fight the drag.** `VesselScene.tsx:55` sets `makeDefault`, so `useThree(s => s.controls)` yields the controls instance; `enabled = false` while `draggingContainerId` is set is the intended lever and is currently unused. Left-drag orbits today, so without this a canvas drag rotates the camera instead of placing.

**Hull picking is already disabled** — `Hull.tsx` sets `raycast={() => null}` on every path (`:124`, `:126`) and traverses the GLB doing the same (`:79-83`). Spec §9's "disable the hull while dragging" is already satisfied; keep it.

**`ContainerInstances.tsx` has no `onPointerDown`** — only `onPointerMove → setHovered`, `onPointerOut`, `onClick → setSelected` (`:116-124`). Dragging an already-placed container means adding a pointer-down that starts a move and hiding that instance while dragging. `key={capacity}` (`:113`) with `capacity = plan.placements.length || 1` means a **same-count move does not remount** the mesh; only place/unplace does. Fine.

**`BayPlanView.tsx` (186 LOC) is a DOM CSS-grid, not SVG/canvas.** Cells are keyed `${row}:${tier}` within the currently selected `bayFilter` bay (`:38-49`, `:159`); handlers are `onMouseEnter`/`onMouseLeave`/`onClick` only. So the 2D fallback can only target slots in the bay already on screen, and it cannot disambiguate a 20' fore/aft half (moot today — no odd bays). Keeping the `div` grid means the click-to-place fallback is small; the SVG rewrite is not needed.

**`Sidebar.tsx` is 261 LOC and breaches the 200-LOC rule.** It owns the unplaced list (`:211-230`), the window `mouseup` cancel (`:76-81`), a global ArrowLeft/Right bay keydown handler (`:62-72` — a competing global key handler to account for when adding Esc/undo shortcuts), and the empty-slot display (`:200-205`). Split the unplaced list into its own component as part of this phase rather than growing the file.

**Decision needed while implementing (flagged in plan.md):** `EmptySlotPicker` restricted to "the current drag's valid + blocked slots" would leave the picker **empty when nothing is dragged**, breaking today's hover-to-inspect behaviour (`Sidebar.tsx:200-205` renders "Empty slot …"). Recommended: keep the full empty-slot picker mounted when not dragging, and swap to the restricted valid/blocked set only while dragging. Same raycast cost, no regression.

**Perf (spec §4.6/§9):** compute `validSlotsFor` **once per drag start**, not per pointer move; BBC is ~900 slot-tiers × 9 cheap checks. Keep everything instanced.

**Accessibility (WCAG 2.5.7, AA in 2.2) — DECIDED 2026-09-16: pick-and-place ships in this phase, it is not deferred.** Every drag operation must also be achievable *without dragging*; a keyboard-only alternative does **not** satisfy it — the operation must be completable with a **single pointer and no drag gesture**. So this phase revives the superseded `phase-03-interactive-2d-bay-plan.md`'s `pickedId` design as the **primary** mechanism: pick an item (click its row in the Unplaced list, or focus it and press Enter), placeholders and the ghost appear exactly as during a drag, then **click a placeholder in 3D or a bay cell in 2D** to place it. Drag becomes sugar on top of the same commit path. `pickedId` and `dragging` must share **one** resolver and **one** store action — two divergent commit paths is the failure mode this decision creates, and the risk table guards it. Esc cancels a pick exactly as it cancels a drag.

## Requirements

**Functional**
- `placeholders.ts`: `validSlotsFor(model, plan, container) → SlotDef[]` (where `canPlaceContainer.ok`) plus `blockedSlots` with each slot's first reason, for red hover tooltips.
- `SlotPlaceholders.tsx`: one instanced translucent box over each valid slot while `dragging.kind === "container"`, positioned from `SlotDef.center` (never recomputed).
- `EmptySlotPicker` reads positions from `model.slots` and is restricted to the current drag's valid + blocked slots; unchanged (full empty-slot set) when not dragging.
- `GhostContainerPreview`: colour and tooltip derived from `canPlaceContainer`; keep `raycast={() => null}`.
- Commit on pointer-up over a slot via a `usePlanDraftStore` action. Invalid → D1 behaviour (hard rules block with the reason surfaced; overridable limits warn).
- Cancel on release outside a slot (existing behaviour) and on Esc.
- Dragging an already-placed container: **pointer-down past a small drag threshold** (a few px) on a `ContainerInstances` instance starts `moveContainer`, hiding that instance while dragging. A click that does not move past the threshold keeps today's meaning — it selects. <!-- Updated: Validation Session 1 - drag threshold decided -->
- **Pick-and-place — the WCAG 2.5.7 path, primary:** click a row in the Unplaced list (or focus it and press Enter) to *pick* an item with no drag gesture. Placeholders and the ghost appear exactly as during a drag. Click a 3D placeholder, or a bay cell in 2D, to place it. Esc cancels the pick. Both input paths run the same `canPlaceContainer` gate and the same store action, so a pick can never commit something a drag would reject.
- 2D bay plan: click-to-place into the highlighted slot, same checks — works with a **picked** item as well as with an active drag.
- `Ctrl/Cmd+Z` undo, `Shift+Z`/`Ctrl/Cmd+Shift+Z` redo.
- Sidebar hint while dragging ("N valid slots"); update the stale "Drop doesn't place it yet" copy (`:215`).
- D3: pause playback on drag start.
- Bay filter and the on-deck/under-deck toggles keep applying to placeholders.
- Generic/approximate areas carry the badge + warning (D4) — the container path only needs the placeholder/ghost to surface the warning, since container slots carry no `source: "generic"` flag today.

**Non-functional**
- Every code file < 200 LOC — including the `Sidebar` split.
- No new npm dependency; no DnD library (research verified none fits: canvas has no DOM rects to register as droppables, and drei's `useDrag` no longer exists in drei 10).
- Placeholders/ghost/picker all tint and gate from `canPlaceContainer` — no UI-only placement rule anywhere.
- No DOM/interaction tests; the pure parts (`placeholders.ts`) get node-env unit tests.
- 60 fps target preserved: instanced meshes only, `validSlotsFor` memoised per drag start.

## Architecture

```
drag start (Sidebar list | ContainerInstances pointer-down)
  |  OR pick without dragging (click / Enter on the Unplaced row)   <- WCAG 2.5.7 path
  → dragging state = {kind: "container", id}   |   pickedId = id    [usePlanStore]
  → pause playback (D3); OrbitControls.enabled = false (drag only)
  → validSlotsFor(model, plan, container)  <- memoised once per drag/pick   [engine/placement/placeholders.ts]
      -> canPlaceContainer per slot            <- SAME predicate as validation
  → SlotPlaceholders (valid, green) + EmptySlotPicker (valid + blocked)
      + GhostContainerPreview (tint + first reason from the hovered slot)
  → ONE commit resolver, two triggers:
       pointer-up over a slot (drag)  |  click on a placeholder or bay cell (pick)
      → usePlanDraftStore.placeContainer | moveContainer   (validate-then-mutate)
      → plan changes → validatePlan re-runs → undo/redo available
  → pointer-up elsewhere / Esc → cancel and restore instance visibility
```

Boundary: `engine/placement/placeholders.ts` is pure (no three/react) and unit-tested; every `.tsx` here is presentation plus store wiring.

## Related Code Files

**Create**
- `frontend/src/engine/placement/placeholders.ts` — `validSlotsFor`, `blockedSlots`.
- `frontend/src/features/viewer3d/SlotPlaceholders.tsx` — instanced valid-slot boxes.
- `frontend/src/features/panels/UnplacedCargoList.tsx` — extracted from `Sidebar.tsx` (the drag source).
- `frontend/src/engine/placement/__tests__/placeholders.test.ts` — pure node-env tests (no DOM test file is created anywhere).

**Modify**
- `frontend/src/features/viewer3d/EmptySlotPicker.tsx` — **untracked**: read from `model.slots`; restrict during drag.
- `frontend/src/features/viewer3d/GhostContainerPreview.tsx` — **untracked**: tint + reason from `canPlaceContainer`.
- `frontend/src/features/viewer3d/ContainerInstances.tsx` — pointer-down to start a move; hide the dragged instance.
- `frontend/src/features/viewer3d/VesselScene.tsx` — mount `SlotPlaceholders`; disable OrbitControls while dragging.
- `frontend/src/features/bayplan/BayPlanView.tsx` — click-to-place into the highlighted slot; replace the `TODO(phase-2)` at `:17`.
- `frontend/src/features/panels/Sidebar.tsx` — use `UnplacedCargoList`; drag hint; fix the stale copy; undo/redo + Esc keys.
- `frontend/src/store/usePlanStore.ts` — drag state for the move case (`dragging` with kind, or reuse `draggingContainerId`), keep `resetForVesselChange` covering it.
- `frontend/src/lib/colors.ts` — add `valid`/`invalid` highlights.
- `frontend/src/styles.css` — drop-target/placeholder affordances (existing tokens `--signal` #E0A030, `--error` #B83A2E are the right tints); no `touch-action`/`pointer-events` rules are needed for the canvas path.

**Delete** — none.

## Implementation Steps

1. Read `EmptySlotPicker.tsx`, `GhostContainerPreview.tsx`, `ContainerInstances.tsx`, `VesselScene.tsx`, `all-slots.ts`, `lib/colors.ts` before editing; both picker files are untracked, so confirm the pre-flight baseline commit landed first (see `plan.md`).
2. Add `valid`/`invalid` colours to `lib/colors.ts` (`HIGHLIGHT`).
3. Write `engine/placement/placeholders.ts`: `validSlotsFor(model, plan, container)` mapping `model.slots` through `canPlaceContainer`, and `blockedSlots` returning `{slot, reason}` using the first blocking reason. Keep it pure and allocation-light; add unit tests (all slots for a 40' dry box on MV Demo Horizon exclude occupied/full stacks; a reefer yields only plug tiers; **a 20' box yields `[]` on both vessels** — the invariant test).
4. Write `SlotPlaceholders.tsx` mirroring `EmptySlotPicker`'s instanced pattern: `useMemo` the valid set once per drag, write translation-only matrices from `SlotDef.center`, `key={capacity}` remount, translucent green material, `raycast={() => null}` so it never steals the pick.
5. Rework `EmptySlotPicker.tsx` to take its slots from `model.slots` (filtered to empty) instead of recomputing `emptySlots`, and to accept an optional restricted set (`valid ∪ blocked`) used while dragging. Keep the pitch-sized pick box and its comment about zero dead zones; add a one-line note that a 20'-grid vessel will need a size-aware volume.
6. Rework `GhostContainerPreview.tsx`: resolve the hovered slot's reason from the same `validSlotsFor`/`blockedSlots` output, tint green/red, and surface the reason text (tooltip/label). Keep `raycast={() => null}`.
7. `VesselScene.tsx`: mount `SlotPlaceholders`; read the controls via `useThree(s => s.controls)` and set `enabled = false` while a drag is active.
8. Wire the commit as **one resolver shared by both input paths**. Given a target (`hoveredSlot`, or a bay cell) plus either an active drag or a `pickedId`, it calls the same store action: on `{ok:false}` with a hard reason do nothing and surface the reason (D1); on a warning-only reason apply and record it. Cancel on release elsewhere and on Esc; Esc must also clear `pickedId`. Do not write a second commit path for the picked case. Remove the blind `setDraggingContainer(null)`-only path in `Sidebar.tsx:76-81` in favour of the commit-aware handler.
9. Dragging a placed container: add `onPointerDown` to `ContainerInstances`' mesh that starts a move for `idAt(e)` **only after a small drag threshold (a few px)** so a plain click still selects (Validation Session 1). Hide that instance while dragging (filter it out of `items`, or set its scale to zero); keep OrbitControls disabled for the gesture. Confirm the `key={capacity}` remount behaviour is unchanged for a same-count move. <!-- Updated: Validation Session 1 - drag threshold decided -->
10. Pause playback on drag start (D3) via `usePlanStore.pausePlayback`.
11. Extract `UnplacedCargoList.tsx` from `Sidebar.tsx` (the `:211-230` section plus its drag handlers), bringing `Sidebar.tsx` back under 200 LOC; update the stale "Drop doesn't place it yet (E3-04c/d)" copy and add the "N valid slots" hint while dragging.
12. Add the keyboard layer in one place: `Ctrl/Cmd+Z` undo, `Shift+Z` redo, Esc cancel — guard against typing targets the way the existing bay-nav handler does (`Sidebar.tsx:64-66`), and reconcile with the ArrowLeft/Right bay navigation so the two do not fight.
13. Pick-and-place wiring: add `pickedId` to `usePlanStore` (alongside the drag state, cleared by `resetForVesselChange`); picking from the Unplaced list on click **and** on Enter; rendering the placeholder set from `pickedId` exactly as from `dragging`. Then make a target click — a bay cell in `BayPlanView.tsx`, or a 3D placeholder — place the **picked or dragged** item (same gate, reason on rejection) and highlight the valid target. This is the WCAG 2.5.7 single-pointer alternative: verify explicitly that a placement can be completed **click-pick → click-target with no drag gesture at all**, in 2D and in 3D, and that Esc cancels the pick.
14. Unit-test the pure parts (`placeholders.test.ts`). There is no DOM test capability and none is to be added, so the interaction path is verified manually.
15. Run `npm run typecheck` and `npm test`; then manually walk the spec's acceptance script on BBC SAO PAULO (below) and record the result.

## Todo List

- [ ] Confirm the untracked viewer3d baseline is committed before editing
- [ ] `HIGHLIGHT.valid`/`invalid` in `lib/colors.ts`
- [ ] `engine/placement/placeholders.ts`: `validSlotsFor` + `blockedSlots`
- [ ] Unit test: 20' box -> `[]` on both vessels (documents the no-odd-bay invariant)
- [ ] Unit test: 40' dry box excludes occupied/full stacks; reefer -> plug tiers only
- [ ] `SlotPlaceholders.tsx` (instanced, translation-only, `raycast={() => null}`)
- [ ] `EmptySlotPicker` re-sourced from `model.slots`; restricted set while dragging; full set otherwise
- [ ] `GhostContainerPreview`: green/red from `canPlaceContainer` + first reason
- [ ] `VesselScene`: mount `SlotPlaceholders`; OrbitControls `enabled=false` while dragging
- [ ] Commit on pointer-up; D1 block/warn behaviour; cancel elsewhere + Esc
- [ ] `pickedId` in `usePlanStore`; click **and** Enter pick from the Unplaced list
- [ ] Place a picked item by clicking a 3D placeholder or a 2D bay cell (no drag gesture)
- [ ] One commit resolver shared by drag and pick (same store action, same gate)
- [ ] Verify WCAG 2.5.7 end to end: full placement single-pointer with no drag, in 2D and 3D
- [ ] Drag a placed container via `ContainerInstances` pointer-down, instance hidden while dragging
- [ ] D3: pause playback on drag start
- [ ] Split `UnplacedCargoList.tsx` out of `Sidebar.tsx` (get under 200 LOC); fix stale copy; add hint
- [ ] Undo/redo/Esc keyboard handling, reconciled with the ArrowLeft/Right bay nav
- [ ] `BayPlanView` click-to-place fallback (works with no drag gesture — WCAG 2.5.7)
- [ ] `npm run typecheck` clean; `npm test` 396/396 + new tests green
- [ ] Manual acceptance script on BBC SAO PAULO recorded (see Success Criteria)

## Success Criteria

**Spec acceptance, quoted verbatim (spec §7 Phase C):**
> drag an unplaced 40' box onto BBC bay 22 on deck and it lands in that slot. A 20' box shows no placeholders in 40' bays. A reefer shows only plug tiers. Undo restores it.

**Repo-specific additions**
- `cd frontend && npm run typecheck` passes.
- Existing suite still passes: 56 files / 396 tests. (`plan.md` records the brief's "395 of 396" figure; the suite is 396/396 today, and the `validate-plan.test.ts:66` wall-clock assertion is flaky — an intermittent failure there is pre-existing, not this phase's.)
- `engine/__tests__/all-slots.test.ts` (5 tests) and `engine/__tests__/slot-helpers.test.ts` stay green — they pin the slot-expansion and half-bay mapping the picker now consumes.
- No new dependency; no test toolchain added; no DOM test file created.
- `Sidebar.tsx` is under 200 LOC after step 11.
- Concretely verifiable on BBC SAO PAULO: a 40' box dragged over bay 22 resolves to a `bay: 22` slot; a 20' box produces zero placeholders and cannot be dropped anywhere; a REEFER resolves only to a bay/tier in `spec.containers.stowage.reefer` (bays 34/30/26, on-deck tiers 82/84). Note the bay-22 case also exercises the ~0.18 m boundary overlap — if the resolved bay is 18 or 26 instead of 22, aim ~0.3 m inboard of the bay centre and record the observation rather than changing the tiling.
- After a successful drop: `validatePlan` re-runs (violation list updates), the container leaves `plan.unplaced`, and `undo` restores both.
- **WCAG 2.5.7 satisfied, verified by hand:** a container can be picked with one click and placed with a second click — no drag gesture anywhere in the sequence — in both the 3D view and the 2D bay plan, and Esc cancels a pick.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| BBC's ~0.18 m bay-boundary overlap resolves the neighbouring bay | Medium | Medium | Expected and documented; place from the bay centre. Do not shrink the pick box — that reintroduces dead zones. Revisit only with a real 20'-grid vessel. |
| OrbitControls steals the drag / camera spins mid-drag | High | Medium | `enabled = false` while dragging (step 7) — `makeDefault` on `VesselScene.tsx:55` is the lever. |
| Pointer released outside the canvas loses the commit or leaves drag state stuck | Medium | Medium | Keep the window-level `mouseup` cancel; resolve the commit from the current `hoveredSlot` at release; always clear drag state in a `finally`-style path. |
| `validSlotsFor` recomputed per pointer move → jank on large grids | Medium | Medium | Memoise per drag start (spec §9); on a 20k-slot vessel this is the difference between usable and not. |
| Placeholder tint disagrees with the violation list (UI-only rule creeping in) | Medium | High | Both read `canPlaceContainer`; add the test in Phase B step 12 asserting the reason string matches; grep for any local `ok` computation in `.tsx` during review. |
| Restricting `EmptySlotPicker` to the drag set breaks hover-to-inspect (Sidebar "Empty slot …") | Medium | Low | Keep the full empty-slot picker mounted when not dragging (recommended above); verify the Sidebar line still renders. |
| `Sidebar` split changes the competing global keydown behaviour | Low | Low | Move the handlers, do not rewrite them; verify ArrowLeft/Right bay nav still works and Esc/undo do not hijack typing. |
| Untracked picker files get edited then lost / the baseline commit mixes concerns | Low | Medium | Pre-flight commits first (`plan.md`), feature work after. |
| Two input paths diverge — the pick path grows its own commit logic and drifts from the drag path's gate | Medium | High | One resolver, one store action, one `canPlaceContainer` gate (steps 8 + 13). Review with a grep for any second `placeContainer`/`moveContainer` call site in `.tsx`. The WCAG verification (Success Criteria) exercises both paths to the same target and compares the outcome. |
| `pickedId` and `dragging` both set (pick then start a drag) leaves ambiguous UI state | Low | Medium | Make them mutually exclusive in the store: setting one clears the other (a single `dragOrPick` field is acceptable if it reads cleanly). Esc clears both. |

## Security Considerations

- No network, no auth, no persistence added; the drop writes to client-side state only. The FastAPI backend stays untouched by this phase.
- The drop is gated by the same predicate the validator uses, so an invalid placement cannot be committed by any UI path — including the 2D fallback and the move case. Never bypass the check for a "quick" case.
- Keep `raycast={() => null}` opt-outs on the ghost, placeholders and hull so no overlay can intercept unrelated picks (a correctness *and* an input-integrity concern, not just a perf one).
- Esc/undo handling must ignore events originating in `INPUT`/`TEXTAREA` (the existing pattern at `Sidebar.tsx:64-66`) so a future text field cannot have keystrokes hijacked.
- Keep the "Planning aid only. Verify stability on the approved loading computer." notice once drops become real edits.
- No secrets involved; do not add `.env*` or credentials while committing the pre-flight baseline.

## Next Steps

- Phase D (`freeRegionsFor`, `AreaPlaceholders`, `AreaDropPlane`, `GhostBreakbulkPreview`) reuses this phase's drag state, tint constants, commit resolver and `pickedId` path; the 0.5 m snap (D2) and R-key rotation belong to it.
- Phase E owns the hatch-opening check (blocked on missing data — see `plan.md`), adjustable pontoon levels, mixed stacking, multi-select/nudging, and the Playwright drag scenarios.
- Keyboard *movement* of a picked item (arrow keys = snap step) is Phase E's "multi-select + keyboard nudging", not this phase — WCAG 2.5.7 needs single-pointer placement only, which click-pick → click-target satisfies.
