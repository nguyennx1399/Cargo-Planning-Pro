/**
 * support-top-probes.ts — the tops of stackable items as drop surfaces (stacking plan, phase 04).
 *
 * A support's top is just another surface for `areaUnderCursor`, whose rule is already "the HIGHEST
 * surface under the ray wins" — exactly what stacking needs, since a top always stands above the floor
 * it rests on. So there is no second pick layer: `AreaDropPlane` stays the one writer of the hovered
 * pose, and this module only lists the extra surfaces. (A separate R3F layer could not work anyway: the
 * drop plane's box encloses every top, is entered first, and stops propagation.)
 *
 * Tops get `pad: [0, 0]`: an area is padded by the held item's half-footprint so its edge stays
 * reachable, but padding a top would let it capture the pointer beside it, and nothing could ever be
 * dropped on the floor next to a frame.
 */
import type { BreakbulkCargo, StowagePlan } from "@/types/domain";
import { footprintRect } from "@/engine/breakbulk-overlap-check";
import { areaIdOf, type StowageArea } from "@/engine/stowage-model";
import { elevationOf, supportChain } from "@/engine/placement/breakbulk-stack";
import type { AreaProbe } from "./nearest-area";

/** A top-surface probe, with what the pose needs once it is hit. */
export interface SupportTopProbe extends AreaProbe {
  /** The stowage area the support stands in — the pose's `areaId`. */
  areaId: string;
}

/**
 * The tops the item in hand may be dropped on: placed, stackable, in an area the planner can see
 * (`areas`, already filtered by the deck toggles), and neither the item in hand nor anything standing on
 * it — an item can never be dropped onto itself or onto its own load.
 */
export function supportTopProbes(
  plan: Pick<StowagePlan, "breakbulk_cargo" | "breakbulk_placements">,
  areas: readonly StowageArea[],
  handId: string,
): SupportTopProbe[] {
  const cargo = new Map<string, BreakbulkCargo>(plan.breakbulk_cargo.map((c) => [c.id, c]));
  const areaById = new Map(areas.map((a) => [a.id, a]));
  const probes: SupportTopProbe[] = [];
  for (const p of plan.breakbulk_placements) {
    const item = cargo.get(p.cargo_id);
    if (!item?.stacking || p.cargo_id === handId) continue;
    const area = areaById.get(areaIdOf(p));
    if (!area) continue; // hidden deck, or an unknown area: not a target
    if (supportChain(plan, p.cargo_id).chain.includes(handId)) continue; // resting on the item in hand
    probes.push({
      id: p.cargo_id,
      areaId: area.id,
      surfaceY: area.surfaceY + elevationOf(plan, p.cargo_id) + item.height_m,
      rect: footprintRect(item, p),
      pad: [0, 0],
    });
  }
  return probes;
}
