import { describe, expect, it } from "vitest";
import { bodyPlanToOffsets, type TracedStation } from "../body-plan-to-offsets";

/** Ground-truth quadratic section (matches the Wigley z-profile shape): b(z) = B/2 * (1-(z/T)^2). */
function quadraticBreadth(z: number, halfBeam: number, T: number): number {
  return halfBeam * (1 - (z / T) ** 2);
}

describe("bodyPlanToOffsets", () => {
  const halfBeam = 13.7;
  const T = 14;

  it("reconstructs a traced quadratic curve within 2% at the target waterlines", () => {
    // Trace 7 points along the curve, keel to deck — plausible for a human clicking along a scan.
    const tracedZs = [0, 2, 5, 8, 10, 12, 14];
    const points: [number, number][] = tracedZs.map((z) => [quadraticBreadth(z, halfBeam, T), z]);
    const station: TracedStation = { xShipFrameM: 80, points };

    const targetWaterlines = [0, 1.4, 2.8, 4.2, 5.6, 7, 8.4, 9.8, 11.2, 12.6, 14];
    const offsets = bodyPlanToOffsets([station], targetWaterlines);

    expect(offsets.stations_x_m).toEqual([80]);
    offsets.half_breadths_m[0].forEach((v, i) => {
      const truth = quadraticBreadth(targetWaterlines[i], halfBeam, T);
      expect(v).not.toBeNull();
      expect(Math.abs((v as number) - truth) / halfBeam).toBeLessThan(0.02);
    });
  });

  it("returns null for a waterline outside the traced range", () => {
    const station: TracedStation = { xShipFrameM: 0, points: [[0, 2], [5, 6], [8, 10]] };
    const offsets = bodyPlanToOffsets([station], [0, 5, 15]);
    expect(offsets.half_breadths_m[0][0]).toBeNull(); // below traced range
    expect(offsets.half_breadths_m[0][2]).toBeNull(); // above traced range
    expect(offsets.half_breadths_m[0][1]).not.toBeNull(); // within range
  });

  it("sorts stations by x ascending regardless of input order", () => {
    const a: TracedStation = { xShipFrameM: 100, points: [[0, 0], [1, 5]] };
    const b: TracedStation = { xShipFrameM: 20, points: [[0, 0], [1, 5]] };
    const offsets = bodyPlanToOffsets([a, b], [0, 5]);
    expect(offsets.stations_x_m).toEqual([20, 100]);
  });

  it("handles a station with too few traced points without crashing (all null, not an exception)", () => {
    const station: TracedStation = { xShipFrameM: 0, points: [[3, 5]] };
    const offsets = bodyPlanToOffsets([station], [0, 5, 10]);
    expect(offsets.half_breadths_m[0]).toEqual([null, null, null]);
  });
});
