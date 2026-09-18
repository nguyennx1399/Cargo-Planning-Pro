/**
 * breakbulk-stack.ts — "how high does this item stand, what does it stand on, what rests on it"
 * (project-cargo stacking plan, phase 01).
 *
 * A placement with `on_cargo_id` rests on that item's top instead of its area's floor. Everything that
 * needs a height (the mesh, the ghost, stability, the rules) asks THIS module, so the picture, the
 * numbers and the checks cannot disagree about where an item is.
 *
 * Heights here are metres ABOVE THE AREA FLOOR. The absolute scene height is
 * `cargoBaseHeight(vessel, area) + elevationOf(...)` — this module stays vessel-free.
 *
 * BROKEN CHAINS are expected, not exceptional: plans come from files and undo, so a support can be
 * missing, unplaced, in another area, not stackable, or part of a cycle. Every walk here terminates
 * (visited set + a step bound) and classifies the break; `canPlaceBreakbulk` turns it into a violation.
 * The walk stops at a missing / cycling / other-area support, but CONTINUES through a non-stackable one:
 * the item physically sits on it, so it is drawn there and flagged, not silently dropped to the floor.
 */
import type { BreakbulkCargo, BreakbulkPlacement, StowagePlan } from "@/types/domain";
import { areaIdOf } from "@/engine/stowage-model";

export type BrokenSupportReason = "missing" | "cycle" | "not_stackable" | "other_area";

export interface SupportChain {
  /** Support ids below the item, nearest first — only supports it can actually rest on. */
  chain: string[];
  /** The first problem found walking down, if any. */
  broken?: { supportId: string; why: BrokenSupportReason };
}

type StackPlan = Pick<StowagePlan, "breakbulk_cargo" | "breakbulk_placements">;

interface StackIndex {
  cargoRef: readonly BreakbulkCargo[];
  byId: Map<string, BreakbulkPlacement>;
  cargo: Map<string, BreakbulkCargo>;
  /** support id → ids resting DIRECTLY on it. */
  above: Map<string, string[]>;
}

/** Memoised on the placements array's identity (plans are immutable by contract): a drag evaluates
 * hundreds of poses against one plan. The cargo array is checked too, since it can change on its own. */
const indexCache = new WeakMap<readonly BreakbulkPlacement[], StackIndex>();

function indexOf(plan: StackPlan): StackIndex {
  const cached = indexCache.get(plan.breakbulk_placements);
  if (cached && cached.cargoRef === plan.breakbulk_cargo) return cached;
  const byId = new Map(plan.breakbulk_placements.map((p) => [p.cargo_id, p] as const));
  const cargo = new Map(plan.breakbulk_cargo.map((c) => [c.id, c] as const));
  const above = new Map<string, string[]>();
  for (const p of plan.breakbulk_placements) {
    if (!p.on_cargo_id) continue;
    const list = above.get(p.on_cargo_id);
    if (list) list.push(p.cargo_id);
    else above.set(p.on_cargo_id, [p.cargo_id]);
  }
  const built: StackIndex = { cargoRef: plan.breakbulk_cargo, byId, cargo, above };
  indexCache.set(plan.breakbulk_placements, built);
  return built;
}

/** The supports under `cargoId`, nearest first, and the first break in the chain. An unplaced item has
 * an empty, unbroken chain. */
export function supportChain(plan: StackPlan, cargoId: string): SupportChain {
  const { byId, cargo } = indexOf(plan);
  const start = byId.get(cargoId);
  const chain: string[] = [];
  if (!start) return { chain };
  const area = areaIdOf(start);
  const visited = new Set([cargoId]);
  let broken: SupportChain["broken"];
  let next = start.on_cargo_id;
  // Bounded by the placement count: a chain can never be longer than the plan without repeating.
  for (let steps = 0; next !== undefined && steps <= byId.size; steps++) {
    const supportId: string = next;
    if (visited.has(supportId)) return { chain, broken: broken ?? { supportId, why: "cycle" } };
    const placement = byId.get(supportId);
    if (!placement) return { chain, broken: broken ?? { supportId, why: "missing" } };
    if (areaIdOf(placement) !== area) return { chain, broken: broken ?? { supportId, why: "other_area" } };
    if (!cargo.get(supportId)?.stacking) broken ??= { supportId, why: "not_stackable" };
    chain.push(supportId);
    visited.add(supportId);
    next = placement.on_cargo_id;
  }
  return broken ? { chain, broken } : { chain };
}

/** Metres above the area floor that `cargoId`'s base sits at: the summed heights of its supports. */
export function elevationOf(plan: StackPlan, cargoId: string): number {
  const { cargo } = indexOf(plan);
  return supportChain(plan, cargoId).chain.reduce((sum, id) => sum + (cargo.get(id)?.height_m ?? 0), 0);
}

/** The ids resting DIRECTLY on `cargoId` — the lift guard's question ("does anything stand on this?"). */
export function dependentsOf(plan: StackPlan, cargoId: string): string[] {
  return indexOf(plan).above.get(cargoId) ?? [];
}

/** Total weight (t) resting on `cargoId`, transitively — everything whose chain passes through it. */
export function loadAbove(plan: StackPlan, cargoId: string): number {
  const { above, cargo } = indexOf(plan);
  const seen = new Set([cargoId]);
  let total = 0;
  const walk = (id: string): void => {
    for (const up of above.get(id) ?? []) {
      if (seen.has(up)) continue; // a cycle in a broken plan must not loop or double-count
      seen.add(up);
      total += cargo.get(up)?.weight_t ?? 0;
      walk(up);
    }
  };
  walk(cargoId);
  return total;
}

/** The refusal for lifting or unplacing an item that others rest on — one wording for the gesture
 * gate and the draft store, so the planner reads the same sentence whichever path refused. */
export const carriesMessage = (cargoId: string, dependents: readonly string[]): string =>
  `${cargoId} carries ${dependents.join(", ")} — lift ${dependents.length === 1 ? "it" : "them"} off first`;

/** The item that touches the floor under `cargoId` (itself when it rests on the floor). */
export function stackBottomOf(plan: StackPlan, cargoId: string): string {
  const { chain } = supportChain(plan, cargoId);
  return chain.length ? chain[chain.length - 1] : cargoId;
}
