/**
 * commit-placement.ts — the ONE resolver both drop triggers go through (Phase C), for BOTH kinds of
 * cargo (Phase D: a container onto a slot, project cargo onto a pose inside an area).
 *
 * Two triggers, one path (spec §6 + WCAG 2.5.7):
 *  - a drag released over a target (pointer-up over the 3D target or a 2D bay cell);
 *  - a PICKED item clicked onto a target (single pointer, no drag gesture anywhere).
 * Both run the same `canPlace…` gate, inside the same `usePlanDraftStore` action, so the pick path can
 * never commit something the drag path would reject. Do NOT add a second commit path for either
 * trigger or for either kind: two divergent paths is the failure mode the phase's risk table guards
 * against. `commitPlacement` and `commitBreakbulkPlacement` are the two doors into the ONE table
 * below — they differ only in which store action they call and which target shape they record.
 *
 * That action drops the subject's OWN placement before it validates (`putContainer`/`putBreakbulk`),
 * and `engine/placement/placeholders.ts` strips the same way for the preview — so a move of an
 * already-placed item is previewed and committed against the identical plan shape.
 *
 * Post-commit state rule (the two triggers end differently, which is why it lives here):
 *  - success → the gesture/pick ends: there is nothing left to place (a container is one box, an item
 *    is one pose).
 *  - rejection → an active DRAG is cleared (the pointer is already up; nothing may keep following the
 *    cursor), but a PICK stays alive so the planner can click another target — the whole point of
 *    click-pick → click-target. The reasons are returned either way so the caller can surface them.
 *
 * Drop-outcome lifetime (P1/D5; the ONE place `usePlanStore.dropOutcome` is written). Every row is
 * node-tested in `store/__tests__/commit-placement.test.ts` and `commit-breakbulk-placement.test.ts`:
 *
 * | Trigger                                                        | dropOutcome                        |
 * |----------------------------------------------------------------|------------------------------------|
 * | `commitPlacement(t, origin)` refused                           | `{target: slot, message: first BLOCKING reason, ok: false, origin}` |
 * | `commitPlacement(t, origin)` accepted WITH a recorded reason    | `{target: slot, message, ok: true, origin}` |
 * | `commitPlacement(t, origin)` accepted clean                     | `null`                              |
 * | `commitPlacement(null)` (nothing to commit)                     | unchanged                           |
 * | `commitBreakbulkPlacement(p, origin)`/`(null)`                  | the same four rows, with `target: {kind:"pose", pose}` |
 * | `setHoveredSlot(next)` / `setHoveredPose(next)`, `next !== null`, a DIFFERENT target of the same kind | `null` — the planner moved on      |
 * | `setHoveredSlot(null)` / `setHoveredPose(null)`                 | unchanged — leaving the canvas must not wipe the message before it is read |
 * | `setHand(...)`/`setDraggingContainer(id)`/`setPicked(id)`, non-null id | `null`                        |
 * | `resetForVesselChange()`                                        | `null`                              |
 *
 * A refused PICK therefore leaves a post-click record while staying armed (review M2), and the record
 * survives the pointer leaving the target — which is the whole reason it is not component state.
 */
import type { Slot } from "@/types/domain";
import type { BreakbulkPose } from "@/engine/placement/can-place-breakbulk";
import type { PlacementResult } from "@/engine/placement/reason";
import { dropOutcomeOf, dropPoseOutcomeOf, type DropOrigin, type DropOutcome } from "@/lib/drop-feedback";
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

  return record(result, view, (r) => dropOutcomeOf(r, target, origin));
}

/**
 * Commit the dragged OR picked PROJECT-CARGO item onto `pose` — the pose-shaped door into the same
 * table (Phase D). The item is resolved from `inHand`, so the `kind` check IS the "never both layers"
 * rule: a container in hand commits nothing here, and vice versa.
 *
 * `pose` is expected to be what `breakbulk-pose.ts` produced for the pointer (snapped, then clamped
 * into the area). Nothing here depends on that: a pose that still breaks a rule is refused with that
 * rule, which is what makes the clamp safe — it never relaxes a limit.
 */
export function commitBreakbulkPlacement(
  pose: BreakbulkPose | null,
  origin: DropOrigin = "scene",
): PlacementResult | null {
  const view = usePlanStore.getState();
  const hand = view.inHand;
  if (!hand || hand.kind !== "breakbulk" || !pose) return null;

  const draft = usePlanDraftStore.getState();
  // `placeBreakbulk` and `moveBreakbulk` are the same store implementation (`putBreakbulk`), which
  // strips the subject's own placement — so a MOVE and a first placement are the same call.
  const placed = draft.plan?.breakbulk_placements.some((p) => p.cargo_id === hand.id) ?? false;
  const result = placed
    ? draft.moveBreakbulk(hand.id, pose)
    : draft.placeBreakbulk(hand.id, pose);

  return record(result, view, (r) => dropPoseOutcomeOf(r, pose, origin));
}

/**
 * The post-commit rules, shared by both doors so neither can end a gesture differently: success ends
 * it, a refused DRAG is cleared (the pointer is already up), a refused PICK stays armed, and the
 * outcome is recorded from the commit's OWN result — never from what the caller expected.
 * `outcomeOf` is the caller's own target-shaped record builder, so a slot outcome and a pose outcome
 * are built by their own door and STILL pass through this one table.
 */
function record(
  result: PlacementResult,
  view: ReturnType<typeof usePlanStore.getState>,
  outcomeOf: (result: PlacementResult) => DropOutcome | null,
): PlacementResult {
  if (result.ok) cancelPlacement();
  else if (view.handMode === "drag") view.endDrag();
  // The record every surface reads afterwards (see the lifetime table above), so no surface can ever
  // describe a drop that did not happen; the message is the same reason the hover verdict quotes
  // (`quotedReason`), which is what makes a refused pick's text identical before and after the click.
  view.setDropOutcome(outcomeOf(result));
  return result;
}

/**
 * End the current gesture/pick with nothing committed: the window-level mouseup release outside any
 * target, a click that was not a placement, and Esc. `hoveredSlot` is deliberately left alone — the
 * Sidebar keeps showing the slot under the cursor (hover-to-inspect), which must survive a cancel.
 */
export function cancelPlacement(): void {
  usePlanStore.getState().cancelHand();
}
