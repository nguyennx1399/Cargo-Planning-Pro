import { describe, expect, it } from "vitest";
import { visiblePlacements } from "../playback-slice";

describe("visiblePlacements", () => {
  const items = [1, 2, 3, 4, 5];

  it("returns the full array when playbackCount is null", () => {
    expect(visiblePlacements(items, null)).toEqual(items);
  });

  it("returns the first N items for a number", () => {
    expect(visiblePlacements(items, 3)).toEqual([1, 2, 3]);
  });

  it("floors a fractional count", () => {
    expect(visiblePlacements(items, 2.9)).toEqual([1, 2]);
  });

  it("clamps to the full array when count exceeds length, without erroring", () => {
    expect(visiblePlacements(items, 100)).toEqual(items);
  });

  it("returns an empty array for count 0", () => {
    expect(visiblePlacements(items, 0)).toEqual([]);
  });

  it("handles an empty input array", () => {
    expect(visiblePlacements([], null)).toEqual([]);
    expect(visiblePlacements([], 5)).toEqual([]);
  });
});
