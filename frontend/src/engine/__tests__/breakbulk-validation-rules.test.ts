import { describe, expect, it } from "vitest";
import { breakbulkOutOfDeckArea, breakbulkOverlap, breakbulkOverlapsContainer, breakbulkOverweight } from "../breakbulk-validation-rules";
import type { BreakbulkCargo, BreakbulkPlacement, Placement, Vessel } from "@/types/domain";

const vessel: Vessel = { id: "v", name: "V", imo: null, length_m: 200, beam_m: 30, bays: [2, 6], rows: [], stacks: [] };

function item(id: string, patch: Partial<BreakbulkCargo> = {}): BreakbulkCargo {
  return { id, category: "yacht", length_m: 20, width_m: 6, height_m: 5, weight_t: 30, kg_above_base_m: 2.5, pol: "A", pod: "B", ...patch };
}

describe("breakbulkOutOfDeckArea", () => {
  it("flags a placement whose footprint extends past the deck bounds", () => {
    const cargo = [item("a", { length_m: 20 })];
    const placements: BreakbulkPlacement[] = [{ cargo_id: "a", x_m: 5, z_m: 0, rotation_deg: 0 }]; // near AP, inside the stern margin
    const violations = breakbulkOutOfDeckArea(vessel, cargo, placements);
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("breakbulk_out_of_deck_area");
  });

  it("does not flag a placement fully inside the deck area", () => {
    const cargo = [item("a", { length_m: 20 })];
    const placements: BreakbulkPlacement[] = [{ cargo_id: "a", x_m: 100, z_m: 0, rotation_deg: 0 }];
    expect(breakbulkOutOfDeckArea(vessel, cargo, placements)).toHaveLength(0);
  });
});

describe("breakbulkOverlap", () => {
  it("flags two placements that overlap", () => {
    const cargo = [item("a"), item("b")];
    const placements: BreakbulkPlacement[] = [
      { cargo_id: "a", x_m: 100, z_m: 0, rotation_deg: 0 },
      { cargo_id: "b", x_m: 105, z_m: 0, rotation_deg: 0 },
    ];
    expect(breakbulkOverlap(cargo, placements)).toHaveLength(1);
  });

  it("does not flag two placements that don't overlap", () => {
    const cargo = [item("a"), item("b")];
    const placements: BreakbulkPlacement[] = [
      { cargo_id: "a", x_m: 100, z_m: 0, rotation_deg: 0 },
      { cargo_id: "b", x_m: 150, z_m: 0, rotation_deg: 0 },
    ];
    expect(breakbulkOverlap(cargo, placements)).toHaveLength(0);
  });
});

describe("breakbulkOverlapsContainer", () => {
  it("flags a breakbulk placement over an on-deck container bay", () => {
    const cargo = [item("a", { length_m: 20 })];
    const containerPlacements: Placement[] = [{ container_id: "c1", slot: { bay: 2, row: 1, tier: 82 } }];
    // bay 2's ship-frame center for this vessel is near the bow end; place breakbulk right there.
    const placements: BreakbulkPlacement[] = [{ cargo_id: "a", x_m: 178, z_m: 0, rotation_deg: 0 }];
    const violations = breakbulkOverlapsContainer(vessel, cargo, placements, containerPlacements);
    expect(violations).toHaveLength(1);
  });

  it("does not flag when there are no on-deck containers at all", () => {
    const cargo = [item("a", { length_m: 20 })];
    const placements: BreakbulkPlacement[] = [{ cargo_id: "a", x_m: 100, z_m: 0, rotation_deg: 0 }];
    expect(breakbulkOverlapsContainer(vessel, cargo, placements, [])).toHaveLength(0);
  });
});

describe("breakbulkOverweight", () => {
  it("flags a 20m band whose total breakbulk weight exceeds the demo limit", () => {
    const cargo = [item("a", { weight_t: 120 }), item("b", { weight_t: 120 })];
    const placements: BreakbulkPlacement[] = [
      { cargo_id: "a", x_m: 100, z_m: -5, rotation_deg: 0 },
      { cargo_id: "b", x_m: 105, z_m: 5, rotation_deg: 0 },
    ];
    expect(breakbulkOverweight(vessel, cargo, placements)).toHaveLength(1);
  });

  it("does not flag when every band stays under the demo limit", () => {
    const cargo = [item("a", { weight_t: 50 }), item("b", { weight_t: 50 })];
    const placements: BreakbulkPlacement[] = [
      { cargo_id: "a", x_m: 100, z_m: -5, rotation_deg: 0 },
      { cargo_id: "b", x_m: 105, z_m: 5, rotation_deg: 0 },
    ];
    expect(breakbulkOverweight(vessel, cargo, placements)).toHaveLength(0);
  });
});
