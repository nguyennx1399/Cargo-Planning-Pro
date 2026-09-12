import { describe, expect, it } from "vitest";
import { bayLcgFromClicks, checkBayLcgAgainstVessel } from "../bay-lcg-from-trace";

describe("bayLcgFromClicks", () => {
  it("builds a bay -> x_m map", () => {
    const result = bayLcgFromClicks([
      { bay: 2, xShipFrameM: 137 },
      { bay: 6, xShipFrameM: 105 },
    ]);
    expect(result).toEqual({ 2: 137, 6: 105 });
  });

  it("later clicks for the same bay overwrite earlier ones", () => {
    const result = bayLcgFromClicks([
      { bay: 2, xShipFrameM: 100 },
      { bay: 2, xShipFrameM: 137 },
    ]);
    expect(result[2]).toBe(137);
  });
});

describe("checkBayLcgAgainstVessel", () => {
  const vesselBays = [2, 6, 10];

  it("has no warnings for a clean, distinct, ordered set", () => {
    expect(checkBayLcgAgainstVessel({ 2: 130, 6: 100, 10: 70 }, vesselBays)).toEqual([]);
  });

  it("flags a bay not on the vessel", () => {
    const warnings = checkBayLcgAgainstVessel({ 2: 130, 99: 50 }, vesselBays);
    expect(warnings.some((w) => w.includes("bay 99"))).toBe(true);
  });

  it("flags a likely duplicate click (same LCG on adjacent declared bays)", () => {
    const warnings = checkBayLcgAgainstVessel({ 2: 130, 6: 130 }, vesselBays);
    expect(warnings.some((w) => w.includes("duplicate"))).toBe(true);
  });
});
