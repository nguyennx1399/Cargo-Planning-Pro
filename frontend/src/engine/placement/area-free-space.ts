/**
 * area-free-space.ts — "is there anywhere in this area the item could actually stand RIGHT NOW"
 * (Phase 03).
 *
 * WHY IT EXISTS. `freeRegionsFor`'s `feasible` answers a different question — does the item belong in
 * this area at all (rect, clear height, load rating: `AREA_FIT_RULES`) — and deliberately ignores what
 * is already standing there. That is right for "fits in: weather deck, Hold 2 tank top", and wrong as
 * the ONLY thing the planner is told: on the loaded demo plan BB005 has ZERO placeable poses across
 * all four areas while the sidebar cheerfully lists two of them. The planner then aims, gets refused
 * everywhere, and has no way to learn that the ship is simply full.
 *
 * WHAT IT IS NOT. Not a second rule set: every candidate is judged by `canPlaceBreakbulk`, the same
 * predicate the ghost, the commit and the report use. This module only decides WHICH poses to ask
 * about.
 *
 * THE SCAN, and its honest limit. A coarse lattice over the area (`SCAN_STEP_M`), both rotations, stop
 * at the first pose the predicate accepts. A step coarser than the 0.5 m drag grid can MISS a gap that
 * a careful planner could still hit by hand, so a negative answer is "this scan found nothing", never
 * "nothing exists" — `freeSpaceHint` words it that way on purpose, and the ghost's own per-pose verdict
 * stays the only promise about a specific spot. Making the step finer is a cost decision, not a
 * correctness one: 2 m over BBC SAO PAULO's four areas costs ~1.5k predicate calls (~35 ms measured in
 * the node test), and halving it quadruples that.
 *
 * COST DISCIPLINE. This is a GESTURE-start call, like `validSlotsFor` and `freeRegionsFor`: memoise it
 * on (vessel, plan, item) at the call site and never run it per pointer move. Early exit makes the
 * "there is room" case (an empty ship) almost free; the expensive case is a full ship, which is
 * exactly the case worth reporting.
 */
import type { BreakbulkCargo, StowagePlan, Vessel } from "@/types/domain";
import type { StowageArea, StowageModel } from "@/engine/stowage-model";
import { canPlaceBreakbulk, type BreakbulkPose } from "./can-place-breakbulk";
import { footprintExtents } from "./breakbulk-pose";
import type { Reason } from "./reason";

/** Lattice pitch for the scan, in metres. Coarser than the 0.5 m drag grid on purpose — see the
 * header's note on what a negative answer does and does not mean. */
export const SCAN_STEP_M = 2;

/** The rotations a scan tries. A square footprint is scanned once: the 90° pass would repeat it. */
const rotationsFor = (item: BreakbulkCargo): (0 | 90)[] =>
  item.length_m === item.width_m ? [0] : [0, 90];

export interface FreeSpaceScan {
  /** A pose the predicate ACCEPTED, or null when the scan found none. */
  pose: BreakbulkPose | null;
  /** When nothing was found: the reason that refused the most candidates — what is actually in the
   * way, in the engine's own words. Null when a pose was found (nothing is in the way) or when the
   * area admitted no candidate at all. */
  blocker: Reason | null;
  /** Predicate calls spent. Exposed so a test can pin the cost claim in the header. */
  probed: number;
}

/**
 * Scan one area for a pose this item could take right now.
 *
 * The lattice is inset by the item's half-footprint so every candidate CENTRE keeps the footprint
 * inside the rect — the same inward bound `clampPoseToArea` uses — which is why no candidate is
 * refused merely for hanging over an edge.
 */
export function scanAreaForFreePose(
  model: StowageModel,
  plan: StowagePlan,
  item: BreakbulkCargo,
  area: StowageArea,
  vessel: Vessel,
): FreeSpaceScan {
  const counts = new Map<string, { reason: Reason; n: number }>();
  let probed = 0;

  for (const rotation of rotationsFor(item)) {
    const [ex, ez] = footprintExtents(item, rotation);
    const xLo = area.rect.xMin + ex / 2;
    const xHi = area.rect.xMax - ex / 2;
    const zLo = area.rect.zMin + ez / 2;
    const zHi = area.rect.zMax - ez / 2;
    if (xLo > xHi || zLo > zHi) continue; // the item is larger than the area at this rotation

    for (let x = xLo; x <= xHi + 1e-9; x += SCAN_STEP_M) {
      for (let z = zLo; z <= zHi + 1e-9; z += SCAN_STEP_M) {
        const pose: BreakbulkPose = { areaId: area.id, x_m: x, z_m: z, rotation_deg: rotation };
        const result = canPlaceBreakbulk(model, plan, item, pose, vessel);
        probed++;
        if (result.ok) return { pose, blocker: null, probed };
        for (const reason of result.reasons) {
          const entry = counts.get(reason.rule);
          if (entry) entry.n++;
          else counts.set(reason.rule, { reason, n: 1 });
        }
      }
    }
  }

  let blocker: Reason | null = null;
  let most = 0;
  for (const { reason, n } of counts.values()) {
    if (n > most) {
      most = n;
      blocker = reason;
    }
  }
  return { pose: null, blocker, probed };
}

/**
 * The same question across a set of areas, with the same early exit: the FIRST area with room ends the
 * scan, so "there is room" costs one area's worth of probing at most.
 *
 * Callers pass the areas the item is `feasible` in (`freeRegionsFor`) — scanning an area the item
 * cannot belong in at all would burn the whole lattice to rediscover what one predicate call already
 * said.
 */
export function findFreeSpace(
  model: StowageModel,
  plan: StowagePlan,
  item: BreakbulkCargo,
  areas: readonly StowageArea[],
  vessel: Vessel,
): { areaId: string | null; blocker: Reason | null; probed: number } {
  let blocker: Reason | null = null;
  let probed = 0;
  for (const area of areas) {
    const scan = scanAreaForFreePose(model, plan, item, area, vessel);
    probed += scan.probed;
    if (scan.pose) return { areaId: area.id, blocker: null, probed };
    blocker = blocker ?? scan.blocker;
  }
  return { areaId: null, blocker, probed };
}
