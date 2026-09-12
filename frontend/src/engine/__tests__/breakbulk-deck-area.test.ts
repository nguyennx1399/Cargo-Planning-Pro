import { describe, expect, it } from "vitest";
import { deckArea } from "../breakbulk-deck-area";
import type { Vessel } from "@/types/domain";

const vessel: Vessel = {
  id: "v", name: "V", imo: null, length_m: 200, beam_m: 30, bays: [], rows: [], stacks: [],
};

describe("deckArea", () => {
  it("trims a fraction of length off each end (stern near AP=0, bow near length_m)", () => {
    const area = deckArea(vessel);
    expect(area.xMin).toBeCloseTo(30, 6); // 15% of 200
    expect(area.xMax).toBeCloseTo(170, 6); // 200 - 15% of 200
  });

  it("trims a fixed margin off each side of the beam, symmetric about z=0", () => {
    const area = deckArea(vessel);
    expect(area.zMin).toBeCloseTo(-13.5, 6); // -30/2 + 1.5
    expect(area.zMax).toBeCloseTo(13.5, 6);
    expect(area.zMin).toBeCloseTo(-area.zMax, 6);
  });

  it("xMin is always less than xMax and zMin less than zMax for a normal vessel", () => {
    const area = deckArea(vessel);
    expect(area.xMin).toBeLessThan(area.xMax);
    expect(area.zMin).toBeLessThan(area.zMax);
  });
});
