import { describe, expect, it } from "vitest";
import { interpolateHydrostatics } from "../hydrostatic-table-lookup";
import type { HydrostaticRow } from "../hull/hydrostatic-table-calculator";

function row(draft_m: number, displacement_t: number, kmt_m: number): HydrostaticRow {
  return {
    draft_m,
    displacement_volume_m3: displacement_t / 1.025,
    displacement_t,
    kb_m: draft_m / 2,
    lcb_m: 80,
    waterplane_area_m2: 4000,
    lcf_m: 78,
    tpc_t_per_cm: 35,
    bmt_m: 3,
    kmt_m,
    bml_m: 300,
    mtc_t_m_per_cm: 300,
    cb: 0.68,
    cm: 0.95,
    cwp: 0.85,
  };
}

describe("interpolateHydrostatics", () => {
  const table: HydrostaticRow[] = [row(5, 10000, 14), row(8, 18000, 12), row(11, 26000, 11.5)];

  it("returns the exact row's values at its own displacement", () => {
    const result = interpolateHydrostatics(table, 18000);
    expect(result?.draft_m).toBeCloseTo(8, 9);
    expect(result?.kmt_m).toBeCloseTo(12, 9);
  });

  it("interpolates linearly between two bracketing rows", () => {
    // halfway between 10000 (draft 5, kmt 14) and 18000 (draft 8, kmt 12)
    const result = interpolateHydrostatics(table, 14000);
    expect(result?.draft_m).toBeCloseTo(6.5, 9);
    expect(result?.kmt_m).toBeCloseTo(13, 9);
  });

  it("returns null below the table's minimum displacement", () => {
    expect(interpolateHydrostatics(table, 5000)).toBeNull();
  });

  it("returns null above the table's maximum displacement", () => {
    expect(interpolateHydrostatics(table, 40000)).toBeNull();
  });

  it("returns null for a table with fewer than 2 rows", () => {
    expect(interpolateHydrostatics([row(5, 10000, 14)], 10000)).toBeNull();
    expect(interpolateHydrostatics([], 10000)).toBeNull();
  });

  it("does not require the input table to be pre-sorted", () => {
    const shuffled = [table[2], table[0], table[1]];
    const result = interpolateHydrostatics(shuffled, 14000);
    expect(result?.draft_m).toBeCloseTo(6.5, 9);
  });
});
