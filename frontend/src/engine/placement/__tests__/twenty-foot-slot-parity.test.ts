/**
 * 20' half-slot acceptance test — the fix for the REOPENED Phase A defect, on the app's own plans.
 *
 * The defect: `buildStowageModel`'s slot list came from `vessel.stacks[].bay`, i.e. the EVEN (40')
 * bays only, while `slot-helpers.bayPosition` maps an ODD bay onto its parent 40' bay's fore/aft half
 * and `validation-rules.slotExists` accepts those. So `canPlaceContainer(20' @ bay 3)` was blocked
 * with `slot_exists` while `validatePlan` called the identical placement clean, and a 20' box had
 * ZERO usable slots on both app vessels (400 of the demo's 886 containers are 20').
 *
 * What this file requires: for a 20' AND a 40' candidate (plus a 20' reefer, which exercises the plug
 * rule on half slots), on both real vessels and their real plans, every slot of the model must produce
 * the SAME shared rule ids from the predicate and from the report — no predicate-blocked/report-clean
 * case and no predicate-clean/report-blocked case. The styles mirror `predicate-report-parity.test.ts`,
 * which does the same for `overstow` and `areaId ""`.
 *
 * Two sweeps, deliberately:
 *  - every slot against a column-scoped plan (all a shared rule reads for ONE candidate);
 *  - a spread of slots against the UNREDUCED plan, which proves that reduction on the real data.
 */
import { describe, expect, it } from "vitest";
import { buildDemoPlan } from "@/data/build-demo-plan";
import { getVesselCatalogEntry } from "@/data/vessel-catalog";
import { canPlaceContainer } from "../can-place-container";
import { validSlotsFor } from "../placeholders";
import { bayPosition, deckOf } from "@/engine/slot-helpers";
import { buildStowageModel, type SlotDef } from "@/engine/stowage-model";
import { validatePlan } from "@/engine/validate-plan";
import type { Container, Placement, Slot, StowagePlan, Vessel, Violation } from "@/types/domain";

/** The app's own defaults (`App.tsx`), the plans the feature ships against. */
const appToggles = (vessel: Vessel) => ({
  cargoLoaded: vessel.bays.length > 0,
  projectCargoLoaded: vessel.bays.length === 0 || vessel.breakbulk_deck !== undefined,
});

/** The rule ids the predicate and the report BOTH own. `max_height` is predicate-only (the report has
 * no clearance rule at all), so the predicate can refuse a drop the report stays silent about — the
 * safe direction — and it is deliberately not part of the comparison. */
const SHARED_RULES: ReadonlySet<string> = new Set([
  "slot_exists",
  "size_fits_bay",
  "cell_conflict",
  "twenty_on_forty",
  "no_floating",
  "stack_weight",
  "reefer_plug",
  "overstow",
  "breakbulk_overlaps_container",
]);

/** A box the plan does not know yet — what a drag carries before it is committed. POD = the first
 * port, so the overstow sequences are the real ones. */
const candidateOf = (size: "20" | "40", pod: string): Container => ({
  id: `CAND-${size}`, size, type: "DRY", high_cube: false, weight_t: 8, pol: "VNSGN", pod, imdg_class: null, oog: false,
});

const ruleIds = (rules: Iterable<string>): string[] => [...new Set(rules)].sort();

/** `breakbulk_overlaps_container` is reported from the BREAKBULK side (its wrapper attributes it to
 * the breakbulk item), so for that rule the candidate is matched by the stack bay/row its message
 * names rather than by `container_ids`. */
const STACK_IN_MESSAGE = /container stack bay (\d+) row (\d+)$/;
function touches(violation: Violation, id: string, slot: Slot): boolean {
  if (violation.container_ids.includes(id)) return true;
  const match = STACK_IN_MESSAGE.exec(violation.message);
  return match !== null && Number(match[1]) === slot.bay && Number(match[2]) === slot.row;
}

/** The shared rule ids `plan` produces for ONE candidate standing at `slot`. */
function reportRulesFor(vessel: Vessel, plan: StowagePlan, candidate: Container, slot: Slot): string[] {
  return ruleIds(
    validatePlan(vessel, plan)
      .violations.filter((v) => SHARED_RULES.has(v.rule) && touches(v, candidate.id, slot))
      .map((v) => v.rule),
  );
}

/** `plan` with the candidate committed at `slot`. */
const committedPlan = (plan: StowagePlan, candidate: Container, slot: Slot): StowagePlan => ({
  ...plan,
  containers: [...plan.containers, candidate],
  placements: [...plan.placements, { container_id: candidate.id, slot }],
});

/** `plan` reduced to the candidate's own 40' column (same fortyBay/row/deck, every tier) — the only
 * placements any shared rule reads when it judges one candidate: its cell, its column, and (for the
 * breakbulk rule) the whole project-cargo set, which is carried over untouched. */
function columnPlan(vessel: Vessel, plan: StowagePlan, candidate: Container, slot: Slot): StowagePlan {
  const pos = bayPosition(slot.bay, vessel.bays)!;
  const inColumn = (p: Placement): boolean => {
    const other = bayPosition(p.slot.bay, vessel.bays);
    return other?.fortyBay === pos.fortyBay && p.slot.row === slot.row && deckOf(p.slot.tier) === deckOf(slot.tier);
  };
  const ids = new Set(plan.placements.filter(inColumn).map((p) => p.container_id));
  return {
    ...plan,
    containers: [...plan.containers.filter((c) => ids.has(c.id)), candidate],
    placements: [...plan.placements.filter(inColumn), { container_id: candidate.id, slot }],
  };
}

// Before the half-slots existed, the 20' candidate was blocked with `slot_exists` on all 2400 demo
// slots (1600 odd + 800 even) while the report called the odd-bay placements clean, and on BBC it was
// blocked on all 1341. Both sweeps below failed.
describe.each(["bbc-sao-paulo", "demo-horizon"] as const)("20'/40' slot parity on %s", (vesselId) => {
  const { vessel, containers } = getVesselCatalogEntry(vesselId);
  const plan = buildDemoPlan(vessel, containers, appToggles(vessel));
  const model = buildStowageModel(vessel);

  it("names the same rules as the report on every slot, for a 20' and a 40' candidate", () => {
    const evidence: string[] = [];
    for (const size of ["20", "40"] as const) {
      const candidate = candidateOf(size, plan.ports[0].locode);
      const mismatches: string[] = [];
      let droppable = 0;
      for (const slot of model.slots) {
        const result = canPlaceContainer(model, plan, candidate, slot, vessel);
        if (result.ok) droppable++;
        const predicate = ruleIds(result.reasons.map((r) => r.rule).filter((r) => SHARED_RULES.has(r)));
        const reported = reportRulesFor(vessel, columnPlan(vessel, plan, candidate, slot), candidate, slot);
        if (predicate.join() !== reported.join()) {
          mismatches.push(`${size}' @ ${slot.key}: predicate [${predicate}] vs report [${reported}]`);
        }
      }
      // A predicate-blocked/report-clean case and a predicate-clean/report-blocked case both land
      // here; the first ten name the cause.
      expect(mismatches.slice(0, 10), `${vesselId} ${size}'`).toEqual([]);
      expect(droppable, `${vesselId} ${size}' has usable slots`).toBeGreaterThan(0);
      evidence.push(`${size}': ${droppable} droppable of ${model.slots.length}`);
    }
    expect(evidence).toHaveLength(2); // both sizes actually swept
  });

  it("offers the 20' candidate odd bays only, and the 40' candidate none of them", () => {
    const twenty = validSlotsFor(vessel, plan, candidateOf("20", plan.ports[0].locode));
    const forty = validSlotsFor(vessel, plan, candidateOf("40", plan.ports[0].locode));
    expect(twenty.length).toBeGreaterThan(0); // the defect: this was 0 on both vessels
    expect(twenty.every((s: SlotDef) => s.bay % 2 === 1)).toBe(true);
    expect(forty.length).toBeGreaterThan(0);
    expect(forty.some((s: SlotDef) => s.bay % 2 === 1)).toBe(false);
  });

  it("gives the plan's OWN unplaced 20' boxes droppable odd bays the report accepts too", () => {
    // The cargo the defect stranded: 400 of the demo vessel's 886 containers are 20' and every one of
    // them was unplaced, on both vessels. This is the planner-facing claim — a 20' box the auto-fill
    // left behind can now be dropped by hand, and the report agrees with the ghost.
    const unplaced = plan.containers.filter(
      (c) => c.size === "20" && !plan.placements.some((p) => p.container_id === c.id),
    );
    expect(unplaced.length).toBeGreaterThan(0);
    const box = unplaced[0];

    let slot: Slot | undefined;
    let predicate: string[] = [];
    for (const candidate of model.slots) {
      const result = canPlaceContainer(model, plan, box, candidate, vessel);
      if (!result.ok) continue;
      slot = candidate;
      predicate = ruleIds(result.reasons.map((r) => r.rule).filter((r) => SHARED_RULES.has(r)));
      break;
    }
    expect(slot, `${vesselId}: no droppable slot for ${box.id}`).toBeDefined();
    expect(slot!.bay % 2).toBe(1); // a 20' box goes in a 20' (odd) bay
    expect(predicate).not.toContain("slot_exists"); // the exact pre-fix failure
    expect(reportRulesFor(vessel, committedPlan(plan, box, slot!), box, slot!)).toEqual(predicate);
  });

  it("agrees on a 20' REEFER too, so the plug rule is compared on half slots as well", () => {
    // A reefers-only plug list is a StackSpec field, and a half-slot's stack is its 40' parent — the
    // case the tester listed as uncovered ("20' candidate in a 20' bay"). The counter keeps the sweep
    // from passing vacuously if the rule never fired.
    const reefer: Container = { ...candidateOf("20", plan.ports[0].locode), type: "REEFER", weight_t: 18 };
    const mismatches: string[] = [];
    let plugSlots = 0;
    for (const slot of model.slots) {
      const result = canPlaceContainer(model, plan, reefer, slot, vessel);
      if (result.reasons.some((r) => r.rule === "reefer_plug")) plugSlots++;
      const predicate = ruleIds(result.reasons.map((r) => r.rule).filter((r) => SHARED_RULES.has(r)));
      const reported = reportRulesFor(vessel, columnPlan(vessel, plan, reefer, slot), reefer, slot);
      if (predicate.join() !== reported.join()) mismatches.push(`${slot.key}: [${predicate}] vs [${reported}]`);
    }
    expect(mismatches.slice(0, 10), `${vesselId} 20' reefer`).toEqual([]);
    expect(plugSlots, `${vesselId} reefer_plug fired nowhere`).toBeGreaterThan(0);
  });

  it("matches the unreduced plan's verdict on a spread of slots", () => {
    const step = Math.max(1, Math.floor(model.slots.length / 60));
    const sampled = model.slots.filter((_, i) => i % step === 0);
    for (const size of ["20", "40"] as const) {
      const candidate = candidateOf(size, plan.ports[0].locode);
      for (const slot of sampled) {
        expect(reportRulesFor(vessel, committedPlan(plan, candidate, slot), candidate, slot),
          `${vesselId} ${size}' @ slot ${slot.key}`)
          .toEqual(reportRulesFor(vessel, columnPlan(vessel, plan, candidate, slot), candidate, slot));
      }
    }
  });
});
