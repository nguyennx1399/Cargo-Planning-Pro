import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { computeShipTransform } from "../ship-attitude-transform";

/** Applies a ShipTransform to a THREE.Object3D and returns the world position of a local point
 * — the only way to actually PROVE a sign convention (matrix math), not just trust the formula. */
function worldPointAfterTransform(t: { positionY: number; rotationX: number; rotationZ: number }, local: [number, number, number]) {
  const obj = new THREE.Object3D();
  obj.position.set(0, t.positionY, 0);
  obj.rotation.x = t.rotationX;
  obj.rotation.z = t.rotationZ;
  obj.updateMatrixWorld(true);
  return new THREE.Vector3(...local).applyMatrix4(obj.matrixWorld);
}

const DEPTH_M = 14;
const LBP_M = 160;
const BEAM_M = 27.4;

describe("computeShipTransform — positionY (sinkage)", () => {
  it("puts the keel (local y=-depth) at world y=-draftMeanM", () => {
    const t = computeShipTransform({ draftMeanM: 9.8, listDeg: 0, trimM: 0 }, DEPTH_M, LBP_M);
    const keel = worldPointAfterTransform(t, [0, -DEPTH_M, 0]);
    expect(keel.y).toBeCloseTo(-9.8, 6);
  });

  it("puts the deck (local y=0) at world y = depth - draftMeanM (freeboard)", () => {
    const t = computeShipTransform({ draftMeanM: 9.8, listDeg: 0, trimM: 0 }, DEPTH_M, LBP_M);
    const deck = worldPointAfterTransform(t, [0, 0, 0]);
    expect(deck.y).toBeCloseTo(DEPTH_M - 9.8, 6);
  });

  it("falls back to a plausible sinkage (not NaN) when draftMeanM is null (out_of_range)", () => {
    const t = computeShipTransform({ draftMeanM: null, listDeg: null, trimM: null }, DEPTH_M, LBP_M);
    expect(Number.isFinite(t.positionY)).toBe(true);
  });
});

describe("computeShipTransform — rotationX (list)", () => {
  it("a positive listDeg (starboard list) lowers the starboard rail (+z) below the port rail (-z)", () => {
    const t = computeShipTransform({ draftMeanM: 9.8, listDeg: 3, trimM: 0 }, DEPTH_M, LBP_M);
    const starboard = worldPointAfterTransform(t, [0, 0, BEAM_M / 2]);
    const port = worldPointAfterTransform(t, [0, 0, -BEAM_M / 2]);
    expect(starboard.y).toBeLessThan(port.y);
  });

  it("a negative listDeg (port list) lowers the port rail below the starboard rail", () => {
    const t = computeShipTransform({ draftMeanM: 9.8, listDeg: -3, trimM: 0 }, DEPTH_M, LBP_M);
    const starboard = worldPointAfterTransform(t, [0, 0, BEAM_M / 2]);
    const port = worldPointAfterTransform(t, [0, 0, -BEAM_M / 2]);
    expect(port.y).toBeLessThan(starboard.y);
  });

  it("zero list keeps port and starboard at the same height", () => {
    const t = computeShipTransform({ draftMeanM: 9.8, listDeg: 0, trimM: 0 }, DEPTH_M, LBP_M);
    const starboard = worldPointAfterTransform(t, [0, 0, BEAM_M / 2]);
    const port = worldPointAfterTransform(t, [0, 0, -BEAM_M / 2]);
    expect(starboard.y).toBeCloseTo(port.y, 6);
  });
});

describe("computeShipTransform — rotationZ (trim)", () => {
  it("a positive trimM (by the head) lowers the bow (+x) below the stern (-x)", () => {
    const t = computeShipTransform({ draftMeanM: 9.8, listDeg: 0, trimM: 1 }, DEPTH_M, LBP_M);
    const bow = worldPointAfterTransform(t, [LBP_M / 2, 0, 0]);
    const stern = worldPointAfterTransform(t, [-LBP_M / 2, 0, 0]);
    expect(bow.y).toBeLessThan(stern.y);
  });

  it("a negative trimM (by the stern) lowers the stern below the bow", () => {
    const t = computeShipTransform({ draftMeanM: 9.8, listDeg: 0, trimM: -1 }, DEPTH_M, LBP_M);
    const bow = worldPointAfterTransform(t, [LBP_M / 2, 0, 0]);
    const stern = worldPointAfterTransform(t, [-LBP_M / 2, 0, 0]);
    expect(stern.y).toBeLessThan(bow.y);
  });
});
