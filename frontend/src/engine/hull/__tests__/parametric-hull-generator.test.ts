import { describe, expect, it } from "vitest";
import { generateParametricOffsets } from "../parametric-hull-generator";
import { blockCoefficient } from "../section-integrals";
import type { MainParticulars, ParametricHullParams } from "@/types/vessel-geometry";

const baseParticulars: Omit<MainParticulars, "cb"> = {
  loa_m: 172,
  lbp_m: 160,
  aft_overhang_m: 6,
  beam_m: 27.4,
  depth_m: 14,
  design_draft_m: 9.8,
};
const params: ParametricHullParams = {
  bow: "bulbous",
  stern: "cruiser",
  parallel_midbody: [0.3, 0.62],
  bulb: { length_m: 3, breadth_m: 3, height_m: 2.5 },
};
const conventionalParams: ParametricHullParams = { bow: "conventional", stern: "transom", parallel_midbody: [0.3, 0.62] };

describe("generateParametricOffsets — Cb fit", () => {
  it.each([0.55, 0.62, 0.7, 0.8])("fits Cb=%s within +/-0.002", (targetCb) => {
    const particulars: MainParticulars = { ...baseParticulars, cb: targetCb };
    const offsets = generateParametricOffsets(particulars, params);
    const achieved = blockCoefficient(offsets, particulars, particulars.design_draft_m);
    expect(Math.abs(achieved - targetCb)).toBeLessThan(0.002);
  });

  it("also fits with a conventional bow / transom stern (no bulb)", () => {
    const particulars: MainParticulars = { ...baseParticulars, cb: 0.68 };
    const offsets = generateParametricOffsets(particulars, conventionalParams);
    const achieved = blockCoefficient(offsets, particulars, particulars.design_draft_m);
    expect(Math.abs(achieved - 0.68)).toBeLessThan(0.002);
  });
});

describe("generateParametricOffsets — shape sanity", () => {
  const particulars: MainParticulars = { ...baseParticulars, cb: 0.68 };
  const offsets = generateParametricOffsets(particulars, params);

  it("never exceeds half beam anywhere", () => {
    for (const row of offsets.half_breadths_m) {
      for (const v of row) {
        if (v !== null) expect(v).toBeLessThanOrEqual(particulars.beam_m / 2 + 1e-6);
      }
    }
  });

  it("reaches full half-beam at midship (inside the parallel midbody, above the bilge)", () => {
    const midshipX = particulars.lbp_m / 2;
    const si = offsets.stations_x_m.findIndex((x) => Math.abs(x - midshipX) < 1);
    expect(si).toBeGreaterThanOrEqual(0);
    const deckRow = offsets.half_breadths_m[si];
    expect(deckRow[deckRow.length - 1]).toBeCloseTo(particulars.beam_m / 2, 3);
  });

  it("adds a bulb protrusion forward of FP when bow is bulbous", () => {
    const bulbous = generateParametricOffsets(particulars, params);
    const conventional = generateParametricOffsets(particulars, conventionalParams);
    expect(bulbous.stations_x_m.length).toBeGreaterThan(conventional.stations_x_m.length);
    expect(Math.max(...bulbous.stations_x_m)).toBeGreaterThan(particulars.lbp_m);
    expect(Math.max(...conventional.stations_x_m)).toBeCloseTo(particulars.lbp_m, 6);
  });

  it("stations are strictly ascending (validator requirement)", () => {
    for (let i = 1; i < offsets.stations_x_m.length; i++) {
      expect(offsets.stations_x_m[i]).toBeGreaterThan(offsets.stations_x_m[i - 1]);
    }
  });

  it("does not collapse the aft overhang into a zero-width blade (AP station has real breadth)", () => {
    // stations_x_m[0] = the true aft tip (x = -aft_overhang_m), always 0 by construction.
    // stations_x_m[1] = AP (x = 0) — regression check for the fix: this must NOT also be 0,
    // or the whole overhang span degenerates to a flat zero-area strip.
    expect(offsets.half_breadths_m[0].every((v) => v === 0)).toBe(true);
    const apRow = offsets.half_breadths_m[1];
    expect(Math.max(...(apRow as number[]))).toBeGreaterThan(0);
  });
});
