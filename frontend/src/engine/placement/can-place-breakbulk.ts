/**
 * canPlaceBreakbulk — the 7 breakbulk rules (engine/breakbulk-validation-rules.ts) lifted from
 * "check a whole plan" to "check ONE candidate item at a candidate pose" (spec §4.5). That file is
 * now a loop over this predicate, so the drop preview and the violation report cannot disagree.
 *
 * MESSAGE CONTRACT: every message below is byte-identical to the one the plan-wide rule emits for the
 * same item/placement (the rule wrappers are pinned by tests). Two behaviours are load-bearing:
 *  - the `EDGE_TOLERANCE_M` slack and its rationale (float round-trip on edge-of-deck placements);
 *  - the 20 m band arithmetic, reproduced with the rule's own repeated addition from `area.xMin`.
 * The item's own placement is excluded before re-adding it, so the same code is correct for an
 * already-placed item (the wrapper's case) and for a brand-new drop (it is not in the plan yet).
 *
 * The `vessel` is the last parameter because the container-stack check reuses Phase A's
 * `containerOccupancy(vessel, placements)`, which is a vessel query (`rows`/`bays`/`container_layout`)
 * the `StowageModel` deliberately does not carry.
 */
import type { BreakbulkCargo, BreakbulkPlacement, Placement, StowagePlan, Vessel } from "@/types/domain";
import { footprintRect, rectsOverlap } from "@/engine/breakbulk-overlap-check";
import {
  WEATHER_DECK_AREA_ID,
  areaIdOf,
  containerOccupancy,
  type OccupiedStack,
  type StowageModel,
} from "@/engine/stowage-model";
import { resultOf, type PlacementResult, type Reason } from "./reason";
import { approximateAreaReason, pad2, reason } from "./placement-reason-builders";
import { supportChain } from "./breakbulk-stack";
import { OVERWEIGHT_BAND_M, OVERWEIGHT_LIMIT_T, bandFor, bandWeight } from "./breakbulk-band-weight";
import { candidatePlan, floorPressure, rangesOverlap, stackReasons, verticalRange } from "./breakbulk-stack-checks";

// Placement stores a rect's CENTER (x_m/z_m), so footprintRect reconstructs edges as
// center +/- extent/2 — for edge-of-deck placements (center derived from area.xMin/zMin
// themselves), that round-trip doesn't always reproduce the exact original bound
// (e.g. (25.8 + 31) - 31 = 25.799999999999997 in IEEE 754). A zero-tolerance comparison here
// flags those as real violations even though the placement is legitimately at the boundary —
// found via the real demo breakbulk set, not a contrived case. Same order of tolerance the
// naive-fill-breakbulk tests already use for this exact reason (see their `- 1e-9` assertions).
const EDGE_TOLERANCE_M = 1e-6;

/** Where a candidate item would sit: a stowage area, a footprint centre and a rotation.
 * (`rotation_deg` is the phase file's `rotation`.) */
export interface BreakbulkPose {
  /** A `vessel.breakbulk_holds[].id`, or absent/""/"weather_deck" for the weather deck. */
  areaId?: string;
  x_m: number;
  z_m: number;
  rotation_deg?: number;
  /** The placed item/frame this pose rests on (stacking plan). Absent = the area's floor. */
  onCargoId?: string;
}

/** The pose as a placement, so the existing rect helpers apply unchanged. */
function placementOf(item: BreakbulkCargo, pose: BreakbulkPose): BreakbulkPlacement {
  return {
    cargo_id: item.id,
    x_m: pose.x_m,
    z_m: pose.z_m,
    rotation_deg: pose.rotation_deg ?? 0,
    ...(pose.areaId ? { area_id: pose.areaId } : {}),
    ...(pose.onCargoId ? { on_cargo_id: pose.onCargoId } : {}),
  };
}

/** `containerOccupancy` memoised on the placements ARRAY identity: a drag start evaluates ~900
 * candidates against one plan, and the rule wrappers evaluate every breakbulk item against one
 * container set. Plans are immutable by contract, so identity is a valid key. */
const occupancyCache = new WeakMap<readonly Placement[], Map<string, OccupiedStack[]>>();

function occupancyFor(vessel: Vessel, placements: Placement[]): Map<string, OccupiedStack[]> {
  const cached = occupancyCache.get(placements);
  if (cached) return cached;
  const built = containerOccupancy(vessel, placements);
  occupancyCache.set(placements, built);
  return built;
}

export function canPlaceBreakbulk(
  model: StowageModel,
  plan: StowagePlan,
  item: BreakbulkCargo,
  pose: BreakbulkPose,
  vessel: Vessel,
): PlacementResult {
  const reasons: Reason[] = [];
  const byId = new Map(plan.breakbulk_cargo.map((c) => [c.id, c] as const));
  // `""` means the weather deck (`BreakbulkPose`'s own doc), and a placement that reaches the plan
  // carries no `area_id` at all for that deck. Normalise ONCE and use the same key for the area
  // lookup, the container-stack occupancy, the overlap grouping and the wording: keeping the raw id
  // in any of them let a preview called with `areaId: ""` skip the container-stack check that the
  // committed drop (which stores no `area_id`) then runs.
  const areaKey = pose.areaId || WEATHER_DECK_AREA_ID;
  const area = model.areaById.get(areaKey);
  const rect = footprintRect(item, placementOf(item, pose));
  // STACKING: judge the plan as it would be with the item at this pose (see `candidatePlan`). For a
  // floor item in a plan without stacks every number below is exactly what it was before stacking.
  const cand = candidatePlan(plan, item, placementOf(item, pose));
  const onFloor = supportChain(cand, item.id).chain.length === 0;
  const mine = verticalRange(cand, item.id, item.height_m);

  if (!area) {
    reasons.push(reason("breakbulk_out_of_deck_area", `${item.id}: unknown stowage area "${areaKey}"`));
  } else {
    if (
      rect.xMin < area.rect.xMin - EDGE_TOLERANCE_M ||
      rect.xMax > area.rect.xMax + EDGE_TOLERANCE_M ||
      rect.zMin < area.rect.zMin - EDGE_TOLERANCE_M ||
      rect.zMax > area.rect.zMax + EDGE_TOLERANCE_M
    ) {
      const where = areaKey === WEATHER_DECK_AREA_ID ? "the usable deck area" : area.label;
      reasons.push(reason("breakbulk_out_of_deck_area", `${item.id}: footprint extends outside ${where}`));
    }
    const keepOut = area.keepOuts.find((k) => rectsOverlap(rect, k)); // read-only: never sort in place
    if (keepOut) reasons.push(reason("breakbulk_in_keep_out", `${item.id}: footprint overlaps ${keepOut.label}`));
    // Stack height: the TOP of the item above the floor, so a stack is judged whole. A floor item keeps
    // its original message byte for byte (pinned by tests).
    if (Number.isFinite(area.maxHeight) && mine[1] > area.maxHeight + EDGE_TOLERANCE_M) {
      const message = onFloor
        ? `${item.id}: ${item.height_m}m tall exceeds the ${area.maxHeight}m clear height in ${area.label}`
        : `${item.id}: top of stack at ${mine[1].toFixed(2)}m exceeds the ${area.maxHeight}m clear height in ${area.label}`;
      reasons.push(reason("breakbulk_too_tall", message));
    }
    // Pressure belongs to the item that TOUCHES the floor, carrying everything stacked on it.
    const floor = area.loadRating !== undefined ? floorPressure(cand, item.id) : null;
    if (floor && area.loadRating !== undefined && floor.pressure > area.loadRating + 1e-9) {
      reasons.push(reason("breakbulk_over_pressure", `${floor.id}: ${floor.pressure.toFixed(2)} t/m² exceeds the ${area.loadRating} t/m² rating of ${area.label}`));
    }
    const band = bandFor(area.rect, pose.x_m);
    if (band) {
      // Area with a rated surface: rating × the band's usable area (still a uniform-load
      // simplification — no point-load/lashing check). Otherwise the generic DEMO limit.
      const limitT = area.loadRating ? Math.round(area.loadRating * OVERWEIGHT_BAND_M * (area.rect.zMax - area.rect.zMin)) : OVERWEIGHT_LIMIT_T;
      const weight = bandWeight(plan, byId, item.id, areaKey, band) + item.weight_t;
      if (weight > limitT) {
        const onDeck = areaKey === WEATHER_DECK_AREA_ID;
        const what = area.loadRating ? `${limitT}t ${onDeck ? "hatch-cover" : "rated"} limit (${area.loadRating} t/m²)` : `${limitT}t demo limit`;
        const where = onDeck ? "Deck band" : `${area.label} band`;
        reasons.push(reason("breakbulk_overweight", `${where} ${band.start.toFixed(0)}-${band.end.toFixed(0)}m: ${weight.toFixed(0)}t exceeds the ${what}`));
      }
    }
    // D4: with no GA layout for this vessel the area's own BOUNDARY is a guess, so every drop in it
    // records a warning-severity caveat — allowed, badged and listed, never a refusal (the wording
    // and the dedup it buys live in `approximateAreaReason`). Pushed LAST of the area reasons so an
    // accepted-with-warnings drop still quotes the concrete limit first (the 20 m band weight) and
    // this caveat is the fallback line, never a red herring.
    if (area.source === "generic") reasons.push(approximateAreaReason(area));
  }

  // Overlap is checked whatever the area is (the plan rule groups by area id, known or not); the
  // container-stack check simply finds no occupancy for an unknown area.
  const orderOf = (cargoId: string): number => {
    const i = plan.breakbulk_placements.findIndex((p) => p.cargo_id === cargoId);
    return i === -1 ? plan.breakbulk_placements.length : i;
  };
  for (const other of plan.breakbulk_placements) {
    if (other.cargo_id === item.id) continue; // never overlap itself
    if (areaIdOf(other) !== areaKey) continue;
    const otherItem = byId.get(other.cargo_id);
    if (!otherItem || !rectsOverlap(rect, footprintRect(otherItem, other))) continue;
    // 3-D: footprints overlapping in plan only clash when their heights overlap too (a stack does not).
    if (!rangesOverlap(mine, verticalRange(cand, other.cargo_id, otherItem.height_m))) continue;
    // Plan order decides which id is named first, so both sides of a pair produce ONE message (the
    // plan rule reports each pair once, from the earlier placement).
    const mineFirst = orderOf(item.id) <= orderOf(other.cargo_id);
    reasons.push(
      reason("breakbulk_overlap", mineFirst ? `${item.id} overlaps ${other.cargo_id}` : `${other.cargo_id} overlaps ${item.id}`),
    );
  }
  // With no container placements `containerOccupancy` is empty, so the vessel is never read — that
  // short-circuit is what lets `breakbulkOverlap` (frozen signature, no vessel) share this predicate.
  const stacks = plan.placements.length === 0 ? undefined : occupancyFor(vessel, plan.placements).get(areaKey);
  const hit = stacks ? stacks.find((s) => rectsOverlap(rect, s.rect)) : undefined;
  if (hit) {
    const deckLabel = hit.deck === "on" ? "on-deck" : "under-deck";
    reasons.push(reason("breakbulk_overlaps_container", `${item.id}: footprint overlaps ${deckLabel} container stack bay ${hit.bay} row ${pad2(hit.row)}`));
  }
  reasons.push(...stackReasons(cand, item, pose.onCargoId, rect));
  return resultOf(reasons);
}
