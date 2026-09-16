/**
 * placeholders — the slot sets behind the drop UI. The load-bearing assertions are: the two sets are
 * a PARTITION of `model.slots` derived from `canPlaceContainer` alone (no UI-local rule creeping in),
 * `blockedSlots` carries the FIRST blocking reason only, and the three-state verdict separates
 * "accepted but recorded" (amber) from "accepted clean" (green).
 *
 * FIXED 2026-09-16 (the defect this file used to document as open, `plans/reports/tester-260916-1955-*`):
 * `model.slots` now enumerates the 20' half bays too — 2400 slots on MV Demo Horizon (1600 odd) and
 * 1341 on BBC SAO PAULO (894 odd), against 800/447 before — so a 20' candidate is no longer refused by
 * the predicate with `slot_exists` on a slot `validatePlan` accepts. Nothing here asserts which bays
 * exist, only that the two sets partition whatever `model.slots` holds, so the sweeps below grew with
 * the model instead of needing a rewrite; the parity itself is pinned in
 * `twenty-foot-slot-parity.test.ts`.
 */
import { describe, expect, it } from "vitest";
import { canPlaceContainer } from "../can-place-container";
import { blockedReasonFor, blockedSlots, validSlotsFor, verdictOf } from "../placeholders";
import { blocks } from "../reason";
import { buildStowageModel, type SlotDef, type StowageModel } from "@/engine/stowage-model";
import { buildBbcSaoPauloVesselAndCargo } from "@/data/bbc-sao-paulo-vessel";
import { buildDemoVesselAndCargo, buildLoadedDemoPlan } from "@/data/build-demo-plan";
import { at, box, makePlan, makeTestVessel } from "@/engine/__tests__/test-vessel-fixture";
import type { Container, StowagePlan, Vessel } from "@/types/domain";

const fixture = makeTestVessel();
const fixtureModel = buildStowageModel(fixture);
const predicate = (plan: StowagePlan, container: Container, s: { bay: number; row: number; tier: number }) =>
  canPlaceContainer(fixtureModel, plan, container, s, fixture);

const bbc = buildBbcSaoPauloVesselAndCargo();
const demo = buildDemoVesselAndCargo();

/** The two real, selectable vessels with the actual demo load — the data the feature ships against. */
const REAL: [string, Vessel, StowagePlan, StowageModel][] = [
  ["MV Demo Horizon", demo.vessel, buildLoadedDemoPlan(demo.vessel, demo.containers), buildStowageModel(demo.vessel)],
  ["BBC SAO PAULO", bbc.vessel, buildLoadedDemoPlan(bbc.vessel, bbc.containers), buildStowageModel(bbc.vessel)],
];

/** The vessel's own answer to "has this tier a reefer plug" — read from `stacks`, not the predicate. */
const hasPlug = (vessel: Vessel, slot: SlotDef): boolean =>
  vessel.stacks.some(
    (s) => s.bay === slot.bay && s.row === slot.row && s.deck === slot.deck && s.reefer_tiers.includes(slot.tier),
  );

describe("validSlotsFor", () => {
  it("returns exactly the slots canPlaceContainer accepts, in the model's own order", () => {
    const plan = makePlan([box("taken")], [at("taken", 2, 2, 82)]);
    const candidate = box("cand");
    const expected = fixtureModel.slots.filter((s) => predicate(plan, candidate, s).ok).map((s) => s.key);

    expect(validSlotsFor(fixture, plan, candidate).map((s) => s.key)).toEqual(expected);
    expect(expected.length).toBeGreaterThan(0);
  });

  it("excludes an occupied slot and a tier with nothing under it, and keeps the supported ones", () => {
    const plan = makePlan([box("below")], [at("below", 2, 2, 82)]);
    const keys = new Set(validSlotsFor(fixture, plan, box("cand")).map((s) => s.key));

    expect(keys.has("2|2|82")).toBe(false); // cell_conflict: the slot is taken
    expect(keys.has("2|1|84")).toBe(false); // no_floating: row 1 has no box at tier 82
    expect(keys.has("2|1|82")).toBe(true); // bottom tier of that row — nothing is needed below
    expect(keys.has("2|2|84")).toBe(true); // stacked on the 40' box below it (both halves filled)
  });

  it("offers a loaded real vessel only slots with nothing in them", () => {
    for (const [label, vessel, plan] of REAL) {
      const occupied = new Set(plan.placements.map((p) => `${p.slot.bay}|${p.slot.row}|${p.slot.tier}`));
      const valid = validSlotsFor(vessel, plan, box("dry"));
      expect(valid.length, label).toBeGreaterThan(0);
      expect(valid.filter((s) => occupied.has(s.key)), label).toEqual([]);
    }
  });

  it("offers a reefer only plug tiers, and no more than a dry box of the same size", () => {
    for (const [label, vessel, plan] of REAL) {
      const reefer = validSlotsFor(vessel, plan, box("reefer", { type: "REEFER" }));
      expect(reefer.length, label).toBeGreaterThan(0);
      expect(reefer.filter((s) => !hasPlug(vessel, s)), label).toEqual([]);

      const dry = new Set(validSlotsFor(vessel, plan, box("dry")).map((s) => s.key));
      expect(reefer.filter((s) => !dry.has(s.key)), label).toEqual([]); // a plug is strictly extra
    }
  });

  // The reviewer's W9 trap: the predicate assumes the candidate is NOT already in `plan.placements`,
  // so a move preview must drop the subject's own placement first or the box's current slot comes
  // back blocked by a self-referencing conflict ("X and X occupy the same position").
  it("previews a MOVE of a placed box without a phantom self-conflict", () => {
    const plan = makePlan([box("a", { weight_t: 30 })], [at("a", 2, 2, 82)]);

    // Its own slot stays offerable, and the column does not double-count the box's own weight.
    expect(validSlotsFor(fixture, plan, box("a", { weight_t: 30 })).map((s) => s.key)).toContain("2|2|82");
    expect(blockedReasonFor(fixture, plan, box("a", { weight_t: 30 }), { bay: 2, row: 2, tier: 82 })).toBeNull();

    // And the un-stripped check really would have failed — the reason this helper exists.
    const asIs = predicate(plan, box("a", { weight_t: 30 }), { bay: 2, row: 2, tier: 82 });
    expect(asIs.ok).toBe(false);
    expect(asIs.reasons[0].message).toBe("a and a occupy the same position");
  });

  it("previews a MOVE against the SAME gate the store commits through", () => {
    for (const [label, vessel, plan] of REAL) {
      const placed = plan.containers.find((c) => plan.placements.some((p) => p.container_id === c.id))!;
      const ownSlot = plan.placements.find((p) => p.container_id === placed.id)!.slot;

      expect(blockedReasonFor(vessel, plan, placed, ownSlot), `${label} ${placed.id} @ its own slot`).toBeNull();
      expect(validSlotsFor(vessel, plan, placed).map((s) => s.key), label).toContain(
        `${ownSlot.bay}|${ownSlot.row}|${ownSlot.tier}`,
      );
    }
  });
});

describe("blockedSlots / blockedReasonFor", () => {
  it("carries one reason per blocked slot, and it is the FIRST error-severity one", () => {
    // Occupied AND over the stack limit: `cell_conflict` is pushed before `stack_weight`.
    const plan = makePlan([box("taken", { weight_t: 30 })], [at("taken", 2, 2, 82)]);
    const candidate = box("cand", { weight_t: 30 });
    const result = predicate(plan, candidate, { bay: 2, row: 2, tier: 82 });
    const blocked = blockedSlots(fixture, plan, candidate).find((b) => b.slot.key === "2|2|82");

    expect(blocked?.reason).toEqual(result.reasons.find(blocks));
    expect(blocked?.reason.rule).toBe("cell_conflict");
    expect(blocked?.reason.severity).toBe("error");
  });

  it("never lists a warning-only slot: a droppable slot belongs to validSlotsFor", () => {
    // `upper` discharges last (MYPKG), the candidate below it first (VNSGN) -> overstow warning only.
    const plan = makePlan([box("upper", { pod: "MYPKG" })], [at("upper", 2, 2, 84)]);
    const candidate = box("cand", { pod: "VNSGN" });

    expect(validSlotsFor(fixture, plan, candidate).some((s) => s.key === "2|2|82")).toBe(true);
    expect(blockedSlots(fixture, plan, candidate).some((b) => b.slot.key === "2|2|82")).toBe(false);
  });

  it("gives the hover path one slot's own reason without sweeping the rest", () => {
    const plan = makePlan([box("taken")], [at("taken", 2, 2, 82)]);

    expect(blockedReasonFor(fixture, plan, box("cand"), { bay: 2, row: 2, tier: 82 })?.rule).toBe("cell_conflict");
    expect(blockedReasonFor(fixture, plan, box("cand"), { bay: 2, row: 1, tier: 82 })).toBeNull();
  });

  it("partitions the model's slots: valid and blocked are disjoint and cover every slot", () => {
    for (const [label, vessel, plan, model] of REAL) {
      const valid = new Set(validSlotsFor(vessel, plan, box("dry")).map((s) => s.key));
      const blocked = blockedSlots(vessel, plan, box("dry"));

      expect(valid.size + blocked.length, label).toBe(model.slots.length);
      expect(blocked.filter((b) => valid.has(b.slot.key)), label).toEqual([]);
    }
  });

  // A clock guard, not a benchmark: it fails only if the predicate's per-plan index stops being
  // reused (the sweep would then rebuild it per slot). Threshold unchanged at 50 ms; the sweep itself
  // grew with the slot count (447 -> 1341 on BBC, 800 -> 2400 on the demo) and measures ≈2-6 ms.
  it("keeps a full sweep of a real vessel in single-digit milliseconds", () => {
    const t0 = performance.now();
    validSlotsFor(bbc.vessel, buildLoadedDemoPlan(bbc.vessel, bbc.containers), box("dry"));
    expect(performance.now() - t0).toBeLessThan(50);
  });
});

describe("verdictOf", () => {
  it("is red when blocked, amber when accepted with a recorded reason, green when clean", () => {
    const plan = makePlan([box("taken")], [at("taken", 2, 2, 82)]);
    expect(verdictOf(predicate(plan, box("cand"), { bay: 2, row: 2, tier: 82 }))).toBe("invalid");
    expect(verdictOf(predicate(plan, box("cand"), { bay: 2, row: 1, tier: 82 }))).toBe("valid");

    const overstow = makePlan([box("upper", { pod: "MYPKG" })], [at("upper", 2, 2, 84)]);
    expect(verdictOf(predicate(overstow, box("cand", { pod: "VNSGN" }), { bay: 2, row: 2, tier: 82 }))).toBe("warning");
  });
});
