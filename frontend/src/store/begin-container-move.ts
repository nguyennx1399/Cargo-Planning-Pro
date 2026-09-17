/**
 * begin-container-move.ts — the gate in front of a MOVE gesture, for a box that is already on board.
 *
 * Why a gate at gesture START and not only at the commit (`usePlanDraftStore.putContainer`, which is
 * the real guard and stays so): a box with other boxes standing on it cannot go ANYWHERE. Arming the
 * hand anyway would sweep ~900 slots, tint every one of them green, and refuse the drop at the end —
 * the planner would learn the box is stuck only after choosing a target. So the refusal is said once,
 * where it is true, at the moment of picking it up.
 *
 * It records the SAME `no_floating` reason, through the SAME `dropOutcome` channel the commit
 * resolver writes (`store/commit-placement.ts`'s lifetime table), so the sidebar/chip wording of a
 * refused pick-up is identical to a refused drop. The target of that record is the box's CURRENT slot:
 * that is the position the refusal is about.
 *
 * Unplaced boxes never reach this: nothing can rest on a box that is not on board, so the unplaced
 * list keeps calling `setDraggingContainer`/`setPicked` directly.
 */
import type { StowagePlan, Vessel } from "@/types/domain";
import { dependentsLosingSupport, strandedMessage } from "@/engine/placement/support-dependents";
import { severityOf } from "@/engine/placement/reason";
import { dropOutcomeOf } from "@/lib/drop-feedback";
import { usePlanStore } from "./usePlanStore";

/**
 * May `containerId` be picked up? `true` when nothing rests on it (the caller arms its own gesture —
 * this module deliberately does not, so the drag and the pick paths keep owning their own hand call).
 * `false` when the move would strand boxes, and the reason has been recorded for the UI to show.
 */
export function canBeginContainerMove(
  vessel: Vessel,
  plan: StowagePlan,
  containerId: string,
): boolean {
  const placement = plan.placements.find((p) => p.container_id === containerId);
  if (!placement) return true; // not on board: nothing can be standing on it
  const without = { ...plan, placements: plan.placements.filter((p) => p.container_id !== containerId) };
  const stranded = dependentsLosingSupport(vessel, plan, without, containerId);
  if (stranded.length === 0) return true;

  usePlanStore.getState().setDropOutcome(
    dropOutcomeOf(
      { ok: false, reasons: [{ rule: "no_floating", message: strandedMessage(containerId, stranded), severity: severityOf("no_floating") }] },
      placement.slot,
      "scene",
    ),
  );
  return false;
}
