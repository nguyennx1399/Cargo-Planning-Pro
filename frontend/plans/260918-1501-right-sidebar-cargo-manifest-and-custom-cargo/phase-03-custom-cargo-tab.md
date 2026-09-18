# Phase 03 — Custom tab: form + my items (pick, edit, delete)

## Context links
- [phase-01](phase-01-right-sidebar-shell-and-left-merge.md)
- `src/features/panels/CustomCargoForm.tsx` (type toggle, max top load, `onDone`)
- `src/lib/custom-cargo-input.ts`: `parseCustomCargo(fields, vessel, existing)`, `nextCustomCargoId`
- `src/store/custom-cargo-in-plan.ts`: `addCustomCargoToPlan`, `removeCustomCargoFromPlan` (edits the draft + history)
- `src/store/usePlanStore.ts`: `customCargo`, `setHand`
- `src/engine/placement/breakbulk-stack.ts`: `dependentsOf` (stacking)

## Overview
- **Priority:** medium.
- **Status:** not started.
- The Custom tab shows the add form permanently at the top and a "My items" list below: every item the planner
  created, with its status and actions.

## Key insights
- **Form always open:** no "+ Add" toggle here. After a successful add the fields reset, and the new item appears
  at the top of the list (flashed briefly), so the planner can add several in a row.
- **My items row:** `FRAME-1 · frame ≤ 60 t · 12 × 4 × 0.5 m · 3 t` + a status chip:
  - "Unplaced";
  - "On board: weather deck 87.5 m";
  - "On board: on FRAME-1".
  Actions:
  - **Pick:** takes the item in hand (`setHand(..., "pick")`). For a placed item it goes through
    `canBeginBreakbulkMove`, so an item carrying others says why it cannot move.
  - **Edit** (unplaced items only): loads the item into the form in edit mode ("Save changes" / "Cancel"). The id
    is kept; renaming is allowed if unique. A placed item shows the button disabled with the tooltip "Unplace to
    edit" (see plan.md, unresolved question 1).
  - **Delete** (unplaced items only): as today (`removeCustomCargoFromPlan`). A placed item's delete is disabled
    with the same tooltip. This matches the current rule that only unplaced items can be removed.
- **Edit = replace in place:** a new `updateCustomCargoInPlan(oldId, item)` in `custom-cargo-in-plan.ts` replaces
  the item in `customCargo`, in the draft plan and in every history snapshot. This is the same pattern as add and
  remove, so undo cannot resurrect the old dimensions. If the id changes, snapshots with a placement of the old
  id do not exist, because it is unplaced.
- **The parser learns edit mode:** `parseCustomCargo(fields, vessel, existing, { editingId })`. Name uniqueness
  ignores the item being edited, and a blank name keeps the current id instead of generating a new one.

## Requirements
- `CustomCargoTab.tsx`: `<CustomCargoForm mode="add" | {edit: item}>` + `<MyItemsList>`.
- `CustomCargoForm`: a prefill from an item (the item → fields mapping in `custom-cargo-input.ts`:
  `fieldsOfItem`), a submit label by mode, and `onDone`.
- `MyItemsList.tsx`: rows as above; the status from `plan.breakbulk_placements` (+ `on_cargo_id`).
- `custom-cargo-in-plan.ts`: `updateCustomCargoInPlan`.
- `custom-cargo-input.ts`: `editingId` option + `fieldsOfItem`.

## Related code files
- Create: `CustomCargoTab.tsx`, `MyItemsList.tsx`
- Modify: `CustomCargoForm.tsx`, `lib/custom-cargo-input.ts`, `store/custom-cargo-in-plan.ts`, `RightSidebar.tsx`
- Tests: parser edit mode (the own name is allowed, others are refused, a blank name keeps the id);
  `fieldsOfItem` round-trip (parse(fieldsOfItem(item)) equals item); `updateCustomCargoInPlan` (draft + history
  replaced, placements of other items kept, `customCargo` updated)

## Implementation steps
1. Parser edit mode + `fieldsOfItem` + tests.
2. `updateCustomCargoInPlan` + tests.
3. Form modes; `MyItemsList`; `CustomCargoTab`; wire it into `RightSidebar` (replacing the phase-01 placeholder).
4. `npx tsc --noEmit` + suite.
5. Browser:
   - add a frame and an item → both are listed at the top, and the form is empty and still open;
   - Pick the frame → place it on deck → its status reads "On board: weather deck …";
   - pick the item → drop it on the frame → "On board: on FRAME-1";
   - Edit is disabled on placed items (tooltip);
   - edit an unplaced item (weight 40 → 45) → the list and the unplaced list update; undo does not bring back 40;
   - delete an unplaced item → it is gone from both lists.

## Todo list
- [ ] Parser edit mode + `fieldsOfItem` + tests
- [ ] `updateCustomCargoInPlan` + tests
- [ ] Form modes, `MyItemsList`, `CustomCargoTab`
- [ ] `npx tsc --noEmit` + suite green
- [ ] Browser checks

## Success criteria
- A planner can create, find, place, edit and delete their own project cargo and frames from one tab, with every
  status visible.

## Risk assessment
- **Editing while the item is in hand:** Edit is disabled for the item currently in hand (the hand holds its id).
- **Id rename vs `selectedId`/hover:** clear `selectedId` if it pointed at the old id.

## Security considerations
Input goes through the existing numeric parser; no free HTML.

## Next steps
Close the plan. Possible follow-ups (not requested): editing placed items with re-validation, import of an item list
(CSV), and duplicating an item.
