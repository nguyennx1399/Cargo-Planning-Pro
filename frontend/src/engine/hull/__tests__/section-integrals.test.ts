import { describe, expect, it } from "vitest";
import { blockCoefficient, displacedVolume, halfBreadthAt, sectionArea } from "../section-integrals";
import type { HullOffsets } from "@/types/vessel-geometry";

function boxBargeOffsets(L: number, B: number, T: number, stationCount = 21, waterlineCount = 11): HullOffsets {
  const stations_x_m = Array.from({ length: stationCount }, (_, i) => (i / (stationCount - 1)) * L);
  const waterlines_z_m = Array.from({ length: waterlineCount }, (_, i) => (i / (waterlineCount - 1)) * (T * 1.5));
  const half_breadths_m = stations_x_m.map(() => waterlines_z_m.map(() => B / 2));
  return { stations_x_m, waterlines_z_m, half_breadths_m };
}

function wigleyOffsets(L: number, B: number, T: number, stationCount = 81, waterlineCount = 41): HullOffsets {
  const stations_x_m = Array.from({ length: stationCount }, (_, i) => (i / (stationCount - 1)) * L);
  const waterlines_z_m = Array.from({ length: waterlineCount }, (_, i) => (i / (waterlineCount - 1)) * T);
  const half_breadths_m = stations_x_m.map((x) => {
    const u = (2 * x) / L - 1;
    return waterlines_z_m.map((z) => {
      const v = z / T;
      return (B / 2) * (1 - u * u) * (1 - v * v);
    });
  });
  return { stations_x_m, waterlines_z_m, half_breadths_m };
}

describe("halfBreadthAt", () => {
  it("interpolates linearly and treats null as outside the hull", () => {
    const offsets: HullOffsets = {
      stations_x_m: [0, 10],
      waterlines_z_m: [0, 5, 10],
      half_breadths_m: [[2, 4, null], [2, 4, null]],
    };
    expect(halfBreadthAt(offsets, 0, 2.5)).toBeCloseTo(3, 6);
    expect(halfBreadthAt(offsets, 0, 7.5)).toBe(0); // between a real value and null
  });
});

describe("sectionArea / displacedVolume / blockCoefficient — box barge", () => {
  const L = 100;
  const B = 20;
  const T = 5;
  const offsets = boxBargeOffsets(L, B, T);

  it("section area at draft T equals B*T (rectangular cross-section)", () => {
    expect(sectionArea(offsets, 5, T)).toBeCloseTo(B * T, 6);
  });

  it("displaced volume equals L*B*T exactly (trapezoidal is exact for a constant function)", () => {
    expect(displacedVolume(offsets, T)).toBeCloseTo(L * B * T, 6);
  });

  it("Cb is 1.0 for a rectangular barge", () => {
    expect(blockCoefficient(offsets, { lbp_m: L, beam_m: B }, T)).toBeCloseTo(1.0, 6);
  });
});

describe("displacedVolume / blockCoefficient — Wigley hull (closed-form Cb = 4/9)", () => {
  const L = 160;
  const B = 20;
  const T = 10;
  const offsets = wigleyOffsets(L, B, T);

  it("matches the analytic volume (4/9 * L*B*T) within 0.5%", () => {
    const analytic = (4 / 9) * L * B * T;
    const relError = Math.abs(displacedVolume(offsets, T) - analytic) / analytic;
    expect(relError).toBeLessThan(0.005);
  });

  it("Cb is close to 4/9 within 0.002", () => {
    const cb = blockCoefficient(offsets, { lbp_m: L, beam_m: B }, T);
    expect(Math.abs(cb - 4 / 9)).toBeLessThan(0.002);
  });
});
