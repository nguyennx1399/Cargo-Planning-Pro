# Phase C — Container placeholders + drop

## Context Links

- Spec: `plans/reports/confluence-260916-1647-drag-drop-stowage-placeholders-feature-plan.md` §4.6 (`validSlotsFor`), §6 (UX flow), §7 Phase C, §9 (risks), §10 file map.
- Depends on: [phase-01-stowage-model-foundation.md](phase-01-stowage-model-foundation.md) (model, `coords`) and [phase-02-placement-checks-and-editable-plan.md](phase-02-placement-checks-and-editable-plan.md) (`canPlaceContainer`, `usePlanDraftStore`).
- Recon: `plans/reports/scout-260916-1628-viewer3d-placeholders.md` (component tree, picking, OrbitControls), `plans/reports/researcher-260916-1628-dnd-intent-and-patterns.md` (why no DnD library; WCAG 2.5.7).
- Overview: [plan.md](plan.md).

## Overview

- **Priority:** P2
- **Size:** ~1.5 days
- **Status:** **implemented (engine/store half in Phase C part 1; UI half 2026-09-16), reviewed 7.5/10, review fixes applied.** The manual browser click-through is the ONLY remaining step — it is the two unticked boxes in the Todo List below and the script is `plans/reports/manual-click-through-260916-phase-c.md`. Final run state: `npm run typecheck` clean, `npm run build` succeeds, 70 files / 541 tests green. Review: `plans/reports/code-reviewer-260916-phase-c-ui-review.md`.
- **Completes** the A–C scope: after this phase a 40' box can be dragged from the Unplaced list onto a valid empty slot and the plan updates with undo.

**From the Phase C UI review (`plans/reports/code-reviewer-260916-phase-c-ui-review.md`, 7.5/10), fixes applied 2026-09-16.** <!-- Updated: Phase C review fixes -->
- **H1 (stale `hoveredSlot`) — fixed twice over.** Gesture start clears `hoveredSlot` (`usePlanStore.ts:94-101`), *and* the window release now commits only when the pointer is over the canvas (`Sidebar.tsx:82-90`: `e.target.closest("canvas")`), else cancels. A click meant to pick can no longer place a box on a slot the pointer is not over.
- **H2 (sibling-half ambiguity) — fixed.** The pick volume is sized by the candidate (`EmptySlotPicker.tsx:84-95`): `DIM.len20` for a 20' box, the pitch box (`DIM.len40 + LAYOUT.bayGap`) for 40'. Measured overlapping sibling-half pairs **1520** (demo) / 1554 (BBC) → **0**, at the cost of a 0.076 m dead zone between halves. (Reconciled: the "2400" figure that circulated was a *box* count — every demo model slot involved in ≥1 overlap — reported as a pair count. See the note in correction 2c.)
- **M1** — the picker now honours the deck toggles and bay filter through `slotVisible` (`lib/drop-verdict.ts:41-55`), the same rule `SlotPlaceholders` uses, so a box cannot be dropped into a bay or deck the planner cannot see. **M3** — the release path surfaces an accepted-with-warnings (amber) drop (`Sidebar.tsx:98-101`), matching the 2D notice. **M4** — the hover verdict is memoised per `(vessel, plan, container, slot)` and the stripped preview per `(plan, candidate)` (`drop-verdict.ts:69-137`). **M6** — the notice clears when the gesture's subject changes (`Sidebar.tsx:106-110`).
- **Recorded, not fixed (low impact, listed in the manual script's "Known gaps"):** M2 (a rejected 3D pick's reason is visible only while the pointer stays on the slot) and M5 (a drag-move's trailing `onClick` can re-select a different box). Lows also stand: `HIGHLIGHT.ghost` is dead, `bayIndex`/`gotoBay` duplicated, the window `mouseup` ignores `e.button` / no `pointercancel`.

## Key Insights

**The pick/raycast half already exists and is wired in.** `EmptySlotPicker.tsx` (60 LOC, **untracked in git**) renders one invisible `InstancedMesh` over `emptySlots(vessel, plan.placements)` (`engine/all-slots.ts:22-25`), writes translation-only matrices from `slotToPosition`, and sets `hoveredSlot` on `onPointerMove` / clears on `onPointerOut`. `VesselScene.tsx:51-52` mounts it and `GhostContainerPreview` inside the attitude group. What is missing is the commit (E3-04c/d) — `Sidebar.tsx:76-81` clears `draggingContainerId` on window `mouseup` and nothing consumes `hoveredSlot`. `Sidebar.tsx:215` states this in the UI copy and must be updated. <!-- Pre-implementation snapshot, kept as written; all three gaps are now closed: the picker is re-sourced from `model.slots` and the release commits through `commitPlacement`, the stale copy is gone, and both picker files are tracked. See the Todo List. -->

**Tiling math — verified against both real vessels, because the pick volume's correctness is the whole snapping mechanism.**
- Pick box is `[DIM.len40 + LAYOUT.bayGap, LAYOUT.tierPitch, DIM.width + LAYOUT.rowGap]` = `[13.392, 2.65, 2.498]` (`EmptySlotPicker.tsx:56`).
- **MV Demo Horizon: exact tiling.** Its bay pitch *is* `DIM.len40 + LAYOUT.bayGap` = 13.392 (`geometry.ts:60-62` fallback), and `rowCenterZ` uses `DIM.width + LAYOUT.rowGap` = 2.498 — so boxes tile with zero dead zones and no overlap.
- **BBC SAO PAULO: up to 0.402 m overlap — worst case at the vessel's MINIMUM bay pitch, not the mean.** Declared `bay_center_x_m` = 119.06, 105.97, 92.98, 79.89, 66.90, 53.81, 40.80, 27.74, 14.75, so adjacent pitches are 13.09, 12.99, 13.09, 12.99, 13.09, 13.01, 13.06, 12.99 — **not uniform**. Against the 13.392 m pick box: min pitch 12.99 → **0.402 m total (0.201 m per side)** is the true worst case; mean pitch 13.0388 → 0.353 m, which is where the earlier "~0.36 m / ~0.18 m per side" came from. Those were the same quantity quoted at different pitch statistics; reconciled by the final tester run. A pointer within ~0.2 m of a bay boundary can therefore resolve to the **adjacent bay** — the live form of the hazard both recon reports flagged. Mitigation unchanged: aim ~0.3 m inboard of a bay centre and record what you see.
- **Vertically there are NO dead zones.** `tierCenterY` (`geometry.ts:74-86`) always steps by exactly `LAYOUT.tierPitch` for a given bay (only the per-bay *base* varies), so tier centres tile exactly with the 2.65 m pick box. The recon's open question about vertical dead zones is answered: not a risk.
- **Rows: no risk either.** `rowCenterZ` ignores the spec's `row_pitch_m: 2.5` and always uses `DIM.width + LAYOUT.rowGap` = 2.498 = the pick box width.

**The 20'-in-odd-bay hazard: FIXED 2026-09-16 — this block previously said the opposite, and that was wrong.** <!-- Updated: 20' workstream + Phase C part 2 -->
- `sizeFitsBay` (`placement-checks.ts:14-15`) sends 20' boxes to **odd** bays and 40'/45' to even ones — the repo's addressing scheme for a 20' box occupying one half of its parent 40' bay (`slot-helpers.ts:30-35` `bayPosition`).
- Phase A built `StowageModel.slots` from `allSlots(vessel)` → `vessel.stacks[].bay`, which holds only EVEN bays, so a 20' box had **no slots at all** — `validSlotsFor(20')` returned `[]` on both vessels, while `validatePlan` accepted the same placement. That was a genuine defect, not correct behaviour, and the earlier instruction to "add a unit test asserting the 20' result is `[]`" was pinning a bug. **Do not write that test.**
- **Now:** `slot-enumeration.ts` emits the odd halves the validator's own `bayPosition` maps onto each 40' stack bay (demo 800 → 2400 slots, BBC 447 → 1341), `lib/geometry.ts` handles odd-bay centres and declared deck bases, and `occupancy.ts` sizes footprints by bay parity. `validSlotsFor(20')` returns **122** slots on MV Demo Horizon and **18** on BBC (all odd); 400/400 of the demo's previously-unplaced 20' boxes and 19/20 of BBC's now have ≥1 error-free position.
- **The correct pinned invariant is "odd bays only"**, not `[]`: a 40' candidate's valid set is 100% even bays, a 20' candidate's is 100% odd. `twenty-foot-slot-parity.test.ts` + `slot-enumeration.test.ts` + `predicate-report-parity.test.ts` hold it, with **0 predicate/report mismatches** across every slot on both vessels for 20', 40' and 20'-reefer.
- `naiveFillPlan` (the container packer) is deliberately **untouched**, so the demo's 20' boxes stay unplaced on load — placing them by hand is the feature. The demo plan and its report are byte-identical pre/post (SHA-256 compared).
- **2D limitation (Phase C part 2):** the bay plan addresses whole (even) bays only — its selector lists `vessel.bays` — so a 20' half-bay drop is possible in 3D only. Recorded, not fixed here.

**`HIGHLIGHT` has no valid/invalid tint yet.** `lib/colors.ts:66-70` defines only `hover: #FFFFFF`, `selected: #FFD23F`, `ghost: #42A5F5`. Add `valid`/`invalid` constants there and tint the ghost + placeholder material from `canPlaceContainer`'s severity — not from a UI-local rule (validator-first). <!-- Done in Phase C part 1: `valid` #2E7D5B, `warning` #E0A030, `invalid` #B83A2E, mapped from one verdict object in `lib/drop-verdict.ts`. -->

**Three-state tint, not two (Phase B deviation, approved 2026-09-16).** D1 makes overridable limits (`breakbulk_overweight`, `breakbulk_over_pressure`) `warning` severity = droppable, while the plan-wide report still reports them as `error` (its message strings are frozen). So the drop UI must distinguish three outcomes or it will contradict itself:
- `valid` + no reasons → **green** (place it).
- `valid` + warning reasons → **amber** + the reason in the tooltip (droppable, but it *will* appear in the violations list — which is exactly what the spec's D1 option (b) describes as "shows red and appears in the violations list"). A green ghost here would promise a clean placement the report then flags.
- blocked → **red** + the first blocking reason (no drop; D1 hard rules).
Add a `warning` tint alongside `valid`/`invalid` in `HIGHLIGHT`. Phase B measured a full slot sweep at ≈1.05 ms for BBC's 447 real slots (≈2.35 µs/slot, dominated by building `no_floating` tooltip strings for the ~437 blocked ones) — above the spec's "well under a millisecond" aspiration, so **memoise per drag start and build tooltip strings lazily, only for the hovered slot.** <!-- Updated 2026-09-16: the 20' reopen took BBC's grid to 1341 slots, so the sweep now measures ≈2-6 ms (clock-guarded at 50 ms in `placeholders.test.ts:153-160`); the memoisation is what keeps the per-gesture cost there, and the hover path uses `blockedReasonFor`/`verdictForSlot` for one slot only. -->

**OrbitControls will fight the drag.** `VesselScene.tsx:55` sets `makeDefault`, so `useThree(s => s.controls)` yields the controls instance; `enabled = false` while `draggingContainerId` is set is the intended lever and is currently unused. Left-drag orbits today, so without this a canvas drag rotates the camera instead of placing. <!-- Done: `VesselScene` locks the controls for a drag gesture; the reviewer confirmed from the drei/three-stdlib sources that the handlers and the `useFrame` update both early-return on `enabled === false`. -->

**Hull picking is already disabled** — `Hull.tsx` sets `raycast={() => null}` on every path (`:124`, `:126`) and traverses the GLB doing the same (`:79-83`). Spec §9's "disable the hull while dragging" is already satisfied; keep it.

**`ContainerInstances.tsx` has no `onPointerDown`** — only `onPointerMove → setHovered`, `onPointerOut`, `onClick → setSelected` (`:116-124`). Dragging an already-placed container means adding a pointer-down that starts a move and hiding that instance while dragging. `key={capacity}` (`:113`) with `capacity = plan.placements.length || 1` means a **same-count move does not remount** the mesh; only place/unplace does. Fine.

**`BayPlanView.tsx` (186 LOC) is a DOM CSS-grid, not SVG/canvas.** Cells are keyed `${row}:${tier}` within the currently selected `bayFilter` bay (`:38-49`, `:159`); handlers are `onMouseEnter`/`onMouseLeave`/`onClick` only. So the 2D fallback can only target slots in the bay already on screen, and it cannot disambiguate a 20' fore/aft half (the recorded Phase C part 2 limitation — a half-bay drop is 3D-only). Keeping the `div` grid means the click-to-place fallback is small; the SVG rewrite is not needed.

**`Sidebar.tsx` is 261 LOC and breaches the 200-LOC rule.** It owns the unplaced list (`:211-230`), the window `mouseup` cancel (`:76-81`), a global ArrowLeft/Right bay keydown handler (`:62-72` — a competing global key handler to account for when adding Esc/undo shortcuts), and the empty-slot display (`:200-205`). Split the unplaced list into its own component as part of this phase rather than growing the file. <!-- Done, and it took four extractions: UnplacedCargoList + ViewOptionsPanel + ProjectCargoPanel + ContainerInspector. `Sidebar.tsx` is 190 lines today (176 LOC at review time; the post-review H1 canvas gate added lines). -->

**Decision needed while implementing (flagged in plan.md):** `EmptySlotPicker` restricted to "the current drag's valid + blocked slots" would leave the picker **empty when nothing is dragged**, breaking today's hover-to-inspect behaviour (`Sidebar.tsx:200-205` renders "Empty slot …"). Recommended: keep the full empty-slot picker mounted when not dragging, and swap to the restricted valid/blocked set only while dragging. Same raycast cost, no regression. <!-- Resolved as recommended, with one refinement: idle = the 40' grid the bay selector addresses (`isFortyBay`), in hand = the size-filtered empty set; hover-to-inspect survives (`EmptySlotPicker.tsx:46-66`). -->

**Tooltip content — decided 2026-09-16.** On a **blocked** target (red): surface the first blocking reason only (`reasons[0]`); that is what `commitPlacement` returns for a hard block. On an **accepted** target (green/amber): amber carries the warning reasons, prefixed so it reads as *recorded, not fatal* — the planner must understand the drop will appear in the violations list. `PlacementResult` returns blocking and warning reasons together; do not dump the whole list into a red tooltip, and never show a warning as the reason a drop was refused.

**`validSlotsFor` and `blockedSlots` partition the model — they are NOT the picker's set.** Test-pinned: `valid.length + blocked.length === model.slots.length`, disjoint, and together they include OCCUPIED slots. Anything that renders pick volumes must use empty-slot semantics (`model.slots` minus `plan.placements`), or `hoveredSlot` will win the raycast over `hoveredId` and regress container hover.
`StowageModel.slotByKey` (and `SlotDef.key`) uses `"bay|row|tier"`; `engine/all-slots.ts:17`'s private `slotKey` uses `"bay:row:tier"` (and `validation-context` has its own `bay|row|tier`). They are not interchangeable: `slotByKey.get(<an all-slots key>)` silently returns `undefined` — a lookup that fails open, not closed. Rule for this phase: **`StowageModel.slotByKey` is authoritative**; when converting an `emptySlots()` result into a model lookup, rebuild the key as `` `${slot.bay}|${slot.row}|${slot.tier}` ``. Better still, drive the picker from `model.slots` directly (which this phase already requires) and drop the `emptySlots` dependency from the drag path.
  - **Correction (Phase C part 2b, 2026-09-16): the in-gesture set is the EMPTY slots of the bays the candidate's SIZE can use — valid AND blocked — not `valid ∩ empty`.** Spec §6 wants red hover feedback with `reason[0]` on a refused empty slot, which `valid ∩ empty` made unreachable. The `sizeFitsBay` filter that remains is not a placement rule (the commit gate is still `canPlaceContainer`) but the parity guard that keeps the pick volumes from overlapping across parities: a 40' box's volume extends 6.7 m off its own centre, so a neighbouring 20' HALF's volume reaches further toward the camera, wins the raycast, and leaves the valid 40' slot underneath unreachable.
  - **And the volume is sized BY THE CANDIDATE (correction 2c, same day, review H2):** a 40' candidate keeps the pitch box `DIM.len40 + LAYOUT.bayGap` (zero dead zones; measured 0 overlapping pairs on MV Demo Horizon, and BBC keeps the documented 0.402 m neighbour-bay overlap that buys the no-dead-zone tiling — do not shrink it, see Risks), while a **20' candidate gets `DIM.len20`** — measured before: 1520 (demo) / 1554 (BBC) overlapping sibling-half pairs with a 7.258 m x-overlap, so three's distance sort let the CAMERA side choose the half; measured after: **0 overlapping pairs on both vessels**, at the cost of a 0.076 m dead zone between sibling halves. Measured gesture-set sizes on the loaded demo plans: 40' → 314 (demo) / 337 (BBC), all even; 20' → 1600 / 894, all odd. <!-- 2026-09-16 reconciled by the final tester run: **1520 is correct** for the demo. The "2400" still quoted in `EmptySlotPicker.tsx`'s comment and in review §H2 is a BOX count (every model slot involved in ≥1 overlap = exactly the demo model's 2400 slots) reported as a PAIR count. Both reproduced: the pair definition that also yields BBC's 1554 gives demo 1520 (degree histogram {1:160, 2:1440} → (160+2880)/2). AABB-vs-x-only (184800) and candidate-set variants were ruled out; the "after = 0" result was never in dispute. The stale 2400 in the source comment is a Phase E cleanup — left unfixed here so the verified tree stays frozen. -->

**Per-stack occupancy: every hold a column passes through is blocked.** `containerOccupancy` maps an under-deck stack into *each* overlapping hold area, so a stack blocks both the tweendeck and the tank top below it. Its guard test is crafted, not real — on BBC the tweendeck and tank-top rects are disjoint, so no app vessel exercises the multi-area loop.

**`emptySlots`/`slotByKey` performance:** `validSlotsFor` must be memoised per drag start (spec §9), and every lookup goes through `slotByKey` (a `Map`), never a linear scan over `model.slots`.

**Forbidden-zone leftovers:** `engine/breakbulk-forbidden-zones.ts` now has no production caller (only its own 5 tests). Its `XZone` type is still imported by `naive-fill-breakbulk.ts`. Do not add callers; deletion is booked for Phase E.

**Accessibility (WCAG 2.5.7, AA in 2.2) — DECIDED 2026-09-16: pick-and-place ships in this phase, it is not deferred.** Every drag operation must also be achievable *without dragging*; a keyboard-only alternative does **not** satisfy it — the operation must be completable with a **single pointer and no drag gesture**. So this phase revives the superseded `phase-03-interactive-2d-bay-plan.md`'s `pickedId` design as the **primary** mechanism: pick an item (click its row in the Unplaced list, or focus it and press Enter), placeholders and the ghost appear exactly as during a drag, then **click a placeholder in 3D or a bay cell in 2D** to place it. Drag becomes sugar on top of the same commit path. `pickedId` and `dragging` must share **one** resolver and **one** store action — two divergent commit paths is the failure mode this decision creates, and the risk table guards it. Esc cancels a pick exactly as it cancels a drag.

## Requirements

**Functional**
- `placeholders.ts`: `validSlotsFor(vessel, plan, container) → SlotDef[]` (where `canPlaceContainer.ok`) plus `blockedSlots` with each slot's first reason, for red hover tooltips.
  - **Signature deviation approved (Phase B, 2026-09-16):** the predicates take the vessel as a **trailing argument** — `canPlaceContainer(model, plan, container, slot, vessel)` and `canPlaceBreakbulk(model, plan, item, pose, vessel)`. The phase file's 4-arg form is not implementable: `StowageModel` carries no vessel (no `reefer_tiers` for `plugOk`, no `rows`/`bays`/`container_layout`), and the `containerOccupancy` the phase *requires* reusing takes a `Vessel`. Passing the vessel is cheap here because Phase C already holds it in scope. Extending the model instead (a vessel ref + `SlotDef.reeferTiers`) is recorded as an optional Phase D/E follow-up, not done now (YAGNI).
- `SlotPlaceholders.tsx`: one instanced translucent box over each valid slot while `dragging.kind === "container"`, positioned from `SlotDef.center` (never recomputed).
- `EmptySlotPicker` reads positions from `model.slots` and is restricted to the current gesture's **empty** slots.
  - **Correction 1 (Phase C part 1): never "valid ∪ blocked".** Those two sets partition *every* model slot, occupied ones included, so rendering pick volumes over placed boxes would make `hoveredSlot` win the raycast where `hoveredId` is expected, regressing container hover (the Sidebar's `hoveredId` readout). Empty-slot semantics only: `model.slots` minus `plan.placements`, keys rebuilt as `"bay|row|tier"` (never `all-slots.ts`'s private `"bay:row:tier"`).
  - **Correction 2 (Phase C part 2): "empty", NOT "valid ∩ empty".** Restricting the picker to the gesture's *valid* slots makes the **red ghost unreachable** — the planner can never hover a refused slot, so the UI can never answer "why not?". Spec §6 says the opposite: *"the existing pick boxes resolve the slot. The ghost snaps to it and is green or red with the first reason."* So while a gesture is active the picker covers **all empty slots**, and hovering a blocked one shows red plus its reason. That is what makes the red state (and the amber state) meaningful rather than decorative.
- `GhostContainerPreview`: colour and tooltip derived from `canPlaceContainer`; keep `raycast={() => null}`.
- Commit on pointer-up over a slot via a `usePlanDraftStore` action. Invalid → D1 behaviour (hard rules block with the reason surfaced; overridable limits warn).
- Cancel on release outside a slot (existing behaviour) and on Esc.
- Dragging an already-placed container: **pointer-down past a small drag threshold** (a few px) on a `ContainerInstances` instance starts `moveContainer`, hiding that instance while dragging. A click that does not move past the threshold keeps today's meaning — it selects. <!-- Updated: Validation Session 1 - drag threshold decided -->
- **Pick-and-place — the WCAG 2.5.7 path, primary:** click a row in the Unplaced list (or focus it and press Enter) to *pick* an item with no drag gesture. Placeholders and the ghost appear exactly as during a drag. Click a 3D placeholder, or a bay cell in 2D, to place it. Esc cancels the pick. Both input paths run the same `canPlaceContainer` gate and the same store action, so a pick can never commit something a drag would reject.
- 2D bay plan: click-to-place into the highlighted slot, same checks — works with a **picked** item. **A drag cannot land on the 2D plan, and that is by design (Phase C part 2):** a `click` fires only on the nearest common ancestor of press and release targets, so a release over a bay cell whose press began on the list row or the canvas never fires that cell's handler. Spec §7 Phase C asks for *click-to-place* in 2D, not drag-to-2D — the older superseded p1 plan wanted drag between 2D cells and the list, and that is not what the Confluence spec specifies. Do not add a third commit call site for it.
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
  → validSlotsFor(vessel, plan, container)  <- memoised once per drag/pick   [engine/placement/placeholders.ts]
      -> canPlaceContainer per slot            <- SAME predicate as validation
  → SlotPlaceholders (valid, green) + EmptySlotPicker (empty slots of the bays the size can use:
      valid AND blocked) + GhostContainerPreview (tint + first reason from the hovered slot)
  → ONE commit resolver, two triggers:
       pointer-up over a slot (drag)  |  click on a placeholder or bay cell (pick)
      → usePlanDraftStore.placeContainer | moveContainer   (validate-then-mutate)
      → plan changes → validatePlan re-runs → undo/redo available
  → pointer-up elsewhere / Esc → cancel and restore instance visibility
```

Boundary: `engine/placement/placeholders.ts` is pure (no three/react) and unit-tested; every `.tsx` here is presentation plus store wiring.

## Related Code Files

**Create**
- `frontend/src/engine/placement/placeholders.ts` — `validSlotsFor`, `blockedSlots`, `blockedReasonFor`, `verdictOf`. **DONE in Phase C part 1** (97 LOC + 12 tests). Pure: no react/three/zustand.
- `frontend/src/store/commit-placement.ts` — `commitPlacement(target: Slot|null)`, `cancelPlacement()`. **DONE in Phase C part 1** (64 LOC + 11 tests). The ONE commit resolver; `null` return = nothing to commit, `ok:false` = D1 hard block (surface `reasons[0]`), `ok:true` + reasons = warning applied and recorded.
- `frontend/src/features/panels/use-stowage-keyboard-shortcuts.ts` — **DONE in Phase C part 1** (54 LOC): `Ctrl/Cmd+Z`, `Shift+Ctrl/Cmd+Z` / `Ctrl+Y`, `Esc`; ignores `INPUT`/`TEXTAREA`. Deliberately does NOT own `ArrowLeft/Right` — `Sidebar.tsx:62-72` already handles those and returns early on ctrl/meta/alt, so the two sets are disjoint. Leave both.
- `frontend/src/features/viewer3d/SlotPlaceholders.tsx` — instanced valid-slot boxes.
- `frontend/src/features/panels/UnplacedCargoList.tsx` — extracted from `Sidebar.tsx` (the drag source).
- `frontend/src/engine/placement/__tests__/placeholders.test.ts` — pure node-env tests (no DOM test file is created anywhere).

**Also already done in Phase C part 1** (not in this phase file's original map, added so the review grep finds them): the `pickedId` + mutual-exclusion + `activeContainerId` changes in `usePlanStore.ts`, the three-state tint in `lib/colors.ts` (`valid` #2E7D5B, `warning` #E0A030, `invalid` #B83A2E), and the D3 drag-pauses-playback behaviour (made atomic inside `setDraggingContainer`, so it holds even if the UI never calls `pausePlayback`). A pick does **not** pause playback — D3 names drag only.

**Also added in Phase C part 2** (likewise not in the original map): `frontend/src/lib/drop-verdict.ts` + `lib/__tests__/drop-verdict.test.ts` — the ONE verdict/tint/visibility funnel (`DROP_TINT`, `slotVisible`, `verdictForSlot`, `verdictsForSlots`) the ghost, placeholders, 2D highlight and Sidebar readout all share; and `frontend/src/features/bayplan/BayPlanDeckBlock.tsx` — one deck level's grid extracted from `BayPlanView`, carrying the `validKeys` outline and the `onCellClick` hook the 2D fallback needs.

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
3. Write `engine/placement/placeholders.ts`: `validSlotsFor(vessel, plan, container)` mapping `model.slots` through `canPlaceContainer` (passing `vessel` through — see the approved signature deviation in Requirements), and `blockedSlots` returning `{slot, reason}` using the first blocking reason. Keep it pure and allocation-light; add unit tests (all slots for a 40' dry box on MV Demo Horizon exclude occupied/full stacks; a reefer yields only plug tiers; ~~**a 20' box yields `[]` on both vessels** — the invariant test~~ <!-- SUPERSEDED 2026-09-16 — do NOT write this test. The 20' set is the odd half-bays, and pinning `[]` would pin the defect. The correct invariant is "odd bays only", held by `twenty-foot-slot-parity.test.ts`. -->).
4. Write `SlotPlaceholders.tsx` mirroring `EmptySlotPicker`'s instanced pattern: `useMemo` the valid set once per drag, write translation-only matrices from `SlotDef.center`, `key={capacity}` remount, translucent green material, `raycast={() => null}` so it never steals the pick.
5. Rework `EmptySlotPicker.tsx` to take its slots from `model.slots` (filtered to **empty** — see the correction in Requirements; NOT valid ∪ blocked) instead of recomputing `emptySlots`, and to accept an optional restricted set (the gesture's valid **empty** slots) used while dragging or picking. Keep the pitch-sized pick box and its comment about zero dead zones; ~~add a one-line note that a 20'-grid vessel will need a size-aware volume~~ <!-- SUPERSEDED 2026-09-16 (review H2): the volume is now sized BY THE CANDIDATE — `DIM.len20` for a 20' box, the pitch box for 40'/45' — with the measurement in the comment. See Correction 2c in Key Insights. --> **Wiring contract from the commit resolver (verbatim):** on window `mouseup`, call `const r = commitPlacement(hoveredSlot); if (!r) cancelPlacement();` — `commitPlacement` returns `null` when there is nothing to commit and deliberately does NOT end the drag in that case, so the window-level cancel must stay or a release outside the canvas leaves the gesture stuck. It clears a *rejected drag* itself but keeps a *rejected pick* (so the planner can click another slot); success clears everything.
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

- [x] Confirm the untracked viewer3d baseline is committed before editing
- [x] `HIGHLIGHT.valid`/`invalid` in `lib/colors.ts`
- [x] `engine/placement/placeholders.ts`: `validSlotsFor` + `blockedSlots`
- [x] Unit test: 20' box -> `[]` on both vessels (documents the no-odd-bay invariant) <!-- superseded: Phase C part 1 enumerated the 20' half bays, so the pinned invariant is "odd (half) bays only", in `twenty-foot-slot-parity.test.ts` + `lib/__tests__/drop-verdict.test.ts` -->
- [x] Unit test: 40' dry box excludes occupied/full stacks; reefer -> plug tiers only
- [x] `SlotPlaceholders.tsx` (instanced, translation-only, `raycast={() => null}`)
- [x] `EmptySlotPicker` re-sourced from `model.slots`; while a container is in hand the set is the EMPTY slots of the bays its size can use (valid **and** blocked, so a hover answers "why not"); full 40' grid otherwise
- [x] `GhostContainerPreview`: three-state tint from `verdictForSlot`; reason text in the Sidebar readout (a mesh cannot carry text)
- [x] `VesselScene`: mount `SlotPlaceholders`; OrbitControls `enabled=false` while dragging
- [x] Commit on pointer-up; D1 block/warn behaviour; cancel elsewhere + Esc
- [x] `pickedId` in `usePlanStore`; click **and** Enter pick from the Unplaced list
- [x] Place a picked item by clicking a 3D placeholder or a 2D bay cell (no drag gesture)
- [x] One commit resolver shared by drag and pick (same store action, same gate) — 3 UI call sites: picker click, bay cell click, window release
- [ ] Verify WCAG 2.5.7 end to end: full placement single-pointer with no drag, in 2D and 3D <!-- needs a browser; steps 11-15 of plans/reports/manual-click-through-260916-phase-c.md. Still unexecuted: no DOM test capability, so it cannot be automated. -->
- [x] Drag a placed container via `ContainerInstances` pointer-down, instance hidden while dragging
- [x] D3: pause playback on drag start
- [x] Split `UnplacedCargoList.tsx` out of `Sidebar.tsx` (get under 200 LOC); fix stale copy; add hint <!-- Sidebar 261 -> 176 LOC at review time (4 extractions: + ViewOptionsPanel, ProjectCargoPanel, ContainerInspector); the post-review H1 canvas gate takes Sidebar.tsx to 190 lines incl. comments/blanks, still under the rule -->
- [x] Undo/redo/Esc keyboard handling, reconciled with the ArrowLeft/Right bay nav
- [x] `BayPlanView` click-to-place fallback (works with no drag gesture — WCAG 2.5.7)
- [x] `npm run typecheck` clean; `npm run build` succeeds; `npm test` green (70 files / 541 tests = the 69/530 baseline + `drop-verdict.test.ts` + one H1 invariant test in `commit-placement.test.ts`)
- [ ] Manual acceptance script on BBC SAO PAULO recorded (see Success Criteria) <!-- script: plans/reports/manual-click-through-260916-phase-c.md (21 steps, includes the two [H] defect checks added after the H1/H2 fixes). Unexecuted. -->

## Success Criteria

**Spec acceptance, quoted verbatim (spec §7 Phase C):**
> drag an unplaced 40' box onto BBC bay 22 on deck and it lands in that slot. A 20' box shows no placeholders in 40' bays. A reefer shows only plug tiers. Undo restores it.

<!-- Corrected 2026-09-16 (20' reopen): the middle sentence was written before the model enumerated the odd half-bays. Read it as the intent, not the mechanism — a 20' box shows no placeholders at a 40' CENTRE, because it now shows them on the odd HALF positions of those bays (see Key Insights + the correction under Repo-specific additions). Everything else stands. -->

**Repo-specific additions**
- `cd frontend && npm run typecheck` passes.
- Existing suite still passes: 56 files / 396 tests. (`plan.md` records the brief's "395 of 396" figure; the suite is 396/396 today, and the `validate-plan.test.ts:66` wall-clock assertion is flaky — an intermittent failure there is pre-existing, not this phase's.)
- `engine/__tests__/all-slots.test.ts` (5 tests) and `engine/__tests__/slot-helpers.test.ts` stay green — they pin the slot-expansion and half-bay mapping the picker now consumes.
- No new dependency; no test toolchain added; no DOM test file created.
- `Sidebar.tsx` is under 200 LOC after step 11.
- Concretely verifiable on BBC SAO PAULO: a 40' box dragged over bay 22 resolves to a `bay: 22` slot; ~~a 20' box produces zero placeholders and cannot be dropped anywhere~~ **corrected 2026-09-16 (20' reopen):** a 20' box produces placeholders on the ODD half positions only (`validSlotsFor(20')` = 122 on MV Demo Horizon, 18 on BBC) and cannot be dropped at a 40' centre — the 2D bay plan still cannot address a half bay (whole-bay selector), so the 20' flow is 3D-only; a REEFER resolves only to a bay/tier in `spec.containers.stowage.reefer` (bays 34/30/26, on-deck tiers 82/84). Note the bay-22 case also exercises the ~0.18 m boundary overlap — if the resolved bay is 18 or 26 instead of 22, aim ~0.3 m inboard of the bay centre and record the observation rather than changing the tiling.
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
