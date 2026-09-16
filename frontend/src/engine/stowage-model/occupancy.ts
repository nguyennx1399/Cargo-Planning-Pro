/**
 * Occupancy — who is already standing where (spec §4.4). Everything here reads *placements*,
 * never `vessel.stacks`: the vessel declares capacity for every bay regardless of what is loaded,
 * so keying off stacks would block the entire deck on an empty ship. That reasoning is carried
 * over from the pre-refactor breakbulk-forbidden-zones.ts.
 */
import type { BreakbulkCargo, BreakbulkPlacement, Placement, Vessel } from "@/types/domain";
import { footprintRect, rectsOverlap, type Rect } from "@/engine/breakbulk-overlap-check";
import { isFortyBay } from "@/engine/slot-helpers";
import { bayCenterX, DIM, rowCenterZ } from "@/lib/geometry";
import { buildStowageModel } from "./build-stowage-model";
import { rectFromCenter, sceneXToPlacementX } from "./coords";
import { WEATHER_DECK_AREA_ID, areaIdOf, type OccupiedStack } from "./types";

/** Same convention as the renderer and validation rules. */
const ON_DECK_TIER_THRESHOLD = 80;

/** One footprint per bay/row/deck that actually carries a container. */
export function occupiedStacks(vessel: Vessel, placements: Placement[]): OccupiedStack[] {
  const seen = new Map<string, OccupiedStack>();
  for (const p of placements) {
    const deck: "on" | "under" = p.slot.tier >= ON_DECK_TIER_THRESHOLD ? "on" : "under";
    const key = `${p.slot.bay}|${p.slot.row}|${deck}`;
    if (seen.has(key)) continue;

    // The footprint follows the bay's parity, the same convention `sizeFitsBay` uses to pick a bay:
    // a 20' box in an odd bay blocks one half of its parent 40' cell, not the whole cell.
    const lengthM = isFortyBay(p.slot.bay) ? DIM.len40 : DIM.len20;
    const x_m = sceneXToPlacementX(bayCenterX(vessel, p.slot.bay), vessel.length_m);
    // A row the vessel doesn't declare blocks the full beam (conservative fallback) — rowCenterZ
    // indexes into vessel.rows and would produce a meaningless position for an unknown row.
    const rect: Rect =
      vessel.rows.indexOf(p.slot.row) === -1
        ? {
            xMin: x_m - lengthM / 2,
            xMax: x_m + lengthM / 2,
            zMin: -vessel.beam_m / 2,
            zMax: vessel.beam_m / 2,
          }
        : rectFromCenter(x_m, rowCenterZ(vessel, p.slot.row), lengthM, DIM.width);

    seen.set(key, { bay: p.slot.bay, row: p.slot.row, deck, rect });
  }
  return [...seen.values()];
}

/** Container stacks grouped by the stowage area they block: on-deck stacks block the weather deck;
 * under-deck stacks block every hold area they overlap, because a container column passes through
 * the tweendeck above the tank top. */
export function containerOccupancy(
  vessel: Vessel,
  placements: Placement[],
): Map<string, OccupiedStack[]> {
  const model = buildStowageModel(vessel);
  const out = new Map<string, OccupiedStack[]>();
  const add = (areaId: string, stack: OccupiedStack): void => {
    const list = out.get(areaId);
    if (list) list.push(stack);
    else out.set(areaId, [stack]);
  };

  for (const stack of occupiedStacks(vessel, placements)) {
    if (stack.deck === "on") {
      if (model.areaById.has(WEATHER_DECK_AREA_ID)) add(WEATHER_DECK_AREA_ID, stack);
      continue;
    }
    for (const area of model.areas) {
      if (!area.onDeck && rectsOverlap(stack.rect, area.rect)) add(area.id, stack);
    }
  }
  return out;
}

/** Placed breakbulk footprints grouped by area id — the rects project cargo must not overlap. */
export function breakbulkOccupancy(
  cargo: BreakbulkCargo[],
  placements: BreakbulkPlacement[],
): Map<string, Rect[]> {
  const byId = new Map(cargo.map((c) => [c.id, c]));
  const out = new Map<string, Rect[]>();
  for (const p of placements) {
    const item = byId.get(p.cargo_id);
    if (!item) continue; // an orphan placement; validate-plan reports those separately
    const areaId = areaIdOf(p);
    const rect = footprintRect(item, p);
    const list = out.get(areaId);
    if (list) list.push(rect);
    else out.set(areaId, [rect]);
  }
  return out;
}

/** Container rects per area, as a plain record — what the packer seeds its `placedRects` with, so
 * project cargo stops colliding with whole container bays and starts respecting actual stacks. */
export function occupiedRectsByArea(
  vessel: Vessel,
  placements: Placement[],
): Record<string, Rect[]> {
  const out: Record<string, Rect[]> = {};
  for (const [areaId, stacks] of containerOccupancy(vessel, placements)) {
    out[areaId] = stacks.map((s) => s.rect);
  }
  return out;
}
