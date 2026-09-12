// L1 hull generator: main particulars + a few shape params -> a HullOffsets grid, fitted to
// hit the target Cb. Offsets are the single hand-off to the shared loft mesher and integrator
// (plan G2) — L1 does not draw a mesh directly.
//
// TODO(phase-3+): `params.stern` is accepted but "transom" currently behaves identically to
// "cruiser" (both taper smoothly to a point at AP). A real flat transom face needs two
// co-located stations with different profiles and isn't modeled yet.
import type { HullOffsets, MainParticulars, ParametricHullParams } from "@/types/vessel-geometry";
import { blockCoefficient } from "./section-integrals";
import { envelopeHalfBreadth, sectionHalfBreadth } from "./parametric-section-shapes";

const STATION_COUNT = 41; // AP (x=0) .. FP (x=lbp_m), evenly spaced
const WATERLINE_COUNT = 25; // baseline (z=0) .. deck (z=depth_m)
const ENTRANCE_POWER_MIN = 0.4;
const ENTRANCE_POWER_MAX = 10;

/** Generates a HullOffsets grid whose Cb at design draft matches `particulars.cb`, by fitting
 * the entrance/run power-law exponent (bisection; block coefficient is monotone increasing
 * in the exponent for this envelope shape). */
export function generateParametricOffsets(particulars: MainParticulars, params: ParametricHullParams): HullOffsets {
  const p = fitEntrancePower(particulars, params);
  return buildOffsets(particulars, params, p);
}

function fitEntrancePower(particulars: MainParticulars, params: ParametricHullParams): number {
  const target = particulars.cb;
  const cbAt = (p: number) => blockCoefficient(buildOffsets(particulars, params, p), particulars, particulars.design_draft_m);
  let lo = ENTRANCE_POWER_MIN;
  let hi = ENTRANCE_POWER_MAX;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (cbAt(mid) < target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

function buildOffsets(particulars: MainParticulars, params: ParametricHullParams, entrancePower: number): HullOffsets {
  const { lbp_m, beam_m, depth_m, aft_overhang_m } = particulars;
  const halfBeam = beam_m / 2;
  const bilgeRadius = params.bilge_radius_m ?? Math.min(2.5, halfBeam * 0.3);

  const mainStations = Array.from({ length: STATION_COUNT }, (_, i) => (i / (STATION_COUNT - 1)) * lbp_m);
  const bulbStations =
    params.bow === "bulbous" && params.bulb
      ? [lbp_m + params.bulb.length_m * 0.5, lbp_m + params.bulb.length_m]
      : [];
  const stations_x_m = [-aft_overhang_m, ...mainStations, ...bulbStations];

  const waterlines_z_m = Array.from({ length: WATERLINE_COUNT }, (_, i) => (i / (WATERLINE_COUNT - 1)) * depth_m);

  // The aft-taper reference length is extended past AP by the overhang, so the envelope
  // reaches exactly 0 at the true stern tip (x=-aft_overhang_m) instead of already hitting 0
  // at AP (x=0) — otherwise that whole overhang span collapses into a zero-width "blade"
  // between two independently-zero stations instead of a smooth taper.
  const aftTaperExtraFrac = aft_overhang_m / lbp_m;

  const half_breadths_m: number[][] = stations_x_m.map((x) => {
    if (x > lbp_m) return waterlines_z_m.map(() => 0); // bulb-region default, overridden below
    const xi = x / lbp_m; // negative for the aft-tip station, in the overhang
    const fullness = envelopeHalfBreadth(xi, params.parallel_midbody, entrancePower, aftTaperExtraFrac); // 0..1
    const b = fullness * halfBeam;
    const r = bilgeRadius * Math.max(fullness, 0.15); // finer bilge toward the fine ends
    return waterlines_z_m.map((z) => Math.min(sectionHalfBreadth(z, b, r), halfBeam));
  });

  if (params.bow === "bulbous" && params.bulb) {
    const bulbMidIndex = 1 + STATION_COUNT; // first bulb station in stations_x_m
    const { breadth_m, height_m } = params.bulb;
    half_breadths_m[bulbMidIndex] = waterlines_z_m.map((z) => {
      const centerZ = height_m / 2;
      const r = height_m / 2;
      return z <= height_m ? (breadth_m / 2) * Math.sqrt(Math.max(1 - ((z - centerZ) / r) ** 2, 0)) : 0;
    });
  }

  return { stations_x_m, waterlines_z_m, half_breadths_m };
}
