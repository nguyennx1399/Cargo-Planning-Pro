import { describe, expect, it } from "vitest";
import { checkOnboardingReadiness } from "../onboarding-publish-checklist";
import { buildDemoVessel } from "@/data/demo-container-vessel";
import { buildDemoHorizonGeometry } from "@/data/demo-horizon-geometry";
import { bayCenterX, rowCenterZ } from "@/lib/geometry";
import type { HullOffsets } from "@/types/vessel-geometry";

describe("checkOnboardingReadiness", () => {
  const vessel = buildDemoVessel();
  const geometry = buildDemoHorizonGeometry();
  const bayXShipFrame = (bay: number) => bayCenterX(vessel, bay) + geometry.particulars.lbp_m / 2;
  const rowYShipFrame = (row: number) => rowCenterZ(vessel, row);
  const tolerance = geometry.particulars.lbp_m * 0.002;

  it("is ready to publish when calibration, hull fit, and schema are all clean", () => {
    const result = checkOnboardingReadiness(geometry, vessel, 0, [], bayXShipFrame, rowYShipFrame);
    expect(result.readyToPublish).toBe(true);
    expect(result.calibrationOk).toBe(true);
    expect(result.hullFitIssues).toEqual([]);
    expect(result.geometryIssues).toEqual([]);
  });

  it("blocks publish when the calibration residual exceeds 0.2% LBP", () => {
    const result = checkOnboardingReadiness(geometry, vessel, tolerance + 0.01, [], bayXShipFrame, rowYShipFrame);
    expect(result.calibrationOk).toBe(false);
    expect(result.readyToPublish).toBe(false);
  });

  it("does NOT block publish on fairness warnings alone (they're acknowledge-or-fix, not a hard gate)", () => {
    const result = checkOnboardingReadiness(
      geometry,
      vessel,
      0,
      [{ station: 0, waterline: 0, message: "test warning" }],
      bayXShipFrame,
      rowYShipFrame
    );
    expect(result.fairnessWarningCount).toBe(1);
    expect(result.readyToPublish).toBe(true);
  });

  it("blocks publish when the hull doesn't fit the vessel's own cargo layout", () => {
    const narrowOffsets: HullOffsets = {
      stations_x_m: [0, 160],
      waterlines_z_m: [0, 14],
      half_breadths_m: [[1, 1], [1, 1]],
    };
    const narrowGeometry = { ...geometry, hull: { source: "offsets" as const, offsets: narrowOffsets } };
    const result = checkOnboardingReadiness(narrowGeometry, vessel, 0, [], bayXShipFrame, rowYShipFrame);
    expect(result.hullFitIssues.length).toBeGreaterThan(0);
    expect(result.readyToPublish).toBe(false);
  });

  it("blocks publish when validateVesselGeometry reports a schema error", () => {
    const badGeometry = { ...geometry, particulars: { ...geometry.particulars, lbp_m: 999 } }; // > loa_m
    const result = checkOnboardingReadiness(badGeometry, vessel, 0, [], bayXShipFrame, rowYShipFrame);
    expect(result.geometryIssues.some((i) => i.severity === "error")).toBe(true);
    expect(result.readyToPublish).toBe(false);
  });
});
