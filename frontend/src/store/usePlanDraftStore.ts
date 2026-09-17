/**
 * usePlanDraftStore — the ONLY place a stowage plan is mutated from the UI (spec §4.7).
 *
 * Deliberately a SEPARATE store from `usePlanStore`: that one holds view state and is subscribed
 * narrowly (Sidebar, BayPlanView, the playback driver) to avoid re-render storms, so plan data must
 * not live in it. This store is small enough to be selected from directly.
 *
 * Invariants, all load-bearing:
 *  - validate-then-mutate: every action runs the same predicate the validator uses (`canPlace…`)
 *    BEFORE touching state, and an invalid action returns its reasons and changes nothing — no new
 *    plan object, no history entry, so a rejected move leaves the plan byte-identical.
 *  - never mutate a plan in place: each action builds a new `StowagePlan`, which is what keeps every
 *    `past`/`future` entry valid as history (and what lets the engine memoise by plan identity).
 *  - `unplaced` is DERIVED from `containers` − `placements` on every mutation, never stored on its
 *    own (Sidebar reads it directly).
 *  - a move is validated as unplace + place: the item's own placement is stripped first, so it can
 *    never conflict with the ghost of itself. `place*` and `move*` share that one implementation —
 *    only the UI wording differs — so a re-place cannot append a duplicate placement.
 *  - no vessel is ever patched here: `buildStowageModel` caches by vessel identity and never
 *    invalidates, so only plans may be replaced.
 */
import { create } from "zustand";
import type { BreakbulkPlacement, Placement, Slot, StowagePlan, Vessel } from "@/types/domain";
import { WEATHER_DECK_AREA_ID, buildStowageModel } from "@/engine/stowage-model";
import { canPlaceContainer } from "@/engine/placement/can-place-container";
import { canPlaceBreakbulk, type BreakbulkPose } from "@/engine/placement/can-place-breakbulk";
import { dependentsLosingSupport, strandedMessage } from "@/engine/placement/support-dependents";
import { resultOf, severityOf, type PlacementResult, type PlacementRule } from "@/engine/placement/reason";

/** Undo depth. Plain arrays — no history library (zundo deliberately not added). */
const HISTORY_CAP = 100;

const fail = (rule: PlacementRule, message: string): PlacementResult => ({
  ok: false,
  reasons: [{ rule, message, severity: severityOf(rule) }],
});

/** `unplaced` recomputed from what is actually placed, in cargo-list order (same order the demo
 * builders produce, so loading a demo plan and editing it stay consistent). */
function unplacedOf(plan: StowagePlan, placements: Placement[]): string[] {
  const placed = new Set(placements.map((p) => p.container_id));
  return plan.containers.filter((c) => !placed.has(c.id)).map((c) => c.id);
}

function withPlacements(plan: StowagePlan, placements: Placement[]): StowagePlan {
  return { ...plan, placements, unplaced: unplacedOf(plan, placements) };
}

/** Newest last, oldest dropped past the cap. */
function pushHistory(history: StowagePlan[], plan: StowagePlan): StowagePlan[] {
  const next = [...history, plan];
  return next.length > HISTORY_CAP ? next.slice(next.length - HISTORY_CAP) : next;
}

/** Same shape the naive packer produces: no `area_id` for the weather deck, so `areaIdOf` (and every
 * existing consumer of it) keeps working unchanged. */
function breakbulkPlacementOf(cargoId: string, pose: BreakbulkPose): BreakbulkPlacement {
  return {
    cargo_id: cargoId,
    x_m: pose.x_m,
    z_m: pose.z_m,
    rotation_deg: pose.rotation_deg ?? 0,
    ...(pose.areaId && pose.areaId !== WEATHER_DECK_AREA_ID ? { area_id: pose.areaId } : {}),
  };
}

export interface PlanDraftState {
  /** The vessel the plan belongs to — needed for the checks and by nothing else. */
  vessel: Vessel | null;
  plan: StowagePlan | null;
  past: StowagePlan[];
  future: StowagePlan[];
  /** Loads a plan (demo build, vessel switch) and RESETS history. `null` clears the draft, which is
   * what a vessel change does before the next plan is built. */
  loadPlan: (vessel: Vessel | null, plan: StowagePlan | null) => void;
  /** Put a box in a slot, validated first; `move*` is the same operation for an already-placed item. */
  placeContainer: (containerId: string, slot: Slot) => PlacementResult;
  moveContainer: (containerId: string, slot: Slot) => PlacementResult;
  /** Take a box off the ship. Returns the same `PlacementResult` shape the put actions do, because it
   * can be REFUSED: a box carrying others may not leave the plan and strand them (`no_floating`). */
  unplaceContainer: (containerId: string) => PlacementResult;
  /** Same contract for project cargo, with a `{areaId, x_m, z_m, rotation_deg}` pose. */
  placeBreakbulk: (cargoId: string, pose: BreakbulkPose) => PlacementResult;
  moveBreakbulk: (cargoId: string, pose: BreakbulkPose) => PlacementResult;
  unplaceBreakbulk: (cargoId: string) => void;
  undo: () => void;
  redo: () => void;
}

export const usePlanDraftStore = create<PlanDraftState>((set, get) => {
  /** Commit a validated plan: the previous one becomes history, redo is dropped. */
  const apply = (current: StowagePlan, next: StowagePlan): void => {
    set({ plan: next, past: pushHistory(get().past, current), future: [] });
  };

  /** Replace the breakbulk placement list — `unplaced` only tracks containers, so nothing to derive. */
  const applyBreakbulk = (current: StowagePlan, breakbulk_placements: BreakbulkPlacement[]): void => {
    apply(current, { ...current, breakbulk_placements });
  };

  /** "Put this box in that slot" — the one implementation behind place AND move (spec §4.7 lists both
   * names because the two UI paths read differently). The box's own placement is stripped before the
   * check, so a move never conflicts with the position it is leaving and re-placing an id can never
   * append a duplicate. */
  const putContainer = (containerId: string, slot: Slot): PlacementResult => {
    const { vessel, plan } = get();
    if (!vessel || !plan) return fail("no_plan", `${containerId}: no plan is loaded`);
    const container = plan.containers.find((c) => c.id === containerId);
    if (!container) return fail("unknown_container", `${containerId}: not in the plan's cargo list`);
    const stripped = withPlacements(plan, plan.placements.filter((p) => p.container_id !== containerId));
    const result = resultOf(canPlaceContainer(buildStowageModel(vessel), stripped, container, slot, vessel).reasons);
    if (!result.ok) return result;
    const next = withPlacements(stripped, [...stripped.placements, { container_id: containerId, slot }]);
    // The DESTINATION is fine; the ORIGIN may not be. A move out of the middle of a stack leaves the
    // boxes above it in the air — the destination check cannot see that, because its subject is the
    // candidate and theirs is the neighbours it is walking away from. Judged before vs after, so a
    // floater that predates this edit is never blamed on it.
    const stranded = dependentsLosingSupport(vessel, plan, next, containerId);
    if (stranded.length) return fail("no_floating", strandedMessage(containerId, stranded));
    apply(plan, next);
    return result;
  };

  /** Same contract for project cargo: its own placement is excluded from the checks it is re-added to. */
  const putBreakbulk = (cargoId: string, pose: BreakbulkPose): PlacementResult => {
    const { vessel, plan } = get();
    if (!vessel || !plan) return fail("no_plan", `${cargoId}: no plan is loaded`);
    const item = plan.breakbulk_cargo.find((c) => c.id === cargoId);
    if (!item) return fail("unknown_breakbulk_cargo", `${cargoId}: not in the plan's project cargo list`);
    const stripped = { ...plan, breakbulk_placements: plan.breakbulk_placements.filter((p) => p.cargo_id !== cargoId) };
    const result = resultOf(canPlaceBreakbulk(buildStowageModel(vessel), stripped, item, pose, vessel).reasons);
    if (!result.ok) return result;
    applyBreakbulk(plan, [...stripped.breakbulk_placements, breakbulkPlacementOf(cargoId, pose)]);
    return result;
  };

  return {
    vessel: null,
    plan: null,
    past: [],
    future: [],
    loadPlan: (vessel, plan) => set({ vessel, plan, past: [], future: [] }),

    placeContainer: putContainer,
    moveContainer: putContainer,

    unplaceContainer: (containerId) => {
      const { vessel, plan } = get();
      if (!vessel || !plan) return fail("no_plan", `${containerId}: no plan is loaded`);
      const placements = plan.placements.filter((p) => p.container_id !== containerId);
      // Not placed: nothing to undo and nothing to strand, so no history entry — and `ok`, because
      // the caller's intent ("this box should not be on board") already holds.
      if (placements.length === plan.placements.length) return resultOf([]);
      const next = withPlacements(plan, placements);
      const stranded = dependentsLosingSupport(vessel, plan, next, containerId);
      if (stranded.length) return fail("no_floating", strandedMessage(containerId, stranded));
      apply(plan, next);
      return resultOf([]);
    },

    placeBreakbulk: putBreakbulk,
    moveBreakbulk: putBreakbulk,

    unplaceBreakbulk: (cargoId) => {
      const { plan } = get();
      if (!plan) return;
      const remaining = plan.breakbulk_placements.filter((p) => p.cargo_id !== cargoId);
      if (remaining.length === plan.breakbulk_placements.length) return;
      applyBreakbulk(plan, remaining);
    },

    undo: () => {
      const { plan, past, future } = get();
      if (!plan || past.length === 0) return;
      set({ plan: past[past.length - 1], past: past.slice(0, -1), future: pushHistory(future, plan) });
    },

    redo: () => {
      const { plan, past, future } = get();
      if (!plan || future.length === 0) return;
      set({ plan: future[future.length - 1], past: pushHistory(past, plan), future: future.slice(0, -1) });
    },
  };
});
