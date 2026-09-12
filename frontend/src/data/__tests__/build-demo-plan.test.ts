import { describe, expect, it } from "vitest";
import { buildDemoVesselAndCargo, buildLoadedDemoPlan } from "../build-demo-plan";

describe("buildDemoVesselAndCargo", () => {
  it("includes every special container type/size in the ACTUAL demo path, not just in tests", () => {
    // Regression for a real gap: specialCounts existed in generateDemoCargo since phase 01 but
    // was never passed here, so 45'/OPEN_TOP/FLAT_RACK/TANK never appeared in the running app —
    // only ever exercised by demo-cargo-generator.test.ts's own explicit opt-in calls.
    const { containers } = buildDemoVesselAndCargo();
    expect(containers.some((c) => c.size === "45")).toBe(true);
    expect(containers.some((c) => c.type === "OPEN_TOP")).toBe(true);
    expect(containers.some((c) => c.type === "FLAT_RACK")).toBe(true);
    expect(containers.some((c) => c.type === "TANK")).toBe(true);
  });

  it("still keeps the base 470/400 forties/twenties mix untouched", () => {
    const { containers } = buildDemoVesselAndCargo();
    expect(containers.filter((c) => c.size === "40" && (c.type === "DRY" || c.type === "REEFER"))).toHaveLength(470);
    expect(containers.filter((c) => c.size === "20")).toHaveLength(400);
  });

  it("a loaded demo plan places at least one 45'/special container (they fit 40' bays, same as DRY/REEFER 40')", () => {
    const { vessel, containers } = buildDemoVesselAndCargo();
    const plan = buildLoadedDemoPlan(vessel, containers);
    const placedIds = new Set(plan.placements.map((p) => p.container_id));
    const specialPlaced = containers.filter((c) => (c.size === "45" || c.type !== "DRY") && c.type !== "REEFER" && placedIds.has(c.id));
    expect(specialPlaced.length).toBeGreaterThan(0);
  });
});
