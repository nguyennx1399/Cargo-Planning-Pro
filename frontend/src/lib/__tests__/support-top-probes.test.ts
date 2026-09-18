/**
 * Dropping onto a support's top (stacking plan, phase 04). The tops are extra surfaces for the drop
 * plane's own resolver, so these tests drive `areaUnderCursor` with them exactly as the drop plane does.
 */
import { describe, expect, it } from "vitest";
import { supportTopProbes } from "../support-top-probes";
import { areaUnderCursor, type AreaProbe, type Vec3 } from "../nearest-area";
import { buildStowageModel } from "@/engine/stowage-model";
import { clampPoseToArea, samePose } from "@/engine/placement/breakbulk-pose";
import type { BreakbulkCargo, BreakbulkPlacement, Vessel } from "@/types/domain";

const vessel: Vessel = {
  id: "bb", name: "BB", imo: null, length_m: 200, beam_m: 30, bays: [], rows: [], stacks: [],
  breakbulk_deck: { area: { xMin: 20, xMax: 180, zMin: -10, zMax: 10 }, keep_out: [], cargo_base_height_m: 1, max_cargo_height_m: 6 },
};
const areas = [...buildStowageModel(vessel).areaById.values()];
const deck = areas[0];

const cargo = (id: string, h: number, maxTop?: number): BreakbulkCargo => ({
  id, category: "general", length_m: 12, width_m: 5, height_m: h, weight_t: 5, kg_above_base_m: h / 2, pol: "A", pod: "B",
  ...(maxTop !== undefined ? { stacking: { max_top_load_t: maxTop } } : {}),
});
const at = (cargo_id: string, x_m: number, on?: string): BreakbulkPlacement => ({
  cargo_id, x_m, z_m: 0, rotation_deg: 0, ...(on ? { on_cargo_id: on } : {}),
});

// A 0.5 m frame at x 44–56, a stackable 2 m item on it, and a plain item elsewhere.
const plan = {
  breakbulk_cargo: [cargo("F1", 0.5, 60), cargo("B1", 2, 30), cargo("P", 3), cargo("HAND", 1)],
  breakbulk_placements: [at("F1", 50), at("B1", 50, "F1"), at("P", 120)],
};

describe("supportTopProbes", () => {
  it("lists only placed, stackable items, each at its real top height", () => {
    const tops = supportTopProbes(plan, areas, "HAND");
    expect(tops.map((t) => [t.id, t.surfaceY])).toEqual([
      ["F1", deck.surfaceY + 0.5],
      ["B1", deck.surfaceY + 0.5 + 2],
    ]);
    expect(tops[0]).toMatchObject({ areaId: deck.id, pad: [0, 0], rect: { xMin: 44, xMax: 56, zMin: -2.5, zMax: 2.5 } });
  });

  it("never offers the item in hand, or anything resting on it", () => {
    expect(supportTopProbes(plan, areas, "F1").map((t) => t.id)).toEqual([]);
    expect(supportTopProbes(plan, areas, "B1").map((t) => t.id)).toEqual(["F1"]);
  });

  it("offers nothing in an area the planner has hidden", () => {
    expect(supportTopProbes(plan, [], "HAND")).toEqual([]);
  });
});

describe("the drop plane's resolver with tops", () => {
  // Straight down from 30 m: the resolver is frame-agnostic, and x here is already the rect's x.
  const down = (x: number): [Vec3, Vec3] => [[x, 30, 0], [0, -1, 0]];
  const probes = (): AreaProbe[] => [
    ...areas.map((a) => ({ id: a.id, surfaceY: a.surfaceY, rect: a.rect })),
    ...supportTopProbes(plan, areas, "HAND"),
  ];

  it("lands on the HIGHEST top under the pointer", () => {
    const hit = areaUnderCursor(probes(), ...down(50), [6, 2.5]);
    expect(probes()[hit!.index].id).toBe("B1");
  });

  it("lands on the floor right beside a frame — a top is never padded", () => {
    // x = 58 is 2 m past the frame's edge: inside the held item's 6 m half-length, but not over the top.
    const hit = areaUnderCursor(probes(), ...down(58), [6, 2.5]);
    expect(probes()[hit!.index].id).toBe(deck.id);
  });
});

describe("poses on a top", () => {
  it("clamp fully onto the support's top", () => {
    const [top] = supportTopProbes(plan, areas, "HAND");
    const small = { ...cargo("S", 1), length_m: 8, width_m: 3 };
    const pose = clampPoseToArea(top, small, { areaId: deck.id, x_m: 55.2, z_m: 2.2, onCargoId: "F1" });
    expect(pose).toMatchObject({ x_m: 52, z_m: 1, onCargoId: "F1" }); // 48–56 × −0.5–2.5: inside 44–56 × ±2.5
  });

  it("are a different pose from the same spot on the floor", () => {
    expect(samePose({ areaId: "d", x_m: 50, z_m: 0 }, { areaId: "d", x_m: 50, z_m: 0, onCargoId: "F1" })).toBe(false);
  });
});
