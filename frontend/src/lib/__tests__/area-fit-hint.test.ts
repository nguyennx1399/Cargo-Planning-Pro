/**
 * area-fit-hint — requirement 2's exact sentences. Two surfaces render these (every unplaced row and
 * the sidebar line for the item in hand) and neither can be reached from a node test, so the wording
 * both of them share is pinned here; a drift between them is now a test failure rather than something
 * a planner notices mid-drag.
 */
import { describe, expect, it } from "vitest";
import { fitsInText, handFitsInText } from "../area-fit-hint";

describe("fitsInText", () => {
  it("lists the areas in the engine's own order, verbatim", () => {
    expect(fitsInText(["weather deck", "Hold 2 tank top"])).toBe("fits in: weather deck, Hold 2 tank top");
  });

  it("says so when nothing fits — an answer, not an empty string", () => {
    expect(fitsInText([])).toBe("nothing fits");
  });

  it("names a single area without a trailing separator", () => {
    expect(fitsInText(["Hold 1 tank top"])).toBe("fits in: Hold 1 tank top");
  });
});

/** Phase 03: the hand's line must separate "belongs here" from "there is room here". */
describe("handFitsInText", () => {
  it("is the plain sentence when the scan found room", () => {
    expect(handFitsInText(["weather deck"], { found: true, blocker: null })).toBe("fits in: weather deck");
  });

  it("says no spot was FOUND — never that none exists — and names the blocker", () => {
    const text = handFitsInText(["weather deck", "Hold 2 tank top"], {
      found: false,
      blocker: "BB007 overlaps BB005",
    });
    expect(text).toContain("fits in: weather deck, Hold 2 tank top");
    expect(text).toContain("no free spot found");
    expect(text).toContain("BB007 overlaps BB005");
    expect(text).not.toContain("no room");
  });

  it("keeps the nothing-fits answer untouched: a scan cannot add to it", () => {
    expect(handFitsInText([], { found: false, blocker: "anything" })).toBe("nothing fits");
  });
});
