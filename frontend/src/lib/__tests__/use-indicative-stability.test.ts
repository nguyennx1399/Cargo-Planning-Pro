import { describe, expect, it } from "vitest";
import { stabilityForVisiblePlan } from "../use-indicative-stability";
import { computeHydrostaticTable } from "@/engine/hull/hydrostatic-table-calculator";
import { buildDemoHorizonGeometry } from "@/data/demo-horizon-geometry";
import { buildDemoVesselAndCargo, buildLoadedDemoPlan } from "@/data/build-demo-plan";
import { DEMO_LIGHTSHIP, DEMO_CONSTANT } from "@/data/demo-lightship";

describe("stabilityForVisiblePlan — playback slicing", () => {
  const geometry = buildDemoHorizonGeometry();
  const offsets = geometry.hull.offsets!;
  const drafts = Array.from({ length: 21 }, (_, i) => 3 + i * 0.5);
  const hydrostatics = computeHydrostaticTable(offsets, geometry.particulars, { drafts });

  const { vessel, containers } = buildDemoVesselAndCargo();
  const plan = buildLoadedDemoPlan(vessel, containers);
  const placements = plan.placements;
  const byId = new Map(plan.containers.map((c) => [c.id, c]));

  it("playbackCount=0 gives a displacement equal to lightship+constant only (no cargo yet)", () => {
    const result = stabilityForVisiblePlan(vessel, plan, geometry, hydrostatics, 0, byId);
    expect(result.displacement_t).toBeCloseTo(DEMO_LIGHTSHIP.weight_t + DEMO_CONSTANT.weight_t, 6);
  });

  it("playbackCount=null gives the same result as showing the full plan", () => {
    const full = stabilityForVisiblePlan(vessel, plan, geometry, hydrostatics, null, byId);
    const allShown = stabilityForVisiblePlan(vessel, plan, geometry, hydrostatics, placements.length, byId);
    expect(full.displacement_t).toBeCloseTo(allShown.displacement_t, 6);
    expect(full.draft_mean_m).toBeCloseTo(allShown.draft_mean_m!, 6);
  });

  it("displacement grows monotonically as playbackCount increases", () => {
    const at10 = stabilityForVisiblePlan(vessel, plan, geometry, hydrostatics, 10, byId);
    const at30 = stabilityForVisiblePlan(vessel, plan, geometry, hydrostatics, 30, byId);
    expect(at30.displacement_t).toBeGreaterThan(at10.displacement_t);
  });
});

describe("stabilityForVisiblePlan — breakbulk cargo integration (phase 04)", () => {
  const geometry = buildDemoHorizonGeometry();
  const offsets = geometry.hull.offsets!;
  const drafts = Array.from({ length: 21 }, (_, i) => 3 + i * 0.5);
  const hydrostatics = computeHydrostaticTable(offsets, geometry.particulars, { drafts });
  const { vessel, containers } = buildDemoVesselAndCargo();
  const basePlan = buildLoadedDemoPlan(vessel, containers);
  const byId = new Map(basePlan.containers.map((c) => [c.id, c]));

  it("regression: an empty breakbulk_cargo/breakbulk_placements gives the exact same result as before this phase", () => {
    const result = stabilityForVisiblePlan(vessel, basePlan, geometry, hydrostatics, null, byId);
    expect(result.status).not.toBe("out_of_range");
  });

  it("a heavy nacelle placed hard to starboard measurably increases list toward starboard vs. no breakbulk", () => {
    const nacelle = { id: "n1", category: "wind_turbine_nacelle" as const, length_m: 12, width_m: 4, height_m: 4.5, weight_t: 95, kg_above_base_m: 1.6, pol: "A", pod: "B" };
    const starboardPlacement = { cargo_id: "n1", x_m: 80, z_m: 10, rotation_deg: 0 };
    const withNacelle = { ...basePlan, breakbulk_cargo: [nacelle], breakbulk_placements: [starboardPlacement] };

    const without = stabilityForVisiblePlan(vessel, basePlan, geometry, hydrostatics, null, byId);
    const withIt = stabilityForVisiblePlan(vessel, withNacelle, geometry, hydrostatics, null, byId);

    expect(withIt.displacement_t).toBeCloseTo(without.displacement_t + 95, 3);
    // Positive z_m = starboard (see types/domain.ts) -> should push list further toward positive (starboard).
    expect(withIt.list_deg!).toBeGreaterThan(without.list_deg!);
  });

  it("a heavy nacelle placed hard to port measurably shifts list toward port vs. starboard placement", () => {
    const nacelle = { id: "n1", category: "wind_turbine_nacelle" as const, length_m: 12, width_m: 4, height_m: 4.5, weight_t: 95, kg_above_base_m: 1.6, pol: "A", pod: "B" };
    const portPlan = { ...basePlan, breakbulk_cargo: [nacelle], breakbulk_placements: [{ cargo_id: "n1", x_m: 80, z_m: -10, rotation_deg: 0 }] };
    const starboardPlan = { ...basePlan, breakbulk_cargo: [nacelle], breakbulk_placements: [{ cargo_id: "n1", x_m: 80, z_m: 10, rotation_deg: 0 }] };

    const port = stabilityForVisiblePlan(vessel, portPlan, geometry, hydrostatics, null, byId);
    const starboard = stabilityForVisiblePlan(vessel, starboardPlan, geometry, hydrostatics, null, byId);
    expect(port.list_deg!).toBeLessThan(starboard.list_deg!);
  });
});
