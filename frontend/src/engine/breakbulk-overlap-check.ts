import type { BreakbulkCargo, BreakbulkPlacement } from "@/types/domain";

export interface Rect {
  xMin: number;
  xMax: number;
  zMin: number;
  zMax: number;
}

/** The rectangle a placed breakbulk item actually occupies — swaps length_m/width_m when
 * rotation_deg is 90 (the only two rotations the naive placer/validator support). */
export function footprintRect(item: BreakbulkCargo, placement: BreakbulkPlacement): Rect {
  const rotated = placement.rotation_deg === 90;
  const xExtent = rotated ? item.width_m : item.length_m;
  const zExtent = rotated ? item.length_m : item.width_m;
  return {
    xMin: placement.x_m - xExtent / 2,
    xMax: placement.x_m + xExtent / 2,
    zMin: placement.z_m - zExtent / 2,
    zMax: placement.z_m + zExtent / 2,
  };
}

/** Two rectangles overlap only if they overlap on BOTH axes; touching at an edge (equal bound)
 * does not count as overlapping. */
export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.xMin < b.xMax && a.xMax > b.xMin && a.zMin < b.zMax && a.zMax > b.zMin;
}
