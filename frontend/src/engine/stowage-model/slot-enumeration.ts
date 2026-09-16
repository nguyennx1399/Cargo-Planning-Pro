/**
 * Slot enumeration — which (bay, row, tier) positions the model exposes (spec §4.1/§4.2), split out
 * of build-stowage-model.ts to keep both files short.
 *
 * The shapes are the ones the VALIDATOR addresses, and they are derived from the validator's own
 * function rather than restated: `slot-helpers.bayPosition` maps an odd (20') bay onto the fore/aft
 * half of its 40' parent, so asking it is what makes `slotExists`, `cellConflict`, `twentyOnForty`
 * and the drag-and-drop predicate agree with this list by construction. `allSlots(vessel)` — the 40'
 * grid the packer fills — is a strict subset; the halves are the drop positions the unplaced 20' boxes
 * of the demo plans can use.
 */
import type { Vessel } from "@/types/domain";
import { rectsOverlap } from "@/engine/breakbulk-overlap-check";
import { bayPosition, isFortyBay, twentyBaysOf } from "@/engine/slot-helpers";
import { DIM, slotToPosition } from "@/lib/geometry";
import { rectContainsPoint, rectFromCenter, sceneXToPlacementX } from "./coords";
import { WEATHER_DECK_AREA_ID, type SlotDef, type StowageArea } from "./types";

/** Tier at or above which a container is on deck — the repo-wide convention (ContainerInstances,
 * validation-rules, the old breakbulk-forbidden-zones all use 80). */
const ON_DECK_TIER_THRESHOLD = 80;

/** The bays one stack's slots occupy: its own 40' bay, plus the odd (20') half bays the validator
 * addresses its boxes by. Asking `bayPosition` instead of assuming `[bay - 1, bay + 1]` also gets a
 * vessel with ADJACENT 40' bays right, where `bay + 1` is the FORE half of the next bay, not the aft
 * half of this one. A stack declared on an odd bay is kept verbatim: that is not how this repo models
 * 20' (`bayPosition` routes odd bays through their parent — see slot-helpers' header). */
function slotBays(fortyBay: number, fortyBays: readonly number[]): number[] {
  if (!isFortyBay(fortyBay)) return [fortyBay];
  return [
    fortyBay,
    ...twentyBaysOf(fortyBay).filter((odd) => bayPosition(odd, fortyBays)?.fortyBay === fortyBay),
  ];
}

/** One (bay, row, tier) the model exposes, with the stack spec that limits it (a 20' half is limited
 * by its 40' parent's spec — see `stackKey` in validation-context.ts). */
interface SlotSeed {
  bay: number;
  row: number;
  tier: number;
  maxStackWeightT: number;
}

function slotSeeds(vessel: Vessel): SlotSeed[] {
  const seeds: SlotSeed[] = [];
  for (const stack of vessel.stacks) {
    for (const bay of slotBays(stack.bay, vessel.bays)) {
      for (const tier of stack.tiers) {
        seeds.push({ bay, row: stack.row, tier, maxStackWeightT: stack.max_weight_t });
      }
    }
  }
  return seeds;
}

/** Every slot with its scene centre, plan-view footprint, stack limit and owning area. Slot centres
 * come from the same `slotToPosition` the renderer uses, so the model can never disagree with what
 * is drawn — including for a half-slot, whose centre `bayCenterX`/`tierCenterY` route through its
 * parent bay (a bare `vessel.bays.indexOf(oddBay)` is -1). */
export function slotDefs(vessel: Vessel, areas: StowageArea[]): SlotDef[] {
  const weatherDeck = areas.find((a) => a.id === WEATHER_DECK_AREA_ID);
  const holds = areas.filter((a) => !a.onDeck);

  return slotSeeds(vessel).map((seed) => {
    const center = slotToPosition(vessel, seed);
    const z_m = center[2];
    const x_m = sceneXToPlacementX(center[0], vessel.length_m);
    // The footprint follows the slot's own parity, exactly as `sizeFitsBay` picks its bay.
    const lengthM = isFortyBay(seed.bay) ? DIM.len40 : DIM.len20;
    const rect = rectFromCenter(x_m, z_m, lengthM, DIM.width);
    const deck: "on" | "under" = seed.tier >= ON_DECK_TIER_THRESHOLD ? "on" : "under";

    // On deck: the weather deck if the footprint overlaps it. Under deck: the first hold whose
    // rect contains the slot CENTRE (a column passes through the tweendeck above the tank top).
    let areaId: string | null = null;
    if (deck === "on") {
      if (weatherDeck && rectsOverlap(rect, weatherDeck.rect)) areaId = weatherDeck.id;
    } else {
      areaId = holds.find((h) => rectContainsPoint(h.rect, x_m, z_m))?.id ?? null;
    }

    return {
      key: `${seed.bay}|${seed.row}|${seed.tier}`,
      bay: seed.bay,
      row: seed.row,
      tier: seed.tier,
      deck,
      rect,
      center,
      areaId,
      maxStackWeightT: seed.maxStackWeightT,
    };
  });
}
