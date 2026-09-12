import { describe, expect, it } from "vitest";
import { frameToX, lcgFromMidship, sceneToShip, shipToScene, xToFrame } from "../ship-frame";
import type { FrameSegment, VesselGeometry } from "@/types/vessel-geometry";

const geometry = { particulars: { lbp_m: 160, depth_m: 14 } } as Pick<VesselGeometry, "particulars">;

describe("shipToScene / sceneToShip", () => {
  it("round-trips arbitrary points", () => {
    const ship: [number, number, number] = [72, 3.2, 6.5];
    expect(sceneToShip(geometry, shipToScene(geometry, ship))).toEqual(ship);
  });

  it("puts midship at scene x = 0 and the deck at scene y = 0", () => {
    expect(shipToScene(geometry, [80, 0, 14])).toEqual([0, 0, 0]);
  });

  it("maps +stbd (ship y) to scene z, and baseline (ship z=0) to scene y = -depth", () => {
    expect(shipToScene(geometry, [80, 5, 0])).toEqual([0, -14, 5]);
  });
});

describe("lcgFromMidship", () => {
  it("is 0 at midship, positive forward of midship", () => {
    expect(lcgFromMidship(geometry, 80)).toBe(0);
    expect(lcgFromMidship(geometry, 100)).toBe(20);
    expect(lcgFromMidship(geometry, 60)).toBe(-20);
  });
});

describe("frameToX / xToFrame", () => {
  const frames: FrameSegment[] = [
    { from_frame: 0, to_frame: 100, spacing_m: 0.6 },
    { from_frame: 100, to_frame: 150, spacing_m: 1.0 },
  ];

  it("computes x at segment boundaries and mid-segment", () => {
    expect(frameToX(frames, 0)).toBeCloseTo(0);
    expect(frameToX(frames, 100)).toBeCloseTo(60);
    expect(frameToX(frames, 150)).toBeCloseTo(110);
    expect(frameToX(frames, 50)).toBeCloseTo(30);
    expect(frameToX(frames, 125)).toBeCloseTo(85);
  });

  it("extrapolates before frame 0 and past the last frame using the nearest segment's spacing", () => {
    expect(frameToX(frames, -5)).toBeCloseTo(-3);
    expect(frameToX(frames, 160)).toBeCloseTo(120);
  });

  it("round-trips within and outside the frame range", () => {
    for (const f of [0, 12.5, 100, 137, -5, 160]) {
      expect(xToFrame(frames, frameToX(frames, f))).toBeCloseTo(f, 9);
    }
  });
});
