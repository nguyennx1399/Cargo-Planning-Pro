import { describe, expect, it } from "vitest";
import {
  placementToScene,
  placementXToSceneX,
  rectContainsPoint,
  rectContainsRect,
  rectFromCenter,
  sceneXToPlacementX,
  snap,
} from "../coords";

describe("placementXToSceneX / sceneXToPlacementX", () => {
  it("shifts by half the LOA, anchored so x_m = 0 sits at the stern", () => {
    const lengthM = 172;
    expect(placementXToSceneX(0, lengthM)).toBe(-86);
    expect(placementXToSceneX(lengthM, lengthM)).toBe(86);
    expect(sceneXToPlacementX(-86, lengthM)).toBe(0);
  });

  it("round-trips (the bug class this module exists to kill)", () => {
    const lengthM = 172;
    for (const x of [0, 13.392, 86, 171.999]) {
      expect(sceneXToPlacementX(placementXToSceneX(x, lengthM), lengthM)).toBeCloseTo(x, 9);
    }
  });
});

describe("placementToScene", () => {
  it("rests the item's base on the area's surface", () => {
    expect(placementToScene(86, 3, 1.55, 172)).toEqual([0, 1.55, 3]);
  });

  it("adds the lift for items measured from their base", () => {
    // A tank top below the main deck: surfaceY is negative, lift raises above it.
    expect(placementToScene(86, 3, -9.5, 172, 2)).toEqual([0, -7.5, 3]);
  });
});

describe("rectFromCenter", () => {
  it("centres a footprint on the placement's x_m/z_m", () => {
    const lengthM_ = 12.192;
    const widthM_ = 2.438;
    expect(rectFromCenter(100, 5, lengthM_, widthM_)).toEqual({
      xMin: 100 - lengthM_ / 2,
      xMax: 100 + lengthM_ / 2,
      zMin: 5 - widthM_ / 2,
      zMax: 5 + widthM_ / 2,
    });
  });

  it("swaps the extents at 90 degrees, matching footprintRect", () => {
    expect(rectFromCenter(10, 4, 12, 2, 90)).toEqual({ xMin: 9, xMax: 11, zMin: -2, zMax: 10 });
  });
});

describe("rectContainsPoint", () => {
  const rect = { xMin: 0, xMax: 10, zMin: -2, zMax: 2 };

  it("includes the edges", () => {
    expect(rectContainsPoint(rect, 0, 0)).toBe(true);
    expect(rectContainsPoint(rect, 10, 2)).toBe(true);
    expect(rectContainsPoint(rect, 0, -2)).toBe(true);
  });

  it("rejects points outside on either axis", () => {
    expect(rectContainsPoint(rect, 10.0001, 0)).toBe(false);
    expect(rectContainsPoint(rect, 5, -2.0001)).toBe(false);
  });
});

describe("rectContainsRect", () => {
  const rect = { xMin: 0, xMax: 10, zMin: -2, zMax: 2 };

  it("accepts an identical rect and one touching the edges", () => {
    expect(rectContainsRect(rect, { ...rect })).toBe(true);
    expect(rectContainsRect(rect, { xMin: 2, xMax: 10, zMin: -2, zMax: 1 })).toBe(true);
  });

  it("rejects one that pokes out", () => {
    expect(rectContainsRect(rect, { xMin: 0, xMax: 10, zMin: -3, zMax: 2 })).toBe(false);
    expect(rectContainsRect(rect, { xMin: -0.1, xMax: 5, zMin: 0, zMax: 1 })).toBe(false);
  });
});

describe("snap", () => {
  it("rounds to the nearest step (0.5 m project-cargo grid)", () => {
    expect(snap(0.24, 0.5)).toBe(0);
    expect(snap(0.26, 0.5)).toBe(0.5);
    expect(snap(-13.4, 0.5)).toBeCloseTo(-13.5, 9);
    expect(snap(7.25, 0.5)).toBe(7.5);
  });

  it("leaves an exact multiple untouched", () => {
    expect(snap(12, 0.5)).toBe(12);
  });
});
