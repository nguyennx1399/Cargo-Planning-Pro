/**
 * breakbulk-stack-checks.ts — the stacking half of `canPlaceBreakbulk` (stacking plan, phase 02).
 *
 * Lives beside the predicate, not inside it, only to keep that file under the 200-line limit: these are
 * NOT a second rule set. The predicate calls them for every candidate, and the plan-wide rules are loops
 * over the predicate, so the drop preview and the report still cannot disagree.
 *
 * Every check reads a CANDIDATE plan: the real plan with the item's own placement replaced by the pose
 * being judged (`candidatePlan`). That is what makes "already placed" and "brand-new drop" the same
 * question — the same exclude-then-re-add the predicate already does for the 20 m band weight.
 */
import type { BreakbulkCargo, BreakbulkPlacement, StowagePlan } from "@/types/domain";
import { footprintRect, type Rect } from "@/engine/breakbulk-overlap-check";
import { elevationOf, loadAbove, stackBottomOf, supportChain, type BrokenSupportReason } from "./breakbulk-stack";
import { reason } from "./placement-reason-builders";
import type { Reason } from "./reason";

/** Same slack the predicate uses for edge-of-area placements (float round-trip on centre ± extent/2). */
const TOLERANCE_M = 1e-6;

export type StackPlan = Pick<StowagePlan, "breakbulk_cargo" | "breakbulk_placements">;

/** The plan as it would be with `item` at `placement`: its old placement (if any) removed, the new one
 * added, and the item itself known to the cargo list even if the plan does not carry it yet. */
export function candidatePlan(plan: StackPlan, item: BreakbulkCargo, placement: BreakbulkPlacement): StackPlan {
  const known = plan.breakbulk_cargo.some((c) => c.id === item.id);
  // The plan-wide rules judge every item AT its own placement: reuse the plan itself then, so the
  // memoised stack index (keyed on the placements array) is built once per plan, not once per call.
  const current = plan.breakbulk_placements.find((p) => p.cargo_id === item.id);
  if (known && current && samePlacement(current, placement)) return plan;
  return {
    breakbulk_cargo: known ? plan.breakbulk_cargo : [...plan.breakbulk_cargo, item],
    breakbulk_placements: [...plan.breakbulk_placements.filter((p) => p.cargo_id !== item.id), placement],
  };
}

const samePlacement = (a: BreakbulkPlacement, b: BreakbulkPlacement): boolean =>
  a.x_m === b.x_m &&
  a.z_m === b.z_m &&
  a.rotation_deg === b.rotation_deg &&
  (a.area_id ?? "") === (b.area_id ?? "") &&
  a.on_cargo_id === b.on_cargo_id;

/** `[bottom, top)` of an item above its area's floor. Two footprints that overlap in plan only conflict
 * when these ranges intersect too — which is what makes a stack legal and a side-by-side clash not. */
export function verticalRange(plan: StackPlan, cargoId: string, heightM: number): [number, number] {
  const bottom = elevationOf(plan, cargoId);
  return [bottom, bottom + heightM];
}

export const rangesOverlap = (a: [number, number], b: [number, number]): boolean =>
  a[0] < b[1] - TOLERANCE_M && b[0] < a[1] - TOLERANCE_M;

/** The floor-touching item under `cargoId` and the pressure its footprint puts on the floor, INCLUDING
 * everything stacked on it. For a plan with no stacks this is exactly the old own-weight pressure. */
export function floorPressure(plan: StackPlan, cargoId: string): { id: string; pressure: number } | null {
  const bottomId = stackBottomOf(plan, cargoId);
  const bottom = plan.breakbulk_cargo.find((c) => c.id === bottomId);
  if (!bottom) return null;
  return { id: bottomId, pressure: (bottom.weight_t + loadAbove(plan, bottomId)) / (bottom.length_m * bottom.width_m) };
}

const WHY: Record<BrokenSupportReason, string> = {
  missing: "it is not placed",
  cycle: "it rests on this item",
  not_stackable: "it is not stackable",
  other_area: "it is in another stowage area",
};

const within = (inner: Rect, outer: Rect): boolean =>
  inner.xMin >= outer.xMin - TOLERANCE_M &&
  inner.xMax <= outer.xMax + TOLERANCE_M &&
  inner.zMin >= outer.zMin - TOLERANCE_M &&
  inner.zMax <= outer.zMax + TOLERANCE_M;

/**
 * The three stacking rules for `item` resting on `supportId` in the candidate plan `cand`:
 *  - `breakbulk_support_invalid`: the chain is broken. Only the DIRECT support's break (or any cycle)
 *    is reported here — a break further down is already reported by the item standing on it, and
 *    repeating it for every item above would bury the one line that matters.
 *  - `breakbulk_unsupported`: the footprint is not entirely on the support's top (no overhang).
 *  - `breakbulk_support_overloaded`: some support in the chain carries more than its max top load.
 *    Named by the SUPPORT, so the plan-wide rule's message dedup reports each overloaded support once.
 */
export function stackReasons(cand: StackPlan, item: BreakbulkCargo, supportId: string | undefined, rect: Rect): Reason[] {
  if (!supportId) return [];
  const reasons: Reason[] = [];
  const { chain, broken } = supportChain(cand, item.id);
  if (broken && (broken.why === "cycle" || broken.supportId === supportId)) {
    reasons.push(reason("breakbulk_support_invalid", `${item.id}: cannot rest on ${supportId} (${WHY[broken.why]})`));
  }
  const supportItem = cand.breakbulk_cargo.find((c) => c.id === supportId);
  const supportPlacement = cand.breakbulk_placements.find((p) => p.cargo_id === supportId);
  if (supportItem && supportPlacement && supportId !== item.id && !within(rect, footprintRect(supportItem, supportPlacement))) {
    reasons.push(reason("breakbulk_unsupported", `${item.id}: footprint overhangs ${supportId}`));
  }
  for (const id of chain) {
    const max = cand.breakbulk_cargo.find((c) => c.id === id)?.stacking?.max_top_load_t;
    if (max === undefined) continue; // not stackable: already reported as an invalid support
    const load = loadAbove(cand, id);
    if (load > max + 1e-9) {
      reasons.push(reason("breakbulk_support_overloaded", `${id}: ${load.toFixed(1)}t on top exceeds its ${max}t max top load`));
    }
  }
  return reasons;
}
