import { describe, expect, it } from "vitest";
import { bayPosition, deckOf, parseSlotCode, slotCode, twentyBaysOf } from "../slot-helpers";

describe("slot helpers", () => {
  const fortyBays = [2, 6, 10];

  it("maps 20' bays to fore/aft halves of their 40' bay", () => {
    expect(bayPosition(1, fortyBays)).toEqual({ fortyBay: 2, halves: ["fore"] });
    expect(bayPosition(3, fortyBays)).toEqual({ fortyBay: 2, halves: ["aft"] });
    expect(bayPosition(5, fortyBays)).toEqual({ fortyBay: 6, halves: ["fore"] });
    expect(bayPosition(6, fortyBays)).toEqual({ fortyBay: 6, halves: ["fore", "aft"] });
  });

  it("returns null for bays not on the vessel", () => {
    expect(bayPosition(14, fortyBays)).toBeNull();
    expect(bayPosition(13, fortyBays)).toBeNull();
  });

  it("splits a 40' bay and rejects odd input", () => {
    expect(twentyBaysOf(14)).toEqual([13, 15]);
    expect(() => twentyBaysOf(13)).toThrow();
  });

  it("round-trips slot codes and rejects bad ones", () => {
    expect(parseSlotCode("140682")).toEqual({ bay: 14, row: 6, tier: 82 });
    expect(slotCode({ bay: 1, row: 2, tier: 4 })).toBe("010204");
    expect(() => parseSlotCode("1406")).toThrow();
    expect(() => parseSlotCode("14a682")).toThrow();
  });

  it("derives deck level from tier", () => {
    expect(deckOf(82)).toBe("on");
    expect(deckOf(8)).toBe("under");
  });
});
