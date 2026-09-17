/**
 * breakbulk-drop-verdict — the POSE half of the verdict layer (Phase D): `areaVisible`'s deck rule and
 * `verdictForPose`'s agreement with the predicate the commit calls.
 *
 * Load-bearing assertions: the tint a pose gets IS `canPlaceBreakbulk`'s own answer, reason and
 * severity included ("one content-area rule, no third state, no UI-local rule"); a MOVE is judged
 * exactly like a first placement (the own-placement strip); and the pointer-move path costs ONE
 * predicate call however many surfaces read the same pose (the one-entry memo, review M4) — counted by
 * wrapping the real predicate through `vi.mock`, with no hook in production code.
 */
import { describe, expect, it, vi } from "vitest";
import { areaVisible } from "../drop-verdict";
import { verdictForPose } from "../pose-verdict";
import { quotedReason } from "../drop-feedback";
import { canPlaceBreakbulk, type BreakbulkPose } from "@/engine/placement/can-place-breakbulk";
import { clampPoseToArea } from "@/engine/placement/breakbulk-pose";
import { verdictOf } from "@/engine/placement/placeholders";
import { buildStowageModel, type StowageModel } from "@/engine/stowage-model";
import { buildBbcSaoPauloVesselAndCargo } from "@/data/bbc-sao-paulo-vessel";
import { buildDemoPlan, buildDemoVesselAndCargo } from "@/data/build-demo-plan";
import type { BreakbulkCargo, BreakbulkPlacement, StowagePlan } from "@/types/domain";

/** The predicate call counter — `vi.hoisted` because `vi.mock` is hoisted above these imports. */
const { calls } = vi.hoisted(() => ({ calls: { n: 0 } }));
vi.mock("@/engine/placement/can-place-breakbulk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/engine/placement/can-place-breakbulk")>();
  return {
    ...actual,
    canPlaceBreakbulk: (...args: Parameters<typeof actual.canPlaceBreakbulk>) => {
      calls.n++;
      return actual.canPlaceBreakbulk(...args);
    },
  };
});

const LOADED = { cargoLoaded: true, projectCargoLoaded: true };
const bbc = buildBbcSaoPauloVesselAndCargo();
const demo = buildDemoVesselAndCargo();
const bbcPlan = buildDemoPlan(bbc.vessel, bbc.containers, LOADED);
const demoPlan = buildDemoPlan(demo.vessel, demo.containers, LOADED);
const bbcModel = buildStowageModel(bbc.vessel);
const demoModel = buildStowageModel(demo.vessel);

/** [name, vessel, plan, model] — the suite's `it.each` rows. */
const REAL = [
  ["MV Demo Horizon", demo.vessel, demoPlan, demoModel] as const,
  ["BBC SAO PAULO", bbc.vessel, bbcPlan, bbcModel] as const,
];

/** The same vessel with nothing on it — the free-deck control. */
const emptyPlan = (vesselId: string): StowagePlan => ({ id: "p", vessel_id: vesselId, voyage: "T", ports: [], containers: [], placements: [], unplaced: [], breakbulk_cargo: [], breakbulk_placements: [] });

/** Real catalogue items from the plan itself: one of a category, and the first the demo could not stow. */
const cargoOf = (plan: StowagePlan, category: BreakbulkCargo["category"]): BreakbulkCargo => plan.breakbulk_cargo.find((c) => c.category === category)!;
const unplacedOf = (plan: StowagePlan): BreakbulkCargo => plan.breakbulk_cargo.find((c) => !plan.breakbulk_placements.some((p) => p.cargo_id === c.id))!;

/** The pose a pointer hovering the middle of `areaId` produces, i.e. the real path: scene point →
 * `poseFromScenePoint` → `clampPoseToArea`, with the centre of the rect as the scene point. */
const poseAtCentre = (model: StowageModel, areaId: string, item: BreakbulkCargo): BreakbulkPose => {
  const area = model.areaById.get(areaId)!;
  return clampPoseToArea(area, item, { areaId, x_m: (area.rect.xMin + area.rect.xMax) / 2, z_m: 0 });
};

describe("areaVisible", () => {
  it("is the deck toggles and nothing else — a bay filter cannot hide an area", () => {
    const deck = bbcModel.areaById.get("weather_deck")!;
    const hold = bbcModel.areaById.get("tank_top_hold2")!;

    expect(areaVisible(deck, { showOnDeck: true, showUnderDeck: false, bayFilter: null })).toBe(true);
    expect(areaVisible(deck, { showOnDeck: false, showUnderDeck: true, bayFilter: null })).toBe(false);
    expect(areaVisible(hold, { showOnDeck: true, showUnderDeck: false, bayFilter: null })).toBe(false);
    expect(areaVisible(hold, { showOnDeck: false, showUnderDeck: true, bayFilter: null })).toBe(true);

    // There is no `slotInBay` analogue: a rectangle spans the ship, so a bay the filter names has no
    // bearing on whether a planner can drop into it. A "consistency" fix that filtered here would
    // hide a surface the drop plane still answers for.
    for (const bayFilter of [null, 2, 22, 4242]) {
      expect(areaVisible(deck, { showOnDeck: true, showUnderDeck: true, bayFilter }), `bay ${bayFilter}`).toBe(true);
      expect(areaVisible(hold, { showOnDeck: true, showUnderDeck: true, bayFilter }), `bay ${bayFilter}`).toBe(true);
    }
  });
});

describe("verdictForPose", () => {
  it.each(REAL)("answers with the engine's own verdict and reason, on %s", (_name, vessel, plan, model) => {
    const item = unplacedOf(plan);

    for (const area of model.areas) {
      const pose = poseAtCentre(model, area.id, item);
      const result = canPlaceBreakbulk(model, plan, item, pose, vessel);
      const verdict = verdictForPose(vessel, plan, item, pose);

      // Byte-for-byte the engine's answer — including which reason is quoted, which `quotedReason`
      // derives independently of `drop-verdict.ts`'s own private `toVerdict`.
      expect(verdict, `${area.id} @ ${pose.x_m},${pose.z_m}`).toEqual({
        verdict: verdictOf(result),
        reason: quotedReason(result),
      });
      if (verdict.verdict === "invalid") expect(verdict.reason?.severity).toBe("error");
      else if (verdict.verdict === "warning") expect(verdict.reason?.severity).toBe("warning");
      else expect(verdict.reason).toBeNull();
    }
  });

  it("is green on a free deck and red off it and on a CLIPPED keep-out (D-P4)", () => {
    const empty = emptyPlan(bbc.vessel.id);
    const blade = cargoOf(bbcPlan, "wind_turbine_blade");

    expect(verdictForPose(bbc.vessel, empty, blade, poseAtCentre(bbcModel, "weather_deck", blade))).toEqual({
      verdict: "valid",
      reason: null,
    });

    const outside = verdictForPose(bbc.vessel, empty, blade, { areaId: "weather_deck", x_m: 130, z_m: 0 });
    expect(outside.reason?.rule).toBe("breakbulk_out_of_deck_area");
    expect(outside.reason?.message).toBe("BB001: footprint extends outside the usable deck area");

    // Crane 1's pedestal is declared outboard of the usable rect; the rectangle the layer DRAWS is the
    // clipped one (x 41.55-45.55, z -9.85..-7), and a blade laid along it is inside the area and on the
    // pedestal at once — the only refusal left is the keep-out itself.
    const keepOut = verdictForPose(bbc.vessel, empty, blade, { areaId: "weather_deck", x_m: 43.5, z_m: -7.5 });
    expect(keepOut.reason?.rule).toBe("breakbulk_in_keep_out");
    expect(keepOut.reason?.message).toBe("BB001: footprint overlaps crane 1 pedestal");
  });

  it("refuses a pose the area is too short for, with the engine's own numbers", () => {
    const empty = emptyPlan(bbc.vessel.id);
    const nacelle = cargoOf(bbcPlan, "wind_turbine_nacelle"); // BB004, 4.5 m tall
    const verdict = verdictForPose(bbc.vessel, empty, nacelle, poseAtCentre(bbcModel, "main_deck_aft_hold2", nacelle));

    expect(verdict.verdict).toBe("invalid");
    expect(verdict.reason?.rule).toBe("breakbulk_too_tall");
    expect(verdict.reason?.message).toContain("BB004: 4.5m tall exceeds");
    expect(verdict.reason?.message).toContain("Hold 2 aft section at main-deck level");
  });

  it("warns (amber) on the 20 m band limit instead of refusing it (D1)", () => {
    const tower = cargoOf(demoPlan, "wind_turbine_tower"); // 110 t
    const nacelle = cargoOf(demoPlan, "wind_turbine_nacelle"); // 95 t
    const placed: BreakbulkPlacement = { cargo_id: tower.id, x_m: 38, z_m: -6, rotation_deg: 0 };
    const plan: StowagePlan = {
      ...emptyPlan(demo.vessel.id),
      breakbulk_cargo: [tower, nacelle],
      breakbulk_placements: [placed],
    };
    // Same 20 m band as the tower (bands run from the area's xMin), clear of it in z.
    const verdict = verdictForPose(demo.vessel, plan, nacelle, { areaId: "weather_deck", x_m: 44, z_m: 6 });

    expect(verdict).toEqual({
      verdict: "warning",
      reason: { rule: "breakbulk_overweight", message: "Deck band 26-46m: 205t exceeds the 200t demo limit", severity: "warning" },
    });
  });

  it.each(REAL)("judges a MOVE exactly like a first placement, on %s", (_name, vessel, plan, model) => {
    const placed = plan.breakbulk_placements[0];
    expect(placed).toBeDefined();
    const item = plan.breakbulk_cargo.find((c) => c.id === placed.cargo_id)!;
    // The same plan with the item's own placement removed and nothing else touched: what the verdict
    // for an arriving item would be. The strip must make the two indistinguishable — including the
    // 20 m band, which re-adds the item's own weight, and the overlap wording, which names the
    // subject last once it is no longer in the list.
    const asArriving: StowagePlan = { ...plan, breakbulk_placements: plan.breakbulk_placements.filter((p) => p.cargo_id !== item.id) };

    for (const area of model.areas) {
      const pose = poseAtCentre(model, area.id, item);
      expect(verdictForPose(vessel, plan, item, pose), `${area.id}`).toEqual(
        verdictForPose(vessel, asArriving, item, pose),
      );
    }

    // ...and standing where it already is, alone on a free deck, is not a refusal.
    const solo: StowagePlan = { ...emptyPlan(vessel.id), breakbulk_cargo: [item], breakbulk_placements: [placed] };
    expect(verdictForPose(vessel, solo, item, { areaId: placed.area_id ?? "weather_deck", x_m: placed.x_m, z_m: placed.z_m }).verdict).not.toBe("invalid");
  });

  it("costs ONE predicate call for three readers of the same pose, and one more per new pose", () => {
    const item = unplacedOf(bbcPlan);
    const pose = poseAtCentre(bbcModel, "weather_deck", item);

    calls.n = 0;
    verdictForPose(bbc.vessel, bbcPlan, item, pose); // the ghost
    verdictForPose(bbc.vessel, bbcPlan, item, pose); // the at-cursor chip
    verdictForPose(bbc.vessel, bbcPlan, item, pose); // the sidebar readout
    expect(calls.n, "three readers of one pose").toBe(1);

    // The next 0.5 m cell is a different pose and does cost a call...
    const moved = { ...pose, z_m: pose.z_m + 0.5 };
    verdictForPose(bbc.vessel, bbcPlan, item, moved);
    expect(calls.n).toBe(2);

    // ...as does a different item at it, and the memo is ONE entry: coming back to the first pose
    // re-computes rather than caching a second one.
    verdictForPose(bbc.vessel, bbcPlan, cargoOf(bbcPlan, "wind_turbine_nacelle"), moved);
    expect(calls.n).toBe(3);
    verdictForPose(bbc.vessel, bbcPlan, item, pose);
    expect(calls.n).toBe(4);
  });
});
