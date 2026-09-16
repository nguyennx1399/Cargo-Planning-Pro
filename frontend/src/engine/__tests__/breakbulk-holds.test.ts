/**
 * Under-deck (hold) stowage for breakbulk cargo: the packer spills into `vessel.breakbulk_holds`,
 * every rule is evaluated per stowage area, and renderer/stability use the hold's own surface height.
 */
import { describe, expect, it } from "vitest";
import type { BreakbulkCargo, BreakbulkPlacement, Vessel } from "@/types/domain";
import { naiveFillBreakbulk } from "../naive-fill-breakbulk";
import {
  breakbulkInKeepOut,
  breakbulkOutOfDeckArea,
  breakbulkOverlap,
  breakbulkOverPressure,
  breakbulkTooTall,
} from "../breakbulk-validation-rules";
import { cargoBaseHeight, stowageAreaIds } from "../breakbulk-deck-area";
import { footprintRect } from "../breakbulk-overlap-check";
import { buildBreakbulkMesh } from "../cargo/breakbulk-mesh-builder";

// 100 m ship: 40 × 10 m deck envelope rated 2 t/m², and a 60 × 16 m tank top 10 m below with 8 m clear height, 15 t/m².
const vessel: Vessel = {
  id: "v", name: "V", imo: null, length_m: 100, beam_m: 20, bays: [], rows: [], stacks: [],
  breakbulk_deck: { area: { xMin: 30, xMax: 70, zMin: -5, zMax: 5 }, keep_out: [], cargo_base_height_m: 1, deck_load_t_per_m2: 2 },
  breakbulk_holds: [
    { id: "tt", label: "Test tank top", level: "tank_top", area: { xMin: 20, xMax: 80, zMin: -8, zMax: 8 }, keep_out: [], cargo_base_height_m: -10, max_cargo_height_m: 8, deck_load_t_per_m2: 15 },
  ],
};

function cargo(id: string, patch: Partial<BreakbulkCargo> = {}): BreakbulkCargo {
  return { id, category: "yacht", length_m: 10, width_m: 4, height_m: 3, weight_t: 20, kg_above_base_m: 1.5, pol: "A", pod: "B", ...patch };
}

describe("naiveFillBreakbulk with holds", () => {
  it("puts what fits on deck, spills the rest into the hold with area_id", () => {
    const items = [cargo("long", { length_m: 50, width_m: 4, weight_t: 60 }), cargo("small")];
    const { placements, unplaced } = naiveFillBreakbulk(vessel, items, []);
    expect(unplaced).toEqual([]);
    expect(placements.find((p) => p.cargo_id === "small")!.area_id).toBeUndefined(); // weather deck
    expect(placements.find((p) => p.cargo_id === "long")!.area_id).toBe("tt"); // 50 m > 40 m deck
  });

  it("useHolds: false keeps the old deck-only behaviour", () => {
    const { unplaced } = naiveFillBreakbulk(vessel, [cargo("long", { length_m: 50 })], [], { useHolds: false });
    expect(unplaced).toEqual(["long"]);
  });

  it("an item heavier per m² than the deck rating goes below, where the tank top can take it", () => {
    const heavy = cargo("heavy", { length_m: 5, width_m: 4, weight_t: 100 }); // 5 t/m² > 2 on deck, < 15 on tank top
    const { placements } = naiveFillBreakbulk(vessel, [heavy], []);
    expect(placements[0].area_id).toBe("tt");
  });

  it("an item taller than the hold's clear height is not put in the hold", () => {
    const tall = cargo("tall", { length_m: 50, height_m: 9 });
    expect(naiveFillBreakbulk(vessel, [tall], []).unplaced).toEqual(["tall"]);
  });

  it("a keep-out blocking the first row pushes a long item into the next row inboard instead of failing", () => {
    const v: Vessel = { ...vessel, breakbulk_deck: { ...vessel.breakbulk_deck!, keep_out: [{ id: "ped", label: "pedestal", xMin: 48, xMax: 52, zMin: -6, zMax: -3 }] } };
    const { placements } = naiveFillBreakbulk(v, [cargo("long", { length_m: 35, width_m: 3, weight_t: 30 })], [], { useHolds: false });
    expect(placements).toHaveLength(1);
    expect(footprintRect(cargo("long", { length_m: 35, width_m: 3 }), placements[0]).zMin).toBeGreaterThanOrEqual(-3 - 1e-9);
  });
});

describe("breakbulk rules are per stowage area", () => {
  const a = cargo("a");
  const b = cargo("b");
  const onDeck: BreakbulkPlacement = { cargo_id: "a", x_m: 50, z_m: 0, rotation_deg: 0 };
  const inHold: BreakbulkPlacement = { cargo_id: "b", x_m: 50, z_m: 0, rotation_deg: 0, area_id: "tt" };

  it("same footprint on deck and on the tank top below is not an overlap", () => {
    expect(breakbulkOverlap([a, b], [onDeck, inHold])).toEqual([]);
    expect(breakbulkOverlap([a, b], [onDeck, { ...inHold, area_id: undefined }])).toHaveLength(1);
  });

  it("each placement is checked against its own area's rectangle", () => {
    const wideOnDeck = { ...onDeck, z_m: 6 }; // outside the ±5 m deck, inside the ±8 m tank top
    expect(breakbulkOutOfDeckArea(vessel, [a], [wideOnDeck])).toHaveLength(1);
    expect(breakbulkOutOfDeckArea(vessel, [b], [{ ...inHold, z_m: 5.5 }])).toEqual([]);
  });

  it("an unknown area id is flagged rather than silently treated as the deck", () => {
    const v = breakbulkOutOfDeckArea(vessel, [b], [{ ...inHold, area_id: "nope" }]);
    expect(v.map((x) => x.message)).toEqual(['b: unknown stowage area "nope"']);
  });

  it("clear height and floor pressure use the area's own limits", () => {
    const tall = cargo("t", { height_m: 9 });
    expect(breakbulkTooTall(vessel, [tall], [{ ...inHold, cargo_id: "t" }])).toHaveLength(1);
    expect(breakbulkTooTall(vessel, [tall], [{ ...onDeck, cargo_id: "t" }])).toEqual([]); // deck declares no limit
    const dense = cargo("d", { length_m: 5, width_m: 4, weight_t: 100 }); // 5 t/m²
    expect(breakbulkOverPressure(vessel, [dense], [{ ...onDeck, cargo_id: "d" }]).map((x) => x.rule)).toEqual(["breakbulk_over_pressure"]);
    expect(breakbulkOverPressure(vessel, [dense], [{ ...inHold, cargo_id: "d" }])).toEqual([]);
  });

  it("keep-outs only apply in their own area", () => {
    const v: Vessel = { ...vessel, breakbulk_deck: { ...vessel.breakbulk_deck!, keep_out: [{ id: "k", label: "pedestal", xMin: 45, xMax: 55, zMin: -1, zMax: 1 }] } };
    expect(breakbulkInKeepOut(v, [a], [onDeck])).toHaveLength(1);
    expect(breakbulkInKeepOut(v, [b], [inHold])).toEqual([]);
  });
});

describe("rendering/stability height per area", () => {
  it("lists the weather deck first, then holds", () => {
    expect(stowageAreaIds(vessel)).toEqual(["weather_deck", "tt"]);
  });

  it("hold cargo rests on the hold surface (below the main-deck reference)", () => {
    expect(cargoBaseHeight(vessel, "tt")).toBe(-10);
    const mesh = buildBreakbulkMesh(cargo("b"), { cargo_id: "b", x_m: 50, z_m: 0, rotation_deg: 0, area_id: "tt" }, vessel);
    let minY = Infinity;
    for (let i = 1; i < mesh.positions.length; i += 3) minY = Math.min(minY, mesh.positions[i]);
    expect(minY).toBeCloseTo(-10, 6);
  });
});
