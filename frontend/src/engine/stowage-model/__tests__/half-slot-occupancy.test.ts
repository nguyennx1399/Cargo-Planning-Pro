/**
 * What a 20' placement blocks — the occupancy side of the half-slot fix.
 *
 * A 20' box stands in an ODD bay, which is one 20' half of its parent 40' cell, so its footprint must
 * be sized from the bay's parity (`sizeFitsBay`'s own convention) rather than as a whole 40' cell:
 * before the fix every footprint was `DIM.len40` and the code carried a TODO about it. This file
 * checks the sizing at its source (`occupiedStacks`) and follows it into the two consumers that
 * matter: the packer's seed rects (`occupiedRectsByArea`) and the breakbulk blocker
 * (`canPlaceBreakbulk` → `containerOccupancy`), which must now leave the cell's other half free.
 */
import { describe, expect, it } from "vitest";
import { buildStowageModel } from "../build-stowage-model";
import { occupiedRectsByArea, occupiedStacks } from "../occupancy";
import { canPlaceBreakbulk } from "@/engine/placement/can-place-breakbulk";
import type { BreakbulkCargo, Placement, StowagePlan, Vessel } from "@/types/domain";

const vessel: Vessel = {
  id: "v",
  name: "V",
  imo: null,
  length_m: 100,
  beam_m: 20,
  bays: [2],
  rows: [1, 3],
  stacks: [{ bay: 2, row: 1, deck: "on", tiers: [82], max_weight_t: 40, max_height_m: null, reefer_tiers: [] }],
};

/** Bay 1 is the FORE half of bay 2's cell; bay 3 the aft half. */
const foreHalf: Placement = { container_id: "twenty", slot: { bay: 1, row: 1, tier: 82 } };
const forty: Placement = { container_id: "forty", slot: { bay: 2, row: 1, tier: 82 } };

const item: BreakbulkCargo = {
  id: "BB", category: "yacht", length_m: 5, width_m: 2, height_m: 2, weight_t: 5, kg_above_base_m: 1, pol: "A", pod: "B",
};

const centreOf = (rect: { xMin: number; xMax: number; zMin: number; zMax: number }) => ({
  x_m: (rect.xMin + rect.xMax) / 2,
  z_m: (rect.zMin + rect.zMax) / 2,
});

describe("a 20' placement's footprint", () => {
  it("is one 20' half of the parent cell, byte-identical to the model's half-slot rect", () => {
    const model = buildStowageModel(vessel);
    const [stack] = occupiedStacks(vessel, [foreHalf]);
    const [cell] = occupiedStacks(vessel, [forty]);

    expect(stack.bay).toBe(1);
    expect(stack.rect.xMax - stack.rect.xMin).toBeCloseTo(6.058, 9); // 20', not 12.192
    expect(stack.rect.zMax - stack.rect.zMin).toBeCloseTo(2.438, 9);
    // The packer seeds its placed-rects from `occupiedRectsByArea`, and `canPlaceContainer` tests the
    // model's own rect, so the two must be the same geometry.
    expect(occupiedRectsByArea(vessel, [foreHalf]).weather_deck[0]).toEqual(model.slotByKey.get("1|1|82")!.rect);
    // Inside the 40' cell it is a half of — not the whole cell, and not the aft half.
    expect(stack.rect.xMin).toBeGreaterThan(cell.rect.xMin);
    expect(stack.rect.xMax).toBeLessThanOrEqual(cell.rect.xMax + 1e-9);
    expect(stack.rect).not.toEqual(cell.rect);
  });

  it("leaves the cell's other half free for project cargo, and blocks the half it stands in", () => {
    const model = buildStowageModel(vessel);
    const plan: StowagePlan = {
      id: "p", vessel_id: "v", voyage: "T", ports: [], containers: [], placements: [foreHalf], unplaced: [],
      breakbulk_cargo: [item], breakbulk_placements: [],
    };
    const blocked = (slotKey: string) =>
      canPlaceBreakbulk(model, plan, item, centreOf(model.slotByKey.get(slotKey)!.rect), vessel).reasons.map((r) => r.rule);

    // The aft half of the same cell (bay 3) is free: the 20' box does not fill the cell.
    expect(blocked("3|1|82")).not.toContain("breakbulk_overlaps_container");
    // The half the box stands in is blocked, by the area's occupancy — not by a whole-bay zone.
    expect(blocked("1|1|82")).toContain("breakbulk_overlaps_container");
  });
});
