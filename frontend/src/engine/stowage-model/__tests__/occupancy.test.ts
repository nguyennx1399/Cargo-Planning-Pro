import { describe, expect, it } from "vitest";
import {
  breakbulkOccupancy,
  containerOccupancy,
  occupiedRectsByArea,
  occupiedStacks,
} from "../occupancy";
import { buildStowageModel } from "../build-stowage-model";
import type { BreakbulkCargo, BreakbulkPlacement, Placement, StackSpec, Vessel } from "@/types/domain";

const onDeckStack: StackSpec = { bay: 2, row: 1, deck: "on", tiers: [82], max_weight_t: 40, max_height_m: null, reefer_tiers: [] };
const underDeckStack: StackSpec = { bay: 2, row: 1, deck: "under", tiers: [2], max_weight_t: 50, max_height_m: null, reefer_tiers: [] };

const vessel: Vessel = {
  id: "v",
  name: "V",
  imo: null,
  length_m: 100,
  beam_m: 20,
  bays: [2],
  rows: [1, 3],
  stacks: [onDeckStack, underDeckStack],
  breakbulk_holds: [
    {
      id: "hold_1",
      label: "Hold 1 tank top",
      level: "tank_top",
      hold: "1",
      area: { xMin: 0, xMax: 100, zMin: -10, zMax: 10 },
      keep_out: [],
      cargo_base_height_m: -9.5,
    },
  ],
};

const onDeck: Placement = { container_id: "c1", slot: { bay: 2, row: 1, tier: 82 } };
const underDeck: Placement = { container_id: "c2", slot: { bay: 2, row: 1, tier: 2 } };

describe("occupiedStacks", () => {
  it("leaves an empty ship free — it reads placements, never capacity", () => {
    expect(occupiedStacks(vessel, [])).toEqual([]);
    expect(containerOccupancy(vessel, []).size).toBe(0);
  });

  it("collapses a whole column into one footprint per bay/row/deck", () => {
    const column: Placement[] = [
      { container_id: "a", slot: { bay: 2, row: 1, tier: 2 } },
      { container_id: "b", slot: { bay: 2, row: 1, tier: 4 } },
    ];
    const stacks = occupiedStacks({ ...vessel, stacks: [{ ...underDeckStack, tiers: [2, 4] }] }, column);
    expect(stacks).toHaveLength(1);
    expect(stacks[0].deck).toBe("under");
  });

  it("blocks the full beam for a row the vessel does not declare", () => {
    const odd: Vessel = {
      ...vessel,
      stacks: [{ bay: 2, row: 99, deck: "on", tiers: [82], max_weight_t: 40, max_height_m: null, reefer_tiers: [] }],
    };
    const [stack] = occupiedStacks(odd, [{ container_id: "c", slot: { bay: 2, row: 99, tier: 82 } }]);
    expect(stack.rect.zMin).toBe(-odd.beam_m / 2);
    expect(stack.rect.zMax).toBe(odd.beam_m / 2);
  });

  it("sizes the footprint as one 40' x 2.438 m slot", () => {
    const [stack] = occupiedStacks(vessel, [onDeck]);
    expect(stack.rect.xMax - stack.rect.xMin).toBeCloseTo(12.192, 9);
    expect(stack.rect.zMax - stack.rect.zMin).toBeCloseTo(2.438, 9);
  });
});

describe("containerOccupancy", () => {
  it("puts an on-deck stack on the weather deck only", () => {
    const map = containerOccupancy(vessel, [onDeck]);
    expect([...map.keys()]).toEqual(["weather_deck"]);
    expect(map.get("weather_deck")).toHaveLength(1);
  });

  it("puts an under-deck stack in the hold it overlaps, not on the deck", () => {
    const map = containerOccupancy(vessel, [underDeck]);
    expect(map.has("weather_deck")).toBe(false);
    expect(map.get("hold_1")).toHaveLength(1);
    expect(map.get("hold_1")?.[0].deck).toBe("under");
  });

  it("groups a mixed plan by area", () => {
    const map = containerOccupancy(vessel, [onDeck, underDeck]);
    expect(map.get("weather_deck")).toHaveLength(1);
    expect(map.get("hold_1")).toHaveLength(1);
  });

  it("blocks EVERY hold area a column passes through, and only those it overlaps", () => {
    // A container column runs from the tank top up through the tweendeck above it, so it blocks
    // both; a hold it does not overlap must stay free. No real vessel exercises this (on BBC the
    // tweendeck and tank-top rects are disjoint), so this crafted case is the only guard.
    const stacked: Vessel = {
      ...vessel,
      breakbulk_holds: [
        {
          id: "tank_top_1",
          label: "Hold 1 tank top",
          level: "tank_top",
          hold: "1",
          area: { xMin: 0, xMax: 100, zMin: -10, zMax: 10 },
          keep_out: [],
          cargo_base_height_m: -9.5,
        },
        {
          id: "tweendeck_1",
          label: "Hold 1 tweendeck",
          level: "tweendeck",
          hold: "1",
          area: { xMin: 20, xMax: 90, zMin: -8, zMax: 8 },
          keep_out: [],
          cargo_base_height_m: -3.5,
        },
        {
          id: "hold_far_forward",
          label: "Hold 9 tank top",
          level: "tank_top",
          hold: "9",
          area: { xMin: 200, xMax: 300, zMin: -10, zMax: 10 },
          keep_out: [],
          cargo_base_height_m: -9.5,
        },
      ],
    };
    const map = containerOccupancy(stacked, [underDeck]);
    expect([...map.keys()].sort()).toEqual(["tank_top_1", "tweendeck_1"]);
    expect(map.get("tweendeck_1")).toHaveLength(1);
    expect(map.has("hold_far_forward")).toBe(false);
  });
});

describe("breakbulkOccupancy", () => {
  const blade: BreakbulkCargo = {
    id: "blade_1",
    category: "wind_turbine_blade",
    length_m: 62,
    width_m: 4.2,
    height_m: 4.2,
    weight_t: 20,
    kg_above_base_m: 2.1,
    pol: "NLRTM",
    pod: "SGSIN",
  };

  it("groups footprints by the placement's area, defaulting to the weather deck", () => {
    const placements: BreakbulkPlacement[] = [
      { cargo_id: "blade_1", x_m: 50, z_m: 0, rotation_deg: 0 },
      { cargo_id: "blade_1", x_m: 50, z_m: 0, rotation_deg: 0, area_id: "hold_1" },
    ];
    const map = breakbulkOccupancy([blade], placements);
    expect(map.get("weather_deck")).toHaveLength(1);
    expect(map.get("hold_1")).toHaveLength(1);
    const [rect] = map.get("weather_deck")!;
    expect(rect.xMax - rect.xMin).toBeCloseTo(62, 9);
    expect(rect.zMax - rect.zMin).toBeCloseTo(4.2, 9);
  });

  it("swaps the footprint extents for a rotated placement", () => {
    const map = breakbulkOccupancy([blade], [{ cargo_id: "blade_1", x_m: 50, z_m: 0, rotation_deg: 90 }]);
    const [rect] = map.get("weather_deck")!;
    expect(rect.xMax - rect.xMin).toBeCloseTo(4.2, 9);
    expect(rect.zMax - rect.zMin).toBeCloseTo(62, 9);
  });

  it("skips an orphan placement whose cargo item is missing", () => {
    expect(breakbulkOccupancy([], [{ cargo_id: "ghost", x_m: 10, z_m: 0, rotation_deg: 0 }]).size).toBe(0);
  });
});

describe("occupiedRectsByArea", () => {
  it("flattens container stacks to plain rects per area — the packer's seed", () => {
    const rects = occupiedRectsByArea(vessel, [onDeck, underDeck]);
    expect(Object.keys(rects).sort()).toEqual(["hold_1", "weather_deck"]);
    expect(rects.weather_deck).toHaveLength(1);
    // The rect must be the SAME geometry the model publishes for that slot — the packer seeds its
    // placed-rects from these, so any divergence would let cargo pack through a real container.
    const model = buildStowageModel(vessel);
    expect(rects.weather_deck[0]).toEqual(model.slotByKey.get("2|1|82")!.rect);
    expect(rects.hold_1[0]).toEqual(model.slotByKey.get("2|1|2")!.rect);
  });

  it("returns an empty record for an empty plan", () => {
    expect(occupiedRectsByArea(vessel, [])).toEqual({});
  });
});
