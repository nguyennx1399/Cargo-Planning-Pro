import { describe, expect, it } from "vitest";
import { checkOffsetsFairness } from "../offsets-fairness-check";
import type { HullOffsets } from "@/types/vessel-geometry";

function wigleyOffsets(L = 160, B = 27.4, T = 14, stationCount = 21, waterlineCount = 11): HullOffsets {
  const stations_x_m = Array.from({ length: stationCount }, (_, i) => (i / (stationCount - 1)) * L);
  const waterlines_z_m = Array.from({ length: waterlineCount }, (_, i) => (i / (waterlineCount - 1)) * T);
  const half_breadths_m = stations_x_m.map((x) => {
    const u = (2 * x) / L - 1;
    return waterlines_z_m.map((z) => {
      const v = z / T;
      return Math.round((B / 2) * (1 - u * u) * (1 - v * v) * 1000) / 1000;
    });
  });
  return { stations_x_m, waterlines_z_m, half_breadths_m };
}

describe("checkOffsetsFairness", () => {
  it("has no warnings for a clean, smooth grid", () => {
    expect(checkOffsetsFairness(wigleyOffsets())).toEqual([]);
  });

  it("catches a shifted-decimal typo (12.45 -> 1.245)", () => {
    const offsets = wigleyOffsets();
    // pick an interior station/waterline with a substantial value
    const si = 10;
    const wi = 5;
    const original = offsets.half_breadths_m[si][wi] as number;
    offsets.half_breadths_m[si][wi] = Math.round((original / 10) * 1000) / 1000; // decimal shift
    const warnings = checkOffsetsFairness(offsets);
    expect(warnings.some((w) => w.station === si && w.waterline === wi)).toBe(true);
  });

  it("catches an outlier that's too far outside the plausible range", () => {
    const offsets = wigleyOffsets();
    offsets.half_breadths_m[10][5] = 999;
    const warnings = checkOffsetsFairness(offsets, { beamM: 27.4 });
    expect(warnings.some((w) => w.station === 10 && w.waterline === 5)).toBe(true);
  });

  it("does not flag a declared knuckle even if it's a genuine discontinuity", () => {
    const offsets = wigleyOffsets();
    const si = 10;
    const wi = 5;
    offsets.half_breadths_m[si][wi] = (offsets.half_breadths_m[si][wi] as number) * 0.3; // sharp real corner
    offsets.knuckles = [{ station: si, waterline: wi }];
    const warnings = checkOffsetsFairness(offsets);
    expect(warnings.some((w) => w.station === si && w.waterline === wi)).toBe(false);
  });

  it("does not crash on a grid too small for a robust statistic", () => {
    const tiny: HullOffsets = { stations_x_m: [0, 10], waterlines_z_m: [0, 5], half_breadths_m: [[0, 5], [1, 6]] };
    expect(() => checkOffsetsFairness(tiny)).not.toThrow();
  });

  it("tolerates null cells (bulb/knuckle stations) without crashing", () => {
    const offsets = wigleyOffsets();
    offsets.half_breadths_m[0] = offsets.half_breadths_m[0].map(() => null);
    expect(() => checkOffsetsFairness(offsets)).not.toThrow();
  });
});
