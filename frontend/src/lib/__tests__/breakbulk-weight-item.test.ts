import { describe, expect, it } from "vitest";
import { breakbulkWeightItem } from "../breakbulk-weight-item";
import { cargoWeightItem } from "../cargo-weight-item";
import { buildDemoHorizonGeometry } from "@/data/demo-horizon-geometry";
import { buildDemoVessel } from "@/data/demo-container-vessel";
import { LAYOUT } from "../geometry";
import type { BreakbulkCargo, BreakbulkPlacement, Container } from "@/types/domain";

const geometry = buildDemoHorizonGeometry();
const vessel = buildDemoVessel();

function item(patch: Partial<BreakbulkCargo> = {}): BreakbulkCargo {
  return { id: "b1", category: "wind_turbine_nacelle", length_m: 12, width_m: 4, height_m: 4.5, weight_t: 95, kg_above_base_m: 1.6, pol: "A", pod: "B", ...patch };
}

describe("breakbulkWeightItem", () => {
  it("raises kg_m by the item's height above its floor when it rests on other cargo (stacking)", () => {
    const placement: BreakbulkPlacement = { cargo_id: "b1", x_m: 77.5, z_m: 0, rotation_deg: 0 };
    const onFloor = breakbulkWeightItem(vessel, geometry, item(), placement);
    const stacked = breakbulkWeightItem(vessel, geometry, item(), placement, 2.5);
    expect(stacked.kg_m - onFloor.kg_m).toBeCloseTo(2.5, 9);
    expect(stacked.lcg_m).toBe(onFloor.lcg_m);
  });

  it("converts x_m (vessel.length_m/2-symmetric) to TRUE ship-frame lcg_m, same inversion cargoWeightItem uses", () => {
    const placement: BreakbulkPlacement = { cargo_id: "b1", x_m: 77.5, z_m: -4.2, rotation_deg: 0 };
    const w = breakbulkWeightItem(vessel, geometry, item(), placement);
    const expectedLcg = (77.5 - vessel.length_m / 2) + geometry.particulars.lbp_m / 2;
    expect(w.lcg_m).toBeCloseTo(expectedLcg, 6);
    expect(w.tcg_m).toBe(-4.2); // transverse axis: no conversion needed
  });

  it("does NOT treat x_m as already true ship-frame (regression for the LOA/LBP mismatch bug)", () => {
    // On the real demo vessel, length_m (172) != lbp_m (160), so a naive pass-through would give
    // a different (wrong) lcg_m than the correct conversion whenever length_m != lbp_m.
    expect(vessel.length_m).not.toBe(geometry.particulars.lbp_m);
    const placement: BreakbulkPlacement = { cargo_id: "b1", x_m: 100, z_m: 0, rotation_deg: 0 };
    const w = breakbulkWeightItem(vessel, geometry, item(), placement);
    expect(w.lcg_m).not.toBe(placement.x_m); // must differ, since length_m != lbp_m here
  });

  it("kg_m is deck level + LAYOUT.hatchHeight + the item's own CG above its base", () => {
    // LAYOUT.hatchHeight must be included: it's the SAME on-deck resting-surface reference
    // breakbulk-mesh-builder.ts renders items on, and cargoWeightItem folds in via tierCenterY
    // for containers (see the next test) — omitting it was a real bug (code-reviewer finding,
    // understated VCG by 0.6m relative to what's actually rendered).
    const placement: BreakbulkPlacement = { cargo_id: "b1", x_m: 0, z_m: 0, rotation_deg: 0 };
    const w = breakbulkWeightItem(vessel, geometry, item({ kg_above_base_m: 1.6 }), placement);
    expect(w.kg_m).toBeCloseTo(geometry.particulars.depth_m + LAYOUT.hatchHeight + 1.6, 6);
  });

  it("shares the SAME on-deck resting-surface reference as a container's lowest on-deck tier", () => {
    // A container sitting on the lowest on-deck tier (82) has its center at
    // hatchHeight + tierPitch/2 above the deck reference (tierCenterY), then cargoWeightItem adds
    // depth_m. A breakbulk item with kg_above_base_m equal to that same half-height should land
    // at the SAME kg_m — cross-checking against cargoWeightItem rather than re-deriving the
    // formula independently, so a future drift in either file's deck reference gets caught here.
    const container: Container = { id: "c1", size: "40", type: "DRY", high_cube: false, weight_t: 10, pol: "A", pod: "B", imdg_class: null, oog: false };
    const containerW = cargoWeightItem(vessel, geometry, container, { bay: vessel.bays[0], row: vessel.rows[0], tier: 82 });
    const containerHalfHeightAboveHatch = containerW.kg_m - geometry.particulars.depth_m - LAYOUT.hatchHeight;

    const breakbulkPlacement: BreakbulkPlacement = { cargo_id: "b1", x_m: 0, z_m: 0, rotation_deg: 0 };
    const w = breakbulkWeightItem(vessel, geometry, item({ kg_above_base_m: containerHalfHeightAboveHatch }), breakbulkPlacement);
    expect(w.kg_m).toBeCloseTo(containerW.kg_m, 6);
  });

  it("weight_t passes through unchanged", () => {
    const placement: BreakbulkPlacement = { cargo_id: "b1", x_m: 0, z_m: 0, rotation_deg: 0 };
    const w = breakbulkWeightItem(vessel, geometry, item({ weight_t: 123.4 }), placement);
    expect(w.weight_t).toBe(123.4);
  });
});
