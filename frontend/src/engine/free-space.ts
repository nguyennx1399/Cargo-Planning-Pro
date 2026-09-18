/**
 * free-space.ts — "what room is left on this vessel", with nothing in hand.
 *
 * Every other answer in this app is shaped to ONE item: `validSlotsFor` needs a container,
 * `freeRegionsFor` needs a project-cargo item, and both render nothing when the hand is empty. This is
 * the item-independent view: how many cells are still empty, and how much ground is not taken.
 *
 * WHAT "FREE" MEANS HERE — and what it does not. Free = not occupied and not a keep-out. It is NOT a
 * promise that anything fits: stack weight, clear height, deck rating, reefer plugs, 20'/40' parity and
 * overstow are all per-item rules that only the predicate can answer. Every sentence built from this
 * report must therefore read as "space left", never "you can load this" (`lib/free-space-text.ts`).
 *
 * THE 20'/40' TRAP, which is the one place this report could be quietly wrong: `model.slots` lists a
 * 40' cell AND its two 20' halves — the SAME physical space, three entries. Counting those raw would
 * inflate capacity by roughly 2×. So the count walks the 40' GRID (`allSlots`, which is built from
 * `vessel.stacks` and lists each bay/row/tier once) and asks whether that cell or either of its halves
 * is occupied. A cell with both halves free is 2 TEU; a cell with one half taken is 0 free TEU for a
 * 40' box but 1 TEU of 20' room, and is reported as such.
 *
 * Occupancy is NOT re-folded here: container footprints come from `occupiedRectsByArea` and project
 * cargo from `breakbulkOccupancy`, the same two functions the drawn layers use.
 */
import type { StowagePlan, Vessel } from "@/types/domain";
import { allSlots } from "@/engine/all-slots";
import { bayPosition, deckOf, isFortyBay } from "@/engine/slot-helpers";
import { buildStowageModel, breakbulkOccupancy, clipRect, occupiedRectsByArea } from "@/engine/stowage-model";
import { rectArea, rectUnionArea } from "@/engine/rect-union-area";
import { areaVisible, slotInBay, type SlotViewFilter } from "@/lib/drop-verdict";
import type { Rect } from "@/engine/breakbulk-overlap-check";

export interface AreaFreeSpace {
  areaId: string;
  label: string;
  onDeck: boolean;
  totalM2: number;
  /** Occupied footprints and keep-outs, overlaps counted once, clipped to the area. */
  takenM2: number;
  freeM2: number;
}

export interface FreeSpaceReport {
  /** Cells whose 40' space is entirely free — a 40' box's room. */
  freeFortyCellsOnDeck: number;
  freeFortyCellsUnderDeck: number;
  /** TEU still free, counting a half-taken cell as the 1 TEU it really offers. */
  freeTeuOnDeck: number;
  freeTeuUnderDeck: number;
  areas: AreaFreeSpace[];
  projectCargoPlaced: number;
  projectCargoUnplaced: number;
}

/** Keys every occupied cell of the plan as `fortyBay|row|tier` -> which halves are taken. */
function occupiedCells(vessel: Vessel, plan: StowagePlan): Map<string, Set<"fore" | "aft">> {
  const cells = new Map<string, Set<"fore" | "aft">>();
  for (const p of plan.placements) {
    const pos = bayPosition(p.slot.bay, vessel.bays);
    if (!pos) continue;
    const key = `${pos.fortyBay}|${p.slot.row}|${p.slot.tier}`;
    const halves = cells.get(key) ?? new Set<"fore" | "aft">();
    for (const half of pos.halves) halves.add(half);
    cells.set(key, halves);
  }
  return cells;
}

/**
 * Room left on `vessel` under `plan`.
 *
 * `view` applies the viewer's own deck toggles and bay filter when given, so the numbers describe what
 * the planner is actually looking at; omit it for the whole ship.
 */
export function freeSpaceReport(vessel: Vessel, plan: StowagePlan, view?: SlotViewFilter): FreeSpaceReport {
  const model = buildStowageModel(vessel);
  const cells = occupiedCells(vessel, plan);

  let freeFortyCellsOnDeck = 0;
  let freeFortyCellsUnderDeck = 0;
  let freeTeuOnDeck = 0;
  let freeTeuUnderDeck = 0;

  // The 40' grid, each bay/row/tier once — never `model.slots`, which lists the halves as well.
  for (const slot of allSlots(vessel)) {
    if (!isFortyBay(slot.bay)) continue; // a vessel may declare an odd-bay stack; its halves are counted through their parent
    const onDeck = deckOf(slot.tier) === "on";
    if (view) {
      if (onDeck ? !view.showOnDeck : !view.showUnderDeck) continue;
      if (view.bayFilter !== null && !slotInBay(slot, view.bayFilter, vessel)) continue;
    }
    const taken = cells.get(`${slot.bay}|${slot.row}|${slot.tier}`);
    const freeHalves = 2 - (taken?.size ?? 0);
    if (freeHalves === 2) {
      if (onDeck) freeFortyCellsOnDeck++;
      else freeFortyCellsUnderDeck++;
    }
    if (onDeck) freeTeuOnDeck += freeHalves;
    else freeTeuUnderDeck += freeHalves;
  }

  const stacksByArea = occupiedRectsByArea(vessel, plan.placements);
  const cargoByArea = breakbulkOccupancy(plan.breakbulk_cargo, plan.breakbulk_placements);

  const areas: AreaFreeSpace[] = model.areas
    .filter((area) => (view ? areaVisible(area, view) : true))
    .map((area) => {
      // Everything that eats into this area, clipped to it: a crane foundation half outboard or a stack
      // that overhangs must not count ground the area never had.
      const obstacles: Rect[] = [
        ...(cargoByArea.get(area.id) ?? []),
        ...(stacksByArea[area.id] ?? []),
        ...area.keepOuts,
      ]
        .map((r) => clipRect(r, area.rect))
        .filter((r): r is Rect => r !== null);
      const totalM2 = rectArea(area.rect);
      const takenM2 = Math.min(totalM2, rectUnionArea(obstacles));
      return {
        areaId: area.id,
        label: area.label,
        onDeck: area.onDeck,
        totalM2,
        takenM2,
        freeM2: Math.max(0, totalM2 - takenM2),
      };
    });

  const placed = new Set(plan.breakbulk_placements.map((p) => p.cargo_id));
  return {
    freeFortyCellsOnDeck,
    freeFortyCellsUnderDeck,
    freeTeuOnDeck,
    freeTeuUnderDeck,
    areas,
    projectCargoPlaced: placed.size,
    projectCargoUnplaced: plan.breakbulk_cargo.filter((c) => !placed.has(c.id)).length,
  };
}
