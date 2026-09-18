/**
 * Stacks through the draft store (stacking plan, phases 03–04): a placement keeps its support, a move
 * back to the floor drops it, and nothing that carries others can be lifted, moved or unplaced — the
 * gesture gate says so early, the store refuses for real, and a refusal leaves the plan untouched.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { usePlanDraftStore } from "../usePlanDraftStore";
import { usePlanStore } from "../usePlanStore";
import { canBeginBreakbulkMove } from "../begin-breakbulk-move";
import type { BreakbulkCargo, StowagePlan, Vessel } from "@/types/domain";

const vessel: Vessel = {
  id: "bb", name: "BB", imo: null, length_m: 200, beam_m: 30, bays: [], rows: [], stacks: [],
  breakbulk_deck: { area: { xMin: 20, xMax: 180, zMin: -10, zMax: 10 }, keep_out: [], cargo_base_height_m: 1, max_cargo_height_m: 6, deck_load_t_per_m2: 2 },
};
const F: BreakbulkCargo = {
  id: "F1", category: "support_frame", length_m: 12, width_m: 5, height_m: 0.5, weight_t: 3, kg_above_base_m: 0.25,
  pol: "A", pod: "B", stacking: { max_top_load_t: 60 },
};
const B: BreakbulkCargo = { id: "B1", category: "general", length_m: 10, width_m: 4, height_m: 2, weight_t: 20, kg_above_base_m: 1, pol: "A", pod: "B" };
const plan: StowagePlan = {
  id: "p", vessel_id: "bb", voyage: "T", ports: [], containers: [], placements: [], unplaced: [],
  breakbulk_cargo: [F, B], breakbulk_placements: [],
};
const draft = () => usePlanDraftStore.getState();

beforeEach(() => {
  usePlanDraftStore.setState({ vessel: null, plan: null, past: [], future: [] });
  usePlanStore.getState().setDropOutcome(null);
  draft().loadPlan(vessel, plan);
  expect(draft().placeBreakbulk("F1", { x_m: 50, z_m: 0 }).ok).toBe(true);
  expect(draft().placeBreakbulk("B1", { x_m: 50, z_m: 0, onCargoId: "F1" }).ok).toBe(true);
});

describe("a stacked placement", () => {
  it("records what it rests on", () => {
    expect(draft().plan!.breakbulk_placements).toContainEqual({ cargo_id: "B1", x_m: 50, z_m: 0, rotation_deg: 0, on_cargo_id: "F1" });
  });

  it("drops its support when moved back to the floor", () => {
    expect(draft().moveBreakbulk("B1", { x_m: 80, z_m: 0 }).ok).toBe(true);
    expect(draft().plan!.breakbulk_placements).toContainEqual({ cargo_id: "B1", x_m: 80, z_m: 0, rotation_deg: 0 });
  });
});

describe("an item that carries others", () => {
  it("cannot be picked up, and the reason is recorded for the UI", () => {
    expect(canBeginBreakbulkMove(draft().plan!, "F1")).toBe(false);
    expect(JSON.stringify(usePlanStore.getState().dropOutcome)).toContain("F1 carries B1 — lift it off first");
  });

  it("the top of the stack can be picked up", () => {
    expect(canBeginBreakbulkMove(draft().plan!, "B1")).toBe(true);
    expect(usePlanStore.getState().dropOutcome).toBeNull();
  });

  it("cannot be moved or unplaced — and a refusal leaves the plan untouched", () => {
    const before = draft().plan;
    const moved = draft().moveBreakbulk("F1", { x_m: 80, z_m: 0 });
    expect(moved.ok).toBe(false);
    expect(moved.reasons[0]).toMatchObject({ rule: "no_floating", message: "F1 carries B1 — lift it off first" });
    expect(draft().unplaceBreakbulk("F1").ok).toBe(false);
    expect(draft().plan).toBe(before);
  });

  it("is free again once the top is taken off", () => {
    expect(draft().unplaceBreakbulk("B1").ok).toBe(true);
    expect(draft().unplaceBreakbulk("F1").ok).toBe(true);
    expect(draft().plan!.breakbulk_placements).toEqual([]);
  });
});
