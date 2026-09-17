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
 *
 * Drop-outcome lifetime (P1/D5; the ONE place `usePlanStore.dropOutcome` is written). Every row is
 * node-tested in `store/__tests__/commit-placement.test.ts`:
 *
 * | Trigger                                                        | dropOutcome                        |
 * |----------------------------------------------------------------|------------------------------------|
 * | `commitPlacement(t, origin)` refused                           | `{slot, message: first BLOCKING reason, ok: false, origin}` |
 * | `commitPlacement(t, origin)` accepted WITH a recorded reason    | `{slot, message, ok: true, origin}` |
 * | `commitPlacement(t, origin)` accepted clean                     | `null`                              |
 * | `commitPlacement(null)` (nothing to commit)                     | unchanged                           |
 * | `setHoveredSlot(next)`, `next !== null`, `next.key !== slot.key`| `null` — the planner moved on      |
 * | `setHoveredSlot(null)`                                          | unchanged — leaving the canvas must not wipe the message before it is read |
 * | `setDraggingContainer(id)` / `setPicked(id)` with a non-null id  | `null`                              |
 * | `resetForVesselChange()`                                        | `null`                              |
 *
 * A refused PICK therefore leaves a post-click record while staying armed (review M2), and the record
 * survives the pointer leaving the slot — which is the whole reason it is not component state.
 */
import type { Slot } from "@/types/domain";
import type { PlacementResult } from "@/engine/placement/reason";
import { dropOutcomeOf, type DropOrigin } from "@/lib/drop-feedback";
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
 *
 * `origin` says WHERE the outcome may be shown: "scene" (the default — the 3D canvas, whose outcome
 * the chip may render at the cursor) or "bayplan" (the panel renders it in place). It changes no
 * check and no state beyond the recorded outcome.
 */
export function commitPlacement(target: Slot | null, origin: DropOrigin = "scene"): PlacementResult | null {
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
  // The record every surface reads afterwards (see the lifetime table above). Written here, from the
  // commit's OWN result, so no surface can ever describe a drop that did not happen; the message is
  // the same reason the hover verdict quotes (`dropOutcomeOf` -> `quotedReason`), which is what makes
  // a refused pick's text identical before and after the click.
  view.setDropOutcome(dropOutcomeOf(result, target, origin));
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
