// Arbitrary-point half-breadth lookup over a HullOffsets grid (bilinear: linear along x
// between stations, linear along z within halfBreadthAt). Used by slots-inside-hull-check.ts
// now, and by the GA/offsets tracer's overlay in phase 5.
import type { HullOffsets } from "@/types/vessel-geometry";
import { halfBreadthAt } from "./section-integrals";

/** Half-breadth at an arbitrary ship-frame (x, z). Returns 0 outside the station range —
 * there is no hull material beyond the first/last defined station. */
export function hullHalfBreadthAt(offsets: HullOffsets, x: number, z: number): number {
  const xs = offsets.stations_x_m;
  if (x <= xs[0] || x >= xs[xs.length - 1]) return 0;
  let lo = 0;
  let hi = xs.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (xs[mid] <= x) lo = mid;
    else hi = mid;
  }
  const y0 = halfBreadthAt(offsets, lo, z);
  const y1 = halfBreadthAt(offsets, hi, z);
  const f = (x - xs[lo]) / (xs[hi] - xs[lo]);
  return y0 + (y1 - y0) * f;
}
