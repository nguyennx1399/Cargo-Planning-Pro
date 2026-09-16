// Frontend-only demo vessel + cargo + plan builders (no backend call — P1-demo plan decision).
// Two plan variants share the same vessel/cargo: empty (every container unplaced) and loaded
// (naiveFillPlan — see engine/naive-fill-plan.ts for what it can and can't place today).
import { buildDemoVessel } from "./demo-container-vessel";
import { generateDemoCargo, DEMO_PORTS } from "./demo-cargo-generator";
import { generateDemoBreakbulkCargo } from "./demo-breakbulk-generator";
import { naiveFillPlan } from "@/engine/naive-fill-plan";
import { naiveFillBreakbulk } from "@/engine/naive-fill-breakbulk";
import { onDeckBayZones, underDeckBayZones } from "@/engine/breakbulk-forbidden-zones";
import type { Container, StowagePlan, Vessel } from "@/types/domain";

export function buildDemoVesselAndCargo(): { vessel: Vessel; containers: Container[] } {
  // specialCounts exercises 45'/OPEN_TOP/FLAT_RACK/TANK in the actual running demo — without this
  // they only ever existed in tests (see phase-01 plan's Success Criteria and the code-reviewer's
  // "inert in rendering" finding).
  const containers = generateDemoCargo(42, { specialCounts: { "45": 4, OPEN_TOP: 4, FLAT_RACK: 4, TANK: 4 } });
  return { vessel: buildDemoVessel(), containers };
}

function basePlanFields(vessel: Vessel, containers: Container[]) {
  return {
    id: "demo-plan-001",
    vessel_id: vessel.id,
    voyage: "DEMO-001",
    ports: DEMO_PORTS,
    containers,
    breakbulk_cargo: [],
    breakbulk_placements: [],
  };
}

export function buildEmptyDemoPlan(vessel: Vessel, containers: Container[]): StowagePlan {
  return { ...basePlanFields(vessel, containers), placements: [], unplaced: containers.map((c) => c.id) };
}

export function buildLoadedDemoPlan(vessel: Vessel, containers: Container[]): StowagePlan {
  const { placements, unplaced } = naiveFillPlan(vessel, containers);
  return { ...basePlanFields(vessel, containers), placements, unplaced };
}

/** Adds the fixed demo breakbulk set (wind turbine components + yachts) on top of an existing
 * plan, placed via naiveFillBreakbulk around whatever on-deck containers that plan already has —
 * an empty-ship plan leaves the whole deck free, a fully-loaded one leaves much less room, and
 * some items may end up unplaced in that case (see phase-02 plan's Success Criteria). */
export function withBreakbulkCargo(vessel: Vessel, plan: StowagePlan): StowagePlan {
  const breakbulk_cargo = generateDemoBreakbulkCargo();
  const forbiddenZones = onDeckBayZones(vessel, plan.placements);
  const { placements: breakbulk_placements } = naiveFillBreakbulk(vessel, breakbulk_cargo, forbiddenZones, {
    holdForbiddenXZones: underDeckBayZones(vessel, plan.placements),
  });
  return { ...plan, breakbulk_cargo, breakbulk_placements };
}
