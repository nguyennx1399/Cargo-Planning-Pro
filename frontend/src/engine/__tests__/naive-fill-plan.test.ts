import { describe, expect, it } from "vitest";
import { naiveFillPlan } from "../naive-fill-plan";
import { buildDemoVessel } from "@/data/demo-container-vessel";
import { generateDemoCargo } from "@/data/demo-cargo-generator";
import { validatePlan } from "../validate-plan";
import type { StowagePlan } from "@/types/domain";

describe("naiveFillPlan", () => {
  const vessel = buildDemoVessel();
  const containers = generateDemoCargo(42);
  const { placements, unplaced } = naiveFillPlan(vessel, containers);

  it("places every 40' container; 20' containers are left unplaced", () => {
    // KNOWN GAP, not a bug in this filler: vessel.stacks only has entries for even (40') bay
    // numbers. 20' containers are meant to occupy the odd fore/aft half-bays of a 40' stack
    // (see slot-helpers.ts's bayPosition/twentyBaysOf), sharing one physical tier two-to-a-slot
    // — that pairing logic doesn't exist anywhere in the codebase yet (P1-demo plan phase 4).
    // This locks in today's real behavior so a future fix here is a deliberate, visible change.
    const byId = new Map(containers.map((c) => [c.id, c]));
    expect(placements.length).toBe(containers.filter((c) => c.size === "40").length);
    expect(unplaced.length).toBe(containers.filter((c) => c.size === "20").length);
    expect(unplaced.every((id) => byId.get(id)!.size === "20")).toBe(true);
    expect(placements.length + unplaced.length).toBe(containers.length);
  });

  it("never double-books a slot", () => {
    const codes = placements.map((p) => `${p.slot.bay}-${p.slot.row}-${p.slot.tier}`);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("produces a plan with zero hard-rule errors", () => {
    const plan: StowagePlan = {
      id: "test-plan",
      vessel_id: vessel.id,
      voyage: "TEST",
      ports: [],
      containers,
      placements,
      unplaced,
      breakbulk_cargo: [],
      breakbulk_placements: [],
    };
    const report = validatePlan(vessel, plan);
    expect(report.kpis.errors).toBe(0);
  });

  it("is deterministic for the same vessel/cargo", () => {
    const again = naiveFillPlan(vessel, containers);
    expect(again.placements).toEqual(placements);
    expect(again.unplaced).toEqual(unplaced);
  });
});
