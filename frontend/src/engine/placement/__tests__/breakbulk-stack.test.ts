/**
 * Stack geometry (stacking plan, phase 01): heights, loads and broken chains. Every broken case must
 * terminate and be classified — plans come from files and undo, so a chain can be anything.
 */
import { describe, expect, it } from "vitest";
import type { BreakbulkCargo, BreakbulkPlacement } from "@/types/domain";
import {
  dependentsOf,
  elevationOf,
  loadAbove,
  stackBottomOf,
  supportChain,
} from "../breakbulk-stack";

const item = (id: string, height_m: number, weight_t: number, maxTop?: number): BreakbulkCargo => ({
  id,
  category: maxTop !== undefined && id.startsWith("F") ? "support_frame" : "general",
  length_m: 10,
  width_m: 4,
  height_m,
  weight_t,
  kg_above_base_m: height_m / 2,
  pol: "A",
  pod: "B",
  ...(maxTop !== undefined ? { stacking: { max_top_load_t: maxTop } } : {}),
});
const at = (cargo_id: string, on?: string, area_id?: string): BreakbulkPlacement => ({
  cargo_id,
  x_m: 50,
  z_m: 0,
  rotation_deg: 0,
  ...(area_id ? { area_id } : {}),
  ...(on ? { on_cargo_id: on } : {}),
});
const plan = (cargo: BreakbulkCargo[], placements: BreakbulkPlacement[]) => ({
  breakbulk_cargo: cargo,
  breakbulk_placements: placements,
});

// F1 (0.5 m frame, 60 t) on the floor → B1 (3 m, 20 t, carries 30 t) → B2 (2 m, 10 t) on top.
const three = plan(
  [item("F1", 0.5, 2, 60), item("B1", 3, 20, 30), item("B2", 2, 10)],
  [at("F1"), at("B1", "F1"), at("B2", "B1")],
);

describe("a legal stack", () => {
  it("a floor item has no chain and elevation 0", () => {
    expect(supportChain(three, "F1")).toEqual({ chain: [] });
    expect(elevationOf(three, "F1")).toBe(0);
    expect(stackBottomOf(three, "F1")).toBe("F1");
  });

  it("walks the chain nearest first and sums the heights below", () => {
    expect(supportChain(three, "B2")).toEqual({ chain: ["B1", "F1"] });
    expect(elevationOf(three, "B1")).toBe(0.5);
    expect(elevationOf(three, "B2")).toBe(3.5);
    expect(stackBottomOf(three, "B2")).toBe("F1");
  });

  it("loads a support with EVERYTHING above it, not only what touches it", () => {
    expect(loadAbove(three, "F1")).toBe(30);
    expect(loadAbove(three, "B1")).toBe(10);
    expect(loadAbove(three, "B2")).toBe(0);
  });

  it("lists only direct dependents", () => {
    expect(dependentsOf(three, "F1")).toEqual(["B1"]);
    expect(dependentsOf(three, "B2")).toEqual([]);
  });

  it("an unplaced item has an empty, unbroken chain", () => {
    expect(supportChain(three, "nope")).toEqual({ chain: [] });
  });
});

describe("broken chains terminate and are classified", () => {
  it("a support that is not placed → missing", () => {
    const p = plan([item("F1", 0.5, 2, 60), item("B1", 3, 20)], [at("B1", "F1")]);
    expect(supportChain(p, "B1")).toEqual({ chain: [], broken: { supportId: "F1", why: "missing" } });
    expect(elevationOf(p, "B1")).toBe(0);
  });

  it("a cycle A ↔ B → cycle, and no hang in any walk", () => {
    const p = plan([item("A", 1, 5, 50), item("B", 1, 5, 50)], [at("A", "B"), at("B", "A")]);
    expect(supportChain(p, "A").broken).toEqual({ supportId: "A", why: "cycle" });
    expect(loadAbove(p, "A")).toBe(5); // B once, never itself or a loop
  });

  it("resting on itself → cycle", () => {
    const p = plan([item("A", 1, 5, 50)], [at("A", "A")]);
    expect(supportChain(p, "A")).toEqual({ chain: [], broken: { supportId: "A", why: "cycle" } });
  });

  it("a support in another area → other_area, and its height is not counted", () => {
    const p = plan([item("F1", 0.5, 2, 60), item("B1", 3, 20)], [at("F1", undefined, "hold_1"), at("B1", "F1")]);
    expect(supportChain(p, "B1")).toEqual({ chain: [], broken: { supportId: "F1", why: "other_area" } });
    expect(elevationOf(p, "B1")).toBe(0);
  });

  it("a non-stackable support → not_stackable, but the item is still drawn on top of it", () => {
    const p = plan([item("B1", 3, 20), item("B2", 2, 10)], [at("B1"), at("B2", "B1")]);
    expect(supportChain(p, "B2")).toEqual({ chain: ["B1"], broken: { supportId: "B1", why: "not_stackable" } });
    expect(elevationOf(p, "B2")).toBe(3);
  });
});

describe("memoisation", () => {
  it("answers from the same index for the same placements array, and rebuilds for a new one", () => {
    expect(elevationOf(three, "B2")).toBe(3.5);
    const moved = { ...three, breakbulk_placements: [at("F1"), at("B1", "F1"), at("B2")] };
    expect(elevationOf(moved, "B2")).toBe(0);
    expect(elevationOf(three, "B2")).toBe(3.5);
  });
});
