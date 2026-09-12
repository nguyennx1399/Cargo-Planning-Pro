// Locks the current scene layout before geometry.ts is routed through ship-frame helpers
// (vessel-3d-model-pipeline phase 01, step 5). Any numeric drift here is a real regression.
import { describe, expect, it } from "vitest";
import { buildDemoVessel } from "@/data/demo-container-vessel";
import { slotToPosition } from "../geometry";

describe("slot position characterization (locks the current scene layout)", () => {
  it("matches the recorded layout for every stack's first and last tier", () => {
    const vessel = buildDemoVessel();
    const samples = vessel.stacks.flatMap((s) =>
      [s.tiers[0], s.tiers[s.tiers.length - 1]].map((tier) => ({
        code: `${s.bay}-${s.row}-${tier}`,
        pos: slotToPosition(vessel, { bay: s.bay, row: s.row, tier }),
      }))
    );
    expect(samples).toMatchSnapshot();
  });
});
