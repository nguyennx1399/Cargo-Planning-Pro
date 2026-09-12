// Turns a hand-traced body-plan curve per station (clicked points along the hull skin, already
// calibrated to ship-frame (half-breadth, z) via drawing-calibration.ts) into a HullOffsets
// grid at the target waterlines — feeding straight into phase-04's fairness check + the shared
// loft mesher (plan G2), same as a CSV import.
import type { HullOffsets } from "@/types/vessel-geometry";
import { catmullRomResample, type Point2 } from "@/engine/hull/catmull-rom-spline";

export interface TracedStation {
  xShipFrameM: number;
  /** Clicked points along the skin, ordered from keel to deck: [halfBreadth_m, z_m]. */
  points: Point2[];
}

/** Evaluates a traced curve's half-breadth at a target z, by densely resampling the spline
 * through the clicked points and linearly interpolating between the two dense samples that
 * bracket targetZ. Returns null when targetZ is outside the traced z-range (the station simply
 * wasn't traced that high/low — same "missing = null" convention as the CSV importer). */
function evaluateTracedCurveAtZ(points: Point2[], targetZ: number): number | null {
  if (points.length < 2) return null;
  const zs = points.map((p) => p[1]);
  const zMin = Math.min(...zs);
  const zMax = Math.max(...zs);
  if (targetZ < zMin - 1e-6 || targetZ > zMax + 1e-6) return null;

  const dense = catmullRomResample(points, Math.max(200, points.length * 10));
  for (let i = 0; i < dense.length - 1; i++) {
    const [b0, z0] = dense[i];
    const [b1, z1] = dense[i + 1];
    const between = (z0 <= targetZ && targetZ <= z1) || (z1 <= targetZ && targetZ <= z0);
    if (!between) continue;
    const f = z1 === z0 ? 0 : (targetZ - z0) / (z1 - z0);
    return b0 + (b1 - b0) * f;
  }
  return null;
}

export function bodyPlanToOffsets(stations: TracedStation[], waterlinesZM: number[]): HullOffsets {
  const sorted = stations.slice().sort((a, b) => a.xShipFrameM - b.xShipFrameM);
  const waterlines_z_m = waterlinesZM.slice().sort((a, b) => a - b);
  return {
    stations_x_m: sorted.map((s) => s.xShipFrameM),
    waterlines_z_m,
    half_breadths_m: sorted.map((s) => waterlines_z_m.map((z) => evaluateTracedCurveAtZ(s.points, z))),
  };
}
