/**
 * commit-placement.ts — the ONE resolver both drop triggers go through (Phase C).
 *
 * Two triggers, one path (spec §6 + WCAG 2.5.7):
 *  - a drag released over a target slot (pointer-up over the 3D placeholder or a 2D bay cell);
 *  - a PICKED item clicked onto a target (single pointer, no drag gesture anywhere).
 * Both run the same `canPlaceContainer` gate, inside the same `usePlanDraftStore` action, so the
 * pick path can never commit something the drag path would reject. Do NOT add a second commit path
 * for either trigger: two divergent paths is the failure mode the phase's risk table guards against.
 *
 * That action drops the subject's OWN placement before it validates (`putContainer`), and
 * `engine/placement/placeholders.ts` strips the same way for the preview — so a move of an
 * already-placed box is previewed and committed against the identical plan shape.
 *
 * Post-commit state rule (the two triggers end differently, which is why it lives here):
 *  - success → the gesture/pick ends: there is nothing left to place (a container is one box).
 *  - rejection → an active DRAG is cleared (the pointer is already up; nothing may keep following
 *    the cursor), but a PICK stays alive so the planner can click another slot — the whole point of
 *    click-pick → click-target. The reasons are returned either way so the caller can surface them.
 */
import type { Slot } from "@/types/domain";
import type { PlacementResult } from "@/engine/placement/reason";
import { activeContainerId, usePlanStore } from "./usePlanStore";
import { usePlanDraftStore } from "./usePlanDraftStore";

/**
 * Commit the dragged OR picked container onto `target`.
 *
 * Returns the draft store's `PlacementResult` — `ok:false` + reasons = a D1 hard block (nothing was
 * written), `ok:true` + reasons = an overridable limit that WAS applied and is recorded (the
 * plan-wide report lists it) — or `null` when there is nothing to commit: no drag, no pick, or no
 * target under the pointer. Callers do nothing on `null`.
 *
 * `target` is a `Slot` (`bay`/`row`/`tier`), the same shape `hoveredSlot` and a bay-plan cell carry.
 */
export function commitPlacement(target: Slot | null): PlacementResult | null {
  const view = usePlanStore.getState();
  const containerId = activeContainerId(view);
  if (!containerId || !target) return null;

  const draft = usePlanDraftStore.getState();
  // `placeContainer` and `moveContainer` are the SAME store implementation (`putContainer`) — the
  // branch only names the intent (an already-placed box is being moved, not newly loaded), so a
  // future divergence between the two cannot make this resolver silently pick the wrong one.
  const placed = draft.plan?.placements.some((p) => p.container_id === containerId) ?? false;
  const result = placed
    ? draft.moveContainer(containerId, target)
    : draft.placeContainer(containerId, target);

  if (result.ok) cancelPlacement();
  else if (view.draggingContainerId !== null) view.setDraggingContainer(null);
  return result;
}

/**
 * End the current gesture/pick with nothing committed: the window-level mouseup release outside any
 * slot, a click that was not a placement, and Esc. `hoveredSlot` is deliberately left alone — the
 * Sidebar keeps showing the slot under the cursor (hover-to-inspect), which must survive a cancel.
 */
export function cancelPlacement(): void {
  const view = usePlanStore.getState();
  view.setDraggingContainer(null);
  view.setPicked(null);
}
