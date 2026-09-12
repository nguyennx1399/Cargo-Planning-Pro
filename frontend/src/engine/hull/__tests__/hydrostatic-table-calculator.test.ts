import { describe, expect, it } from "vitest";
import { computeHydrostaticTable } from "../hydrostatic-table-calculator";
import type { HullOffsets } from "@/types/vessel-geometry";

function boxBargeOffsets(L: number, B: number, maxZ: number, stationCount = 21, waterlineCount = 11): HullOffsets {
  const stations_x_m = Array.from({ length: stationCount }, (_, i) => (i / (stationCount - 1)) * L);
  const waterlines_z_m = Array.from({ length: waterlineCount }, (_, i) => (i / (waterlineCount - 1)) * maxZ);
  const half_breadths_m = stations_x_m.map(() => waterlines_z_m.map(() => B / 2));
  return { stations_x_m, waterlines_z_m, half_breadths_m };
}

describe("computeHydrostaticTable — box barge (fully analytic, z-orientation-independent)", () => {
  const L = 100;
  const B = 20;
  const T = 5;
  const rho = 1.025;
  const offsets = boxBargeOffsets(L, B, T * 1.5); // waterlines extend past T so T itself is an interior point
  const [row] = computeHydrostaticTable(offsets, { lbp_m: L, beam_m: B }, { drafts: [T], rho });

  it("displacement volume and mass", () => {
    expect(row.displacement_volume_m3).toBeCloseTo(L * B * T, 6);
    expect(row.displacement_t).toBeCloseTo(rho * L * B * T, 6);
  });

  it("KB = T/2, LCB = L/2 (from AP)", () => {
    expect(row.kb_m).toBeCloseTo(T / 2, 6);
    expect(row.lcb_m).toBeCloseTo(L / 2, 3);
  });

  it("Awp = L*B (full rectangle), LCF = L/2, TPC = Awp*rho/100", () => {
    expect(row.waterplane_area_m2).toBeCloseTo(L * B, 6);
    expect(row.lcf_m).toBeCloseTo(L / 2, 3);
    expect(row.tpc_t_per_cm).toBeCloseTo((L * B * rho) / 100, 6);
  });

  it("BMt = B^2/(12T), KMt = KB + BMt", () => {
    const bmtExpected = B ** 2 / (12 * T);
    expect(row.bmt_m).toBeCloseTo(bmtExpected, 3);
    expect(row.kmt_m).toBeCloseTo(T / 2 + bmtExpected, 3);
  });

  it("BMl = L^2/(12T), MTC = Δ*BMl/(100*LBP), within 1% (trapezoidal on a quadratic (x-LCF)^2 " +
    "integrand over a 21-station grid isn't exact — this is discretization error, not a formula bug)", () => {
    const bmlExpected = L ** 2 / (12 * T);
    expect(Math.abs(row.bml_m - bmlExpected) / bmlExpected).toBeLessThan(0.01);
    const mtcExpected = (rho * L * B * T * bmlExpected) / (100 * L);
    expect(Math.abs(row.mtc_t_m_per_cm - mtcExpected) / mtcExpected).toBeLessThan(0.01);
  });

  it("Cb = Cm = Cwp = 1 for a rectangular barge", () => {
    expect(row.cb).toBeCloseTo(1, 6);
    expect(row.cm).toBeCloseTo(1, 6);
    expect(row.cwp).toBeCloseTo(1, 6);
  });

  it("applies a displacement_factor multiplicatively to displacement_t only", () => {
    const [factored] = computeHydrostaticTable(offsets, { lbp_m: L, beam_m: B }, { drafts: [T], rho, displacementFactor: 1.005 });
    expect(factored.displacement_t).toBeCloseTo(row.displacement_t * 1.005, 6);
    expect(factored.displacement_volume_m3).toBeCloseTo(row.displacement_volume_m3, 6); // volume itself unaffected
  });

  it("computes a row per requested draft, independently", () => {
    const rows = computeHydrostaticTable(offsets, { lbp_m: L, beam_m: B }, { drafts: [2, 4, 7], rho });
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.draft_m)).toEqual([2, 4, 7]);
    expect(rows[1].displacement_volume_m3).toBeCloseTo(L * B * 4, 6);
  });
});

// The Wigley fixture used elsewhere in this codebase (phase-02/04) has y maximal at z=0 (baseline)
// and zero at z=T — the OPPOSITE of the classic Wigley convention (max breadth AT the design
// waterline, tapering to a point at the keel). That's fine for Cb (z-flip-symmetric) but wrong
// for anything that evaluates y specifically at z=T (Awp, LCF, BMt, KMt, MTC, Cwp) or takes a
// z-moment (KB) — those need max breadth AT z=T. Defined correctly here, locally, for this test
// only; NOT a fix to the shared fixture (that's a separate, wider-blast-radius cleanup — see
// phase-06 plan file's Deviations for why this wasn't touched this session).
function wigleyOffsetsWaterlineOriented(L: number, B: number, T: number, stationCount = 81, waterlineCount = 41): HullOffsets {
  const stations_x_m = Array.from({ length: stationCount }, (_, i) => (i / (stationCount - 1)) * L);
  const waterlines_z_m = Array.from({ length: waterlineCount }, (_, i) => (i / (waterlineCount - 1)) * T);
  const half_breadths_m = stations_x_m.map((x) => {
    const u = (2 * x) / L - 1;
    return waterlines_z_m.map((z) => {
      const v = z / T; // v=1 at the waterline (z=T) -> full breadth; v=0 at the keel -> zero
      return (B / 2) * (1 - u * u) * v * (2 - v);
    });
  });
  return { stations_x_m, waterlines_z_m, half_breadths_m };
}

describe("computeHydrostaticTable — waterline-oriented Wigley hull (closed-form Cb=4/9, Cwp=2/3, KB=5T/8)", () => {
  const L = 160;
  const B = 20;
  const T = 10;
  const offsets = wigleyOffsetsWaterlineOriented(L, B, T);
  const [row] = computeHydrostaticTable(offsets, { lbp_m: L, beam_m: B }, { drafts: [T] });

  it("Cb close to 4/9", () => {
    expect(Math.abs(row.cb - 4 / 9)).toBeLessThan(0.003);
  });

  it("Cwp close to 2/3", () => {
    expect(Math.abs(row.cwp - 2 / 3)).toBeLessThan(0.003);
  });

  it("KB close to 5T/8 (derived analytically for this hull: integrate y(z)=(B/2)k*v*(2-v) times z" +
    " and plain over z in [0,T], ratio is x-independent since k(x) cancels; confirmed by brute-force" +
    " numeric double integration at 2000x2000 resolution -> KB/T = 0.625000)", () => {
    expect(Math.abs(row.kb_m - (5 * T) / 8)).toBeLessThan(0.05);
  });
});
