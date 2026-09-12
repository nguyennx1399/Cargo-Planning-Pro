/**
 * Naive demo-only placement for breakbulk cargo: greedy shelf-packing (sort by footprint area
 * descending, lay items along x within a z-row — skipping past any x already occupied by an
 * on-deck container or an already-placed item — wrap to the next row when x runs out). NOT a
 * real bin-packing optimizer — same spirit as naive-fill-plan.ts for containers. Some items may
 * end up unplaced if the deck genuinely doesn't have room (see phase-02 plan's Success Criteria).
 */
import type { BreakbulkCargo, BreakbulkPlacement, Vessel } from "@/types/domain";
import { deckArea, type DeckArea } from "./breakbulk-deck-area";
import { footprintRect, rectsOverlap, type Rect } from "./breakbulk-overlap-check";
import type { XZone } from "./breakbulk-forbidden-zones";

export interface BreakbulkFillResult {
  placements: BreakbulkPlacement[];
  unplaced: string[];
}

/** Finds the leftmost valid x (>= startX) for a rect of the given length/width at z=rowZ within
 * the deck's x bounds, skipping past any forbidden zone or already-placed rect that blocks it.
 * Returns null if no valid x remains before running off the deck's x bound. */
function findXInRow(
  startX: number,
  lengthM: number,
  widthM: number,
  rowZ: number,
  area: DeckArea,
  forbiddenXZones: XZone[],
  placedRects: Rect[]
): number | null {
  let x = startX;
  while (x + lengthM <= area.xMax) {
    const rect: Rect = { xMin: x, xMax: x + lengthM, zMin: rowZ, zMax: rowZ + widthM };
    const blockingZone = forbiddenXZones.find((z) => rect.xMin < z.xMax && rect.xMax > z.xMin);
    if (blockingZone) {
      x = blockingZone.xMax;
      continue;
    }
    const blockingRect = placedRects.find((r) => rectsOverlap(rect, r));
    if (blockingRect) {
      x = blockingRect.xMax;
      continue;
    }
    return x;
  }
  return null;
}

export function naiveFillBreakbulk(vessel: Vessel, cargo: BreakbulkCargo[], forbiddenXZones: XZone[]): BreakbulkFillResult {
  const area = deckArea(vessel);
  const sorted = [...cargo].sort((a, b) => b.length_m * b.width_m - a.length_m * a.width_m);

  const placements: BreakbulkPlacement[] = [];
  const placedRects: Rect[] = [];
  const unplaced: string[] = [];
  let rowZ = area.zMin;
  let rowDepth = 0;

  for (const item of sorted) {
    if (item.length_m > area.xMax - area.xMin || item.width_m > area.zMax - area.zMin) {
      unplaced.push(item.id); // doesn't fit the deck at all, in either dimension
      continue;
    }

    let x = findXInRow(area.xMin, item.length_m, item.width_m, rowZ, area, forbiddenXZones, placedRects);
    if (x === null) {
      // current row is full/blocked — start a fresh row below the tallest item placed so far
      rowZ += rowDepth;
      rowDepth = 0;
      if (rowZ + item.width_m > area.zMax) {
        unplaced.push(item.id); // out of deck width entirely
        continue;
      }
      x = findXInRow(area.xMin, item.length_m, item.width_m, rowZ, area, forbiddenXZones, placedRects);
    }
    if (x === null) {
      unplaced.push(item.id);
      continue;
    }

    const placement: BreakbulkPlacement = { cargo_id: item.id, x_m: x + item.length_m / 2, z_m: rowZ + item.width_m / 2, rotation_deg: 0 };
    placements.push(placement);
    placedRects.push(footprintRect(item, placement));
    rowDepth = Math.max(rowDepth, item.width_m);
  }

  return { placements, unplaced };
}
