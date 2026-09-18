/**
 * parseCustomCargo — what a planner typed, turned into project cargo or into the reasons it cannot be.
 * Covers the original rules (deferred from an earlier `--not-test` run) and stacking's frame / max top
 * load rules (stacking plan, phase 05).
 */
import { describe, expect, it } from "vitest";
import { nextCustomCargoId, parseCustomCargo, type CustomCargoFields } from "../custom-cargo-input";
import type { Vessel } from "@/types/domain";

const vessel: Vessel = { id: "v", name: "V", imo: null, length_m: 150, beam_m: 25, bays: [], rows: [], stacks: [] };
const fields = (patch: Partial<CustomCargoFields> = {}): CustomCargoFields => ({
  name: "", length: "12", width: "4", height: "3", weight: "20", ...patch,
});

describe("parseCustomCargo — cargo", () => {
  it("builds a general, non-stackable item with CoG at half height by default", () => {
    const result = parseCustomCargo(fields(), vessel, []);
    expect(result).toEqual({
      ok: true,
      item: { id: "CUSTOM-1", category: "general", length_m: 12, width_m: 4, height_m: 3, weight_t: 20, kg_above_base_m: 1.5, pol: "", pod: "" },
    });
  });

  it("rejects zero, non-numeric and absurd sizes, each on its own field", () => {
    const result = parseCustomCargo(fields({ length: "0", width: "abc", height: "61", weight: "-1" }), vessel, []);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.errors).sort()).toEqual(["height", "length", "weight", "width"]);
  });

  it("rejects an item longer or wider than the vessel", () => {
    const result = parseCustomCargo(fields({ length: "151", width: "26" }), vessel, []);
    expect(result.ok ? {} : result.errors).toEqual({
      length: "Longer than the vessel (150 m)",
      width: "Wider than the vessel's beam (25 m)",
    });
  });

  it("keeps an edited CoG inside [0, height]", () => {
    expect(parseCustomCargo(fields({ kg: "0.8" }), vessel, []).ok && true).toBe(true);
    const bad = parseCustomCargo(fields({ kg: "4" }), vessel, []);
    expect(bad.ok ? null : bad.errors.kg).toBe("Centre of gravity must be between 0 and the height (3 m)");
  });

  it("refuses a name already in use", () => {
    const result = parseCustomCargo(fields({ name: "CUSTOM-1" }), vessel, [{ id: "CUSTOM-1" }]);
    expect(result.ok ? null : result.errors.name).toBe('"CUSTOM-1" is already used');
  });

  it("becomes stackable when a max top load is given", () => {
    const result = parseCustomCargo(fields({ maxTopLoad: "30" }), vessel, []);
    expect(result.ok && result.item.stacking).toEqual({ max_top_load_t: 30 });
    expect(result.ok && result.item.category).toBe("general");
  });

  it("rejects a max top load that is not a number > 0", () => {
    const result = parseCustomCargo(fields({ maxTopLoad: "0" }), vessel, []);
    expect(result.ok ? null : result.errors.maxTopLoad).toBe("Max top load must be a number greater than 0");
  });
});

describe("parseCustomCargo — support frame", () => {
  it("requires the load the frame can carry", () => {
    const result = parseCustomCargo(fields({ kind: "frame" }), vessel, []);
    expect(result.ok ? null : result.errors).toEqual({ maxTopLoad: "A frame needs the max load it can carry" });
  });

  it("builds a support_frame, named FRAME-n, carrying its max top load", () => {
    const result = parseCustomCargo(fields({ kind: "frame", height: "0.5", weight: "3", maxTopLoad: "60" }), vessel, [{ id: "FRAME-1" }]);
    expect(result.ok && result.item).toMatchObject({
      id: "FRAME-2", category: "support_frame", height_m: 0.5, weight_t: 3, stacking: { max_top_load_t: 60 },
    });
  });
});

describe("nextCustomCargoId", () => {
  it("takes the first free index, never resurrecting a live id", () => {
    expect(nextCustomCargoId([{ id: "CUSTOM-1" }, { id: "CUSTOM-3" }])).toBe("CUSTOM-2");
    expect(nextCustomCargoId([], "FRAME")).toBe("FRAME-1");
  });
});
