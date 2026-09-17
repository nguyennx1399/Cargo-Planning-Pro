/**
 * canPlaceBreakbulk — the 7 breakbulk rules lifted to one candidate item. The last test is the
 * contract: every message the predicate predicts must be one the plan-wide rules actually produce,
 * which keeps the drop preview and the report from disagreeing (spec §4.5).
 */
import { describe, expect, it } from "vitest";
import { canPlaceBreakbulk, type BreakbulkPose } from "../can-place-breakbulk";
import {
  breakbulkInKeepOut,
  breakbulkOutOfDeckArea,
  breakbulkOverlap,
  breakbulkOverlapsContainer,
  breakbulkOverPressure,
  breakbulkOverweight,
  breakbulkTooTall,
} from "@/engine/breakbulk-validation-rules";
import { buildStowageModel } from "@/engine/stowage-model";
import type {
  BreakbulkCargo,
  BreakbulkDeckLayout,
  BreakbulkPlacement,
  Container,
  Placement,
  StowagePlan,
  Vessel,
} from "@/types/domain";

const item = (id: string, patch: Partial<BreakbulkCargo> = {}): BreakbulkCargo => ({
  id, category: "yacht", length_m: 20, width_m: 6, height_m: 5, weight_t: 30, kg_above_base_m: 2.5, pol: "A", pod: "B", ...patch,
});

/** 200 m vessel with a declared hatch envelope, one crane pedestal, 6 m clear height and 2 t/m². */
const deckVessel = (deck: Partial<BreakbulkDeckLayout> = {}): Vessel => ({
  id: "bb", name: "BB", imo: null, length_m: 200, beam_m: 30, bays: [], rows: [], stacks: [],
  breakbulk_deck: {
    area: { xMin: 20, xMax: 180, zMin: -10, zMax: 10 },
    keep_out: [{ id: "k1", label: "crane pedestal", xMin: 100, xMax: 110, zMin: -5, zMax: 5 }],
    cargo_base_height_m: 1,
    max_cargo_height_m: 6,
    deck_load_t_per_m2: 2,
    ...deck,
  },
});

const planWith = (
  cargo: BreakbulkCargo[],
  breakbulk_placements: BreakbulkPlacement[],
  placements: Placement[] = [],
  containers: Container[] = [],
): StowagePlan => ({
  id: "p", vessel_id: "bb", voyage: "T", ports: [], containers, placements, unplaced: [],
  breakbulk_cargo: cargo, breakbulk_placements,
});

const check = (vessel: Vessel, plan: StowagePlan, subject: BreakbulkCargo, pose: BreakbulkPose) =>
  canPlaceBreakbulk(buildStowageModel(vessel), plan, subject, pose, vessel);

describe("canPlaceBreakbulk", () => {
  it("accepts an item fully inside the envelope, clear of every limit", () => {
    const vessel = deckVessel();
    const result = check(vessel, planWith([], []), item("A"), { x_m: 60, z_m: 0 });
    expect(result).toEqual({ ok: true, reasons: [] });
  });

  it("rejects an unknown stowage area, naming it", () => {
    const result = check(deckVessel(), planWith([], []), item("A"), { areaId: "hold_99", x_m: 60, z_m: 0 });
    expect(result.ok).toBe(false);
    expect(result.reasons[0]).toEqual({
      rule: "breakbulk_out_of_deck_area", message: 'A: unknown stowage area "hold_99"', severity: "error",
    });
  });

  it("rejects a footprint outside the area rect", () => {
    const result = check(deckVessel(), planWith([], []), item("A"), { x_m: 5, z_m: 0 });
    expect(result.reasons[0].message).toBe("A: footprint extends outside the usable deck area");
  });

  it("does not false-positive on an edge-of-area placement (float round-trip, EDGE_TOLERANCE_M)", () => {
    // 172 m generic deck: xMin = 25.8; the packer centres a 62 m item as xMin + length/2.
    const vessel: Vessel = { id: "v2", name: "V2", imo: null, length_m: 172, beam_m: 27.4, bays: [], rows: [], stacks: [] };
    const blade = item("A", { length_m: 62, width_m: 4.5 });
    const result = check(vessel, planWith([], []), blade, { x_m: 25.8 + 31, z_m: 0 });
    // Nothing BLOCKS (that is the float round-trip this test exists for). This hull declares no deck
    // layout, so the D4 approximation is recorded alongside — see approximate-area-warning.test.ts.
    expect(result.ok).toBe(true);
    expect(result.reasons.map((r) => r.rule)).toEqual(["breakbulk_approximate_area"]);
  });

  it("rejects a footprint over a declared keep-out structure", () => {
    const result = check(deckVessel(), planWith([], []), item("A"), { x_m: 105, z_m: 0 });
    expect(result.reasons[0]).toEqual({
      rule: "breakbulk_in_keep_out", message: "A: footprint overlaps crane pedestal", severity: "error",
    });
  });

  it("rejects an item taller than the area's clear height", () => {
    const result = check(deckVessel(), planWith([], []), item("A", { height_m: 8 }), { x_m: 60, z_m: 0 });
    expect(result.reasons[0].message).toBe("A: 8m tall exceeds the 6m clear height in weather deck");
  });

  it("rejects an item whose own footprint pressure exceeds the rated load", () => {
    const result = check(deckVessel(), planWith([], []), item("A", { weight_t: 300 }), { x_m: 60, z_m: 0 });
    expect(result.reasons[0].message).toBe("A: 2.50 t/m² exceeds the 2 t/m² rating of weather deck");
  });

  it("names the same overlap message from both sides of a pair (plan order decides)", () => {
    const cargo = [item("A"), item("B")];
    const placed: BreakbulkPlacement[] = [
      { cargo_id: "A", x_m: 60, z_m: 0, rotation_deg: 0 },
      { cargo_id: "B", x_m: 61, z_m: 0, rotation_deg: 0 },
    ];
    const plan = planWith(cargo, placed);
    // Whichever side is validated, the pair is reported once, from the placement first in plan order:
    // the plan rule needs exactly that to stay reproducible from this predicate.
    for (const [subject, pose] of [[cargo[0], 60], [cargo[1], 61]] as const) {
      const result = check(deckVessel(), plan, subject, { x_m: pose, z_m: 0 });
      expect(result.reasons.map((r) => r.message)).toEqual(["A overlaps B"]);
    }
    expect(breakbulkOverlap(cargo, placed).map((v) => v.message)).toEqual(["A overlaps B"]);
  });

  it("rejects a footprint over an occupied container stack, naming the stack", () => {
    const vessel = deckVessel({ area: { xMin: 20, xMax: 200, zMin: -15, zMax: 15 } });
    // bays/rows are undeclared, so the stack blocks the full beam of its bay (conservative fallback).
    const plan = planWith([], [], [{ container_id: "c1", slot: { bay: 2, row: 1, tier: 82 } }], []);
    const result = check(vessel, plan, item("A"), { x_m: 184.7, z_m: 0 });
    expect(result.reasons[0].rule).toBe("breakbulk_overlaps_container");
    expect(result.reasons[0].message).toBe("A: footprint overlaps on-deck container stack bay 2 row 01");
  });

  it("warns — without blocking — when the item pushes its 20 m band over the demo limit", () => {
    const vessel = deckVessel({ deck_load_t_per_m2: undefined, max_cargo_height_m: undefined, keep_out: [] });
    // Same x band, different z row: the two items share the band but never overlap.
    const plan = planWith(
      [item("A", { weight_t: 120, width_m: 4 })],
      [{ cargo_id: "A", x_m: 100, z_m: -6, rotation_deg: 0 }],
    );
    const result = check(vessel, plan, item("B", { weight_t: 120, width_m: 4 }), { x_m: 105, z_m: 6 });
    expect(result.ok).toBe(true); // D1: an overridable limit, recorded but not blocking
    expect(result.reasons).toEqual([
      {
        rule: "breakbulk_overweight",
        message: "Deck band 100-120m: 240t exceeds the 200t demo limit",
        severity: "warning",
      },
    ]);
  });

  it("bands a candidate sitting exactly on a band edge the way the rule's repeated addition does", () => {
    const vessel = deckVessel({ deck_load_t_per_m2: undefined, keep_out: [] });
    const plan = planWith(
      [item("A", { weight_t: 120, width_m: 4 })],
      [{ cargo_id: "A", x_m: 125, z_m: -6, rotation_deg: 0 }],
    );
    const result = check(vessel, plan, item("B", { weight_t: 120, width_m: 4 }), { x_m: 120, z_m: 6 });
    expect(result.reasons.map((r) => r.message)).toEqual(["Deck band 120-140m: 240t exceeds the 200t demo limit"]);
  });

  it("uses the rated band formula when the area declares a load rating", () => {
    const vessel = deckVessel({ deck_load_t_per_m2: 5, keep_out: [], max_cargo_height_m: undefined });
    const heavy = (id: string, x_m: number, rotation_deg = 0) =>
      ({ cargo_id: id, x_m, z_m: 0, rotation_deg }) as BreakbulkPlacement;
    const plan = planWith([item("A", { length_m: 40, width_m: 10, weight_t: 1100 })], [heavy("A", 100)]);
    const result = check(vessel, plan, item("B", { length_m: 40, width_m: 10, weight_t: 1100 }), { x_m: 110, z_m: 0 });
    // 5 t/m² × 20 m band × 20 m beam = 2000 t; the two 1100 t items exceed it, while each stays
    // inside the 5 t/m² footprint rating (1100 / 400 m² = 2.75).
    expect(result.reasons.map((r) => r.message)).toContain("Deck band 100-120m: 2200t exceeds the 2000t hatch-cover limit (5 t/m²)");
  });

  it("predicts only messages the plan-wide rules actually produce", () => {
    const vessel = deckVessel();
    const cargo = [item("A", { height_m: 8 }), item("B", { weight_t: 4000 })];
    const placed: BreakbulkPlacement[] = [
      { cargo_id: "A", x_m: 100, z_m: 0, rotation_deg: 0 },
      { cargo_id: "B", x_m: 101, z_m: 0, rotation_deg: 0 }, // overlapping A, on top of the pedestal
    ];
    const plan = planWith(cargo, placed);
    const reported = [
      breakbulkOutOfDeckArea(vessel, cargo, placed), breakbulkOverlap(cargo, placed),
      breakbulkOverlapsContainer(vessel, cargo, placed, []), breakbulkInKeepOut(vessel, cargo, placed),
      breakbulkTooTall(vessel, cargo, placed), breakbulkOverPressure(vessel, cargo, placed),
      breakbulkOverweight(vessel, cargo, placed),
    ].flat().map((v) => v.message);

    expect(reported.length).toBeGreaterThan(0);
    for (const placement of placed) {
      const subject = cargo.find((c) => c.id === placement.cargo_id)!;
      const predicted = check(vessel, plan, subject,
        { x_m: placement.x_m, z_m: placement.z_m, rotation_deg: placement.rotation_deg },
      ).reasons.map((r) => r.message);
      expect(predicted.length).toBeGreaterThan(0);
      expect(reported).toEqual(expect.arrayContaining(predicted));
    }
  });
});
