import { describe, expect, it } from "vitest";
import { naiveFillBreakbulk } from "../naive-fill-breakbulk";
import { rectsOverlap, footprintRect } from "../breakbulk-overlap-check";
import { deckArea } from "../breakbulk-deck-area";
import type { BreakbulkCargo, Vessel } from "@/types/domain";

// A synthetic vessel with controlled, easy-to-reason-about dimensions: length 200m (deckArea
// x-range [30, 170]), beam 30m (deckArea z-range [-13.5, 13.5], 27m usable width).
const vessel: Vessel = { id: "v", name: "V", imo: null, length_m: 200, beam_m: 30, bays: [], rows: [], stacks: [] };

function cargo(id: string, patch: Partial<BreakbulkCargo> = {}): BreakbulkCargo {
  return { id, category: "yacht", length_m: 20, width_m: 6, height_m: 5, weight_t: 30, kg_above_base_m: 2.5, pol: "A", pod: "B", ...patch };
}

describe("naiveFillBreakbulk", () => {
  it("places every item and none overlap when there's ample room", () => {
    const items = [cargo("a", { length_m: 20, width_m: 6 }), cargo("b", { length_m: 15, width_m: 5 }), cargo("c", { length_m: 10, width_m: 4 })];
    const { placements, unplaced } = naiveFillBreakbulk(vessel, items, []);
    expect(unplaced).toHaveLength(0);
    expect(placements).toHaveLength(3);
    const rects = placements.map((p) => footprintRect(items.find((i) => i.id === p.cargo_id)!, p));
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) expect(rectsOverlap(rects[i], rects[j])).toBe(false);
    }
  });

  it("every placement lands fully inside the deck area", () => {
    const items = [cargo("a", { length_m: 30, width_m: 8 }), cargo("b", { length_m: 25, width_m: 6 })];
    const { placements } = naiveFillBreakbulk(vessel, items, []);
    const area = deckArea(vessel);
    for (const p of placements) {
      const rect = footprintRect(items.find((i) => i.id === p.cargo_id)!, p);
      expect(rect.xMin).toBeGreaterThanOrEqual(area.xMin - 1e-9);
      expect(rect.xMax).toBeLessThanOrEqual(area.xMax + 1e-9);
      expect(rect.zMin).toBeGreaterThanOrEqual(area.zMin - 1e-9);
      expect(rect.zMax).toBeLessThanOrEqual(area.zMax + 1e-9);
    }
  });

  it("skips past a forbidden zone within the same row instead of giving up the row", () => {
    // deckArea x range is [30,170]. A forbidden zone in the middle should push a small item to
    // land after it, still within the SAME row (same z), rather than wasting a whole new row.
    const items = [cargo("a", { length_m: 10, width_m: 4 })];
    const forbidden = [{ xMin: 30, xMax: 100 }];
    const { placements, unplaced } = naiveFillBreakbulk(vessel, items, forbidden);
    expect(unplaced).toHaveLength(0);
    expect(placements[0].x_m - items[0].length_m / 2).toBeGreaterThanOrEqual(100);
  });

  it("an item too large for the deck in either dimension is unplaced, not force-fit", () => {
    const items = [cargo("huge", { length_m: 500, width_m: 4 })]; // longer than the whole vessel
    const { placements, unplaced } = naiveFillBreakbulk(vessel, items, []);
    expect(placements).toHaveLength(0);
    expect(unplaced).toEqual(["huge"]);
  });

  it("larger items are placed first regardless of input order (sorted by area descending)", () => {
    const small = cargo("small", { length_m: 5, width_m: 3 });
    const big = cargo("big", { length_m: 40, width_m: 10 });
    const { placements } = naiveFillBreakbulk(vessel, [small, big], []);
    const bigPlacement = placements.find((p) => p.cargo_id === "big")!;
    const area = deckArea(vessel);
    expect(bigPlacement.x_m - big.length_m / 2).toBeCloseTo(area.xMin, 6); // big claimed the first spot
  });

  it("never places an item past the deck's z-bound when reusing a row a previous item left behind", () => {
    // Regression: naiveFillBreakbulk only checked whether an item's width fit the current row
    // when EXPLICITLY starting a new row (the x===null branch) — an item that failed to start a
    // fresh row (too tall) left `rowZ` sitting past that unchecked point, and the NEXT item could
    // then get placed there via the "first try succeeds" path with no bound check at all. Found
    // with the real demo breakbulk cargo set: a yacht landed ~4.6m outside the deck's beam.
    const area = deckArea(vessel);
    const fullLength = area.xMax - area.xMin - 1;
    const items = [
      // Two full-row items force two separate rows (each nearly spans the deck's x-length).
      cargo("row1", { length_m: fullLength, width_m: 5 }),
      cargo("row2", { length_m: fullLength, width_m: 20 }),
      // Small enough to slot in after row2 in x, but wide enough to overflow z if placed there
      // without a height check.
      cargo("overflow_candidate", { length_m: 1, width_m: 25 }),
    ];
    const { placements } = naiveFillBreakbulk(vessel, items, []);
    for (const p of placements) {
      const item = items.find((i) => i.id === p.cargo_id)!;
      const rect = footprintRect(item, p);
      expect(rect.zMin).toBeGreaterThanOrEqual(area.zMin - 1e-9);
      expect(rect.zMax).toBeLessThanOrEqual(area.zMax + 1e-9);
    }
  });

  it("wraps to a new row when a row runs out of width, and rows don't overlap", () => {
    // Each item is nearly the full usable x-length, so only one fits per row; with 27m usable
    // beam and 8m-wide items, expect multiple rows.
    const area = deckArea(vessel);
    const fullLength = area.xMax - area.xMin - 1;
    const items = [
      cargo("r1", { length_m: fullLength, width_m: 8 }),
      cargo("r2", { length_m: fullLength, width_m: 8 }),
      cargo("r3", { length_m: fullLength, width_m: 8 }),
    ];
    const { placements, unplaced } = naiveFillBreakbulk(vessel, items, []);
    expect(unplaced).toHaveLength(0);
    const zValues = placements.map((p) => p.z_m).sort((a, b) => a - b);
    expect(new Set(zValues).size).toBe(3); // 3 distinct rows
  });
});
