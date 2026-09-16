import { describe, expect, it } from "vitest";
import { allSlots, emptySlots } from "../all-slots";
import type { Placement, StackSpec, Vessel } from "@/types/domain";

const stacks: StackSpec[] = [
  { bay: 2, row: 1, deck: "under", tiers: [2, 4], max_weight_t: 100, max_height_m: null, reefer_tiers: [] },
  { bay: 2, row: 1, deck: "on", tiers: [82, 84], max_weight_t: 80, max_height_m: null, reefer_tiers: [] },
  { bay: 2, row: 3, deck: "under", tiers: [2], max_weight_t: 100, max_height_m: null, reefer_tiers: [] },
];

const vessel: Vessel = {
  id: "v", name: "V", imo: null, length_m: 100, beam_m: 20, bays: [2], rows: [1, 3], stacks,
};

describe("allSlots", () => {
  it("expands every stack's tiers into individual bay/row/tier slots", () => {
    const slots = allSlots(vessel);
    expect(slots).toHaveLength(5);
    expect(slots).toEqual(
      expect.arrayContaining([
        { bay: 2, row: 1, tier: 2 },
        { bay: 2, row: 1, tier: 4 },
        { bay: 2, row: 1, tier: 82 },
        { bay: 2, row: 1, tier: 84 },
        { bay: 2, row: 3, tier: 2 },
      ])
    );
  });

  it("returns an empty array for a vessel with no stacks", () => {
    expect(allSlots({ ...vessel, stacks: [] })).toEqual([]);
  });
});

describe("emptySlots", () => {
  it("excludes slots that already have a placement", () => {
    const placements: Placement[] = [
      { container_id: "c1", slot: { bay: 2, row: 1, tier: 2 } },
      { container_id: "c2", slot: { bay: 2, row: 3, tier: 2 } },
    ];
    const slots = emptySlots(vessel, placements);
    expect(slots).toHaveLength(3);
    expect(slots).not.toContainEqual({ bay: 2, row: 1, tier: 2 });
    expect(slots).not.toContainEqual({ bay: 2, row: 3, tier: 2 });
    expect(slots).toContainEqual({ bay: 2, row: 1, tier: 82 });
  });

  it("returns all slots when nothing is placed", () => {
    expect(emptySlots(vessel, [])).toHaveLength(5);
  });

  it("returns no slots when every slot is occupied", () => {
    const placements: Placement[] = allSlots(vessel).map((slot, i) => ({ container_id: `c${i}`, slot }));
    expect(emptySlots(vessel, placements)).toEqual([]);
  });
});
