import { describe, expect, it } from "vitest";
import { onDeckBayZones } from "../breakbulk-forbidden-zones";
import { buildDemoVessel } from "@/data/demo-container-vessel";
import { naiveFillPlan } from "../naive-fill-plan";
import { generateDemoCargo } from "@/data/demo-cargo-generator";
import type { Placement, Vessel } from "@/types/domain";

const emptyVessel: Vessel = { id: "v", name: "V", imo: null, length_m: 100, beam_m: 20, bays: [2, 6], rows: [], stacks: [] };

describe("onDeckBayZones", () => {
  it("returns no zones when nothing is placed on deck", () => {
    expect(onDeckBayZones(emptyVessel, [])).toEqual([]);
  });

  it("returns no zones for a container placed UNDER deck (tier < 80)", () => {
    const placements: Placement[] = [{ container_id: "c1", slot: { bay: 2, row: 1, tier: 4 } }];
    expect(onDeckBayZones(emptyVessel, placements)).toEqual([]);
  });

  it("returns exactly one zone per distinct bay that has an on-deck placement", () => {
    const placements: Placement[] = [
      { container_id: "c1", slot: { bay: 2, row: 1, tier: 82 } },
      { container_id: "c2", slot: { bay: 2, row: 2, tier: 84 } }, // same bay — should not duplicate
      { container_id: "c3", slot: { bay: 6, row: 1, tier: 82 } },
    ];
    const zones = onDeckBayZones(emptyVessel, placements);
    expect(zones).toHaveLength(2);
  });

  it("each zone is a valid, non-empty x range", () => {
    const placements: Placement[] = [{ container_id: "c1", slot: { bay: 2, row: 1, tier: 82 } }];
    const [zone] = onDeckBayZones(emptyVessel, placements);
    expect(zone.xMin).toBeLessThan(zone.xMax);
  });

  it("on the real demo vessel fully loaded, some bays have on-deck zones and some don't", () => {
    const vessel = buildDemoVessel();
    const containers = generateDemoCargo(42);
    const { placements } = naiveFillPlan(vessel, containers);
    const zones = onDeckBayZones(vessel, placements);
    expect(zones.length).toBeGreaterThan(0);
    expect(zones.length).toBeLessThan(vessel.bays.length); // not every bay gets on-deck cargo with 470/800 cells used
  });
});
