import { describe, expect, it } from "vitest";
import { hullHalfBreadthAt } from "../hull-half-breadth-query";
import type { HullOffsets } from "@/types/vessel-geometry";

const offsets: HullOffsets = {
  stations_x_m: [0, 10, 20],
  waterlines_z_m: [0, 5],
  half_breadths_m: [
    [4, 4],
    [8, 8],
    [4, 4],
  ],
};

describe("hullHalfBreadthAt", () => {
  it("returns the exact table value at a station/waterline", () => {
    expect(hullHalfBreadthAt(offsets, 10, 5)).toBeCloseTo(8, 6);
  });

  it("interpolates linearly between stations", () => {
    expect(hullHalfBreadthAt(offsets, 5, 0)).toBeCloseTo(6, 6);
  });

  it("returns 0 outside the station range", () => {
    expect(hullHalfBreadthAt(offsets, -5, 0)).toBe(0);
    expect(hullHalfBreadthAt(offsets, 25, 0)).toBe(0);
  });
});
