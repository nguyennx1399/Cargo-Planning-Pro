/**
 * A click on a bay-sheet cell (all-bay overview, phase 02): the odd section decides a 20' target, the pair
 * decides a 40' one, and a 40' is valid in both sections at once.
 */
import { describe, expect, it } from "vitest";
import { cellTargetSlot, isValidCell, sideBay } from "../bay-cell-target";

describe("cellTargetSlot", () => {
  it("names the odd bay for a 20' in hand: fore = b − 1, aft = b + 1", () => {
    expect(sideBay(22, "fore")).toBe(21);
    expect(cellTargetSlot(22, "fore", 4, 82, "20")).toEqual({ bay: 21, row: 4, tier: 82 });
    expect(cellTargetSlot(22, "aft", 4, 82, "20")).toEqual({ bay: 23, row: 4, tier: 82 });
  });

  it("names the 40' bay for a 40' or 45' in hand, whichever section was clicked", () => {
    expect(cellTargetSlot(22, "fore", 4, 82, "40")).toEqual({ bay: 22, row: 4, tier: 82 });
    expect(cellTargetSlot(22, "aft", 4, 82, "40")).toEqual({ bay: 22, row: 4, tier: 82 });
    expect(cellTargetSlot(22, "aft", 4, 82, "45")).toEqual({ bay: 22, row: 4, tier: 82 });
  });
});

describe("isValidCell", () => {
  const valid = new Set(["21|4|82", "22|6|84"]);

  it("a 20' is valid only in the section whose odd slot is valid", () => {
    expect(isValidCell(valid, 22, "fore", 4, 82, "20")).toBe(true);
    expect(isValidCell(valid, 22, "aft", 4, 82, "20")).toBe(false);
  });

  it("a 40' is valid in BOTH sections when its 40' slot is", () => {
    expect(isValidCell(valid, 22, "fore", 6, 84, "40")).toBe(true);
    expect(isValidCell(valid, 22, "aft", 6, 84, "40")).toBe(true);
    expect(isValidCell(valid, 22, "fore", 4, 82, "40")).toBe(false);
  });
});
