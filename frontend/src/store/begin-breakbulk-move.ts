/**
 * begin-breakbulk-move.ts — the gate in front of lifting a project-cargo item that is already on board
 * (stacking plan, phase 03). The project-cargo twin of `begin-container-move.ts`, for the same reason:
 * an item with others resting on it cannot go ANYWHERE without leaving them in the air, so the refusal
 * is said once, when it is picked up, instead of after the planner has chosen a target.
 *
 * The draft store refuses the same move and the same unplace (`usePlanDraftStore`), so this gate is the
 * early, explanatory half — never the only guard. The reason goes through the same `dropOutcome`
 * channel a refused drop uses, pinned to the item's CURRENT pose, which is what the refusal is about.
 */
import type { StowagePlan } from "@/types/domain";
import { carriesMessage, dependentsOf } from "@/engine/placement/breakbulk-stack";
import { severityOf } from "@/engine/placement/reason";
import { dropPoseOutcomeOf } from "@/lib/drop-feedback";
import { usePlanStore } from "./usePlanStore";

/** May `cargoId` be lifted? `true` when nothing rests on it (the caller arms its own gesture). `false`
 * when something does, with the reason recorded for the sidebar and the chip. */
export function canBeginBreakbulkMove(plan: StowagePlan, cargoId: string): boolean {
  const placement = plan.breakbulk_placements.find((p) => p.cargo_id === cargoId);
  if (!placement) return true; // not on board: nothing can be resting on it
  const dependents = dependentsOf(plan, cargoId);
  if (dependents.length === 0) return true;
  usePlanStore.getState().setDropOutcome(
    dropPoseOutcomeOf(
      { ok: false, reasons: [{ rule: "no_floating", message: carriesMessage(cargoId, dependents), severity: severityOf("no_floating") }] },
      {
        x_m: placement.x_m,
        z_m: placement.z_m,
        rotation_deg: placement.rotation_deg,
        ...(placement.area_id ? { areaId: placement.area_id } : {}),
        ...(placement.on_cargo_id ? { onCargoId: placement.on_cargo_id } : {}),
      },
      "scene",
    ),
  );
  return false;
}
