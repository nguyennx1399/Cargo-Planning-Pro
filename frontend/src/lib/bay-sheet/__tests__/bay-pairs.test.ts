/**
 * The bay sheet model (all-bay overview, phase 01). The load-bearing case is the 20' regression: the old
 * bay view kept `slot.bay === 40' bay` and so never showed a 20' box. Here every box must appear —
 * a 20' once, in its own odd section; a 40' twice, drawn fore and marked × aft.
 */
import { describe, expect, it } from "vitest";
import type { StowagePlan, ValidationReport, Vessel } from "@/types/domain";
import { getVesselCatalogEntry } from "@/data/vessel-catalog";
import { buildDemoPlan } from "@/data/build-demo-plan";
import { validatePlan } from "@/engine/validate-plan";
import { buildValidationContext } from "@/engine/validation-context";
import { buildStowageModel } from "@/engine/stowage-model";
import { deckOf, parseSlotCode, bayPosition, slotCode } from "@/engine/slot-helpers";
import { at, box, makePlan, makeTestVessel } from "@/engine/__tests__/test-vessel-fixture";
import { buildBayPairs } from "../bay-pair-facts";
import { sheetCellKey, stackSlotKey } from "../bay-pairs";

/** The demo fill never places a 20' box (it leaves them all unplaced), so each real plan gets a few put
 * into empty half-bay slots by hand — exactly what a planner does, and exactly what the old view lost. */
function withTwentyFooters(vessel: Vessel, plan: StowagePlan, n: number): StowagePlan {
  const placed = new Set(plan.placements.map((p) => p.container_id));
  const twenties = plan.containers.filter((c) => c.size === "20" && !placed.has(c.id)).slice(0, n);
  const taken = new Set(plan.placements.map((p) => `${bayPosition(p.slot.bay, vessel.bays)?.fortyBay}|${p.slot.row}|${p.slot.tier}`));
  const halves = buildStowageModel(vessel).slots.filter((s) => s.bay % 2 === 1 && !taken.has(`${bayPosition(s.bay, vessel.bays)?.fortyBay}|${s.row}|${s.tier}`));
  const extra = twenties.map((c, i) => ({ container_id: c.id, slot: { bay: halves[i * 7].bay, row: halves[i * 7].row, tier: halves[i * 7].tier } }));
  return { ...plan, placements: [...plan.placements, ...extra] };
}

const demo = (id: string) => {
  const { vessel, containers } = getVesselCatalogEntry(id);
  const plan = buildDemoPlan(vessel, containers, { cargoLoaded: true, projectCargoLoaded: true });
  return { vessel, plan: withTwentyFooters(vessel, plan, 3) };
};

describe.each(["bbc-sao-paulo", "demo-horizon"])("%s", (id) => {
  const { vessel, plan } = demo(id);
  const pairs = buildBayPairs(vessel, plan, undefined, null);

  it("maps every placement to a bay (no half without a parent)", () => {
    expect(buildValidationContext(vessel, plan).unmapped).toEqual([]);
  });

  it("draws every box: a 20' once in its own odd section, a 40' twice (fore + × aft)", () => {
    const seen = new Map<string, string[]>();
    for (const pair of pairs) {
      for (const section of [pair.fore, pair.aft]) {
        for (const cell of section.cells.values()) seen.set(cell.box.id, [...(seen.get(cell.box.id) ?? []), cell.kind]);
      }
    }
    const sizeOf = new Map(plan.containers.map((c) => [c.id, c.size]));
    for (const p of plan.placements) {
      const kinds = seen.get(p.container_id) ?? [];
      if (sizeOf.get(p.container_id) === "20") expect(kinds).toEqual(["twenty"]);
      else expect(kinds.sort()).toEqual(["forty", "fortyTail"]);
    }
    const counted = pairs.reduce((sum, p) => sum + p.facts.n20 + p.facts.n40, 0);
    expect(counted).toBe(plan.placements.length);
  });

  it("puts a 20' box in the section of its own odd bay, at its row and tier", () => {
    for (const p of plan.placements.filter((q) => q.slot.bay % 2 === 1)) {
      const pair = pairs.find((q) => q.fore.bay === p.slot.bay || q.aft.bay === p.slot.bay)!;
      const section = pair.fore.bay === p.slot.bay ? pair.fore : pair.aft;
      expect(section.cells.get(sheetCellKey(p.slot.row, p.slot.tier))?.box.id).toBe(p.container_id);
    }
  });

  it("weighs the ship: every pair's weight sums to the placed boxes' weight", () => {
    const byId = new Map(plan.containers.map((c) => [c.id, c.weight_t]));
    const placed = plan.placements.reduce((sum, p) => sum + (byId.get(p.container_id) ?? 0), 0);
    expect(pairs.reduce((sum, p) => sum + p.facts.weightT, 0)).toBeCloseTo(placed, 6);
  });

  it("lists each project-cargo item under the deck its area belongs to", () => {
    for (const p of plan.breakbulk_placements) {
      const deck = (p.area_id ?? "weather_deck") === "weather_deck" ? "on" : "under";
      const other = deck === "on" ? "under" : "on";
      expect(pairs.some((q) => q.facts.projectCargo[deck].includes(p.cargo_id))).toBe(true);
      expect(pairs.some((q) => q.facts.projectCargo[other].includes(p.cargo_id))).toBe(false);
    }
  });
});

it("really exercises 20' boxes on both ships (the regression would pass vacuously otherwise)", () => {
  for (const id of ["bbc-sao-paulo", "demo-horizon"]) {
    expect(demo(id).plan.placements.filter((p) => p.slot.bay % 2 === 1)).toHaveLength(3);
  }
});

describe("stack weights are the stack_weight rule's own numbers", () => {
  it("marks over exactly the stacks the report lists", () => {
    const { vessel: base, plan } = demo("demo-horizon");
    // Tighten every limit so some stacks fail, then compare against the real rule.
    const vessel: Vessel = { ...base, stacks: base.stacks.map((s) => ({ ...s, max_weight_t: 30 })) };
    const report = validatePlan(vessel, plan);
    const flagged = new Set(
      report.violations
        .filter((v) => v.rule === "stack_weight")
        .map((v) => {
          const slot = parseSlotCode(v.slots[0]);
          return `${bayPosition(slot.bay, vessel.bays)!.fortyBay}|${stackSlotKey(deckOf(slot.tier), slot.row)}`;
        }),
    );
    expect(flagged.size).toBeGreaterThan(0);
    const over = new Set<string>();
    for (const pair of buildBayPairs(vessel, plan, report, null)) {
      for (const [key, w] of pair.stackWeights) if (w.over) over.add(`${pair.fortyBay}|${key}`);
    }
    expect(over).toEqual(flagged);
  });
});

describe("facts on a hand-built plan", () => {
  const vessel = makeTestVessel(); // bays 02 (01|03) and 06 (05|07), rows 2/1, tiers 02/04 and 82/84
  const plan: StowagePlan = makePlan(
    [box("F40"), box("T20", { size: "20", weight_t: 5 })],
    [at("F40", 2, 2, 2), at("T20", 1, 2, 4)],
  );

  it("counts free TEU: an empty cell 2, a cell with one 20' 1, a 40' 0", () => {
    const [bay02] = buildBayPairs(vessel, plan, undefined, null);
    expect(bay02.facts).toMatchObject({ n20: 1, n40: 1, weightT: 15 });
    expect(bay02.facts.freeTeu).toBe(8 * 2 - 2 - 1); // 8 cells in bay 02
  });

  it("marks a bay by its worst violation, and ignores violations without slots", () => {
    const report: ValidationReport = {
      ok: false,
      kpis: {},
      violations: [
        { rule: "overstow", severity: "warning", message: "x", container_ids: ["T20"], slots: [slotCode({ bay: 1, row: 2, tier: 4 })] },
        { rule: "breakbulk_overlap", severity: "error", message: "y", container_ids: [], slots: [] },
      ],
    };
    const [bay02, bay06] = buildBayPairs(vessel, plan, report, null);
    expect(bay02.facts.worst).toBe("warning");
    expect(bay06.facts.worst).toBeNull();
  });

  it("follows the loading-sequence playback", () => {
    const [bay02] = buildBayPairs(vessel, plan, undefined, 1);
    expect(bay02.facts.n40 + bay02.facts.n20).toBe(1);
  });
});
