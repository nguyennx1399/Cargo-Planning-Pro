// Integrates a HullOffsets grid into an even-keel hydrostatic table. STRICTLY a `computed`
// aid — never a substitute for the class-approved stability booklet (plan G3, RT-2). Uses only
// the shared integrator from section-integrals.ts (one integrator, plan G2).
import type { HullOffsets } from "@/types/vessel-geometry";
import { halfBreadthAt, sectionArea, sectionMomentAboutBaseline, trapz } from "./section-integrals";

export interface HydrostaticRow {
  draft_m: number;
  displacement_volume_m3: number;
  displacement_t: number;
  kb_m: number;
  lcb_m: number; // ship-frame x (from AP)
  waterplane_area_m2: number;
  lcf_m: number; // ship-frame x (from AP)
  tpc_t_per_cm: number;
  bmt_m: number;
  kmt_m: number;
  bml_m: number;
  mtc_t_m_per_cm: number;
  cb: number;
  cm: number;
  cwp: number;
}

export interface HydrostaticTableOptions {
  drafts: number[];
  rho?: number; // t/m^3, default seawater 1.025
  displacementFactor?: number; // corrects for shell plating + appendages, fitted at ONE draft (plan G3 note)
}

export function computeHydrostaticTable(
  offsets: HullOffsets,
  particulars: { lbp_m: number; beam_m: number },
  opts: HydrostaticTableOptions
): HydrostaticRow[] {
  const rho = opts.rho ?? 1.025;
  const factor = opts.displacementFactor ?? 1.0;
  return opts.drafts.map((draftM) => computeRow(offsets, particulars, draftM, rho, factor));
}

function computeRow(
  offsets: HullOffsets,
  particulars: { lbp_m: number; beam_m: number },
  draftM: number,
  rho: number,
  factor: number
): HydrostaticRow {
  const xs = offsets.stations_x_m;
  const areas = xs.map((_, si) => sectionArea(offsets, si, draftM));
  const moments = xs.map((_, si) => sectionMomentAboutBaseline(offsets, si, draftM));

  const volume = trapz(xs, areas);
  const kb = volume > 0 ? trapz(xs, moments) / volume : 0;
  const lcb = volume > 0 ? trapz(xs, areas.map((a, i) => a * xs[i])) / volume : 0;

  const yWl = xs.map((_, si) => halfBreadthAt(offsets, si, draftM));
  const awp = trapz(xs, yWl) * 2;
  const lcf = awp > 0 ? (trapz(xs, yWl.map((y, i) => y * xs[i])) * 2) / awp : 0;
  const tpc = (awp * rho) / 100;

  const iT = (2 / 3) * trapz(xs, yWl.map((y) => y ** 3));
  const bmt = volume > 0 ? iT / volume : 0;
  const kmt = kb + bmt;

  const iL = 2 * trapz(xs, xs.map((x, i) => (x - lcf) ** 2 * yWl[i]));
  const bml = volume > 0 ? iL / volume : 0;
  const displacement = rho * volume * factor;
  const mtc = particulars.lbp_m > 0 ? (displacement * bml) / (100 * particulars.lbp_m) : 0;

  const cb = volume / (particulars.lbp_m * particulars.beam_m * draftM);
  const midshipArea = areas[closestIndex(xs, particulars.lbp_m / 2)];
  const cm = midshipArea / (particulars.beam_m * draftM);
  const cwp = awp / (particulars.lbp_m * particulars.beam_m);

  return {
    draft_m: draftM,
    displacement_volume_m3: volume,
    displacement_t: displacement,
    kb_m: kb,
    lcb_m: lcb,
    waterplane_area_m2: awp,
    lcf_m: lcf,
    tpc_t_per_cm: tpc,
    bmt_m: bmt,
    kmt_m: kmt,
    bml_m: bml,
    mtc_t_m_per_cm: mtc,
    cb,
    cm,
    cwp,
  };
}

function closestIndex(xs: number[], target: number): number {
  let best = 0;
  let bestDist = Infinity;
  xs.forEach((x, i) => {
    const d = Math.abs(x - target);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  });
  return best;
}
