import { describe, expect, it } from "vitest";
import { cargoWeightItem } from "../cargo-weight-item";
import { buildDemoVessel } from "@/data/demo-container-vessel";
import { buildDemoHorizonGeometry } from "@/data/demo-horizon-geometry";
import { slotToPosition } from "../geometry";
import { shipToScene } from "../ship-frame";
import type { Container, Slot } from "@/types/domain";

describe("cargoWeightItem", () => {
  const vessel = buildDemoVessel();
  const geometry = buildDemoHorizonGeometry();
  const container: Container = {
    id: "TEST0000001",
    size: "40",
    type: "DRY",
    high_cube: false,
    weight_t: 22,
    pol: "VNSGN",
    pod: "SGSIN",
    imdg_class: null,
    oog: false,
  };

  it("converts to ship-frame (lcg/tcg/kg) that maps back to the EXACT scene position the container renders at", () => {
    const slots: Slot[] = [{ bay: 2, row: 1, tier: 2 }, { bay: 22, row: 10, tier: 84 }, { bay: 38, row: 8, tier: 8 }];
    for (const slot of slots) {
      const item = cargoWeightItem(vessel, geometry, container, slot);
      const backToScene = shipToScene(geometry, [item.lcg_m, item.tcg_m, item.kg_m]);
      const expectedScene = slotToPosition(vessel, slot);
      expect(backToScene[0]).toBeCloseTo(expectedScene[0], 6);
      expect(backToScene[1]).toBeCloseTo(expectedScene[1], 6);
      expect(backToScene[2]).toBeCloseTo(expectedScene[2], 6);
    }
  });

  it("carries the container's own weight through unchanged", () => {
    const item = cargoWeightItem(vessel, geometry, container, { bay: 2, row: 1, tier: 2 });
    expect(item.weight_t).toBe(22);
  });
});
