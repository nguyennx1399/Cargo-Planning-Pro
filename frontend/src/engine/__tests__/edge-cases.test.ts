import { describe, expect, it } from "vitest";
import type { Container, Placement } from "@/types/domain";
import { validatePlan } from "../validate-plan";
import { at, box, makePlan, makeTestVessel } from "./test-vessel-fixture";

const vessel = makeTestVessel();

const twenty = (id: string, patch: Partial<Container> = {}) => box(id, { size: "20", ...patch });

const hits = (rule: string, containers: Container[], placements: Placement[]) =>
  validatePlan(vessel, makePlan(containers, placements)).violations.filter((v) => v.rule === rule);

describe("Edge Cases: Size Rules & Bay Placement", () => {
  it("flags 20' in even bay 2 (size_fits_bay)", () => {
    const v = hits("size_fits_bay", [twenty("A")], [at("A", 2, 2, 2)]);
    expect(v).toHaveLength(1);
  });

  it("flags multiple 20' in even bay at the same row/tier (cell_conflict)", () => {
    const boxes = [twenty("A"), twenty("B")];
    const placements = [at("A", 2, 2, 2), at("B", 2, 2, 2)];
    const v = hits("cell_conflict", boxes, placements);
    expect(v).toHaveLength(1);
  });

  it("allows 20' in the same even bay if stacked in different tiers", () => {
    const boxes = [twenty("A"), twenty("B"), twenty("C"), twenty("D")];
    const placements = [at("A", 1, 2, 2), at("B", 3, 2, 2), at("C", 1, 2, 4), at("D", 3, 2, 4)];
    const conflicts = hits("cell_conflict", boxes, placements);
    expect(conflicts).toHaveLength(0);
  });
});

describe("Edge Cases: Reefer Placement", () => {
  it("flags REEFER on a 20' (reefer_plug)", () => {
    const v = hits("reefer_plug", [twenty("R", { type: "REEFER" })], [at("R", 1, 2, 82)]);
    expect(v).toHaveLength(1);
  });

  it("flags REEFER on bay 2 (no plug) even on deck", () => {
    const v = hits("reefer_plug", [box("R", { type: "REEFER" })], [at("R", 2, 2, 82)]);
    expect(v).toHaveLength(1);
  });

  it("passes REEFER on bay 6 on-deck tier 82 (has plug)", () => {
    const v = hits("reefer_plug", [box("R", { type: "REEFER" })], [at("R", 6, 2, 82)]);
    expect(v).toHaveLength(0);
  });
});

describe("Edge Cases: Floating & Support", () => {
  it("flags a 20' with no support below (floating)", () => {
    const v = hits("no_floating", [twenty("A")], [at("A", 1, 2, 4)]);
    expect(v).toHaveLength(1);
  });

  it("flags a 40' floating on a single 20' in the fore half", () => {
    const boxes = [twenty("A"), box("B")];
    const placements = [at("A", 1, 2, 2), at("B", 2, 2, 4)];
    const v = hits("no_floating", boxes, placements);
    expect(v).toHaveLength(1);
    expect(v[0].message).toContain("aft");
  });

  it("flags a 20' in aft half stacked on a 40' (twenty_on_forty)", () => {
    const boxes = [box("F"), twenty("T")];
    const placements = [at("F", 2, 2, 2), at("T", 3, 2, 4)];
    const v = hits("twenty_on_forty", boxes, placements);
    expect(v).toHaveLength(1);
  });
});

describe("Edge Cases: Overstow with Mixed Sizes", () => {
  it("detects overstow in both 20' halves under a 40' (one violation per half)", () => {
    const boxes = [
      twenty("A", { pod: "SGSIN" }),
      twenty("B", { pod: "SGSIN" }),
      box("C", { pod: "MYPKG" }),
    ];
    const placements = [at("A", 1, 2, 2), at("B", 3, 2, 2), at("C", 2, 2, 4)];
    const v = hits("overstow", boxes, placements);
    expect(v).toHaveLength(2);
    expect(v.every((x) => x.severity === "warning")).toBe(true);
  });

  it("reports overstow once if only one 20' half is under a 40'", () => {
    const boxes = [
      twenty("A", { pod: "SGSIN" }),
      box("C", { pod: "MYPKG" }),
    ];
    const placements = [at("A", 1, 2, 2), at("C", 2, 2, 4)];
    const v = hits("overstow", boxes, placements);
    expect(v).toHaveLength(1);
  });

  it("passes when upper boxes are earlier discharge (SGSIN before MYPKG)", () => {
    const boxes = [
      box("L", { pod: "MYPKG" }),
      box("U", { pod: "SGSIN" }),
    ];
    const placements = [at("L", 2, 2, 2), at("U", 2, 2, 4)];
    const v = hits("overstow", boxes, placements);
    expect(v).toHaveLength(0);
  });
});

describe("Edge Cases: Stack Weight with Fractional Values", () => {
  it("accumulates fractional weights correctly under the 60 t limit", () => {
    const boxes = [
      box("A", { weight_t: 10.5 }),
      box("B", { weight_t: 20.3 }),
      box("C", { weight_t: 29.1 }),
    ];
    const placements = [at("A", 2, 2, 2), at("B", 2, 2, 4), at("C", 2, 2, 82)]; // 82 on deck doesn't count toward under limit
    const v = hits("stack_weight", boxes, placements);
    expect(v).toHaveLength(0);
  });

  it("flags when fractional weights exceed 60 t under deck", () => {
    const boxes = [
      box("A", { weight_t: 25.5 }),
      box("B", { weight_t: 35.3 }),
    ];
    const placements = [at("A", 2, 2, 2), at("B", 2, 2, 4)];
    const v = hits("stack_weight", boxes, placements);
    expect(v).toHaveLength(1);
  });

  it("counts both 20' halves toward the 40' column weight (fractional)", () => {
    const boxes = [
      twenty("A", { weight_t: 15.5 }),
      twenty("B", { weight_t: 15.5 }),
      box("C", { weight_t: 30.5 }),
    ];
    const placements = [at("A", 1, 2, 2), at("B", 3, 2, 2), at("C", 2, 2, 4)];
    const v = hits("stack_weight", boxes, placements);
    expect(v).toHaveLength(1); // 15.5 + 15.5 + 30.5 = 61.5, exceeds 60t limit
  });
});

describe("Edge Cases: Cell Conflicts & Overlaps", () => {
  it("flags two 40' overlapping at the same bay/row/tier", () => {
    const boxes = [box("A"), box("B")];
    const v = hits("cell_conflict", boxes, [at("A", 2, 2, 2), at("B", 2, 2, 2)]);
    expect(v).toHaveLength(1);
    expect(v[0].container_ids.sort()).toEqual(["A", "B"]);
  });

  it("flags a 40' and 20' overlap once", () => {
    const boxes = [box("A"), twenty("B")];
    const v = hits("cell_conflict", boxes, [at("A", 2, 2, 2), at("B", 3, 2, 2)]);
    expect(v).toHaveLength(1);
  });

  it("allows two 20' pairs in fore and aft halves", () => {
    const boxes = [twenty("A"), twenty("B"), twenty("C"), twenty("D")];
    const placements = [
      at("A", 1, 2, 2),
      at("B", 3, 2, 2),
      at("C", 1, 2, 4),
      at("D", 3, 2, 4),
    ];
    const v = hits("cell_conflict", boxes, placements);
    expect(v).toHaveLength(0);
  });
});

describe("Edge Cases: Violation Messages & Slot Codes", () => {
  it("formats slot codes as BBRRTT (e.g., 020204)", () => {
    const report = validatePlan(vessel, makePlan([], [at("GHOST", 2, 2, 4)]));
    const v = report.violations.find((x) => x.rule === "unknown_container");
    expect(v?.slots).toEqual(["020204"]);
    expect(v?.message).toBe("GHOST: placed but not in the cargo list");
  });

  it("includes container ids in cell_conflict violations", () => {
    const boxes = [box("X"), box("Y")];
    const v = hits("cell_conflict", boxes, [at("X", 2, 2, 2), at("Y", 2, 2, 2)]);
    expect(v[0].container_ids).toContain("X");
    expect(v[0].container_ids).toContain("Y");
  });

  it("names the unsupported half in no_floating messages", () => {
    const boxes = [twenty("A"), box("B")];
    const placements = [at("A", 1, 2, 2), at("B", 2, 2, 4)];
    const v = hits("no_floating", boxes, placements);
    expect(v[0].message).toMatch(/aft|fore/);
  });
});

describe("Edge Cases: Placement order & unsorted tiers", () => {
  it("accepts a proper stack even when placements are listed top-down", () => {
    const boxes = [box("A"), box("B")];
    const report = validatePlan(vessel, makePlan(boxes, [at("A", 2, 2, 4), at("B", 2, 2, 2)]));
    expect(report.ok).toBe(true);
  });

  it("finds the tier below when the stack spec lists tiers out of order", () => {
    // bay 02 row 02 under deck declared as tiers [4, 2] instead of [2, 4]
    const unsorted = {
      ...vessel,
      stacks: vessel.stacks.map((s) => (s.bay === 2 && s.row === 2 && s.deck === "under" ? { ...s, tiers: [4, 2] } : s)),
    };
    const floating = validatePlan(unsorted, makePlan([box("A")], [at("A", 2, 2, 4)]));
    expect(floating.violations.map((v) => v.rule)).toEqual(["no_floating"]);
    expect(floating.violations[0].message).toContain("tier 02");

    const stacked = validatePlan(unsorted, makePlan([box("A"), box("B")], [at("A", 2, 2, 4), at("B", 2, 2, 2)]));
    expect(stacked.ok).toBe(true);
  });
});
