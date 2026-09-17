/**
 * Shared fixtures for the two Unplaced-list suites (P2): the real vessels, the plan-order input the
 * component builds, and the query builders. Not named `*.test.ts`, so vitest does not collect it —
 * the same pattern as `engine/__tests__/test-vessel-fixture.ts`.
 */
import type { Container, StowagePlan, Vessel } from "@/types/domain";
import type { SlotDef } from "@/engine/stowage-model";
import { buildStowageModel } from "@/engine/stowage-model";
import { slotInBay } from "@/lib/drop-verdict";
import { DEFAULT_UNPLACED_QUERY, queryUnplacedRows, type UnplacedContext, type UnplacedQuery } from "@/lib/unplaced-query";
import { buildBbcSaoPauloVesselAndCargo } from "@/data/bbc-sao-paulo-vessel";
import { buildDemoVesselAndCargo, buildLoadedDemoPlan } from "@/data/build-demo-plan";

const demo = buildDemoVesselAndCargo();
const bbc = buildBbcSaoPauloVesselAndCargo();

/** [name, vessel, loaded plan] — the suite's `it.each` rows. */
export const REAL: [string, Vessel, StowagePlan][] = [
  ["MV Demo Horizon", demo.vessel, buildLoadedDemoPlan(demo.vessel, demo.containers)],
  ["BBC SAO PAULO", bbc.vessel, buildLoadedDemoPlan(bbc.vessel, bbc.containers)],
];

export const DEMO_VESSEL: Vessel = demo.vessel;
/** Every demo container, placed or not — the fleet a size/type filter is meaningful over. */
export const DEMO_FLEET: Container[] = demo.containers;

/** The list's input as the component builds it: containers, in `plan.unplaced` order. */
export const unplacedOf = (plan: StowagePlan): Container[] =>
  plan.unplaced.map((id) => plan.containers.find((c) => c.id === id)!);

export const ctxOf = (plan: StowagePlan): UnplacedContext => ({
  podSequence: Object.fromEntries(plan.ports.map((p) => [p.locode, p.sequence])),
  baySlots: null,
});

/** Exactly what the component's memo hands over: the bay's own slots, halves included. */
export const baySlotsOf = (vessel: Vessel, bay: number): SlotDef[] =>
  buildStowageModel(vessel).slots.filter((slot) => slotInBay(slot, bay, vessel));

export const q = (patch: Partial<UnplacedQuery> = {}): UnplacedQuery => ({ ...DEFAULT_UNPLACED_QUERY, ...patch });

export const ids = (plan: StowagePlan, patch: Partial<UnplacedQuery> = {}): string[] =>
  queryUnplacedRows(unplacedOf(plan), q(patch), ctxOf(plan)).ordered.map((r) => r.container.id);

/** A synthetic container with sane defaults, for the cases neither real vessel exercises. */
export const mk = (id: string, over: Partial<Container> = {}): Container => ({
  id, size: "20", type: "DRY", high_cube: false, weight_t: 10,
  pol: "VNSGN", pod: "SGSIN", imdg_class: null, oog: false, ...over,
});
