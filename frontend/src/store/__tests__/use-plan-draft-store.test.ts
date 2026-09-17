/**
 * usePlanDraftStore — exercised through getState()/setState() like the playback slice (plain Zustand
 * state and actions, no React render needed). The load-bearing assertions are the validate-then-mutate
 * ones: a rejected action must leave the plan BYTE-IDENTICAL (same object, same JSON, no history
 * entry), and `unplaced` must always equal containers minus placements.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { usePlanDraftStore } from "../usePlanDraftStore";
import { at, box, makePlan, makeTestVessel } from "@/engine/__tests__/test-vessel-fixture";
import type { BreakbulkCargo, Slot, StowagePlan, Vessel } from "@/types/domain";

const vessel: Vessel = makeTestVessel();
const state = () => usePlanDraftStore.getState();
const slot = (bay: number, row: number, tier: number): Slot => ({ bay, row, tier });
const load = (plan: StowagePlan) => state().loadPlan(vessel, plan);

const projectCargo = (id: string): BreakbulkCargo => ({
  id, category: "yacht", length_m: 20, width_m: 6, height_m: 5, weight_t: 30, kg_above_base_m: 2.5, pol: "A", pod: "B",
});

/** The invariant every mutation must preserve. */
const expectUnplacedConsistent = () => {
  const plan = state().plan!;
  const placed = new Set(plan.placements.map((p) => p.container_id));
  expect(plan.unplaced).toEqual(plan.containers.filter((c) => !placed.has(c.id)).map((c) => c.id));
};

beforeEach(() => {
  usePlanDraftStore.setState({ vessel: null, plan: null, past: [], future: [] });
});

describe("usePlanDraftStore", () => {
  it("loads a plan with its vessel and resets history", () => {
    load(makePlan([box("a")], []));
    expect(state().vessel).toBe(vessel);
    state().placeContainer("a", slot(2, 2, 82));
    expect(state().past).toHaveLength(1);

    const next = makePlan([box("a")], []);
    load(next);
    expect(state().plan).toBe(next);
    expect(state().past).toEqual([]); // the old plan's history does not carry over
    expect(state().future).toEqual([]);

    state().loadPlan(null, null); // vessel switch: draft cleared
    expect(state().plan).toBeNull();
  });

  it("places a valid container and derives `unplaced` from containers minus placements", () => {
    load(makePlan([box("a"), box("b")], []));
    expect(state().placeContainer("a", slot(2, 2, 82))).toEqual({ ok: true, reasons: [] });
    expect(state().plan!.placements).toEqual([at("a", 2, 2, 82)]);
    expectUnplacedConsistent();
    expect(state().plan!.unplaced).toEqual(["b"]);
    expect(state().past).toHaveLength(1);
  });

  it("rejects an invalid placement and leaves the plan byte-identical", () => {
    load(makePlan([box("a"), box("b")], [at("a", 2, 2, 82)]));
    const before = state().plan!;
    const snapshot = JSON.stringify(before);

    const result = state().placeContainer("b", slot(2, 2, 82));
    expect(result.ok).toBe(false);
    expect(result.reasons[0].rule).toBe("cell_conflict");
    expect(state().plan).toBe(before); // not even a copy was made
    expect(JSON.stringify(state().plan)).toBe(snapshot);
    expect(state().past).toEqual([]); // and no history entry
  });

  it("rejects an id that is not in the plan, and any action without a plan", () => {
    expect(state().placeContainer("a", slot(2, 2, 82)).reasons[0].rule).toBe("no_plan");
    load(makePlan([box("a")], []));
    expect(state().placeContainer("ghost", slot(2, 2, 82)).reasons[0].rule).toBe("unknown_container");
    expect(state().past).toEqual([]);
  });

  it("moves a container without conflicting with the position it is leaving", () => {
    load(makePlan([box("a")], [at("a", 2, 2, 82)]));
    expect(state().moveContainer("a", slot(2, 2, 82))).toEqual({ ok: true, reasons: [] }); // same slot
    expect(state().moveContainer("a", slot(6, 2, 82))).toEqual({ ok: true, reasons: [] });
    expect(state().plan!.placements).toEqual([at("a", 6, 2, 82)]); // replaced, never duplicated
    expectUnplacedConsistent();
  });

  it("rejects a move onto an occupied slot and keeps the original placement", () => {
    load(makePlan([box("a"), box("b")], [at("a", 2, 2, 82), at("b", 2, 2, 84)]));
    const before = state().plan!;
    const result = state().moveContainer("a", slot(2, 2, 84));
    expect(result.ok).toBe(false);
    expect(state().plan).toBe(before);
    expectUnplacedConsistent();
  });

  it("unplaces a container, and ignores one that was never placed", () => {
    load(makePlan([box("a"), box("b")], [at("a", 2, 2, 82)]));
    state().unplaceContainer("b");
    expect(state().past).toEqual([]); // nothing changed, so nothing to undo
    state().unplaceContainer("a");
    expect(state().plan!.placements).toEqual([]);
    expectUnplacedConsistent();
    expect(state().plan!.unplaced).toEqual(["a", "b"]);
    expect(state().past).toHaveLength(1);
  });

  it("undoes and redoes through the same plan objects, and stops at the ends", () => {
    load(makePlan([box("a")], []));
    const loaded = state().plan!;
    state().placeContainer("a", slot(2, 2, 82));
    const placed = state().plan!;

    state().undo();
    expect(state().plan).toBe(loaded);
    expect(state().future).toEqual([placed]);
    state().redo();
    expect(state().plan).toBe(placed);
    expect(state().future).toEqual([]);

    state().undo();
    state().undo(); // nothing left: a no-op, not a crash
    expect(state().plan).toBe(loaded);
    state().redo();
    state().redo();
    expect(state().plan).toBe(placed);
  });

  it("caps history at 100 entries, dropping the oldest", () => {
    load(makePlan([box("a")], [at("a", 2, 2, 82)]));
    for (let i = 0; i < 105; i++) {
      const moved = state().moveContainer("a", i % 2 === 0 ? slot(6, 2, 82) : slot(2, 2, 82));
      expect(moved.ok).toBe(true);
    }
    expect(state().past).toHaveLength(100);
  });

  it("applies a warning-only action and records the reason (D1)", () => {
    // The lower box is discharged first (VNSGN, sequence 0), the box going above it is not (MYPKG, 2).
    load(makePlan([box("lower", { pod: "VNSGN" }), box("upper", { pod: "MYPKG" })], [at("lower", 2, 2, 82)]));
    const result = state().placeContainer("upper", slot(2, 2, 84));
    expect(result).toEqual({
      ok: true,
      reasons: [{ rule: "overstow", message: "upper blocks lower (earlier discharge)", severity: "warning" }],
    });
    expect(state().plan!.placements).toHaveLength(2);
  });

  it("places, moves and unplaces project cargo through the same predicate", () => {
    // `makeTestVessel` declares no deck layout, so its weather deck is the D4 approximation and every
    // project-cargo drop in it records that warning. `ok: true` is the assertion that matters here —
    // the commit goes through, and the recorded reason is the SAME one the predicate returned.
    const approximate = {
      rule: "breakbulk_approximate_area",
      message: "weather deck: approximate area — no GA layout, so its extent is a fraction-of-LOA estimate",
      severity: "warning",
    };
    const plan = { ...makePlan([], []), breakbulk_cargo: [projectCargo("BB1")] };
    load(plan);
    expect(state().placeBreakbulk("BB1", { x_m: 30, z_m: 0 })).toEqual({ ok: true, reasons: [approximate] });
    expect(state().plan!.breakbulk_placements).toEqual([{ cargo_id: "BB1", x_m: 30, z_m: 0, rotation_deg: 0 }]);

    expect(state().moveBreakbulk("BB1", { x_m: 35, z_m: 0 })).toEqual({ ok: true, reasons: [approximate] });
    expect(state().plan!.breakbulk_placements).toEqual([{ cargo_id: "BB1", x_m: 35, z_m: 0, rotation_deg: 0 }]);

    const before = state().plan!;
    const outside = state().moveBreakbulk("BB1", { x_m: 5, z_m: 0 }); // off the usable deck
    expect(outside.ok).toBe(false);
    expect(outside.reasons[0].rule).toBe("breakbulk_out_of_deck_area");
    expect(state().plan).toBe(before);

    state().unplaceBreakbulk("BB1");
    expect(state().plan!.breakbulk_placements).toEqual([]);
    expectUnplacedConsistent();
  });

  it("keeps project cargo inside its stowage area id", () => {
    const plan = { ...makePlan([], []), breakbulk_cargo: [projectCargo("BB1")] };
    load(plan);
    expect(state().placeBreakbulk("BB1", { x_m: 30, z_m: 0, areaId: "hold_99" }).ok).toBe(false);
    expect(state().placeBreakbulk("BB1", { x_m: 30, z_m: 0, areaId: "hold_99" }).reasons[0].message).toBe(
      'BB1: unknown stowage area "hold_99"',
    );
    expect(state().plan).toBe(plan);
  });
});
