/**
 * placeholders.ts — "where can THIS box go" (spec §4.6), pure.
 *
 * ONE predicate, two shapes: every slot in `model.slots` is either valid (`canPlaceContainer.ok`) or
 * blocked (at least one error-severity reason). Nothing here re-derives a placement rule, so the
 * placeholder set, the ghost tint and the violation list can never disagree, and the size of the
 * candidate is never assumed (`sizeFitsBay` decides which bay a size belongs in — not this module).
 *
 * Perf, measured (Phase B: ≈1.05 ms for BBC SAO PAULO's 447 slots, dominated by the predicate's
 * reason MESSAGES for the ~437 blocked ones):
 *  - `validSlotsFor` is the drag/pick-start call. Memoise it at the call site (`useMemo` keyed on
 *    vessel/plan/container) — never run a sweep per pointer move.
 *  - the hover path is `blockedReasonFor` (one slot, one predicate call). Do NOT call `blockedSlots`
 *    per hover: it sweeps again and allocates a message per blocked slot.
 *  - `blockedSlots` exists for callers that genuinely need the whole blocked set with its reasons.
 *
 * Slot keys: driven entirely by `model.slots`/`SlotDef`, whose key is `"bay|row|tier"` — the
 * authoritative one. The `"bay:row:tier"` key `engine/all-slots.ts` uses privately is never built
 * here (`slotByKey` lookups with it fail open).
 *
 * Previewing a MOVE: every function below checks the candidate against a plan with the subject's own
 * placement removed (`previewPlan`). `canPlaceContainer` assumes the candidate is not yet in
 * `plan.placements` — handed an already-placed box it reports a self-referencing `cell_conflict`
 * ("X and X occupy the same position"), counts that box's own weight into `stack_weight` and pairs
 * it with itself in `overstow`, i.e. a phantom rejection of the very slot the box already occupies.
 * The draft store strips identically before it commits (`putContainer`), so the ghost and the commit
 * agree; do not hand these functions a plan that was stripped (or not) by other means.
 */
import type { Container, Slot, StowagePlan, Vessel } from "@/types/domain";
import { buildStowageModel, type SlotDef } from "@/engine/stowage-model";
import { canPlaceContainer } from "./can-place-container";
import { blocks, type PlacementResult, type Reason } from "./reason";

export interface BlockedSlot {
  slot: SlotDef;
  /** The FIRST blocking reason only: the drop is refused for this one reason, and the tooltip needs
   * a line, not the whole list. */
  reason: Reason;
}

/** The three drop outcomes the UI tints from (Phase C, D1): `valid` (place it), `warning` (place it,
 * but it WILL appear in the violations list — the overridable limits), `invalid` (refused). */
export type SlotVerdict = "valid" | "warning" | "invalid";

const firstBlocker = (result: PlacementResult): Reason | null => result.reasons.find(blocks) ?? null;

/** The plan a candidate is checked against: its own placement dropped when it is already on board
 * (see the header). Returned as the SAME object when the candidate is unplaced — the common case,
 * and the one that must keep the predicate's plan-identity cache warm. */
function previewPlan(plan: StowagePlan, container: Container): StowagePlan {
  if (!plan.placements.some((p) => p.container_id === container.id)) return plan;
  return { ...plan, placements: plan.placements.filter((p) => p.container_id !== container.id) };
}

/** Every slot the candidate may go in. Empty is a legitimate answer (nothing fits). */
export function validSlotsFor(vessel: Vessel, plan: StowagePlan, container: Container): SlotDef[] {
  const model = buildStowageModel(vessel);
  const preview = previewPlan(plan, container);
  const out: SlotDef[] = [];
  for (const slot of model.slots) {
    if (canPlaceContainer(model, preview, container, slot, vessel).ok) out.push(slot);
  }
  return out;
}

/** The complement of `validSlotsFor` with one blocking reason each — for a red hover tooltip or a
 * "show blocked" layer. Loads a message per blocked slot, so keep it off the pointer-move path. */
export function blockedSlots(vessel: Vessel, plan: StowagePlan, container: Container): BlockedSlot[] {
  const model = buildStowageModel(vessel);
  const preview = previewPlan(plan, container);
  const out: BlockedSlot[] = [];
  for (const slot of model.slots) {
    const reason = firstBlocker(canPlaceContainer(model, preview, container, slot, vessel));
    if (reason) out.push({ slot, reason });
  }
  return out;
}

/** The hovered-slot reason, computed for that slot alone — the cheap half of `blockedSlots`. `null`
 * when the slot is fine (or only warns), i.e. when the drop would be accepted. */
export function blockedReasonFor(
  vessel: Vessel,
  plan: StowagePlan,
  container: Container,
  slot: Slot,
): Reason | null {
  return firstBlocker(
    canPlaceContainer(buildStowageModel(vessel), previewPlan(plan, container), container, slot, vessel),
  );
}

/** Fold a predicate result into the tint state. Green would promise a clean placement the plan-wide
 * report then flags for a warning-severity reason (D1), so the warning case is its own state. */
export function verdictOf(result: PlacementResult): SlotVerdict {
  if (!result.ok) return "invalid";
  return result.reasons.length > 0 ? "warning" : "valid";
}
