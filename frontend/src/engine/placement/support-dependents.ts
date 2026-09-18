/**
 * support-dependents.ts — "what stands ON this box, and would it still stand after the edit?"
 * (Phase 01 of the support-integrity plan).
 *
 * WHY IT IS NOT PART OF `canPlaceContainer`: that predicate answers ONE question — "may this candidate
 * go in that slot" — and `validSlotsFor` asks it ~900 times per gesture. Origin damage is a different
 * question with a different subject (the boxes ALREADY standing on the slot being vacated), and
 * folding it in would make every destination in the sweep report the same origin reason, i.e. paint
 * the whole placeholder layer red for something no destination can fix.
 *
 * WHY BEFORE-vs-AFTER AND NOT "IS ANYTHING ABOVE": a plan may already contain floaters (the demo
 * builders can produce them, and `unplaceContainer` could always create them), and blaming an edit for
 * a violation that predates it is how a guard becomes noise the planner learns to ignore. So the rule
 * is strictly: reported only if it was supported BEFORE and is not supported AFTER.
 *
 * WHY ONLY THE TIER DIRECTLY ABOVE: `no_floating` (engine/validation-rules.ts) judges each box by the
 * tier directly BELOW it. A box two tiers up is already floating or already supported by whatever sits
 * between — removing this box cannot change its verdict. One tier is the whole blast radius.
 *
 * The bay/deck/half arithmetic is NOT re-derived here: `bayPosition`, `deckOf` and `tierBelow` are the
 * same primitives `can-place-container.ts` and the plan-wide rules use, so "the tier below" has one
 * definition in this repo and a 20' half keeps belonging to its 40' parent. Cell occupancy likewise
 * comes from the shared `cell-occupancy.ts` (the landing rule asks the same question).
 */
import type { Placement, StowagePlan, Vessel } from "@/types/domain";
import { bayPosition, deckOf } from "@/engine/slot-helpers";
import { tierBelow } from "@/engine/placement-checks";
import { allHalvesOccupied, occupiedHalvesAt } from "./cell-occupancy";

/** True when every half this placement covers has something under it — the per-box form of
 * `no_floating`. The lowest tier of its stack rests on the tank top / hatch cover and is supported by
 * definition (`tierBelow` returns null), which is the same escape the plan-wide rule makes. */
function isSupported(vessel: Vessel, plan: StowagePlan, placement: Placement): boolean {
  const pos = bayPosition(placement.slot.bay, vessel.bays);
  if (!pos) return true; // bay not on this vessel: `slot_exists` owns that case, not this one
  const deck = deckOf(placement.slot.tier);
  const stack = vessel.stacks.find((s) => s.bay === pos.fortyBay && s.row === placement.slot.row && s.deck === deck);
  if (!stack) return true; // no spec for this column: nothing here can claim to know better
  const below = tierBelow(stack, placement.slot.tier);
  if (below === null) return true; // lowest tier of the stack — it stands on the deck itself
  return allHalvesOccupied(occupiedHalvesAt(vessel, plan, pos.fortyBay, placement.slot.row, below), pos.halves);
}

/** The placements sitting one tier above `placement` in the same 40'-bay column and on the same deck —
 * the only boxes an edit to `placement` can strand. */
function boxesResting(vessel: Vessel, plan: StowagePlan, placement: Placement): Placement[] {
  const pos = bayPosition(placement.slot.bay, vessel.bays);
  if (!pos) return [];
  const deck = deckOf(placement.slot.tier);
  const stack = vessel.stacks.find((s) => s.bay === pos.fortyBay && s.row === placement.slot.row && s.deck === deck);
  if (!stack) return [];
  const higher = stack.tiers.filter((t) => t > placement.slot.tier);
  if (higher.length === 0) return [];
  const above = Math.min(...higher);
  return plan.placements.filter((p) => {
    if (p.slot.row !== placement.slot.row || p.slot.tier !== above) return false;
    const other = bayPosition(p.slot.bay, vessel.bays);
    return other?.fortyBay === pos.fortyBay;
  });
}

/**
 * Container ids that were supported in `before` and are NOT supported in `after`, because
 * `containerId` left the slot it occupied in `before`.
 *
 * `[]` when the subject was not placed (a first placement strands nothing), when the vessel does not
 * know the column, or when nothing rests on it. Order follows `plan.placements`, so the message is
 * stable across calls.
 */
export function dependentsLosingSupport(
  vessel: Vessel,
  before: StowagePlan,
  after: StowagePlan,
  containerId: string,
): string[] {
  const subject = before.placements.find((p) => p.container_id === containerId);
  if (!subject) return [];
  return boxesResting(vessel, before, subject)
    .filter((p) => p.container_id !== containerId)
    .filter((p) => isSupported(vessel, before, p) && !isSupported(vessel, after, p))
    .map((p) => p.container_id);
}

/** The ONE wording for the refusal, so the store, the gesture guard and any future caller quote the
 * same sentence (the `no_floating` rule id is what ties it to the plan-wide report's own message). */
export function strandedMessage(containerId: string, stranded: readonly string[]): string {
  const what = stranded.length === 1 ? "container stands" : "containers stand";
  return `${containerId}: ${stranded.length} ${what} on this slot (${stranded.join(", ")}) — move them first`;
}
