/**
 * The origin half of `no_floating`: what an edit leaves BEHIND (Phase 01).
 *
 * Built on `buildDemoVessel` rather than a hand-rolled fixture so the stack tier lists
 * (under deck 02..10, on deck 82..88) and the 20'/40' bay parity are the real ones — the two things
 * the module's arithmetic depends on.
 */
import { describe, expect, it } from "vitest";
import { buildDemoVessel } from "@/data/demo-container-vessel";
import type { Container, Placement, StowagePlan } from "@/types/domain";
import { dependentsLosingSupport, strandedMessage } from "@/engine/placement/support-dependents";

const vessel = buildDemoVessel();

const box = (id: string, size: Container["size"] = "40"): Container => ({
  id,
  size,
  type: "DRY",
  weight_t: 10,
  high_cube: false,
  imdg_class: null,
  oog: false,
  pol: "VNSGN",
  pod: "SGSIN",
});

function planOf(containers: Container[], placements: Placement[]): StowagePlan {
  return {
    id: "t",
    vessel_id: vessel.id,
    voyage: "T",
    ports: [],
    containers,
    placements,
    unplaced: [],
    breakbulk_cargo: [],
    breakbulk_placements: [],
  };
}

/** The plan with `id`'s placement removed — the shape every caller passes as `after`. */
const without = (plan: StowagePlan, id: string): StowagePlan => ({
  ...plan,
  placements: plan.placements.filter((p) => p.container_id !== id),
});

describe("dependentsLosingSupport", () => {
  it("reports the box standing directly on the one being removed", () => {
    const plan = planOf(
      [box("bottom"), box("top")],
      [
        { container_id: "bottom", slot: { bay: 14, row: 2, tier: 2 } },
        { container_id: "top", slot: { bay: 14, row: 2, tier: 4 } },
      ],
    );
    expect(dependentsLosingSupport(vessel, plan, without(plan, "bottom"), "bottom")).toEqual(["top"]);
  });

  it("reports nothing for the top box of a stack", () => {
    const plan = planOf(
      [box("bottom"), box("top")],
      [
        { container_id: "bottom", slot: { bay: 14, row: 2, tier: 2 } },
        { container_id: "top", slot: { bay: 14, row: 2, tier: 4 } },
      ],
    );
    expect(dependentsLosingSupport(vessel, plan, without(plan, "top"), "top")).toEqual([]);
  });

  it("reports nothing for a box that is not placed", () => {
    const plan = planOf([box("loose")], []);
    expect(dependentsLosingSupport(vessel, plan, plan, "loose")).toEqual([]);
  });

  it("only blames the tier DIRECTLY above — a box two tiers up was already floating", () => {
    const plan = planOf(
      [box("bottom"), box("floater")],
      [
        { container_id: "bottom", slot: { bay: 14, row: 2, tier: 2 } },
        { container_id: "floater", slot: { bay: 14, row: 2, tier: 6 } },
      ],
    );
    expect(dependentsLosingSupport(vessel, plan, without(plan, "bottom"), "bottom")).toEqual([]);
  });

  it("a 40' box above loses support when EITHER 20' half below leaves", () => {
    const plan = planOf(
      [box("fore", "20"), box("aft", "20"), box("top")],
      [
        { container_id: "fore", slot: { bay: 13, row: 2, tier: 2 } }, // fore half of bay 14
        { container_id: "aft", slot: { bay: 15, row: 2, tier: 2 } }, // aft half of bay 14
        { container_id: "top", slot: { bay: 14, row: 2, tier: 4 } },
      ],
    );
    expect(dependentsLosingSupport(vessel, plan, without(plan, "fore"), "fore")).toEqual(["top"]);
    expect(dependentsLosingSupport(vessel, plan, without(plan, "aft"), "aft")).toEqual(["top"]);
  });

  it("a 20' half above is stranded only when ITS own half below leaves", () => {
    const plan = planOf(
      [box("fore", "20"), box("aft", "20"), box("topFore", "20")],
      [
        { container_id: "fore", slot: { bay: 13, row: 2, tier: 2 } },
        { container_id: "aft", slot: { bay: 15, row: 2, tier: 2 } },
        { container_id: "topFore", slot: { bay: 13, row: 2, tier: 4 } },
      ],
    );
    expect(dependentsLosingSupport(vessel, plan, without(plan, "fore"), "fore")).toEqual(["topFore"]);
    expect(dependentsLosingSupport(vessel, plan, without(plan, "aft"), "aft")).toEqual([]);
  });

  it("does not blame an edit for a floater that predates it", () => {
    // `high` is already unsupported (nothing at tier 82 under it); removing an unrelated box on
    // another row must not report it.
    const plan = planOf(
      [box("other"), box("high")],
      [
        { container_id: "other", slot: { bay: 14, row: 4, tier: 2 } },
        { container_id: "high", slot: { bay: 14, row: 2, tier: 84 } },
      ],
    );
    expect(dependentsLosingSupport(vessel, plan, without(plan, "other"), "other")).toEqual([]);
  });

  it("the deck boundary is not support: an on-deck box rests on the hatch cover", () => {
    const plan = planOf(
      [box("hold"), box("deck")],
      [
        { container_id: "hold", slot: { bay: 14, row: 2, tier: 10 } }, // top under-deck tier
        { container_id: "deck", slot: { bay: 14, row: 2, tier: 82 } }, // lowest on-deck tier
      ],
    );
    expect(dependentsLosingSupport(vessel, plan, without(plan, "hold"), "hold")).toEqual([]);
  });

  it("wording names the count and the ids", () => {
    expect(strandedMessage("A", ["B"])).toContain("1 container stands on this slot (B)");
    expect(strandedMessage("A", ["B", "C"])).toContain("2 containers stand on this slot (B, C)");
  });
});
