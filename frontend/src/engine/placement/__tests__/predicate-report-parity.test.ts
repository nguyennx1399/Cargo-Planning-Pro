/**
 * Predicate-vs-report parity — the phase's validator-first invariant ("if the UI and the report can
 * disagree, the phase is wrong") on the app's OWN default plans, not on crafted fixtures.
 *
 * Why this file exists: the crafted unit tests pin each rule's wording, but two drift modes are only
 * visible at scale. `overstow` (review H1) paired a candidate with every higher-POD box in its column
 * while the report names only the NEAREST blocker above each lower box — +18 pairs on BBC SAO PAULO
 * (54 vs 36) and +99 on the demo vessel (298 vs 199), which a Phase C tooltip would have shown as a
 * blocker the violation list never mentions. `areaId: ""` (review W1) was normalised for the area
 * lookup but not for the container-stack occupancy, so a preview skipped a check the committed drop
 * runs. Both are unreachable-by-construction drift, hence tests on the real data and on the exact
 * input shape the store produces.
 *
 * The 20'/40' half-slot acceptance test lives in `twenty-foot-slot-parity.test.ts` (same idea, one
 * slot sweep per candidate size on both vessels).
 */
import { describe, expect, it } from "vitest";
import { buildDemoPlan } from "@/data/build-demo-plan";
import { getVesselCatalogEntry } from "@/data/vessel-catalog";
import { canPlaceBreakbulk } from "../can-place-breakbulk";
import { canPlaceContainer } from "../can-place-container";
import { breakbulkOverlapsContainer } from "@/engine/breakbulk-validation-rules";
import { buildStowageModel } from "@/engine/stowage-model";
import { validatePlan } from "@/engine/validate-plan";
import type { BreakbulkCargo, BreakbulkPlacement, Placement, StowagePlan, Vessel } from "@/types/domain";

/** The app's own defaults (`App.tsx`): containers load when the vessel has a grid, project cargo when
 * it has no grid or declares a breakbulk deck. */
const appToggles = (vessel: Vessel) => ({
  cargoLoaded: vessel.bays.length > 0,
  projectCargoLoaded: vessel.bays.length === 0 || vessel.breakbulk_deck !== undefined,
});

const parsePair = (message: string): string => {
  const m = /^(.+) blocks (.+) \(earlier discharge\)$/.exec(message);
  if (!m) throw new Error(`not an overstow message: ${message}`);
  return `${m[2]}<-${m[1]}`; // "lower<-blocker", so the two sources compare as sets
};

/** Every overstow pair the predicate names across the plan, evaluated the way the store commits a
 * placement: the subject's own placement is stripped first, so it never conflicts with itself. */
function predicatePairs(vessel: Vessel, plan: StowagePlan): string[] {
  const model = buildStowageModel(vessel);
  const out = new Set<string>();
  for (const placement of plan.placements) {
    const container = plan.containers.find((c) => c.id === placement.container_id);
    if (!container) continue; // orphan placement: the rules skip those too
    const stripped: StowagePlan = {
      ...plan,
      placements: plan.placements.filter((p) => p.container_id !== placement.container_id),
    };
    for (const r of canPlaceContainer(model, stripped, container, placement.slot, vessel).reasons) {
      if (r.rule === "overstow") out.add(parsePair(r.message));
    }
  }
  return [...out].sort();
}

/** The report's overstow pairs, same key: the rule's `container_ids` are [blocker, lower]. */
const reportPairs = (vessel: Vessel, plan: StowagePlan): string[] =>
  validatePlan(vessel, plan).violations
    .filter((v) => v.rule === "overstow")
    .map((v) => `${v.container_ids[1]}<-${v.container_ids[0]}`)
    .sort();

// Real plans, real counts: 36 and 199 are the report's own totals today, so a change in either the
// rule's selection or the predicate's shows up as a diff instead of a silently different tooltip.
describe.each([
  ["bbc-sao-paulo", 36],
  ["demo-horizon", 199],
] as const)("overstow parity on %s", (vesselId, expected) => {
  const { vessel, containers } = getVesselCatalogEntry(vesselId);
  const plan = buildDemoPlan(vessel, containers, appToggles(vessel));

  it(`predicate and report name the same ${expected} blocker pairs`, () => {
    const reported = reportPairs(vessel, plan);
    expect(reported).toHaveLength(expected);
    // Same pairs, hence also the same count and the same blocker for every lower box: predicate-only
    // (= over-report) and report-only pairs both fail here.
    expect(predicatePairs(vessel, plan)).toEqual(reported);
  });
});

describe("breakbulk area-id normalisation", () => {
  /** Weather deck with a hatch envelope; bay 2 row 1 on-deck carries a container stack. */
  const vessel: Vessel = {
    id: "v", name: "V", imo: null, length_m: 200, beam_m: 30, bays: [], rows: [], stacks: [],
    breakbulk_deck: { area: { xMin: 20, xMax: 200, zMin: -15, zMax: 15 }, keep_out: [], cargo_base_height_m: 1, max_cargo_height_m: 6, deck_load_t_per_m2: 2 },
  };
  const item: BreakbulkCargo = { id: "A", category: "yacht", length_m: 20, width_m: 6, height_m: 5, weight_t: 30, kg_above_base_m: 2.5, pol: "A", pod: "B" };
  const containers: Placement[] = [{ container_id: "c1", slot: { bay: 2, row: 1, tier: 82 } }];
  const plan: StowagePlan = {
    id: "p", vessel_id: "v", voyage: "T", ports: [], containers: [], placements: containers, unplaced: [],
    breakbulk_cargo: [item], breakbulk_placements: [],
  };

  it('treats areaId "" as the weather deck for the container-stack check the commit runs', () => {
    const pose = { areaId: "", x_m: 184.7, z_m: 0 };
    const predicted = canPlaceBreakbulk(buildStowageModel(vessel), plan, item, pose, vessel)
      .reasons.map((r) => r.message);
    // The raw "" id used to miss the occupancy key, so the preview stayed silent here.
    expect(predicted).toEqual(["A: footprint overlaps on-deck container stack bay 2 row 01"]);
    // The same drop committed through the store stores NO `area_id` for the weather deck; the report
    // must therefore say exactly what the preview said.
    const committed: BreakbulkPlacement[] = [{ cargo_id: "A", x_m: 184.7, z_m: 0, rotation_deg: 0 }];
    expect(breakbulkOverlapsContainer(vessel, [item], committed, containers).map((v) => v.message))
      .toEqual(predicted);
  });

  it('uses the weather deck\'s band wording for areaId "", not the raw id\'s', () => {
    const rated: Vessel = {
      ...vessel,
      breakbulk_deck: {
        ...vessel.breakbulk_deck!,
        area: { xMin: 20, xMax: 200, zMin: -10, zMax: 10 }, // 20 m beam -> 5 × 20 × 20 = 2000 t band limit
        deck_load_t_per_m2: 5,
        max_cargo_height_m: undefined,
      },
    };
    // 1100 t over 40 × 6 m = 4.58 t/m² (inside the 5 t/m² footprint rating), but two of them push the
    // 20 m band over its 2000 t limit. A and B share the band and never overlap (z -8..-2 vs 2..8).
    const heavy = (id: string): BreakbulkCargo => ({ ...item, id, length_m: 40, width_m: 6, weight_t: 1100 });
    const banded: StowagePlan = {
      ...plan,
      breakbulk_cargo: [heavy("A")],
      breakbulk_placements: [{ cargo_id: "A", x_m: 100, z_m: -5, rotation_deg: 0 }],
    };
    const messages = (p: StowagePlan, areaId?: string) =>
      canPlaceBreakbulk(buildStowageModel(rated), p, heavy("B"), { areaId, x_m: 110, z_m: 5 }, rated)
        .reasons.map((r) => r.message);
    // "Deck band … hatch-cover" is what a placement stored without `area_id` produces; the raw "" id
    // used to produce the hold wording ("weather deck band … rated limit") for the same drop.
    expect(messages(banded, "")).toEqual(["Deck band 100-120m: 2200t exceeds the 2000t hatch-cover limit (5 t/m²)"]);
    expect(messages(banded, "")).toEqual(messages(banded));
  });
});
