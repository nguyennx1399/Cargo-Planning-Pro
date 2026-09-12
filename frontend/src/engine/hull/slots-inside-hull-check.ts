// Checks that under-deck cargo slots fit within the hull skin (a bay near a fine bow/stern can
// otherwise poke a container through the shell). On-deck cargo isn't checked — it sits above
// the hull, not constrained by its underwater/topside skin.
//
// Real per-bay/row ship-frame positions aren't calibrated yet (that lands in phase 5's GA
// tracer, as `VesselGeometry.bay_lcg_m`); callers pass in how to get a ship-frame (x, y) for a
// bay/row today (e.g. via lib/geometry.ts's scene-space helpers, converted with shipToScene).
import type { Vessel } from "@/types/domain";
import type { VesselGeometry } from "@/types/vessel-geometry";
import { hullHalfBreadthAt } from "./hull-half-breadth-query";

export interface HullFitIssue {
  bay: number;
  row: number;
  reason: string;
}

/** z used to sample the hull's half-breadth: low enough to catch a fine entrance/run pinching
 * in before the outermost row, well above the flat bottom so it isn't fooled by the keel.
 * TODO(phase-4+): half-breadth is monotonic non-decreasing from keel to deck, so this single-z
 * check is only sound if it sits BELOW every stack's true lowest cargo point — not verified
 * against real tank-top/tier extents yet. Fine for the current demo stacks; check per-tier z
 * once real stack geometry (not just bay/row) is available. */
const CHECK_Z_FRACTION_OF_DEPTH = 0.35;

export function checkSlotsInsideHull(
  vessel: Vessel,
  geometry: VesselGeometry,
  bayXShipFrame: (bay: number) => number,
  rowYShipFrame: (row: number) => number
): HullFitIssue[] {
  const offsets = geometry.hull.offsets;
  if (!offsets) return []; // nothing to check yet (no offsets generated/imported)

  const checkZ = geometry.particulars.depth_m * CHECK_Z_FRACTION_OF_DEPTH;
  const issues: HullFitIssue[] = [];
  const checked = new Set<string>();

  for (const stack of vessel.stacks) {
    if (stack.deck !== "under") continue;
    const key = `${stack.bay}-${stack.row}`;
    if (checked.has(key)) continue;
    checked.add(key);

    const x = bayXShipFrame(stack.bay);
    const yAbs = Math.abs(rowYShipFrame(stack.row));
    const halfBreadth = hullHalfBreadthAt(offsets, x, checkZ);
    if (yAbs > halfBreadth) {
      issues.push({
        bay: stack.bay,
        row: stack.row,
        reason: `|y|=${yAbs.toFixed(2)}m exceeds hull half-breadth ${halfBreadth.toFixed(2)}m at x=${x.toFixed(1)}m`,
      });
    }
  }
  return issues;
}
