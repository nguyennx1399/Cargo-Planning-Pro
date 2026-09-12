// Integrates a HullOffsets grid: half-breadth query, per-station submerged area, and the
// longitudinal integrals needed to fit Cb (phase 2) and, later, hydrostatics (phase 6) —
// one integrator shared by every hull source (plan G2).
import type { HullOffsets } from "@/types/vessel-geometry";

/** Half-breadth at an arbitrary z within a given station's table, linear-interpolated.
 * A null table value (outside the hull at that waterline) contributes 0. */
export function halfBreadthAt(offsets: HullOffsets, stationIndex: number, z: number): number {
  const zs = offsets.waterlines_z_m;
  const row = offsets.half_breadths_m[stationIndex];
  if (z <= zs[0]) return row[0] ?? 0;
  if (z >= zs[zs.length - 1]) return row[row.length - 1] ?? 0;
  let lo = 0;
  let hi = zs.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (zs[mid] <= z) lo = mid;
    else hi = mid;
  }
  const ya = row[lo];
  const yb = row[hi];
  if (ya === null || yb === null) return 0;
  const f = (z - zs[lo]) / (zs[hi] - zs[lo]);
  return ya + (yb - ya) * f;
}

/** Submerged cross-section area (both sides) up to zTop, trapezoidal over the waterline table. */
export function sectionArea(offsets: HullOffsets, stationIndex: number, zTop: number): number {
  const zs = offsets.waterlines_z_m;
  let halfArea = 0;
  for (let i = 0; i < zs.length - 1 && zs[i] < zTop; i++) {
    const za = zs[i];
    const zb = Math.min(zs[i + 1], zTop);
    const ya = halfBreadthAt(offsets, stationIndex, za);
    const yb = halfBreadthAt(offsets, stationIndex, zb);
    halfArea += ((ya + yb) / 2) * (zb - za);
  }
  return halfArea * 2;
}

/** Trapezoidal integral of ys(xs) — exported so phase-6's hydrostatics calculator reuses the
 * exact same longitudinal integrator (one integrator, plan G2), not a second implementation. */
export function trapz(xs: number[], ys: number[]): number {
  let sum = 0;
  for (let i = 0; i < xs.length - 1; i++) sum += ((ys[i] + ys[i + 1]) / 2) * (xs[i + 1] - xs[i]);
  return sum;
}

/** First moment of submerged area about the baseline (z=0), up to zTop: 2*integral(z*y dz).
 * Exact for the piecewise-LINEAR interpolant halfBreadthAt already assumes between tabulated
 * waterlines (trapezoidal alone isn't exact for z*y, a quadratic, so each segment is integrated
 * in closed form). Needed for KB = (this, integrated along x) / displaced volume. */
export function sectionMomentAboutBaseline(offsets: HullOffsets, stationIndex: number, zTop: number): number {
  const zs = offsets.waterlines_z_m;
  let halfMoment = 0;
  for (let i = 0; i < zs.length - 1 && zs[i] < zTop; i++) {
    const za = zs[i];
    const zb = Math.min(zs[i + 1], zTop);
    const ya = halfBreadthAt(offsets, stationIndex, za);
    const yb = halfBreadthAt(offsets, stationIndex, zb);
    halfMoment += segmentZMoment(za, ya, zb, yb);
  }
  return halfMoment * 2;
}

/** Exact integral of z*y(z) over [za,zb], where y is linear between (za,ya) and (zb,yb). */
function segmentZMoment(za: number, ya: number, zb: number, yb: number): number {
  const h = zb - za;
  if (h === 0) return 0;
  const slope = (yb - ya) / h;
  const intZ2 = (zb ** 3 - za ** 3) / 3;
  const intZ1 = (zb ** 2 - za ** 2) / 2;
  return slope * intZ2 + (ya - slope * za) * intZ1;
}

/** Displaced volume up to draft T, trapezoidal along x over all stations. */
export function displacedVolume(offsets: HullOffsets, draftM: number): number {
  const areas = offsets.stations_x_m.map((_, si) => sectionArea(offsets, si, draftM));
  return trapz(offsets.stations_x_m, areas);
}

export function blockCoefficient(
  offsets: HullOffsets,
  particulars: { lbp_m: number; beam_m: number },
  draftM: number
): number {
  const volume = displacedVolume(offsets, draftM);
  return volume / (particulars.lbp_m * particulars.beam_m * draftM);
}
