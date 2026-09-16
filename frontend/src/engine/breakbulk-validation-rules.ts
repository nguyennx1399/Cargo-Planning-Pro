/**
 * Breakbulk-only validation rules — deliberately separate from validation-rules.ts/ALL_RULES,
 * which are built entirely around the slot-based bay/row/tier grid (StackSpec, cells, columns).
 * Breakbulk cargo has none of that, so its rules operate on BreakbulkCargo/BreakbulkPlacement
 * directly rather than forcing it through the slot-based ValidationContext.
 *
 * Every rule is per stowage area (weather deck, or a hold via BreakbulkPlacement.area_id): an item
 * on the hatch covers can't overlap one on the tank top below it, and each area has its own
 * rectangle, keep-outs, clear height and rated load.
 *
 * PHASE B (spec §4.5): each rule here is now a thin loop over `engine/placement/canPlaceBreakbulk`,
 * the same predicate the drop preview and the placeholders use, so the UI and this report cannot
 * disagree. Exported names, argument signatures, rule ids and message strings are UNCHANGED — they
 * are the regression contract (breakbulk-validation-rules.test.ts, validate-plan.test.ts,
 * bbc-sao-paulo-containers.test.ts, breakbulk-real-vessels-no-violations.test.ts). The tolerances
 * (EDGE_TOLERANCE_M), the band arithmetic and the container-stack occupancy live in the predicate.
 */
import type {
  BreakbulkCargo,
  BreakbulkPlacement,
  Placement,
  StowagePlan,
  Vessel,
  Violation,
} from "@/types/domain";
import { buildStowageModel, type StowageModel } from "@/engine/stowage-model";
import { canPlaceBreakbulk, type BreakbulkPose } from "./placement/can-place-breakbulk";
import type { PlacementRule } from "./placement/reason";

/** A plan view for the predicate: these rules never received a StowagePlan, so the wrappers hand it
 * exactly what they were given. `containers: []` is safe — canPlaceBreakbulk reads only
 * `plan.breakbulk_*`, `plan.ports` and `plan.placements` (the last only for container stacks). */
function planView(
  cargo: BreakbulkCargo[],
  placements: BreakbulkPlacement[],
  containerPlacements: Placement[],
): StowagePlan {
  return {
    id: "breakbulk-rules",
    vessel_id: "",
    voyage: "",
    ports: [],
    containers: [],
    placements: containerPlacements,
    unplaced: [],
    breakbulk_cargo: cargo,
    breakbulk_placements: placements,
  };
}

/** `breakbulkOverlap`'s signature is frozen WITHOUT a vessel (it is pure geometry), yet the predicate
 * takes one. Its plan view carries no container placements, and canPlaceBreakbulk then never reads
 * the vessel (the container-stack check is skipped outright), so this placeholder is provably unread
 * — it exists to satisfy the argument list, not to describe a ship. */
const NO_VESSEL: Vessel = { id: "", name: "", imo: null, length_m: 0, beam_m: 0, bays: [], rows: [], stacks: [] };

function poseOf(placement: BreakbulkPlacement): BreakbulkPose {
  return {
    x_m: placement.x_m,
    z_m: placement.z_m,
    rotation_deg: placement.rotation_deg,
    ...(placement.area_id !== undefined ? { areaId: placement.area_id } : {}),
  };
}

/** One rule = its predicate rule id over every placement, mapped back to the Violation shape.
 * `container_ids` is the placement that produced the message (the rules' own attribution), and a
 * message already emitted is skipped — which reproduces the pairwise / 20 m band dedup the rules
 * used to do inline, and keeps a pair reported once, from the placement that comes first in plan
 * order. */
function ruleViolations(vessel: Vessel, model: StowageModel, plan: StowagePlan, rule: PlacementRule): Violation[] {
  const out: Violation[] = [];
  const seen = new Set<string>();
  for (const placement of plan.breakbulk_placements) {
    const item = plan.breakbulk_cargo.find((c) => c.id === placement.cargo_id);
    if (!item) continue; // orphan placement: no cargo row to check, exactly as before
    for (const reason of canPlaceBreakbulk(model, plan, item, poseOf(placement), vessel).reasons) {
      if (reason.rule !== rule || seen.has(reason.message)) continue;
      seen.add(reason.message);
      out.push({ rule, severity: "error", message: reason.message, container_ids: [placement.cargo_id], slots: [] });
    }
  }
  return out;
}

const violationsFor = (
  vessel: Vessel,
  cargo: BreakbulkCargo[],
  placements: BreakbulkPlacement[],
  containerPlacements: Placement[],
  rule: PlacementRule,
): Violation[] =>
  ruleViolations(vessel, buildStowageModel(vessel), planView(cargo, placements, containerPlacements), rule);

export function breakbulkOutOfDeckArea(vessel: Vessel, cargo: BreakbulkCargo[], placements: BreakbulkPlacement[]): Violation[] {
  return violationsFor(vessel, cargo, placements, [], "breakbulk_out_of_deck_area");
}

export function breakbulkOverlap(cargo: BreakbulkCargo[], placements: BreakbulkPlacement[]): Violation[] {
  return violationsFor(NO_VESSEL, cargo, placements, [], "breakbulk_overlap");
}

/** Breakbulk cargo must clear the container stacks that actually carry boxes in its own area.
 *
 * Phase A change (Validation Session 1 tie-breaker): this used to block a whole bay across the
 * full beam via onDeckBayZones/underDeckBayZones. It now tests the footprint against the real
 * per-stack rects of the area the item sits in (engine/stowage-model/occupancy.ts), so cargo can
 * legitimately fit beside a stack. If this ever lets a placement through that the BBC demo flags,
 * the agreed fallback is to revert this one rule to whole-bay blocking and record it for Phase D —
 * do not chase it inside a behaviour-preserving phase. */
export function breakbulkOverlapsContainer(vessel: Vessel, cargo: BreakbulkCargo[], placements: BreakbulkPlacement[], containerPlacements: Placement[]): Violation[] {
  return violationsFor(vessel, cargo, placements, containerPlacements, "breakbulk_overlaps_container");
}

export function breakbulkOverweight(vessel: Vessel, cargo: BreakbulkCargo[], placements: BreakbulkPlacement[]): Violation[] {
  return violationsFor(vessel, cargo, placements, [], "breakbulk_overweight");
}

/** Footprint overlaps one of the area's declared keep-out structures (crane pedestal etc.). */
export function breakbulkInKeepOut(vessel: Vessel, cargo: BreakbulkCargo[], placements: BreakbulkPlacement[]): Violation[] {
  return violationsFor(vessel, cargo, placements, [], "breakbulk_in_keep_out");
}

/** Item is taller than the area's declared clear height (deck above, hatch covers, stowed jibs…). */
export function breakbulkTooTall(vessel: Vessel, cargo: BreakbulkCargo[], placements: BreakbulkPlacement[]): Violation[] {
  return violationsFor(vessel, cargo, placements, [], "breakbulk_too_tall");
}

/** The item's own footprint pressure (weight ÷ footprint area) exceeds the surface's rated load —
 * catches a single heavy, compact piece that a 20 m band average would hide. */
export function breakbulkOverPressure(vessel: Vessel, cargo: BreakbulkCargo[], placements: BreakbulkPlacement[]): Violation[] {
  return violationsFor(vessel, cargo, placements, [], "breakbulk_over_pressure");
}
