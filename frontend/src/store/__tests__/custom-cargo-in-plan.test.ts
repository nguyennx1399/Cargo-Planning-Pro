/**
 * Adding a planner-defined item keeps the planner's work (found while verifying the stacking plan):
 * it used to rebuild the plan, wiping every placement and the undo history.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { usePlanDraftStore } from "../usePlanDraftStore";
import { usePlanStore } from "../usePlanStore";
import { addCustomCargoToPlan, removeCustomCargoFromPlan } from "../custom-cargo-in-plan";
import type { BreakbulkCargo, StowagePlan, Vessel } from "@/types/domain";

const vessel: Vessel = {
  id: "bb", name: "BB", imo: null, length_m: 200, beam_m: 30, bays: [], rows: [], stacks: [],
  breakbulk_deck: { area: { xMin: 20, xMax: 180, zMin: -10, zMax: 10 }, keep_out: [], cargo_base_height_m: 1 },
};
const cargo = (id: string): BreakbulkCargo => ({
  id, category: "general", length_m: 10, width_m: 4, height_m: 2, weight_t: 20, kg_above_base_m: 1, pol: "", pod: "",
});
const plan: StowagePlan = {
  id: "p", vessel_id: "bb", voyage: "T", ports: [], containers: [], placements: [], unplaced: [],
  breakbulk_cargo: [cargo("A")], breakbulk_placements: [],
};
const draft = () => usePlanDraftStore.getState();

beforeEach(() => {
  usePlanStore.setState({ customCargo: [] });
  usePlanDraftStore.setState({ vessel: null, plan: null, past: [], future: [] });
  draft().loadPlan(vessel, plan);
  expect(draft().placeBreakbulk("A", { x_m: 50, z_m: 0 }).ok).toBe(true);
});

describe("addCustomCargoToPlan", () => {
  it("keeps every placement and the undo history", () => {
    addCustomCargoToPlan(cargo("NEW"));
    expect(draft().plan!.breakbulk_placements.map((p) => p.cargo_id)).toEqual(["A"]);
    expect(draft().past).toHaveLength(1);
    expect(draft().plan!.breakbulk_cargo.map((c) => c.id)).toEqual(["A", "NEW"]);
    expect(usePlanStore.getState().customCargo.map((c) => c.id)).toEqual(["NEW"]);
  });

  it("puts the item in history snapshots too, so undo cannot drop it from the list", () => {
    addCustomCargoToPlan(cargo("NEW"));
    draft().undo();
    expect(draft().plan!.breakbulk_cargo.map((c) => c.id)).toContain("NEW");
    expect(draft().plan!.breakbulk_placements).toEqual([]); // the placement is what undo takes back
  });
});

describe("removeCustomCargoFromPlan", () => {
  it("removes the item everywhere, leaving other placements alone", () => {
    addCustomCargoToPlan(cargo("NEW"));
    removeCustomCargoFromPlan("NEW");
    expect(draft().plan!.breakbulk_cargo.map((c) => c.id)).toEqual(["A"]);
    expect(draft().plan!.breakbulk_placements.map((p) => p.cargo_id)).toEqual(["A"]);
    expect(usePlanStore.getState().customCargo).toEqual([]);
  });
});
