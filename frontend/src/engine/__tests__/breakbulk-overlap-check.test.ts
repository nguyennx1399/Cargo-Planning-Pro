import { describe, expect, it } from "vitest";
import { footprintRect, rectsOverlap } from "../breakbulk-overlap-check";
import type { BreakbulkCargo } from "@/types/domain";

function item(patch: Partial<BreakbulkCargo> = {}): BreakbulkCargo {
  return { id: "b1", category: "yacht", length_m: 20, width_m: 6, height_m: 5, weight_t: 30, kg_above_base_m: 2.5, pol: "A", pod: "B", ...patch };
}

describe("footprintRect", () => {
  it("centers the rectangle on (x_m, z_m) using length_m along x, width_m along z at rotation 0", () => {
    const rect = footprintRect(item({ length_m: 20, width_m: 6 }), { cargo_id: "b1", x_m: 100, z_m: 0, rotation_deg: 0 });
    expect(rect).toEqual({ xMin: 90, xMax: 110, zMin: -3, zMax: 3 });
  });

  it("swaps length_m/width_m when rotation_deg is 90", () => {
    const rect = footprintRect(item({ length_m: 20, width_m: 6 }), { cargo_id: "b1", x_m: 100, z_m: 0, rotation_deg: 90 });
    expect(rect).toEqual({ xMin: 97, xMax: 103, zMin: -10, zMax: 10 });
  });
});

describe("rectsOverlap", () => {
  const base = { xMin: 0, xMax: 10, zMin: 0, zMax: 10 };

  it("detects a clear overlap", () => {
    expect(rectsOverlap(base, { xMin: 5, xMax: 15, zMin: 5, zMax: 15 })).toBe(true);
  });

  it("does not count merely touching edges as overlapping", () => {
    expect(rectsOverlap(base, { xMin: 10, xMax: 20, zMin: 0, zMax: 10 })).toBe(false);
    expect(rectsOverlap(base, { xMin: 0, xMax: 10, zMin: 10, zMax: 20 })).toBe(false);
  });

  it("returns false when separated on the x axis even if z ranges overlap", () => {
    expect(rectsOverlap(base, { xMin: 20, xMax: 30, zMin: 0, zMax: 10 })).toBe(false);
  });

  it("returns false when separated on the z axis even if x ranges overlap", () => {
    expect(rectsOverlap(base, { xMin: 0, xMax: 10, zMin: 20, zMax: 30 })).toBe(false);
  });

  it("one rectangle fully inside another counts as overlapping", () => {
    expect(rectsOverlap(base, { xMin: 2, xMax: 8, zMin: 2, zMax: 8 })).toBe(true);
  });
});
