/**
 * custom-cargo-in-plan.ts — adding or removing a planner-defined item WITHOUT rebuilding the plan.
 *
 * WHY (found while verifying the stacking plan, 2026-09-18): `App.tsx` used to rebuild the whole demo
 * plan whenever `customCargo` changed, because the list was one of the rebuild effect's dependencies.
 * A rebuild is a fresh plan, so adding ONE item wiped every hand-made placement and the undo history —
 * which made stacking impossible to build in the UI (place a frame, add the item to put on it, and the
 * frame is gone).
 *
 * Now the rebuild only follows the vessel and the cargo toggles (it still merges the custom list, so
 * the items survive those), and a single add/remove is applied to the CURRENT draft here instead.
 * History snapshots get the same edit: the cargo list is not something undo should take back, and an
 * undo to a snapshot that lacks the item would drop it from the unplaced list while the view store still
 * says it exists.
 */
import type { BreakbulkCargo, StowagePlan } from "@/types/domain";
import { withCustomCargo } from "@/data/with-custom-cargo";
import { usePlanDraftStore } from "./usePlanDraftStore";
import { usePlanStore } from "./usePlanStore";

/** Apply `edit` to the draft and every history snapshot, leaving undo/redo positions where they are. */
function editEverySnapshot(edit: (plan: StowagePlan) => StowagePlan): void {
  usePlanDraftStore.setState((s) =>
    s.plan ? { plan: edit(s.plan), past: s.past.map(edit), future: s.future.map(edit) } : s,
  );
}

export function addCustomCargoToPlan(item: BreakbulkCargo): void {
  usePlanStore.getState().addCustomCargo(item);
  editEverySnapshot((plan) => withCustomCargo(plan, [item])); // idempotent: never a duplicate row
}

/** Only offered for UNPLACED items, but a snapshot may still hold a placement of it (placed, then
 * undone): that placement goes too, so redo can never resurrect an orphan. */
export function removeCustomCargoFromPlan(id: string): void {
  usePlanStore.getState().removeCustomCargo(id);
  editEverySnapshot((plan) => ({
    ...plan,
    breakbulk_cargo: plan.breakbulk_cargo.filter((c) => c.id !== id),
    breakbulk_placements: plan.breakbulk_placements.filter((p) => p.cargo_id !== id),
  }));
}
