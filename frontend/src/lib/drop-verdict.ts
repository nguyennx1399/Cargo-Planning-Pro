/**
 * drop-verdict.ts — "what would dropping onto THIS slot do", for the UI layers that have to say it
 * out loud (Phase C). The 3D ghost tint, the placeholder tint, the 2D bay-plan highlight and the
 * Sidebar readout all read this one function, so no two of them can describe the same target
 * differently. It also owns the ONE slot-visibility rule the drop layers share (below).
 *
 * Why it sits next to (not inside) `engine/placement/placeholders.ts`: that module answers WHICH
 * slots are open and deliberately drops the reasons of the accepted ones. But D1's overridable
 * limits (`overstow`) are `warning`-severity reasons that only exist in the predicate RESULT —
 * `blockedReasonFor` returns null for them, and `validSlotsFor` cannot tell a clean slot from an
 * accepted-with-warnings one. The three-state UI (green clean / amber accepted-and-recorded / red
 * refused) therefore needs the full result. It is the SAME `canPlaceContainer` gate the validator
 * and the draft store use — never a second, UI-local placement rule.
 *
 * The plan a candidate is judged against has the candidate's OWN placement stripped, exactly as the
 * engine's private `previewPlan` and the store's `putContainer` do: without the strip a MOVE would
 * report a self-referencing `cell_conflict` on the very slot the box came from. That strip is
 * MEMOISED per (plan, candidate) — its object identity is what keeps `canPlaceContainer`'s plan-keyed
 * `indexCache` warm; a fresh strip per call (which a MOVE needs on every pointer move) rebuilt the
 * whole plan index each time (review M4).
 */
import type { Container, Slot, StowagePlan, Vessel } from "@/types/domain";
import type { SlotDef } from "@/engine/stowage-model";
import { buildStowageModel } from "@/engine/stowage-model";
import { canPlaceContainer } from "@/engine/placement/can-place-container";
import { verdictOf, type SlotVerdict } from "@/engine/placement/placeholders";
import { blocks, type PlacementResult, type Reason } from "@/engine/placement/reason";
import { bayPosition } from "@/engine/slot-helpers";
import { HIGHLIGHT } from "./colors";

/** Tint per `verdictOf` outcome — the one place a verdict becomes a colour (hexes match the
 * `--ok`/`--signal`/`--error` tokens in styles.css so canvas and panels agree). */
export const DROP_TINT: Record<SlotVerdict, string> = {
  valid: HIGHLIGHT.valid,
  warning: HIGHLIGHT.warning,
  invalid: HIGHLIGHT.invalid,
};

/** The viewer toggles that hide part of the ship: the drop layers must agree on them or a box can be
 * dropped into a bay or deck the planner cannot see (review M1). */
export interface SlotViewFilter {
  showOnDeck: boolean;
  showUnderDeck: boolean;
  bayFilter: number | null;
}

/** The visibility rule `ContainerInstances` applies to the cargo, applied to slots: the deck toggles
 * by the slot's own deck, and the bay filter — a half (odd) slot belongs to the filter through its
 * 40' parent, which is the only bay the selector can name. View state only: it never gates a commit
 * (that is `canPlaceContainer`), it decides what is worth picking and drawing. */
export function slotVisible(slot: SlotDef, vessel: Vessel, view: SlotViewFilter): boolean {
  if (slot.deck === "on" ? !view.showOnDeck : !view.showUnderDeck) return false;
  if (view.bayFilter === null) return true;
  return slot.bay === view.bayFilter || bayPosition(slot.bay, vessel.bays)?.fortyBay === view.bayFilter;
}

export interface DropVerdict {
  verdict: SlotVerdict;
  /** The ONE line to show. Refused → the first blocking reason (a warning is never shown as the
   * reason a drop was refused); accepted-with-warnings → the recorded (warning-severity) reason,
   * which the caller must phrase as recorded, not fatal — the drop still lands and the plan-wide
   * report lists it; clean → null. */
  reason: Reason | null;
}

/** One stripped plan per (plan, candidate) — see the header. Plans are immutable by contract (the
 * draft store always builds a new one), so this can never go stale, and the WeakMap releases with
 * the plan. */
const stripCache = new WeakMap<StowagePlan, Map<string, StowagePlan>>();

/** The candidate's own placement removed — mirrors the engine's private `previewPlan`. */
function subjectStrippedPlan(plan: StowagePlan, containerId: string): StowagePlan {
  let byId = stripCache.get(plan);
  if (!byId) {
    byId = new Map();
    stripCache.set(plan, byId);
  }
  const cached = byId.get(containerId);
  if (cached) return cached;
  const stripped = plan.placements.some((p) => p.container_id === containerId)
    ? { ...plan, placements: plan.placements.filter((p) => p.container_id !== containerId) }
    : plan; // not placed (the common case): the plan itself, identity preserved
  byId.set(containerId, stripped);
  return stripped;
}

function toVerdict(result: PlacementResult): DropVerdict {
  const verdict = verdictOf(result);
  const reason =
    verdict === "invalid"
      ? result.reasons.find(blocks) ?? result.reasons[0] ?? null
      : result.reasons[0] ?? null;
  return { verdict, reason };
}

/** One-entry hover memo: the ghost and the Sidebar readout ask for the SAME hovered slot on the same
 * pointer move (review M4), and this collapses that into a single predicate call. Deliberately one
 * entry with identity keys — it holds references to the current vessel/plan only, and every new
 * hover replaces it. */
let lastVerdict: {
  vessel: Vessel;
  plan: StowagePlan;
  containerId: string;
  slotKey: string;
  verdict: DropVerdict;
} | null = null;

/** Verdict for ONE slot — the hover path, and safe on pointer-move: one predicate call for one
 * slot (the expensive part of a full sweep is the reason text of the blocked slots). */
export function verdictForSlot(
  vessel: Vessel,
  plan: StowagePlan,
  container: Container,
  slot: Slot,
): DropVerdict {
  const slotKey = `${slot.bay}|${slot.row}|${slot.tier}`;
  const memo = lastVerdict;
  if (
    memo &&
    memo.vessel === vessel &&
    memo.plan === plan &&
    memo.containerId === container.id &&
    memo.slotKey === slotKey
  ) {
    return memo.verdict;
  }
  const verdict = toVerdict(
    canPlaceContainer(
      buildStowageModel(vessel),
      subjectStrippedPlan(plan, container.id),
      container,
      slot,
      vessel,
    ),
  );
  lastVerdict = { vessel, plan, containerId: container.id, slotKey, verdict };
  return verdict;
}

/** Verdicts for a whole candidate set, keyed by `SlotDef.key` ("bay|row|tier"). Called once per
 * gesture with the VALID set: the blocked slots are not in it, and skipping them keeps this second
 * pass cheap on top of `validSlotsFor`'s sweep. */
export function verdictsForSlots(
  vessel: Vessel,
  plan: StowagePlan,
  container: Container,
  slots: readonly SlotDef[],
): Map<string, DropVerdict> {
  const model = buildStowageModel(vessel);
  const preview = subjectStrippedPlan(plan, container.id);
  const out = new Map<string, DropVerdict>();
  for (const slot of slots) {
    out.set(slot.key, toVerdict(canPlaceContainer(model, preview, container, slot, vessel)));
  }
  return out;
}
