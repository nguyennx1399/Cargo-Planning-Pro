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

  it("does not false-positive on a placement whose center puts an edge EXACTLY at the deck bound (float round-trip noise)", () => {
    // Regression: found via the real demo breakbulk set against real vessel dimensions (172m/
    // 27.4m) — a blade placed flush against the stern margin came back as
    // xMin: 25.799999999999997 vs area.xMin: 25.8 (center +/- extent/2 doesn't always exactly
    // reconstruct the edge a placer derived the center FROM), which a zero-tolerance comparison
    // flagged as a real violation for a legitimately-fitting placement.
    const v: Vessel = { id: "v2", name: "V2", imo: null, length_m: 172, beam_m: 27.4, bays: [], rows: [], stacks: [] };
    const cargo = [item("a", { length_m: 62, width_m: 4.5 })];
    // area.xMin for this vessel is 172*0.15 = 25.8; place the item flush against it, same
    // center-derivation naiveFillBreakbulk itself uses (x + length/2).
    const xMin = v.length_m * 0.15;
    const placements: BreakbulkPlacement[] = [{ cargo_id: "a", x_m: xMin + 62 / 2, z_m: 0, rotation_deg: 0 }];
    expect(breakbulkOutOfDeckArea(v, cargo, placements)).toHaveLength(0);
  });

  it("still flags a placement that is genuinely, non-trivially outside the deck bound", () => {
    const cargo = [item("a", { length_m: 20 })];
    const placements: BreakbulkPlacement[] = [{ cargo_id: "a", x_m: -50, z_m: 0, rotation_deg: 0 }]; // way off, not a float rounding case
    expect(breakbulkOutOfDeckArea(vessel, cargo, placements)).toHaveLength(1);
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

  // Phase A replaced whole-bay x-zones with real per-stack rects. These two pin the BOUND of that
  // loosening: cargo beside a stack is now allowed, cargo crossing one still is not.
  // Note the fixture above declares `rows: []`, which makes every stack fall back to a full-beam
  // rect — so these use a vessel with declared rows for a 2.438 m-wide stack footprint.
  const rowVessel: Vessel = { ...vessel, rows: [1, 3] };
  const bayTwoStack: Placement[] = [{ container_id: "c1", slot: { bay: 2, row: 1, tier: 82 } }];
  // bay 2 sits at x_m ≈ 171.3 on this 200 m vessel; row 1's footprint is z ∈ [-2.468, -0.03].

  it("stays clean for cargo in a different row — beside the stack, not over it", () => {
    const cargo = [item("a", { length_m: 20, width_m: 6 })];
    // Same x-band as bay 2 (the old x-only zone would have flagged this) but z well clear of row 1.
    const placements: BreakbulkPlacement[] = [{ cargo_id: "a", x_m: 171.3, z_m: 8, rotation_deg: 0 }];
    expect(breakbulkOverlapsContainer(rowVessel, cargo, placements, bayTwoStack)).toHaveLength(0);
  });

  it("still flags cargo whose footprint crosses the stack, and names it", () => {
    const cargo = [item("a", { length_m: 20, width_m: 6 })];
    const placements: BreakbulkPlacement[] = [{ cargo_id: "a", x_m: 171.3, z_m: 0, rotation_deg: 0 }];
    const violations = breakbulkOverlapsContainer(rowVessel, cargo, placements, bayTwoStack);
    expect(violations).toHaveLength(1);
    expect(violations[0].rule).toBe("breakbulk_overlaps_container");
    expect(violations[0].message).toContain("bay 2 row 01"); // names the stack it hit
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
