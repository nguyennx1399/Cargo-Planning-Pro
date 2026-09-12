import { describe, expect, it } from "vitest";
import { checkSlotsInsideHull } from "../slots-inside-hull-check";
import { buildDemoVessel } from "@/data/demo-container-vessel";
import { buildDemoHorizonGeometry } from "@/data/demo-horizon-geometry";
import { bayCenterX, rowCenterZ } from "@/lib/geometry";
import type { HullOffsets } from "@/types/vessel-geometry";

describe("checkSlotsInsideHull", () => {
  const vessel = buildDemoVessel();
  const geometry = buildDemoHorizonGeometry();
  // scene x = shipX - lbp/2 (lib/ship-frame.ts), so shipX = sceneX + lbp/2. rowCenterZ is
  // already ship-frame y (transverse, +stbd) unchanged by shipToScene.
  const bayXShipFrame = (bay: number) => bayCenterX(vessel, bay) + geometry.particulars.lbp_m / 2;
  const rowYShipFrame = (row: number) => rowCenterZ(vessel, row);

  it("returns no issues for the demo vessel's own hull (no under-deck row pokes through)", () => {
    const issues = checkSlotsInsideHull(vessel, geometry, bayXShipFrame, rowYShipFrame);
    expect(issues).toEqual([]);
  });

  it("returns [] when the geometry has no offsets yet", () => {
    const noOffsetsGeometry = { ...geometry, hull: { source: "parametric" as const, params: geometry.hull.source === "parametric" ? geometry.hull.params : { bow: "conventional" as const, stern: "cruiser" as const, parallel_midbody: [0.3, 0.62] as [number, number] } } };
    expect(checkSlotsInsideHull(vessel, noOffsetsGeometry, bayXShipFrame, rowYShipFrame)).toEqual([]);
  });

  it("flags a row that sits outside a deliberately narrow hull", () => {
    const narrowOffsets: HullOffsets = {
      stations_x_m: [0, 160],
      waterlines_z_m: [0, 14],
      half_breadths_m: [
        [1, 1],
        [1, 1],
      ],
    };
    const narrowGeometry = { ...geometry, hull: { source: "offsets" as const, offsets: narrowOffsets } };
    const issues = checkSlotsInsideHull(vessel, narrowGeometry, bayXShipFrame, rowYShipFrame);
    expect(issues.length).toBeGreaterThan(0);
  });
});
