/**
 * The D4 generic-area caveat (Phase D, requirement 1) — the half a planner cannot see from a
 * screenshot: that a drop on an approximated area is ALLOWED but RECORDED, that the record is a
 * warning (so the ghost goes amber, never red), and that it never turns the plan-wide report's `ok`
 * into false on a vessel that simply has no GA layout to load.
 *
 * The three surfaces this drives are asserted where they live: the amber tint via `verdictOf` (the
 * same fold the ghost, the chip and the sidebar readout use), the badge via
 * `lib/__tests__/area-label-text.test.ts`, and the list line via `breakbulkApproximateArea`.
 */
import { describe, expect, it } from "vitest";
import { canPlaceBreakbulk, type BreakbulkPose } from "../can-place-breakbulk";
import { freeRegionsFor, verdictOf } from "../placeholders";
import { breakbulkApproximateArea } from "@/engine/breakbulk-validation-rules";
import { validatePlan } from "@/engine/validate-plan";
import { buildStowageModel } from "@/engine/stowage-model";
import type { BreakbulkCargo, BreakbulkPlacement, StowagePlan, Vessel } from "@/types/domain";

/** 172 m vessel with NO declared deck layout — the model falls back to the 15 %/85 % LOA weather deck
 * with `source: "generic"`, i.e. exactly MV Demo Horizon's case. */
const genericVessel: Vessel = {
  id: "v", name: "V", imo: null, length_m: 172, beam_m: 27.4, bays: [], rows: [], stacks: [],
};

/** The same hull WITH a declared envelope: rating, clear height and a real rect. */
const declaredVessel: Vessel = {
  ...genericVessel,
  breakbulk_deck: {
    area: { xMin: 25.8, xMax: 146.2, zMin: -12.2, zMax: 12.2 },
    keep_out: [],
    cargo_base_height_m: 1,
    max_cargo_height_m: 12,
    deck_load_t_per_m2: 5,
  },
};

const item = (id: string): BreakbulkCargo => ({
  id, category: "yacht", length_m: 20, width_m: 6, height_m: 5, weight_t: 30, kg_above_base_m: 2.5, pol: "A", pod: "B",
});

const planWith = (cargo: BreakbulkCargo[], breakbulk_placements: BreakbulkPlacement[]): StowagePlan => ({
  id: "p", vessel_id: "v", voyage: "T", ports: [], containers: [], placements: [], unplaced: [],
  breakbulk_cargo: cargo, breakbulk_placements,
});

const pose: BreakbulkPose = { x_m: 60, z_m: 0 };
const APPROXIMATE = "weather deck: approximate area — no GA layout, so its extent is a fraction-of-LOA estimate";

describe("the generic-area warning", () => {
  it("is recorded on every drop into an approximated area, and does not refuse it (D4)", () => {
    const result = canPlaceBreakbulk(buildStowageModel(genericVessel), planWith([], []), item("A"), pose, genericVessel);
    expect(result.ok).toBe(true);
    expect(result.reasons).toContainEqual({
      rule: "breakbulk_approximate_area", message: APPROXIMATE, severity: "warning",
    });
  });

  it("tints the drop amber, never red — the colour the ghost, the chip and the readout share", () => {
    const result = canPlaceBreakbulk(buildStowageModel(genericVessel), planWith([], []), item("A"), pose, genericVessel);
    expect(verdictOf(result)).toBe("warning");
  });

  it("is absent on a declared area: a real GA layout has nothing to caveat", () => {
    const result = canPlaceBreakbulk(buildStowageModel(declaredVessel), planWith([], []), item("A"), pose, declaredVessel);
    expect(result).toEqual({ ok: true, reasons: [] });
  });

  it("does not change what the area admits: the badge is not a refusal of the AREA", () => {
    // `freeRegionsFor`'s `feasible` is projected by rule id (`AREA_FIT_RULES`), which is what keeps a
    // warning out of it — a generic area that fits an item must still say "fits in: weather deck".
    const regions = freeRegionsFor(genericVessel, planWith([], []), item("A"));
    expect(regions).toHaveLength(1);
    expect(regions[0]).toMatchObject({ feasible: true, reason: null });
    expect(regions[0].area.source).toBe("generic");
  });

  it("is pushed LAST, so a drop that also breaks a limit still quotes the limit", () => {
    // An accepted-with-warnings drop shows ONE line (`toVerdict` quotes `reasons[0]`). "This 20 m band
    // is over its demo limit" is actionable; "this area is a guess" is background — so the caveat must
    // never displace a concrete limit. 250 t alone in a 20 m band is the generic deck's own 200 t
    // demo limit, with no rating to hide behind.
    const result = canPlaceBreakbulk(
      buildStowageModel(genericVessel), planWith([], []), { ...item("A"), weight_t: 250 }, pose, genericVessel,
    );
    expect(result.reasons.map((r) => r.rule)).toEqual(["breakbulk_overweight", "breakbulk_approximate_area"]);
    expect(result.ok).toBe(true); // both are overridable limits (D1)
  });
});

describe("breakbulkApproximateArea", () => {
  const cargo = [item("A"), item("B")];
  const bothOnDeck: BreakbulkPlacement[] = [
    { cargo_id: "A", x_m: 40, z_m: 0, rotation_deg: 0 },
    { cargo_id: "B", x_m: 80, z_m: 0, rotation_deg: 0 },
  ];

  it("reports ONE line per approximated area, not one per item resting on it", () => {
    expect(breakbulkApproximateArea(genericVessel, cargo, bothOnDeck)).toEqual([
      {
        rule: "breakbulk_approximate_area",
        severity: "warning",
        message: APPROXIMATE,
        container_ids: ["A"],
        slots: [],
      },
    ]);
  });

  it("reports nothing on a declared area", () => {
    expect(breakbulkApproximateArea(declaredVessel, cargo, bothOnDeck)).toEqual([]);
  });

  it("is listed by the plan-wide report without making the plan not-ok or counting an error", () => {
    const report = validatePlan(genericVessel, planWith(cargo, bothOnDeck));
    expect(report.violations.filter((v) => v.rule === "breakbulk_approximate_area")).toHaveLength(1);
    expect(report.kpis.errors).toBe(0);
    expect(report.kpis.warnings).toBe(1);
    expect(report.ok).toBe(true); // D4: droppable
  });
});
