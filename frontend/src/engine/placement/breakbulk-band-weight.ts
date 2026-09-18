/**
 * breakbulk-band-weight.ts — the 20 m band weight arithmetic of `canPlaceBreakbulk`, moved out
 * unchanged when stacking pushed that file past 200 lines. The float behaviour is load-bearing: band
 * edges are built by repeated addition from `area.xMin`, exactly as the plan-wide rule always did.
 */
import type { BreakbulkCargo, StowagePlan } from "@/types/domain";
import type { Rect } from "@/engine/breakbulk-overlap-check";
import { areaIdOf } from "@/engine/stowage-model";

/** DEMO approximation, not real structural deck strength — see plan.md "Ngoài phạm vi". */
export const OVERWEIGHT_BAND_M = 20;
export const OVERWEIGHT_LIMIT_T = 200;

/** The 20 m band containing `x_m`, reproduced with the rule's own arithmetic (repeated addition from
 * `area.xMin`, `x_m` inclusive of the start and exclusive of the end) so band edges land on exactly
 * the same floats. Null when the point is in no band — the rule's `for` loop would have skipped it. */
export function bandFor(area: Rect, x_m: number): { start: number; end: number } | null {
  let start = area.xMin;
  while (start < area.xMax) {
    const end = start + OVERWEIGHT_BAND_M;
    if (x_m >= start && x_m < end) return { start, end };
    start = end;
  }
  return null;
}

/** Weight of the band in one area with the candidate's own placement excluded (it is re-added by the
 * caller, which makes the total identical whether the item is already placed or not). */
export function bandWeight(plan: StowagePlan, byId: Map<string, BreakbulkCargo>, itemId: string, areaId: string, band: { start: number; end: number }): number {
  let weight = 0;
  for (const p of plan.breakbulk_placements) {
    if (p.cargo_id === itemId) continue;
    if (areaIdOf(p) !== areaId) continue;
    if (p.x_m < band.start || p.x_m >= band.end) continue;
    weight += byId.get(p.cargo_id)?.weight_t ?? 0; // orphans carry no weight, as in `byArea`
  }
  return weight;
}
