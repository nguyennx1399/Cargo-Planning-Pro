import { describe, expect, it } from "vitest";
import { applyAffine, applySimilarity, residual, solveAffine, solveSimilarity, type Point2 } from "../drawing-calibration";

describe("solveSimilarity / applySimilarity", () => {
  it("round-trips with a 3° rotation and an arbitrary scale", () => {
    const angle = (3 * Math.PI) / 180;
    const scale = 12.7;
    const tx0 = 5.2;
    const ty0 = -3.1;
    const trueMap = (p: Point2): Point2 => ({
      x: scale * (Math.cos(angle) * p.x - Math.sin(angle) * p.y) + tx0,
      y: scale * (Math.sin(angle) * p.x + Math.cos(angle) * p.y) + ty0,
    });
    const srcA: Point2 = { x: 10, y: 20 };
    const srcB: Point2 = { x: 400, y: 60 };
    const tgtA = trueMap(srcA);
    const tgtB = trueMap(srcB);
    const t = solveSimilarity(srcA, tgtA, srcB, tgtB);

    // A third point, not used to solve, should still map correctly (proves it's a true global
    // similarity transform, not an overfit to just the two solving points).
    const srcC: Point2 = { x: 150, y: -80 };
    const expectedC = trueMap(srcC);
    expect(residual(applySimilarity(t, srcC), expectedC)).toBeLessThan(1e-6);
  });

  it("residual is ~0 for exactly-matching points", () => {
    const t = solveSimilarity({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 });
    expect(residual(applySimilarity(t, { x: 5, y: 0 }), { x: 10, y: 0 })).toBeLessThan(1e-9);
  });

  it("throws when the two source points coincide", () => {
    expect(() => solveSimilarity({ x: 1, y: 1 }, { x: 0, y: 0 }, { x: 1, y: 1 }, { x: 5, y: 5 })).toThrow();
  });
});

describe("solveAffine / applyAffine", () => {
  it("recovers independent x/y stretch + shear from 3 points", () => {
    const trueMap = (p: Point2): Point2 => ({
      x: 2.5 * p.x + 0.3 * p.y + 7,
      y: 0.1 * p.x + 1.8 * p.y - 4,
    });
    const src: [Point2, Point2, Point2] = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 10 }];
    const tgt: [Point2, Point2, Point2] = [trueMap(src[0]), trueMap(src[1]), trueMap(src[2])];
    const t = solveAffine(src, tgt);

    const srcD: Point2 = { x: 6, y: 9 };
    expect(residual(applyAffine(t, srcD), trueMap(srcD))).toBeLessThan(1e-6);
  });

  it("throws when the three source points are collinear", () => {
    const src: [Point2, Point2, Point2] = [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 10, y: 0 }];
    const tgt: [Point2, Point2, Point2] = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }];
    expect(() => solveAffine(src, tgt)).toThrow();
  });
});
