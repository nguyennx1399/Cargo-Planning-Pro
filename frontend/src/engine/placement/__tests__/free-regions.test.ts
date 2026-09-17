/**
 * freeRegionsFor — the per-area draw data and "does this item belong in this area at all" answer
 * (spec §4.6). The load-bearing assertions: one region per area of the model, feasibility taken from
 * the predicate's item-vs-AREA reasons ALONE (BBC's weather deck is feasible for a 62 m blade even
 * though the same blade is refused at that area's centre by a container stack), keep-outs clipped to
 * the rect for drawing, and occupancy read from the plan as it stands.
 */
import { describe, expect, it } from "vitest";
import { canPlaceBreakbulk } from "../can-place-breakbulk";
import { freeRegionsFor, type FreeRegion } from "../placeholders";
import { buildStowageModel, occupiedRectsByArea, rectContainsRect } from "@/engine/stowage-model";
import { buildBbcSaoPauloVesselAndCargo } from "@/data/bbc-sao-paulo-vessel";
import { buildDemoVesselAndCargo, buildLoadedDemoPlan } from "@/data/build-demo-plan";
import type { BreakbulkCargo, BreakbulkPlacement, StowagePlan } from "@/types/domain";

const item = (patch: Partial<BreakbulkCargo> = {}): BreakbulkCargo => ({
  id: "BLADE", category: "wind_turbine_blade", length_m: 62, width_m: 4.5, height_m: 3.5, weight_t: 22,
  kg_above_base_m: 1.7, pol: "A", pod: "B", ...patch,
});

const emptyPlan = (vesselId: string): StowagePlan => ({
  id: "p", vessel_id: vesselId, voyage: "T", ports: [], containers: [], placements: [], unplaced: [],
  breakbulk_cargo: [], breakbulk_placements: [],
});

const regionOf = (regions: FreeRegion[], areaId: string): FreeRegion => regions.find((r) => r.area.id === areaId)!;

const bbc = buildBbcSaoPauloVesselAndCargo();
const bbcModel = buildStowageModel(bbc.vessel);
const bbcPlan = buildLoadedDemoPlan(bbc.vessel, bbc.containers);
const blade = item();
const demo = buildDemoVesselAndCargo();

describe("freeRegionsFor", () => {
  it("returns one region per area of the model, in the model's own order", () => {
    const regions = freeRegionsFor(bbc.vessel, bbcPlan, blade);

    expect(regions.map((r) => r.area.id)).toEqual(bbcModel.areas.map((a) => a.id));
    expect(regions).toHaveLength(4); // weather deck + Hold 2 tank top + Hold 2 aft deck level + Hold 1
    for (const region of regions) expect(region.area).toBe(bbcModel.areaById.get(region.area.id));
  });

  it("drops the keep-outs outside the area rect and clips the ones that straddle it (D-P4)", () => {
    const weather = regionOf(freeRegionsFor(bbc.vessel, bbcPlan, blade), "weather_deck");

    // 6 declared (2 crane foundations, 2 crane pedestals, forecastle, aft deck structure).
    expect(weather.area.keepOuts).toHaveLength(6);
    expect(weather.keepOuts).toHaveLength(2); // the two crane pedestals; the rest sit outside the rect
    for (const keepOut of weather.keepOuts) expect(rectContainsRect(weather.area.rect, keepOut)).toBe(true);

    const [crane1, crane2] = weather.keepOuts;
    expect(crane1.xMin).toBeCloseTo(41.55, 6);
    expect(crane1.xMax).toBeCloseTo(45.55, 6);
    expect(crane1.zMax).toBe(-7); // its own inboard edge, untouched
    expect(crane1.zMin).toBe(weather.area.rect.zMin); // clipped at the port edge of the usable deck
    expect(crane2.xMin).toBeCloseTo(86.3, 6);
  });

  it("makes a 62 m blade feasible exactly where the area itself can take it", () => {
    const regions = freeRegionsFor(bbc.vessel, bbcPlan, blade);
    const fits = regions.filter((r) => r.feasible).map((r) => r.area.label);

    expect(fits).toEqual(["weather deck", "Hold 2 tank top"]);

    const hold1 = regionOf(regions, "tank_top_hold1"); // 7.7 m long — 62 m cannot fit, at any rotation
    expect(hold1.feasible).toBe(false);
    expect(hold1.reason).toEqual({
      rule: "breakbulk_out_of_deck_area",
      message: "BLADE: footprint extends outside Hold 1 tank top",
      severity: "error",
    });
    expect(regionOf(regions, "main_deck_aft_hold2").reason?.rule).toBe("breakbulk_out_of_deck_area");
  });

  it("judges the AREA, not the occupancy: a stack under the centre does not make the area unfit", () => {
    const weather = regionOf(freeRegionsFor(bbc.vessel, bbcPlan, blade), "weather_deck");
    // ...while the predicate, asked about the same item at that area's centre, refuses the pose itself
    // (an on-deck stack in the loaded demo plan). One predicate, two questions — and `feasible` is the
    // "fits in" list, NOT a promise that a drop succeeds anywhere.
    const atCentre = canPlaceBreakbulk(bbcModel, bbcPlan, blade, { areaId: "weather_deck", x_m: 66, z_m: 0 }, bbc.vessel);

    expect(weather.feasible).toBe(true);
    expect(atCentre.ok).toBe(false);
    expect(atCentre.reasons.map((r) => r.rule)).not.toContain("breakbulk_out_of_deck_area");
  });

  it("draws what is already there: a placed project-cargo item, then the container stacks", () => {
    const yacht = item({ id: "YACHT", category: "yacht", length_m: 30, width_m: 6.5, height_m: 7, weight_t: 95 });
    const placed: BreakbulkPlacement = { cargo_id: "YACHT", x_m: 40, z_m: 5, rotation_deg: 0 };
    const plan: StowagePlan = { ...bbcPlan, breakbulk_cargo: [yacht], breakbulk_placements: [placed] };
    const weather = regionOf(freeRegionsFor(bbc.vessel, plan, yacht), "weather_deck");
    const stacks = occupiedRectsByArea(bbc.vessel, plan.placements)["weather_deck"] ?? [];

    expect(stacks.length).toBeGreaterThan(0); // the loaded plan really does have on-deck stacks
    expect(weather.occupied).toContainEqual({ xMin: 25, xMax: 55, zMin: 1.75, zMax: 8.25 });
    expect(weather.occupied).toEqual([{ xMin: 25, xMax: 55, zMin: 1.75, zMax: 8.25 }, ...stacks]);
  });

  it("gives a vessel with no declared layout one generic area with nothing to clip or avoid", () => {
    const regions = freeRegionsFor(demo.vessel, emptyPlan(demo.vessel.id), blade);

    expect(regions).toHaveLength(1);
    expect(regions[0].area.source).toBe("generic");
    expect(regions[0].feasible).toBe(true);
    expect(regions[0].reason).toBeNull();
    expect(regions[0].keepOuts).toEqual([]);
    expect(regions[0].occupied).toEqual([]);
    expect(regions[0].area.rect).toEqual({ xMin: 25.8, xMax: 146.2, zMin: -12.2, zMax: 12.2 });
  });

  it("leaves the generic deck to be refused by the footprint — it declares no height and no rating", () => {
    const tooLong = item({ id: "HULL", length_m: 200 });
    const region = freeRegionsFor(demo.vessel, emptyPlan(demo.vessel.id), tooLong)[0];

    expect(region.feasible).toBe(false);
    expect(region.reason?.message).toBe("HULL: footprint extends outside the usable deck area");
  });

  it("reads occupancy from the plan as it stands, on the demo vessel too", () => {
    const loaded = buildLoadedDemoPlan(demo.vessel, demo.containers);
    const region = freeRegionsFor(demo.vessel, loaded, blade)[0];

    expect(loaded.placements.length).toBeGreaterThan(0);
    expect(region.occupied).toEqual(occupiedRectsByArea(demo.vessel, loaded.placements)["weather_deck"] ?? []);
    expect(region.occupied.length).toBeGreaterThan(0);
  });
});
