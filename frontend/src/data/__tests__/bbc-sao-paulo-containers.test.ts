/**
 * BBC SAO PAULO container grid, checked against what the BBC-13K-500A GA side view shows: rows per
 * tier per bay (the digits in the grey stacks), tier counts, and bay positions.
 */
import { describe, expect, it } from "vitest";
import { buildBbcSaoPauloVessel, buildBbcSaoPauloVesselAndCargo } from "../bbc-sao-paulo-vessel";
import { getVesselSpec } from "../vessel-specs";
import { buildLoadedDemoPlan, withBreakbulkCargo } from "../build-demo-plan";
import { tierCenterY, bayCenterX, LAYOUT } from "@/lib/geometry";
import { validatePlan } from "@/engine/validate-plan";
import { breakbulkOverlapsContainer } from "@/engine/breakbulk-validation-rules";

const vessel = buildBbcSaoPauloVessel();
const spec = getVesselSpec("bbc-sao-paulo")!.spec;
const stacksOf = (bay: number, deck: "on" | "under") => vessel.stacks.filter((s) => s.bay === bay && s.deck === deck);

describe("BBC SAO PAULO container grid (GA side view)", () => {
  it("40' slots + the 20'-only stacks listed in the spec come to the GA's total within 2% of the nominal 970 TEU", () => {
    const teu40 = vessel.stacks.reduce((sum, s) => sum + s.tiers.length * 2, 0);
    const teu20only = spec.containers!.stowage!.twenty_foot_only!.reduce((sum, t) => sum + t.rows * t.tiers, 0);
    expect(teu40).toBe(894);
    expect(Math.abs(teu40 + teu20only - 970) / 970).toBeLessThan(0.02);
  });

  it("4 tiers on deck everywhere; crane bays 26/14/10 lose the port-outboard row (6 rows)", () => {
    for (const bay of vessel.bays) for (const s of stacksOf(bay, "on")) expect(s.tiers).toEqual([82, 84, 86, 88]);
    for (const bay of [26, 14, 10]) {
      expect(stacksOf(bay, "on")).toHaveLength(6);
      expect(stacksOf(bay, "on").some((s) => s.row === 6)).toBe(false);
    }
    expect(stacksOf(22, "on")).toHaveLength(7);
  });

  it("under deck: 5 tiers × 7 rows in Hold 2, 5 rows in bay 06, 1 tier in the aft main-deck section, none under bays 02/30", () => {
    expect(stacksOf(18, "under")).toHaveLength(7);
    expect(stacksOf(18, "under")[0].tiers).toEqual([2, 4, 6, 8, 10]);
    expect(stacksOf(6, "under")).toHaveLength(5);
    expect(stacksOf(34, "under")[0].tiers).toEqual([2]);
    expect(stacksOf(2, "under")).toHaveLength(0);
    expect(stacksOf(30, "under")).toHaveLength(0);
  });

  it("stack weights come from the sheet: 100 t on deck, 60 t on the tank top and tweendeck level (40')", () => {
    expect(stacksOf(22, "on")[0].max_weight_t).toBe(100);
    expect(stacksOf(22, "under")[0].max_weight_t).toBe(60);
    expect(stacksOf(34, "under")[0].max_weight_t).toBe(60);
  });

  it("tiers rest on the real surfaces: hatch covers 4.8 m, tank top −10.7 m, aft section 0 m (scene y, main deck = 0)", () => {
    expect(tierCenterY(82, vessel, 22)).toBeCloseTo(18.0 - 13.2 + LAYOUT.tierPitch / 2, 6);
    expect(tierCenterY(2, vessel, 22)).toBeCloseTo(2.5 - 13.2 + LAYOUT.tierPitch / 2, 6);
    expect(tierCenterY(2, vessel, 34)).toBeCloseTo(13.2 - 13.2 + LAYOUT.tierPitch / 2, 6);
    // 5 tiers fit under the hatch covers (14.6 m clear above the tank top)
    expect(tierCenterY(10, vessel, 22) + LAYOUT.tierPitch / 2).toBeLessThanOrEqual(17.1 - 13.2 + 1e-9);
  });

  it("bays sit at their measured positions, bay 34 aftmost and bay 02 forward, ~13 m apart", () => {
    const x = (b: number) => bayCenterX(vessel, b);
    expect(x(34)).toBeLessThan(x(30));
    expect(x(2)).toBeGreaterThan(x(6));
    expect(x(22) - x(26)).toBeCloseTo(13.0, 0);
  });

  it("a part container load plus project cargo share the ship without breakbulk sitting on container bays", () => {
    const { containers } = buildBbcSaoPauloVesselAndCargo();
    const plan = withBreakbulkCargo(vessel, buildLoadedDemoPlan(vessel, containers));
    expect(plan.placements.length).toBeGreaterThan(50);
    expect(plan.breakbulk_placements.length).toBeGreaterThan(0);
    expect(breakbulkOverlapsContainer(vessel, plan.breakbulk_cargo, plan.breakbulk_placements, plan.placements)).toEqual([]);
    const report = validatePlan(vessel, plan);
    expect(report.violations.filter((v) => v.rule.startsWith("breakbulk") || v.rule === "stack_weight")).toEqual([]);
  });
});
