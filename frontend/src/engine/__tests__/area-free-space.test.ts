/**
 * The free-space scan (Phase 03), against the two states the planner actually sees: the loaded demo
 * plan (where the sidebar used to promise areas that refuse every pose) and a ship with the container
 * cargo cleared.
 */
import { describe, expect, it } from "vitest";
import { getVesselCatalogEntry } from "@/data/vessel-catalog";
import { buildDemoPlan, buildEmptyDemoPlan, withBreakbulkCargo } from "@/data/build-demo-plan";
import { buildStowageModel } from "@/engine/stowage-model";
import { freeRegionsFor } from "@/engine/placement/placeholders";
import { canPlaceBreakbulk } from "@/engine/placement/can-place-breakbulk";
import { findFreeSpace, scanAreaForFreePose, SCAN_STEP_M } from "@/engine/placement/area-free-space";

const { vessel, containers } = getVesselCatalogEntry("bbc-sao-paulo");
const model = buildStowageModel(vessel);
const loaded = buildDemoPlan(vessel, containers, { cargoLoaded: true, projectCargoLoaded: true });
const feasibleAreas = (plan: typeof loaded, id: string) =>
  freeRegionsFor(vessel, plan, plan.breakbulk_cargo.find((c) => c.id === id)!)
    .filter((r) => r.feasible)
    .map((r) => r.area);

describe("findFreeSpace on the loaded demo plan", () => {
  const item = loaded.breakbulk_cargo.find((c) => c.id === "BB005")!;

  it("reports NO free spot for the item the sidebar says fits in two areas", () => {
    const areas = feasibleAreas(loaded, "BB005");
    expect(areas.length).toBeGreaterThan(0); // the promise the old hint made
    const scan = findFreeSpace(model, loaded, item, areas, vessel);
    expect(scan.areaId).toBeNull(); // …and what the ground actually allows
  });

  it("names what is in the way, in the engine's own words", () => {
    const scan = findFreeSpace(model, loaded, item, feasibleAreas(loaded, "BB005"), vessel);
    expect(scan.blocker).not.toBeNull();
    expect(scan.blocker!.message.length).toBeGreaterThan(0);
  });

  it("costs a bounded number of predicate calls (the header's claim)", () => {
    const scan = findFreeSpace(model, loaded, item, feasibleAreas(loaded, "BB005"), vessel);
    expect(scan.probed).toBeLessThan(4000);
  });
});

describe("findFreeSpace with the container cargo cleared", () => {
  it("finds room, and the pose it returns is one the PREDICATE accepts", () => {
    const empty = withBreakbulkCargo(vessel, buildEmptyDemoPlan(vessel, containers));
    // Containers cleared AND no project cargo standing yet: the deck is genuinely free, so a scan that
    // reports "no room" here would be the scan's own fault, not the ship's. (Keeping the packer's own
    // placements would test something else — an item the packer left unplaced may truly have no spot,
    // which is exactly what the loaded-plan cases above already cover.)
    const plan = { ...empty, breakbulk_placements: [] };
    const item = plan.breakbulk_cargo[0];
    const areas = freeRegionsFor(vessel, plan, item).filter((r) => r.feasible).map((r) => r.area);
    const scan = scanAreaForFreePose(model, plan, item, areas[0], vessel);
    expect(scan.pose).not.toBeNull();
    expect(canPlaceBreakbulk(model, plan, item, scan.pose!, vessel).ok).toBe(true);
  });

  it("early-exits: finding room costs far less than proving there is none", () => {
    const empty = withBreakbulkCargo(vessel, buildEmptyDemoPlan(vessel, containers));
    const item = empty.breakbulk_cargo[0];
    const bare = { ...empty, breakbulk_placements: [] };
    const areas = freeRegionsFor(vessel, bare, item).filter((r) => r.feasible).map((r) => r.area);
    const cheap = findFreeSpace(model, bare, item, areas, vessel);
    const expensive = findFreeSpace(model, loaded, loaded.breakbulk_cargo.find((c) => c.id === "BB005")!, feasibleAreas(loaded, "BB005"), vessel);
    expect(cheap.areaId).not.toBeNull();
    expect(cheap.probed).toBeLessThan(expensive.probed);
  });
});

describe("the scan's own limits, stated honestly", () => {
  it("walks a lattice coarser than the 0.5 m drag grid", () => {
    expect(SCAN_STEP_M).toBeGreaterThan(0.5);
  });

  it("returns no pose (and no crash) for an item larger than the area", () => {
    const empty = withBreakbulkCargo(vessel, buildEmptyDemoPlan(vessel, containers));
    const giant = { ...empty.breakbulk_cargo[0], id: "GIANT", length_m: 500, width_m: 200 };
    const area = model.areas[0];
    const scan = scanAreaForFreePose(model, empty, giant, area, vessel);
    expect(scan.pose).toBeNull();
    expect(scan.probed).toBe(0); // rejected by the inset bounds, never probed
  });
});
