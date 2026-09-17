# Phase 03 — In-hand state, breakbulk commit, move / rotate / unplace

## Context Links

- Store + resolver to generalize: `frontend/src/store/usePlanStore.ts`, `frontend/src/store/commit-placement.ts`, `frontend/src/store/usePlanDraftStore.ts`
- Drag source to mirror: `frontend/src/features/panels/UnplacedCargoList.tsx`, `UnplacedListControls.tsx`
- Keys: `frontend/src/features/panels/use-stowage-keyboard-shortcuts.ts`
- Outcome lifetime table: header of `commit-placement.ts` (must stay true for both kinds)
- Session-1 decision "placed item drag needs a threshold": `plans/260916-1647-drag-drop-stowage-placeholders/plan.md`

## Overview

- **Priority:** P2 · **Status:** planned · **Effort:** ~1 d
- Makes the gesture real: pick a project-cargo item, put it anywhere in an area, move it again, rotate it, unplace it — through the SAME resolver containers use.

## Key Insights

- Today's store is container-only: `draggingContainerId`, `pickedId`, `activeContainerId`, `hoveredSlot`, `DropOutcome.slot`. Adding a parallel set of breakbulk fields would create **two sources driving one ghost** — the exact failure the Phase C risk table guards against. Generalize instead.
- `commitPlacement` already encodes the post-commit rules (success ends the gesture; a refused DRAG clears, a refused PICK stays armed; outcome recorded from the commit's own result). Breakbulk must reuse that table verbatim, only with a pose target.
- `putBreakbulk` in the draft store already strips the subject's own placement, so a MOVE and a first placement are the same call — same as `putContainer`.
- A placed item must be **lifted out of the scene while in hand** (prototype: otherwise it collides with itself visually and its dark footprint lies under the ghost).
- Undo/redo is free: every mutation goes through `apply()` in the draft store.

## Requirements

**Functional**
1. `usePlanStore.inHand: { kind: "container" | "breakbulk"; id: string } | null` + `handMode: "drag" | "pick"`, replacing `draggingContainerId`/`pickedId`. `activeContainerId(s)` keeps working (returns the id only when `kind === "container"`), so Phase C components need no rewrite.
2. `handRotation: 0 | 90` and `hoveredPose: BreakbulkPose | null` in the store; both cleared on gesture start/end exactly as `hoveredSlot` is.
3. `commitBreakbulkPlacement(pose, origin)` in `commit-placement.ts`, obeying the same outcome table; `DropOutcome.target` becomes `{ kind: "slot"; slot: Slot } | { kind: "pose"; pose: BreakbulkPose }` and `staleOutcome` compares within a kind.
4. Unplaced **project cargo** list in the sidebar: same `mousedown` → drag / `click` → pick pattern (WCAG 2.5.7), with "fits in: weather deck, Hold 2 tank top" from `freeRegionsFor`.
5. Pressing a placed breakbulk mesh past a small drag threshold starts a MOVE; a click without movement selects it (Session-1 decision, same as containers).
6. Keys while a breakbulk item is in hand: `R` rotate 0↔90 (re-clamped), `Esc` cancel, `Delete` unplace the selected/placed item, `Ctrl/Cmd+Z` undo.
7. Window release outside the canvas cancels, as the container path already does.

**Non-functional**
- `usePlanStore.ts` stays under 200 LOC after the refactor (split the hand slice into `store/hand-slice.ts` if needed).
- Every existing store/commit test keeps passing; the refactor is behaviour-preserving for containers.

## Architecture

```
UnplacedProjectCargoList ─ mousedown/click ─► setHand({kind:"breakbulk", id}, mode)
                                                     │
AreaDropPlane ─ pointermove ─► setHoveredPose(clampPoseToArea(...))
                                                     │
click / mouseup ──► commitBreakbulkPlacement(pose) ──► usePlanDraftStore.placeBreakbulk|moveBreakbulk
                                                     │            │
                                              setDropOutcome  ◄───┘ PlacementResult
```

One resolver module, two entry points (`commitPlacement` for slots, `commitBreakbulkPlacement` for poses), one outcome record.

## Related Code Files

**Modify:** `store/usePlanStore.ts`, `store/commit-placement.ts`, `lib/drop-feedback.ts` (target union), `features/viewer3d/{EmptySlotPicker,GhostContainerPreview,AreaDropPlane,BreakbulkCargoInstances}.tsx`, `features/viewer3d/use-drop-cursor.ts`, `features/panels/{Sidebar,UnplacedCargoList,ProjectCargoPanel}.tsx`, `features/panels/use-stowage-keyboard-shortcuts.ts`
**Create:** `features/panels/UnplacedProjectCargoList.tsx`, `store/__tests__/commit-breakbulk-placement.test.ts`
**Delete:** none

## Implementation Steps

1. **Store refactor first, alone, tests green.** Introduce `inHand`/`handMode`; reimplement `setDraggingContainer`/`setPicked` on top of it (or migrate their call sites) keeping `activeContainerId` semantics; keep every clearing rule (`hoveredSlot`, `dropOutcome`, playback pause) intact. Run the existing store tests unchanged — that is the acceptance for this step.
2. Add `handRotation`, `hoveredPose`, `setHoveredPose`, `rotateHand`. Clear them where `hoveredSlot` is cleared.
3. Widen `DropOutcome` to the target union; update `staleOutcome`, `dropOutcomeOf`, `DropVerdictChip`, the Sidebar readout.
4. `commitBreakbulkPlacement(pose, origin)`: resolve item from `inHand`, call `placeBreakbulk`/`moveBreakbulk` by whether it is already placed, apply the outcome table, return the result.
5. Wire `AreaDropPlane`'s click + the window `mouseup` release to it (mirror `Sidebar`'s existing listener; extend rather than duplicate).
6. `UnplacedProjectCargoList.tsx`: rows from `plan.breakbulk_cargo` minus `breakbulk_placements`, each a `<button>` (drag on mousedown, pick on click), with size/weight and the "fits in" hint. Mount in `Sidebar` under `ProjectCargoPanel`.
7. `BreakbulkCargoInstances`: add `onPointerDown` (threshold → move), `onClick` → select, hover tint, and skip rendering the item currently in hand.
8. Keyboard: `R` → `rotateHand()` + re-clamp; `Delete` → `unplaceBreakbulk(selectedId)` when the selection is project cargo. Keep the typing-target guard.
9. `npm run typecheck && npm run build && npm test`; browser pass: place, move, rotate, undo, redo, unplace, Esc, release-off-canvas.

## Todo List

- [ ] `inHand`/`handMode` refactor with existing store tests green
- [ ] `handRotation` / `hoveredPose`
- [ ] `DropOutcome` target union + readers updated
- [ ] `commitBreakbulkPlacement` + its test (refused / accepted-with-warning / clean / nothing-in-hand)
- [ ] `UnplacedProjectCargoList` (drag + pick + fits-in hint)
- [ ] placed-mesh press-to-move with threshold + select on click
- [ ] R / Esc / Delete / undo
- [ ] typecheck, build, full suite

## Success Criteria

- A project-cargo item can be placed, moved and unplaced entirely by **single clicks** (no drag) — the WCAG 2.5.7 path — and by drag.
- Undo/redo restores the exact previous pose.
- Every container behaviour from Phase C is unchanged (its tests pass untouched).
- A refused drop never mutates the plan and always leaves a readable reason.

## Risk Assessment

| Risk | Mitigation |
|---|---|
| Store refactor regresses the container gesture | Step 1 is refactor-only with the existing tests as the gate; no feature work in the same commit |
| Two ghosts (container + breakbulk) armed at once | `inHand` is a single field — mutually exclusive by construction |
| Drag threshold swallows a plain click on cargo | Same threshold constant as containers; click-without-move still selects (Session-1 decision) |
| `Delete` unplaces the wrong thing | Only acts when `selectedId` resolves to a breakbulk cargo id |

## Security Considerations

None — local state only. No persistence, no network.

## Next Steps

Phase 04: badges, hints, docs, and the manual acceptance run.
