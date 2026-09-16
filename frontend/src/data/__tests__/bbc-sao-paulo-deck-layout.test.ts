/**
 * BBC SAO PAULO deck layout, checked against the BBC-13K-500A GA sheet (BBC Chartering fleet sheet
 * p.20–21) that its stowage spec is now built from — labelled figures (A) exactly, measured
 * positions (B) as recorded in the spec.
 */
import { describe, expect, it } from "vitest";
import { buildBbcSaoPauloVessel } from "../bbc-sao-paulo-vessel";
import { buildBbcSaoPauloGeometry } from "../bbc-sao-paulo-geometry";
import { getVesselSpec } from "../vessel-specs";
import { generateDemoBreakbulkCargo } from "../demo-breakbulk-generator";
import { naiveFillBreakbulk } from "@/engine/naive-fill-breakbulk";
import { cargoBaseHeight, deckArea, deckKeepOuts, maxCargoHeight } from "@/engine/breakbulk-deck-area";
import { breakbulkInKeepOut, breakbulkOverweight } from "@/engine/breakbulk-validation-rules";
import { validatePlan } from "@/engine/validate-plan";
import { buildEmptyDemoPlan, withBreakbulkCargo } from "../build-demo-plan";
import { footprintRect } from "@/engine/breakbulk-overlap-check";
import { buildBreakbulkMesh } from "@/engine/cargo/breakbulk-mesh-builder";
import { breakbulkWeightItem } from "@/lib/breakbulk-weight-item";
import type { BreakbulkCargo } from "@/types/domain";

const vessel = buildBbcSaoPauloVessel();
const geometry = buildBbcSaoPauloGeometry();
const spec = getVesselSpec("bbc-sao-paulo")!.spec;
const space = (id: string) => spec.cargo_spaces.find((s) => s.id === id)!;
const obstruction = (id: string) => spec.obstructions.find((o) => o.id === id)!;
const keepOut = (id: string) => deckKeepOuts(vessel).find((k) => k.id === id)!;
// BreakbulkPlacement.x_m -> AP-referenced ship-frame x (inverse of the spec adapter's conversion).
const toShipX = (xM: number) => xM - vessel.length_m / 2 + geometry.particulars.lbp_m / 2;
const len = (id: string) => space(id).x_fwd_m! - space(id).x_aft_m!;

function item(patch: Partial<BreakbulkCargo> = {}): BreakbulkCargo {
  return { id: "t1", category: "yacht", length_m: 10, width_m: 4, height_m: 5, weight_t: 30, kg_above_base_m: 2.5, pol: "A", pod: "B", ...patch };
}

describe("BBC SAO PAULO stowage spec vs the GA sheet", () => {
  it("hatch-cover sections carry the labelled lengths aft→fwd: 30.1 / 15.8 / 26.1 / 15.8 / 30.2 and 6.9 m", () => {
    expect(len("hatch_aft_notch") + len("hatch_aft")).toBeCloseTo(30.1, 6);
    expect(len("hatch_mid_aft")).toBeCloseTo(15.8, 6);
    expect(len("hatch_center")).toBeCloseTo(26.1, 6);
    expect(len("hatch_mid_forward")).toBeCloseTo(15.8, 6);
    expect(len("hatch_forward")).toBeCloseTo(30.2, 6);
    expect(len("hatch_small_forward")).toBeCloseTo(6.9, 6);
  });

  it("tank-top load zones of Hold 2 add up to the labelled 84.8 m with 20/25 t/m² ratings", () => {
    const zones = spec.cargo_spaces.filter((s) => s.id.startsWith("tank_top_hold2"));
    expect(zones.reduce((sum, z) => sum + z.x_fwd_m! - z.x_aft_m!, 0)).toBeCloseTo(84.8, 6);
    expect(new Set(zones.map((z) => z.max_load_t_per_m2))).toEqual(new Set([20, 25]));
  });

  it("tweendeck pontoon levels all reach the same hatch-cover underside (level + clear height = 14.6 m)", () => {
    const tt = space("tank_top_hold2_z2").surface_above_baseline_m!;
    for (const lv of space("tweendeck_hold2").adjustable_levels!) {
      expect(lv.surface_above_baseline_m - tt + lv.clear_height_m).toBeCloseTo(14.6, 6);
    }
  });

  it("the 36.1 m label is the clear distance between crane foundations, not slewing-centre spacing", () => {
    const gap = obstruction("crane_02_foundation").x_aft_m - obstruction("crane_01_foundation").x_fwd_m;
    expect(gap).toBeCloseTo(36.05, 1);
    expect(spec.cranes[1].x_m! - spec.cranes[0].x_m!).toBeGreaterThan(40);
  });
});

describe("BBC SAO PAULO breakbulk deck layout", () => {
  it("usable area runs over the main hatch covers, entirely aft of the accommodation", () => {
    const area = deckArea(vessel);
    expect(toShipX(area.xMin)).toBeCloseTo(space("hatch_aft").x_aft_m!, 6);
    expect(toShipX(area.xMax)).toBeCloseTo(space("hatch_forward").x_fwd_m!, 6);
    expect(toShipX(area.xMax)).toBeLessThan(obstruction("accommodation").x_aft_m);
    expect(area.zMax - area.zMin).toBeCloseTo(19.7, 6);
  });

  it("both crane pedestals sit on the port side and intrude into the hatch envelope", () => {
    for (const id of ["crane_01_pedestal", "crane_02_pedestal"]) {
      const k = keepOut(id);
      expect(k.zMax).toBeLessThan(0);
      expect(k.zMax).toBeGreaterThan(deckArea(vessel).zMin);
    }
  });

  it("the packer never lets real demo cargo touch a crane pedestal", () => {
    const cargo = generateDemoBreakbulkCargo();
    const { placements } = naiveFillBreakbulk(vessel, cargo, [], { useHolds: false });
    expect(placements.length).toBeGreaterThanOrEqual(7); // incl. three 62 m blades inboard of the pedestals
    expect(breakbulkInKeepOut(vessel, cargo, placements)).toEqual([]);
  });

  it("an item forced onto crane 1's pedestal is flagged", () => {
    const k = keepOut("crane_01_pedestal");
    const cargo = [item()];
    const placement = { cargo_id: "t1", x_m: (k.xMin + k.xMax) / 2, z_m: deckArea(vessel).zMin + 2, rotation_deg: 0 };
    expect(breakbulkInKeepOut(vessel, cargo, [placement]).map((v) => v.rule)).toEqual(["breakbulk_in_keep_out"]);
  });

  it("the packer skips a small item past the pedestal instead of placing it on top", () => {
    const k = keepOut("crane_01_pedestal");
    const area = deckArea(vessel);
    const filler = item({ id: "filler", length_m: k.xMin - area.xMin, width_m: 3 });
    const small = item({ id: "small", length_m: 2, width_m: 2, weight_t: 5 }); // 1.25 t/m², under the 4 t/m² rating
    const { placements } = naiveFillBreakbulk(vessel, [filler, small], []);
    const rect = footprintRect(small, placements.find((p) => p.cargo_id === "small")!);
    expect(rect.xMin).toBeGreaterThanOrEqual(k.xMax - 1e-9);
  });

  it("the GA shows no overhead limit on the hatch covers, so none is imposed", () => {
    expect(maxCargoHeight(vessel)).toBe(Infinity);
  });

  it("cargo rests on the hatch-cover top (≈18.0 m abl = 4.8 m above the 13.2 m main deck) in render and stability", () => {
    expect(cargoBaseHeight(vessel)).toBeCloseTo(18.0 - 13.2, 9);
    const it1 = item({ height_m: 4 });
    const p = { cargo_id: "t1", x_m: 40, z_m: 0, rotation_deg: 0 };
    const mesh = buildBreakbulkMesh(it1, p, vessel);
    let minY = Infinity;
    for (let i = 1; i < mesh.positions.length; i += 3) minY = Math.min(minY, mesh.positions[i]);
    expect(minY).toBeCloseTo(4.8, 4);
    expect(breakbulkWeightItem(vessel, geometry, it1, p).kg_m).toBeCloseTo(18.0 + it1.kg_above_base_m, 6);
  });

  it("band overweight uses the 4 t/m² hatch-cover rating", () => {
    const cargo = generateDemoBreakbulkCargo();
    const { placements } = naiveFillBreakbulk(vessel, cargo, []);
    expect(breakbulkOverweight(vessel, cargo, placements)).toEqual([]);
    const heavy = [item({ id: "h", length_m: 10, width_m: 10, weight_t: 1600 })]; // > 4 × 20 × 19.7 = 1576 t
    const msgs = breakbulkOverweight(vessel, heavy, [{ cargo_id: "h", x_m: 30, z_m: 0, rotation_deg: 0 }]).map((v) => v.message);
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toContain("1576t hatch-cover limit");
  });
});

describe("BBC SAO PAULO under-deck stowage", () => {
  const hold = (id: string) => vessel.breakbulk_holds!.find((h) => h.id === id)!;

  it("has the GA's hold areas: Hold 2 tank top, Hold 2 aft section at main-deck level, Hold 1 tank top", () => {
    expect(vessel.breakbulk_holds!.map((h) => h.id)).toEqual(["tank_top_hold2", "main_deck_aft_hold2", "tank_top_hold1"]);
    expect(hold("tank_top_hold2").deck_load_t_per_m2).toBe(20); // lowest zone rating across the run
    expect(hold("tank_top_hold2").max_cargo_height_m).toBeCloseTo(14.6, 6); // pontoons ashore
    expect(hold("main_deck_aft_hold2").cargo_base_height_m).toBeCloseTo(0, 6); // floor = main deck (13.2 m)
    expect(hold("main_deck_aft_hold2").deck_load_t_per_m2).toBe(2.5);
  });

  it("tank-top cargo sits ≈10.7 m below the main deck, and its KG is tank top + own CG", () => {
    expect(cargoBaseHeight(vessel, "tank_top_hold2")).toBeCloseTo(2.5 - 13.2, 6);
    const it1 = item({ height_m: 4 });
    const p = { cargo_id: "t1", x_m: 60, z_m: 0, rotation_deg: 0, area_id: "tank_top_hold2" };
    expect(breakbulkWeightItem(vessel, geometry, it1, p).kg_m).toBeCloseTo(2.5 + it1.kg_above_base_m, 6);
  });

  it("the demo project cargo uses deck and holds with no rule violations", () => {
    const plan = withBreakbulkCargo(vessel, buildEmptyDemoPlan(vessel, []));
    const inHolds = plan.breakbulk_placements.filter((p) => p.area_id).length;
    expect(inHolds).toBeGreaterThan(0);
    expect(plan.breakbulk_placements.length).toBeGreaterThanOrEqual(12);
    expect(validatePlan(vessel, plan).violations).toEqual([]);
  });
});
