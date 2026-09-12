/**
 * Naive demo-only cargo fill: bottom-up per stack, respecting size/bay match, reefer plugs,
 * and stack weight limits (via the same predicates the validator uses — DRY, "validator before
 * optimizer"). NOT the real auto-stow solver — no POD/overstow awareness, no optimization.
 * That's the P1-demo plan's pending phase 2/3 greedy solver; this exists only so the frontend
 * demo has cargo to look at in the meantime.
 */
import type { Container, Placement, StackSpec, Vessel } from "@/types/domain";
import { plugOk, sizeFitsBay } from "./placement-checks";

export interface FillResult {
  placements: Placement[];
  unplaced: string[];
}

export function naiveFillPlan(vessel: Vessel, containers: Container[]): FillResult {
  const nextTierIndex = new Map<string, number>();
  const stackWeight = new Map<string, number>();
  const placements: Placement[] = [];
  const unplaced: string[] = [];

  for (const container of containers) {
    let placed = false;
    for (const stack of vessel.stacks) {
      if (!sizeFitsBay(container, stack.bay)) continue;
      const key = stackKey(stack);
      const tierIdx = nextTierIndex.get(key) ?? 0;
      if (tierIdx >= stack.tiers.length) continue; // stack full
      const tier = stack.tiers[tierIdx];
      if (!plugOk(container, stack, tier)) continue; // reefer needs a plug at THIS tier specifically
      const currentWeight = stackWeight.get(key) ?? 0;
      if (currentWeight + container.weight_t > stack.max_weight_t) continue;

      placements.push({ container_id: container.id, slot: { bay: stack.bay, row: stack.row, tier } });
      nextTierIndex.set(key, tierIdx + 1);
      stackWeight.set(key, currentWeight + container.weight_t);
      placed = true;
      break;
    }
    if (!placed) unplaced.push(container.id);
  }

  return { placements, unplaced };
}

function stackKey(stack: StackSpec): string {
  return `${stack.bay}-${stack.row}-${stack.deck}`;
}
