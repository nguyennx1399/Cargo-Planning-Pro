import { describe, expect, it } from "vitest";
import { catmullRomEval, catmullRomResample, type Point2 } from "../catmull-rom-spline";

describe("catmullRomEval", () => {
  it("passes exactly through every control point at its knot parameter", () => {
    const points: Point2[] = [[0, 0], [1, 2], [3, 2.5], [5, 0], [6, -1]];
    points.forEach((p, i) => {
      const t = i / (points.length - 1);
      const eval_ = catmullRomEval(points, t);
      expect(eval_[0]).toBeCloseTo(p[0], 6);
      expect(eval_[1]).toBeCloseTo(p[1], 6);
    });
  });

  it("handles a single point and two points without throwing", () => {
    expect(catmullRomEval([[1, 1]], 0.5)).toEqual([1, 1]);
    const two = catmullRomEval([[0, 0], [2, 2]], 0.5);
    expect(two[0]).toBeCloseTo(1, 6);
    expect(two[1]).toBeCloseTo(1, 6);
  });
});

describe("catmullRomResample", () => {
  const points: Point2[] = [[0, 0], [2, 3], [5, 4], [8, 3], [10, 0]];

  it("starts and ends at the first/last control points", () => {
    const out = catmullRomResample(points, 20);
    expect(out[0][0]).toBeCloseTo(points[0][0], 3);
    expect(out[0][1]).toBeCloseTo(points[0][1], 3);
    expect(out[out.length - 1][0]).toBeCloseTo(points[points.length - 1][0], 3);
    expect(out[out.length - 1][1]).toBeCloseTo(points[points.length - 1][1], 3);
  });

  it("spaces resampled points evenly by arc length, within 2%", () => {
    const out = catmullRomResample(points, 40);
    const segLens: number[] = [];
    for (let i = 0; i < out.length - 1; i++) {
      segLens.push(Math.hypot(out[i + 1][0] - out[i][0], out[i + 1][1] - out[i][1]));
    }
    const mean = segLens.reduce((a, b) => a + b, 0) / segLens.length;
    for (const len of segLens) {
      expect(Math.abs(len - mean) / mean).toBeLessThan(0.02);
    }
  });

  it("produces no NaN when control points are duplicated", () => {
    const withDup: Point2[] = [[0, 0], [2, 2], [2, 2], [5, 1]];
    const out = catmullRomResample(withDup, 10);
    for (const [y, z] of out) {
      expect(Number.isNaN(y)).toBe(false);
      expect(Number.isNaN(z)).toBe(false);
    }
  });

  it("handles a single repeated point (zero-length curve)", () => {
    const out = catmullRomResample([[3, 4]], 5);
    for (const p of out) expect(p).toEqual([3, 4]);
  });
});
