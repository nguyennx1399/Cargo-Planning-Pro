import { describe, expect, it } from "vitest";
import type { Container, Placement } from "@/types/domain";
import { validatePlan } from "../validate-plan";
import { at, box, makePlan, makeTestVessel } from "./test-vessel-fixture";

const vessel = makeTestVessel();

/** Violations of one rule for a plan built from boxes + placements. */
const hits = (rule: string, containers: Container[], placements: Placement[]) =>
  validatePlan(vessel, makePlan(containers, placements)).violations.filter((v) => v.rule === rule);

const twenty = (id: string, patch: Partial<Container> = {}) => box(id, { size: "20", ...patch });

describe("slot_exists", () => {
  it("passes for a real slot", () => {
    expect(hits("slot_exists", [box("A")], [at("A", 2, 2, 2)])).toHaveLength(0);
  });
  it("flags a missing tier and a bay that is not on the vessel", () => {
    expect(hits("slot_exists", [box("A"), box("B")], [at("A", 2, 2, 6), at("B", 10, 2, 2)])).toHaveLength(2);
  });
});

describe("size_fits_bay", () => {
  it("passes 20' in odd bay and 40' in even bay", () => {
    expect(hits("size_fits_bay", [twenty("A"), box("B")], [at("A", 1, 2, 2), at("B", 6, 2, 2)])).toHaveLength(0);
  });
  it("flags 40' in odd bay and 20' in even bay", () => {
    expect(hits("size_fits_bay", [box("A"), twenty("B")], [at("A", 1, 2, 2), at("B", 2, 1, 2)])).toHaveLength(2);
  });
});

describe("cell_conflict", () => {
  it("passes two 20' side by side in fore and aft halves", () => {
    expect(hits("cell_conflict", [twenty("A"), twenty("B")], [at("A", 1, 2, 2), at("B", 3, 2, 2)])).toHaveLength(0);
  });
  it("flags a 40' overlapping a 20' once", () => {
    const v = hits("cell_conflict", [box("A"), twenty("B")], [at("A", 2, 2, 2), at("B", 3, 2, 2)]);
    expect(v).toHaveLength(1);
    expect(v[0].container_ids.sort()).toEqual(["A", "B"]);
  });
  it("flags two 40' in the same slot once", () => {
    expect(hits("cell_conflict", [box("A"), box("B")], [at("A", 2, 2, 2), at("B", 2, 2, 2)])).toHaveLength(1);
  });
});

describe("twenty_on_forty", () => {
  it("flags a 20' on top of a 40'", () => {
    const v = hits("twenty_on_forty", [box("F"), twenty("T")], [at("F", 2, 2, 2), at("T", 1, 2, 4)]);
    expect(v).toHaveLength(1);
    expect(v[0].container_ids).toEqual(["T", "F"]);
  });
  it("passes a 20' on a 20'", () => {
    expect(hits("twenty_on_forty", [twenty("A"), twenty("B")], [at("A", 1, 2, 2), at("B", 1, 2, 4)])).toHaveLength(0);
  });
  it("passes a 40' on two 20' (and it is supported)", () => {
    const boxes = [twenty("A"), twenty("B"), box("C")];
    const placements = [at("A", 1, 2, 2), at("B", 3, 2, 2), at("C", 2, 2, 4)];
    expect(hits("twenty_on_forty", boxes, placements)).toHaveLength(0);
    expect(hits("no_floating", boxes, placements)).toHaveLength(0);
  });
});

describe("no_floating", () => {
  it("flags a box with an empty tier below", () => {
    expect(hits("no_floating", [box("A")], [at("A", 2, 2, 4)])).toHaveLength(1);
  });
  it("flags a 40' resting on a single 20' and names the empty half", () => {
    const v = hits("no_floating", [twenty("A"), box("B")], [at("A", 1, 2, 2), at("B", 2, 2, 4)]);
    expect(v).toHaveLength(1);
    expect(v[0].message).toContain("aft half");
  });
  it("passes the lowest on-deck tier and a proper stack", () => {
    expect(hits("no_floating", [box("A")], [at("A", 2, 2, 82)])).toHaveLength(0);
    expect(hits("no_floating", [box("A"), box("B")], [at("A", 2, 2, 2), at("B", 2, 2, 4)])).toHaveLength(0);
  });
});

describe("stack_weight", () => {
  it("passes exactly at the limit", () => {
    const boxes = [box("A", { weight_t: 30 }), box("B", { weight_t: 30 })];
    expect(hits("stack_weight", boxes, [at("A", 2, 2, 2), at("B", 2, 2, 4)])).toHaveLength(0);
  });
  it("flags a stack over the limit", () => {
    const boxes = [box("A", { weight_t: 35 }), box("B", { weight_t: 30 })];
    expect(hits("stack_weight", boxes, [at("A", 2, 2, 2), at("B", 2, 2, 4)])).toHaveLength(1);
  });
  it("counts both 20' halves toward the 40' column", () => {
    const boxes = [twenty("A", { weight_t: 20 }), twenty("B", { weight_t: 20 }), box("C", { weight_t: 25 })];
    expect(hits("stack_weight", boxes, [at("A", 1, 2, 2), at("B", 3, 2, 2), at("C", 2, 2, 4)])).toHaveLength(1);
  });
});

describe("reefer_plug", () => {
  it("passes a reefer on a plug tier", () => {
    expect(hits("reefer_plug", [box("R", { type: "REEFER" })], [at("R", 6, 2, 82)])).toHaveLength(0);
  });
  it("flags reefers on tiers without plugs", () => {
    const boxes = [box("R1", { type: "REEFER" }), box("R2", { type: "REEFER" })];
    expect(hits("reefer_plug", boxes, [at("R1", 2, 2, 82), at("R2", 6, 2, 2)])).toHaveLength(2);
  });
});

describe("overstow", () => {
  it("warns when a later-discharge box sits on an earlier one", () => {
    const v = hits("overstow", [box("L", { pod: "SGSIN" }), box("U", { pod: "MYPKG" })], [at("L", 2, 2, 2), at("U", 2, 2, 4)]);
    expect(v).toHaveLength(1);
    expect(v[0].severity).toBe("warning");
  });
  it("passes when the upper box is discharged first", () => {
    expect(hits("overstow", [box("L", { pod: "MYPKG" }), box("U", { pod: "SGSIN" })], [at("L", 2, 2, 2), at("U", 2, 2, 4)])).toHaveLength(0);
  });
  it("reports each blocked 20' under a 40'", () => {
    const boxes = [twenty("A", { pod: "SGSIN" }), twenty("B", { pod: "SGSIN" }), box("C", { pod: "MYPKG" })];
    expect(hits("overstow", boxes, [at("A", 1, 2, 2), at("B", 3, 2, 2), at("C", 2, 2, 4)])).toHaveLength(2);
  });
});
