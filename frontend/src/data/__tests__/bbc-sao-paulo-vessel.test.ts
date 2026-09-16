import { describe, expect, it } from "vitest";
import { buildBbcSaoPauloVesselAndCargo, BBC_SAO_PAULO_VESSEL_ID } from "../bbc-sao-paulo-vessel";
import { buildBbcSaoPauloGeometry, BBC_SAO_PAULO_GEOMETRY_ID } from "../bbc-sao-paulo-geometry";
import { getVesselGeometry } from "../vessel-geometry-catalog";
import { getVesselCatalogEntry, VESSEL_CATALOG } from "../vessel-catalog";
import { buildEmptyDemoPlan, withBreakbulkCargo } from "../build-demo-plan";
import { validatePlan } from "@/engine/validate-plan";

describe("BBC SAO PAULO vessel", () => {
  it("has a container grid from its stowage spec, plus a part container load of demo boxes", () => {
    const { vessel, containers } = buildBbcSaoPauloVesselAndCargo();
    expect(vessel.id).toBe(BBC_SAO_PAULO_VESSEL_ID);
    expect(vessel.bays).toEqual([2, 6, 10, 14, 18, 22, 26, 30, 34]); // 40' bays, bow -> stern
    expect(vessel.stacks.length).toBeGreaterThan(0);
    expect(containers.length).toBeGreaterThan(0);
  });

  it("its VesselGeometry is mesh-sourced with no offsets (visual-only, per source plan's scope)", () => {
    const geometry = buildBbcSaoPauloGeometry();
    expect(geometry.hull.source).toBe("mesh");
    expect(geometry.hull.offsets).toBeUndefined();
    if (geometry.hull.source === "mesh") expect(geometry.hull.mesh_uri).toBe("/vessels/bbc-sao-paulo/bbc_sao_paulo_lod0.glb");
  });

  it("is registered in both the geometry catalog and the vessel catalog", () => {
    expect(getVesselGeometry(BBC_SAO_PAULO_GEOMETRY_ID)).toBeDefined();
    expect(VESSEL_CATALOG.some((v) => v.id === BBC_SAO_PAULO_VESSEL_ID)).toBe(true);
    const entry = getVesselCatalogEntry(BBC_SAO_PAULO_VESSEL_ID);
    expect(entry.vessel.id).toBe(BBC_SAO_PAULO_VESSEL_ID);
    // Cached, like getVesselGeometry — same reference on a second call.
    expect(getVesselCatalogEntry(BBC_SAO_PAULO_VESSEL_ID)).toBe(entry);
  });

  it("real breakbulk cargo loads against its real footprint without crashing validatePlan", () => {
    const { vessel, containers } = buildBbcSaoPauloVesselAndCargo();
    const base = buildEmptyDemoPlan(vessel, containers);
    const plan = withBreakbulkCargo(vessel, base);
    expect(plan.breakbulk_placements.length).toBeGreaterThan(0);
    expect(() => validatePlan(vessel, plan)).not.toThrow();
  });
});
