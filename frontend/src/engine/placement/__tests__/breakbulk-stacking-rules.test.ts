/**
 * Stacking rules (stacking plan, phase 02): a stack is legal, and each of the three checks — top load,
 * fully supported, stack height — refuses its own case. The last test is the contract the predicate
 * already keeps for the floor rules: the drop preview and the plan-wide report say the same thing.
 */
import { describe, expect, it } from "vitest";
import { canPlaceBreakbulk, type BreakbulkPose } from "../can-place-breakbulk";
import { validatePlan } from "@/engine/validate-plan";
import { buildStowageModel } from "@/engine/stowage-model";
import type { BreakbulkCargo, BreakbulkPlacement, StowagePlan, Vessel } from "@/types/domain";

/** 200 m vessel: hatch envelope x 20–180, z ±10, 6 m clear height, 2 t/m² (same shape as the predicate's own tests). */
const vessel: Vessel = {
  id: "bb", name: "BB", imo: null, length_m: 200, beam_m: 30, bays: [], rows: [], stacks: [],
  breakbulk_deck: {
    area: { xMin: 20, xMax: 180, zMin: -10, zMax: 10 },
    keep_out: [],
    cargo_base_height_m: 1,
    max_cargo_height_m: 6,
    deck_load_t_per_m2: 2,
  },
};

const cargo = (id: string, l: number, w: number, h: number, t: number, maxTop?: number): BreakbulkCargo => ({
  id, category: id.startsWith("F") ? "support_frame" : "general",
  length_m: l, width_m: w, height_m: h, weight_t: t, kg_above_base_m: h / 2, pol: "A", pod: "B",
  ...(maxTop !== undefined ? { stacking: { max_top_load_t: maxTop } } : {}),
});
const at = (cargo_id: string, x_m: number, on?: string): BreakbulkPlacement => ({
  cargo_id, x_m, z_m: 0, rotation_deg: 0, ...(on ? { on_cargo_id: on } : {}),
});
const plan = (items: BreakbulkCargo[], placements: BreakbulkPlacement[]): StowagePlan => ({
  id: "p", vessel_id: "bb", voyage: "T", ports: [], containers: [], placements: [], unplaced: [],
  breakbulk_cargo: items, breakbulk_placements: placements,
});
const check = (p: StowagePlan, subject: BreakbulkCargo, pose: BreakbulkPose) =>
  canPlaceBreakbulk(buildStowageModel(vessel), p, subject, pose, vessel);
const messages = (p: StowagePlan, subject: BreakbulkCargo, pose: BreakbulkPose) =>
  check(p, subject, pose).reasons.map((r) => r.message);

// Frame 12 × 5 × 0.5 m, 3 t, carries 60 t — spans x 44–56 at x = 50.
const F = cargo("F1", 12, 5, 0.5, 3, 60);
const B1 = cargo("B1", 10, 4, 2, 20, 50); // stackable itself: carries 50 t
const B2 = cargo("B2", 8, 3, 1.5, 10);

describe("a legal stack", () => {
  it("accepts an item dropped on a frame's top — no overlap, no refusal", () => {
    const result = check(plan([F, B1], [at("F1", 50)]), B1, { x_m: 50, z_m: 0, onCargoId: "F1" });
    expect(result).toEqual({ ok: true, reasons: [] });
  });

  it("a 3-high stack validates clean plan-wide", () => {
    const report = validatePlan(vessel, plan([F, B1, B2], [at("F1", 50), at("B1", 50, "F1"), at("B2", 50, "B1")]));
    expect(report.violations).toEqual([]);
  });

  it("still reports two items side by side at the same level", () => {
    const X = cargo("X", 10, 4, 2, 5);
    // B1 on the frame sits 0.5–2.5 m; X on the floor at x 53–63 is 0–2 m: they share space.
    const msgs = messages(plan([F, B1, X], [at("F1", 50), at("X", 58)]), B1, { x_m: 50, z_m: 0, onCargoId: "F1" });
    expect(msgs).toContain("X overlaps B1"); // plan order names the placed item first
  });
});

describe("fully supported", () => {
  it("refuses a footprint that overhangs its support", () => {
    // B1 at x = 52 spans 47–57; the frame ends at 56.
    const msgs = messages(plan([F, B1], [at("F1", 50)]), B1, { x_m: 52, z_m: 0, onCargoId: "F1" });
    expect(msgs).toEqual(["B1: footprint overhangs F1"]);
  });
});

describe("top load", () => {
  it("refuses more weight than the support's max top load", () => {
    const heavy = cargo("H", 10, 4, 2, 70);
    expect(messages(plan([F, heavy], [at("F1", 50)]), heavy, { x_m: 50, z_m: 0, onCargoId: "F1" }))
      .toEqual(["F1: 70.0t on top exceeds its 60t max top load"]);
  });

  it("loads EVERY support below: 45 t on B1 is fine for B1 (50 t) but tips the frame over 60 t", () => {
    const B2heavy = cargo("B2", 8, 3, 1.5, 45);
    const msgs = messages(plan([F, B1, B2heavy], [at("F1", 50), at("B1", 50, "F1")]), B2heavy, { x_m: 50, z_m: 0, onCargoId: "B1" });
    expect(msgs).toEqual(["F1: 65.0t on top exceeds its 60t max top load"]);
  });

  it("puts the whole stack's weight on the floor item's pressure", () => {
    // (3 + 130) t over the frame's 60 m² = 2.22 t/m² > 2; the item on top has no floor pressure of its own.
    const bigFrame = cargo("F1", 12, 5, 0.5, 3, 200);
    const load = cargo("L", 10, 4, 2, 130);
    expect(messages(plan([bigFrame, load], [at("F1", 50)]), load, { x_m: 50, z_m: 0, onCargoId: "F1" }))
      .toContain("F1: 2.22 t/m² exceeds the 2 t/m² rating of weather deck");
  });
});

describe("stack height", () => {
  it("judges the TOP of the stack against the clear height", () => {
    const tall = cargo("T", 8, 3, 4, 5);
    // 0.5 + 2 + 4 = 6.5 m > 6 m.
    expect(messages(plan([F, B1, tall], [at("F1", 50), at("B1", 50, "F1")]), tall, { x_m: 50, z_m: 0, onCargoId: "B1" }))
      .toEqual(["T: top of stack at 6.50m exceeds the 6m clear height in weather deck"]);
  });

  it("keeps the original message for an item on the floor", () => {
    const tall = cargo("T", 8, 3, 7, 5);
    expect(messages(plan([tall], []), tall, { x_m: 50, z_m: 0 }))
      .toEqual(["T: 7m tall exceeds the 6m clear height in weather deck"]);
  });
});

describe("invalid supports", () => {
  it("refuses resting on an item that is not stackable", () => {
    const flat = cargo("P", 12, 5, 1, 10);
    expect(messages(plan([flat, B2], [at("P", 50)]), B2, { x_m: 50, z_m: 0, onCargoId: "P" }))
      .toEqual(["B2: cannot rest on P (it is not stackable)"]);
  });

  it("refuses a support that is not placed", () => {
    expect(messages(plan([F, B1], []), B1, { x_m: 50, z_m: 0, onCargoId: "F1" }))
      .toEqual(["B1: cannot rest on F1 (it is not placed)"]);
  });

  it("refuses a cycle without hanging", () => {
    const A = cargo("A", 10, 4, 1, 5, 50);
    const B = cargo("B", 10, 4, 1, 5, 50);
    const msgs = messages(plan([A, B], [at("A", 50, "B"), at("B", 50, "A")]), A, { x_m: 50, z_m: 0, onCargoId: "B" });
    expect(msgs).toContain("A: cannot rest on B (it rests on this item)");
  });
});

describe("the drop preview and the plan-wide report agree", () => {
  it("every message predicted for a stacked pose is one the report lists once it is placed", () => {
    const heavy = cargo("H", 12, 4, 5, 70);
    const cases: [StowagePlan, BreakbulkCargo, BreakbulkPose][] = [
      [plan([F, heavy], [at("F1", 50)]), heavy, { x_m: 51, z_m: 0, onCargoId: "F1" }],
      [plan([F, B1, B2], [at("F1", 50), at("B1", 50, "F1")]), B2, { x_m: 50, z_m: 0, onCargoId: "B1" }],
    ];
    for (const [p, subject, pose] of cases) {
      const predicted = messages(p, subject, pose);
      const placed = { ...p, breakbulk_placements: [...p.breakbulk_placements, at(subject.id, pose.x_m, pose.onCargoId)] };
      const reported = validatePlan(vessel, placed).violations.map((v) => v.message);
      for (const m of predicted) expect(reported).toContain(m);
    }
  });
});
