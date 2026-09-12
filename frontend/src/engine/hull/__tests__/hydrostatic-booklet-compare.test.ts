import { describe, expect, it } from "vitest";
import { compareHydrostatics } from "../hydrostatic-booklet-compare";
import type { HydrostaticRow } from "../hydrostatic-table-calculator";

function row(draft_m: number, overrides: Partial<HydrostaticRow> = {}): HydrostaticRow {
  return {
    draft_m,
    displacement_volume_m3: 10000,
    displacement_t: 10250,
    kb_m: 4,
    lcb_m: 80,
    waterplane_area_m2: 3000,
    lcf_m: 78,
    tpc_t_per_cm: 30,
    bmt_m: 8,
    kmt_m: 12,
    bml_m: 300,
    mtc_t_m_per_cm: 250,
    cb: 0.68,
    cm: 0.95,
    cwp: 0.85,
    ...overrides,
  };
}

const lbpM = 160;

describe("compareHydrostatics", () => {
  it("passes when computed matches booklet exactly", () => {
    const computed = [row(9.8)];
    const report = compareHydrostatics(computed, [{ draft_m: 9.8, displacement_t: 10250, kmt_m: 12 }], lbpM);
    expect(report.passed).toBe(true);
    expect(report.cells).toHaveLength(2);
  });

  it("fails when displacement deviates beyond 1%", () => {
    const computed = [row(9.8, { displacement_t: 10250 })];
    const report = compareHydrostatics(computed, [{ draft_m: 9.8, displacement_t: 10250 * 1.02 }], lbpM);
    expect(report.passed).toBe(false);
    expect(report.cells[0].pass).toBe(false);
  });

  it("uses a wider LBP-relative tolerance for lcb/lcf, not the value's own magnitude", () => {
    const computed = [row(9.8, { lcb_m: 80 })];
    // 0.4% of LBP (160*0.004=0.64m) is well within the 0.5% tolerance (0.8m), even though it's
    // a much bigger fraction of lcb_m itself (0.64/80 = 0.8%) than the generic 1% rule would allow.
    const report = compareHydrostatics(computed, [{ draft_m: 9.8, lcb_m: 80.64 }], lbpM);
    expect(report.cells[0].pass).toBe(true);
  });

  it("enforces the KMt absolute floor (0.05m) even when 1% of a small value would be smaller", () => {
    const computed = [row(9.8, { kmt_m: 1 })]; // small kmt -> 1% = 0.01m, floor is 0.05m
    const report = compareHydrostatics(computed, [{ draft_m: 9.8, kmt_m: 1.03 }], lbpM); // 0.03m off
    expect(report.cells[0].pass).toBe(true); // within the 0.05m floor, even though > 1% relative
  });

  it("skips a booklet row with no matching computed draft", () => {
    const computed = [row(9.8)];
    const report = compareHydrostatics(computed, [{ draft_m: 20, displacement_t: 99999 }], lbpM);
    expect(report.cells).toEqual([]);
    expect(report.passed).toBe(true); // vacuously — nothing to compare, nothing failed
  });

  it("only compares fields actually present in the booklet row", () => {
    const computed = [row(9.8)];
    const report = compareHydrostatics(computed, [{ draft_m: 9.8, tpc_t_per_cm: 30 }], lbpM);
    expect(report.cells).toHaveLength(1);
    expect(report.cells[0].field).toBe("tpc_t_per_cm");
  });

  it("reports the max deviation per quantity across multiple drafts", () => {
    const computed = [row(5, { displacement_t: 5000 }), row(10, { displacement_t: 12000 })];
    const report = compareHydrostatics(
      computed,
      [{ draft_m: 5, displacement_t: 5010 }, { draft_m: 10, displacement_t: 12050 }],
      lbpM
    );
    expect(report.maxDeviationByQuantity.displacement_t).toBeCloseTo(50, 6);
  });
});
