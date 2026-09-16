/**
 * Integration-level regression: the ACTUAL demo breakbulk cargo set (generateDemoBreakbulkCargo)
 * run through the ACTUAL naive packer against every real, selectable vessel must never produce a
 * placement that overlaps another or extends outside the vessel's usable deck area. Unit tests on
 * crafted fixtures (naive-fill-breakbulk.test.ts, breakbulk-validation-rules.test.ts) cover the
 * underlying bugs directly; this test exists because both real bugs it guards against (a row-reuse
 * height check gap, and a float round-trip false-positive) were FOUND by running the real data,
 * not by reasoning about crafted cases — the crafted tests alone would not have caught them.
 */
import { describe, expect, it } from "vitest";
import { naiveFillBreakbulk } from "../naive-fill-breakbulk";
import { breakbulkInKeepOut, breakbulkOutOfDeckArea, breakbulkOverlap, breakbulkOverPressure, breakbulkTooTall } from "../breakbulk-validation-rules";
import { generateDemoBreakbulkCargo } from "@/data/demo-breakbulk-generator";
import { buildDemoVessel } from "@/data/demo-container-vessel";
import { buildBbcSaoPauloVessel } from "@/data/bbc-sao-paulo-vessel";
import type { Vessel } from "@/types/domain";

const VESSELS: [string, Vessel][] = [
  ["MV Demo Horizon", buildDemoVessel()],
  ["BBC SAO PAULO", buildBbcSaoPauloVessel()],
];

describe("real demo breakbulk cargo against real vessels", () => {
  for (const [label, vessel] of VESSELS) {
    it(`${label}: no overlap and no out-of-deck-area violations`, () => {
      const cargo = generateDemoBreakbulkCargo();
      const { placements } = naiveFillBreakbulk(vessel, cargo, []);
      expect(placements.length).toBeGreaterThan(0); // sanity: something actually got placed
      expect(breakbulkOutOfDeckArea(vessel, cargo, placements)).toEqual([]);
      expect(breakbulkOverlap(cargo, placements)).toEqual([]);
      expect(breakbulkInKeepOut(vessel, cargo, placements)).toEqual([]);
      expect(breakbulkTooTall(vessel, cargo, placements)).toEqual([]);
      expect(breakbulkOverPressure(vessel, cargo, placements)).toEqual([]);
    });
  }
});
