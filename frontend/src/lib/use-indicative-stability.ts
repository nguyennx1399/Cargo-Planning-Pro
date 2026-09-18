// Orchestration hook: vessel + plan -> indicative StabilityResult. Ties together the pure
// engine pieces (hydrostatic table, stability calc, cargo weight conversion) with the vessel's
// geometry catalog — the only place in the app that needs to know about all of them at once.
import { useMemo } from "react";
import type { Container, StowagePlan, Vessel } from "@/types/domain";
import type { VesselGeometry } from "@/types/vessel-geometry";
import type { HydrostaticRow } from "@/engine/hull/hydrostatic-table-calculator";
import { getVesselGeometry } from "@/data/vessel-geometry-catalog";
import { DEMO_LIGHTSHIP, DEMO_CONSTANT } from "@/data/demo-lightship";
import { computeHydrostaticTable } from "@/engine/hull/hydrostatic-table-calculator";
import { computeIndicativeStability, type StabilityResult } from "@/engine/stability-indicative";
import { visiblePlacements } from "@/engine/playback-slice";
import { cargoWeightItem } from "./cargo-weight-item";
import { breakbulkWeightItem } from "./breakbulk-weight-item";
import { elevationOf } from "@/engine/placement/breakbulk-stack";

const DRAFT_GRID_STEP_M = 0.5;
const DRAFT_GRID_MIN_M = 3;

/** Pure core of the hook below — extracted so it's testable without a React render context.
 * Slices plan.placements to `playbackCount` BEFORE converting to weight items, so stability
 * reflects only the cargo currently "shown so far" during playback, not the whole plan.
 * `byId` is passed in (not rebuilt here) so callers can memoize it separately from `plan.containers`
 * — during playback this function runs every animation frame, but the container list itself only
 * changes on cargo load/clear, so rebuilding an ~870-entry Map every frame would be pure waste. */
export function stabilityForVisiblePlan(
  vessel: Vessel,
  plan: StowagePlan,
  geometry: VesselGeometry,
  hydrostatics: HydrostaticRow[],
  playbackCount: number | null,
  byId: Map<string, Container>
): StabilityResult {
  const visible = visiblePlacements(plan.placements, playbackCount);
  const containerCargo = visible.map((p) => cargoWeightItem(vessel, geometry, byId.get(p.container_id)!, p.slot));
  // Breakbulk is NOT sliced by playbackCount: there are only a handful of items, and "reveal one
  // at a time" has no real meaning for them the way it does for hundreds of containers — they're
  // either all part of the current plan or not (see phase-04 plan's Key Insights).
  const breakbulkById = new Map(plan.breakbulk_cargo.map((c) => [c.id, c]));
  const breakbulkCargo = plan.breakbulk_placements.map((p) => breakbulkWeightItem(vessel, geometry, breakbulkById.get(p.cargo_id)!, p, elevationOf(plan, p.cargo_id)));
  const cargo = [...containerCargo, ...breakbulkCargo];
  const maxDraftM = geometry.particulars.depth_m - 1;
  return computeIndicativeStability(DEMO_LIGHTSHIP, DEMO_CONSTANT, cargo, hydrostatics, geometry.particulars.lbp_m, maxDraftM);
}

export function useIndicativeStability(vessel: Vessel, plan: StowagePlan, playbackCount: number | null): StabilityResult | null {
  const geometry = vessel.geometry_id ? getVesselGeometry(vessel.geometry_id) : undefined;

  const hydrostatics = useMemo(() => {
    if (!geometry?.hull.offsets) return null;
    const maxDraftM = geometry.particulars.depth_m - DRAFT_GRID_STEP_M;
    const steps = Math.floor((maxDraftM - DRAFT_GRID_MIN_M) / DRAFT_GRID_STEP_M) + 1;
    const drafts = Array.from({ length: steps }, (_, i) => DRAFT_GRID_MIN_M + i * DRAFT_GRID_STEP_M);
    return computeHydrostaticTable(geometry.hull.offsets, geometry.particulars, { drafts });
  }, [geometry]); // only recomputed when the vessel's geometry changes, not on every plan edit

  // Rebuilt only when the container list itself changes, not every playback tick (playbackCount
  // is deliberately NOT a dependency here).
  const byId = useMemo(() => new Map(plan.containers.map((c) => [c.id, c])), [plan.containers]);

  return useMemo(() => {
    if (!geometry || !hydrostatics) return null;
    return stabilityForVisiblePlan(vessel, plan, geometry, hydrostatics, playbackCount, byId);
  }, [geometry, hydrostatics, plan.placements, plan.containers, plan.breakbulk_cargo, plan.breakbulk_placements, playbackCount, vessel, byId]);
}
