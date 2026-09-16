/**
 * canPlaceContainer — the per-slot checks behind the drop preview, the placeholders and the store's
 * commit. The message-parity test at the end is the load-bearing one: the ghost may never promise a
 * slot the report would then flag.
 */
import { describe, expect, it } from "vitest";
import { canPlaceContainer } from "../can-place-container";
import { buildStowageModel } from "@/engine/stowage-model";
import { validatePlan } from "@/engine/validate-plan";
import { at, box, makePlan, makeTestVessel, TEST_PORTS } from "@/engine/__tests__/test-vessel-fixture";
import type { Container, StowagePlan, Vessel } from "@/types/domain";

const vessel = makeTestVessel();
const model = buildStowageModel(vessel);
const emptyPlan = makePlan([], []);
const place = (plan: StowagePlan, container: Container, bay: number, row: number, tier: number) =>
  canPlaceContainer(model, plan, container, { bay, row, tier }, vessel);
const rules = (result: { reasons: { rule: string }[] }) => result.reasons.map((r) => r.rule);

describe("canPlaceContainer", () => {
  it("accepts an empty slot on the bottom tier (nothing below, nothing to conflict with)", () => {
    const result = place(emptyPlan, box("c1"), 2, 2, 82);
    expect(result).toEqual({ ok: true, reasons: [] });
  });

  it("rejects a slot that already carries a box in the same 20' half", () => {
    const plan = makePlan([box("a"), box("b")], [at("a", 2, 2, 82)]);
    const result = place(plan, box("b"), 2, 2, 82);
    expect(result.ok).toBe(false);
    expect(result.reasons[0].rule).toBe("cell_conflict");
    expect(result.reasons[0].severity).toBe("error");
  });

  it("rejects a 40' box in a 20' bay and a 20' box in a 40' bay", () => {
    expect(rules(place(emptyPlan, box("a"), 1, 2, 82))).toContain("size_fits_bay");
    expect(rules(place(emptyPlan, box("a", { size: "20" }), 2, 2, 82))).toContain("size_fits_bay");
  });

  it("distinguishes a bay the vessel does not have from a tier it does not have", () => {
    const missingBay = place(emptyPlan, box("a"), 99, 2, 82);
    expect(missingBay.reasons[0].message).toBe("a: bay 99 does not exist on vessel");
    const missingTier = place(emptyPlan, box("a"), 2, 2, 86);
    expect(missingTier.reasons[0].message).toBe("a: slot does not exist on vessel");
  });

  it("rejects a reefer without a plug and accepts the one tier that has it (bay 6 tier 82)", () => {
    const reefer = box("r", { type: "REEFER" });
    expect(rules(place(emptyPlan, reefer, 2, 2, 82))).toContain("reefer_plug");
    expect(place(emptyPlan, reefer, 6, 2, 82).ok).toBe(true);
    expect(rules(place(emptyPlan, reefer, 6, 2, 84))).toContain("reefer_plug"); // 84 has no plug
  });

  it("rejects a floating box but exempts the bottom tier of the stack", () => {
    const floating = place(emptyPlan, box("b"), 2, 2, 84); // tier 82 below is empty
    expect(rules(floating)).toContain("no_floating");
    expect(floating.reasons[0].message).toBe("b: no container below (fore half of tier 82 empty)");
    expect(place(emptyPlan, box("b"), 2, 2, 82).ok).toBe(true); // bottom tier: nothing needed below
  });

  it("rejects a box that would push the stack over its weight limit", () => {
    const plan = makePlan([box("a", { weight_t: 30 })], [at("a", 2, 2, 82)]);
    const result = canPlaceContainer(model, plan, box("c", { weight_t: 15 }), { bay: 2, row: 2, tier: 84 }, vessel);
    expect(rules(result)).toContain("stack_weight");
    expect(result.reasons[0].message).toBe("Stack bay 02 row 02 (on deck): 45.0t > limit 40t");
    // 30 t placed + 15 t candidate vs the stack's 40 t limit
  });

  it("rejects a high-cube box that does not fit the stack's declared clear height", () => {
    const low: Vessel = {
      ...vessel,
      stacks: vessel.stacks.map((s) => (s.bay === 2 && s.row === 2 && s.deck === "under" ? { ...s, max_height_m: 2.7 } : s)),
    };
    const under = (c: Container) => canPlaceContainer(buildStowageModel(low), makePlan([], []), c, { bay: 2, row: 2, tier: 2 }, low);
    expect(rules(under(box("hc", { high_cube: true })))).toContain("max_height"); // 2.896 m > 2.7 m
    expect(under(box("std")).ok).toBe(true); // 2.591 m fits
  });

  it("rejects a slot a breakbulk item already occupies in the same area", () => {
    const item = { id: "BB1", category: "yacht" as const, length_m: 20, width_m: 6, height_m: 5, weight_t: 30, kg_above_base_m: 2.5, pol: "A", pod: "B" };
    const plan: StowagePlan = {
      ...makePlan([], []),
      breakbulk_cargo: [item],
      // bay 2 row 2 sits at x_m ≈ 31.3, z_m ≈ −1.25 on this fixture
      breakbulk_placements: [{ cargo_id: "BB1", x_m: 31.3, z_m: -1.25, rotation_deg: 0 }],
    };
    const result = place(plan, box("a"), 2, 2, 82);
    expect(rules(result)).toContain("breakbulk_overlaps_container");
    expect(result.reasons[0].message).toBe("a: slot overlaps breakbulk cargo in weather deck");
  });

  it("warns, without blocking, when the candidate would be discharged before the box above it", () => {
    // Lower box goes to MYPKG (sequence 2, last), the candidate to VNSGN (sequence 0, first).
    const plan = makePlan([box("upper", { pod: "MYPKG" })], [at("upper", 2, 2, 84)]);
    const result = canPlaceContainer(model, plan, box("cand", { pod: "VNSGN" }), { bay: 2, row: 2, tier: 82 }, vessel);
    expect(result.ok).toBe(true); // D1: overstow is an overridable limit, not a block
    expect(result.reasons).toHaveLength(1);
    expect(result.reasons[0]).toEqual({
      rule: "overstow",
      message: "upper blocks cand (earlier discharge)",
      severity: "warning",
    });
  });

  it("does not warn when the box above is discharged later than the candidate", () => {
    const plan = makePlan([box("upper", { pod: "VNSGN" })], [at("upper", 2, 2, 84)]);
    const result = canPlaceContainer(model, plan, box("cand", { pod: "MYPKG" }), { bay: 2, row: 2, tier: 82 }, vessel);
    expect(result).toEqual({ ok: true, reasons: [] });
  });

  // Selection parity, not just wording: a 3-box column where the box above the candidate is not the
  // first one with a later POD. The rule names only the NEAREST blocker, so evaluating a box in this
  // column must never name a pair the report does not contain — the 2-box column above cannot catch
  // this, because there "nearest" and "every box above" are the same thing (the real demo plans drifted
  // by +18 and +99 pairs before this, and Phase C's tooltip would have blamed the wrong box).
  it("names only the nearest higher-POD blocker on a 3-box column, exactly as the report does", () => {
    const plan = makePlan(
      [box("t82", { pod: "VNSGN" }), box("t84", { pod: "SGSIN" }), box("t86", { pod: "MYPKG" })],
      [at("t82", 2, 2, 82), at("t84", 2, 2, 84), at("t86", 2, 2, 86)],
    );
    // POD sequences VNSGN 0 < SGSIN 1 < MYPKG 2. The committed box is stripped first, as the store does.
    const evaluated = (id: string): string[] => {
      const stripped: StowagePlan = { ...plan, placements: plan.placements.filter((p) => p.container_id !== id) };
      const container = plan.containers.find((c) => c.id === id)!;
      const slot = plan.placements.find((p) => p.container_id === id)!.slot;
      return canPlaceContainer(model, stripped, container, slot, vessel).reasons
        .filter((r) => r.rule === "overstow").map((r) => r.message);
    };
    expect(evaluated("t82")).toEqual(["t84 blocks t82 (earlier discharge)"]);
    // For the top box the nearer blocker is t84, so "t86 blocks t82" — the all-pairs over-report — is
    // not a pair the report ever lists.
    expect(evaluated("t86")).toEqual(["t86 blocks t84 (earlier discharge)"]);
    const reported = validatePlan(vessel, plan).violations.filter((v) => v.rule === "overstow").map((v) => v.message);
    expect(reported).toEqual(["t84 blocks t82 (earlier discharge)", "t86 blocks t84 (earlier discharge)"]);
    expect([...new Set(["t82", "t84", "t86"].flatMap(evaluated))].sort()).toEqual([...reported].sort());
  });

  // Code review H2, verified as a false green before it shipped: `twenty_on_forty` is a blocking
  // `error` in the report but was missing from the predicate, so a 20' box dropped onto a 40' below
  // showed a green ghost and then appeared in the violation list. Unreachable until the model grew
  // its 20' half slots — bay 3 is the AFT half of bay 2's cell (bayPosition), which the 40' fills.
  it("blocks a 20' box standing on a 40' below it, with the plan rule's own message", () => {
    const plan = makePlan([box("forty")], [at("forty", 2, 2, 82)]);
    const result = place(plan, box("twenty", { size: "20" }), 3, 2, 84);
    const reason = result.reasons.find((r) => r.rule === "twenty_on_forty")!;

    expect(result.ok).toBe(false);
    expect(reason.severity).toBe("error");
    expect(reason.message).toBe("twenty: 20' stowed on top of 40' forty");

    const committed = makePlan(
      [box("forty"), box("twenty", { size: "20" })],
      [at("forty", 2, 2, 82), at("twenty", 3, 2, 84)],
    );
    expect(validatePlan(vessel, committed).violations.map((v) => v.message)).toContain(reason.message);
  });

  it("accepts a 20' on a 20' in the same half — only a non-20' below lacks corner castings", () => {
    const plan = makePlan([box("below", { size: "20" })], [at("below", 1, 2, 82)]);
    const result = place(plan, box("above", { size: "20" }), 1, 2, 84);

    expect(rules(result)).not.toContain("twenty_on_forty");
    expect(result.ok).toBe(true);
  });

  it("reports every blocking check at once instead of stopping at the first", () => {
    const plan = makePlan([box("a", { weight_t: 30 })], [at("a", 2, 2, 82)]);
    const result = canPlaceContainer(model, plan, box("dup", { weight_t: 30 }), { bay: 2, row: 2, tier: 82 }, vessel);
    expect(rules(result).sort()).toEqual(["cell_conflict", "stack_weight"]); // occupied AND over the limit
  });

  // The risk-table mitigation: a rejected candidate must produce the very same wording the plan-wide
  // rule produces once the box is committed, or the tooltip and the violation list disagree. Each row
  // sets up the prior placements its own rule needs (an empty tier below for `no_floating`, weight
  // under the candidate for `stack_weight`).
  it.each([
    ["cell_conflict", box("dup"), 82, [at("first", 2, 2, 82)]],
    ["no_floating", box("dup"), 84, []],
    ["size_fits_bay", box("dup", { size: "20" }), 84, []],
    ["reefer_plug", box("dup", { type: "REEFER" }), 84, []],
    ["stack_weight", box("dup", { weight_t: 30 }), 84, [at("first", 2, 2, 82)]],
  ] as const)("uses the plan rule's own message for %s", (rule, candidate, tier, priorPlacements) => {
    const before = makePlan([box("first", { weight_t: 30 })], [...priorPlacements]);
    const result = canPlaceContainer(model, before, candidate, { bay: 2, row: 2, tier }, vessel);
    const reason = result.reasons.find((r) => r.rule === rule);
    expect(reason, `no ${rule} reason`).toBeDefined();

    const committed = makePlan(
      [box("first", { weight_t: 30 }), candidate],
      [...priorPlacements, at("dup", 2, 2, tier)],
    );
    const reported = validatePlan(vessel, committed).violations.filter((v) => v.rule === rule).map((v) => v.message);
    expect(reported).toContain(reason!.message);
  });

  it("keeps ports on the plan so the overstow sequence survives a plan copy", () => {
    expect(makePlan([], []).ports).toEqual(TEST_PORTS);
  });
});
