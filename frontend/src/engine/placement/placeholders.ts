/**
 * placeholders.ts — "where can THIS box go" (spec §4.6), pure.
 *
 * ONE predicate, two shapes: every slot in `model.slots` is either valid (`canPlaceContainer.ok`) or
 * blocked (at least one error-severity reason). Nothing here re-derives a placement rule, so the
 * placeholder set, the ghost tint and the violation list can never disagree, and the size of the
 * candidate is never assumed (`sizeFitsBay` decides which bay a size belongs in — not this module).
 * `freeRegionsFor` is the same idea one level up: the AREA-shaped answer for a project-cargo item,
 * whose feasibility is a projection of `canPlaceBreakbulk`'s own reasons (see `AREA_FIT_RULES`).
 *
 * Perf, measured (Phase B: ≈1.05 ms for BBC SAO PAULO's 447 slots, dominated by the predicate's
 * reason MESSAGES for the ~437 blocked ones):
 *  - `validSlotsFor` is the drag/pick-start call. Memoise it at the call site (`useMemo` keyed on
 *    vessel/plan/container) — never run a sweep per pointer move.
 *  - the hover path is `blockedReasonFor` (one slot, one predicate call). Do NOT call `blockedSlots`
 *    per hover: it sweeps again and allocates a message per blocked slot.
 *  - `blockedSlots` exists for callers that genuinely need the whole blocked set with its reasons.
 *
 * Slot keys: driven entirely by `model.slots`/`SlotDef`, whose key is `"bay|row|tier"` — the
 * authoritative one. The `"bay:row:tier"` key `engine/all-slots.ts` uses privately is never built
 * here (`slotByKey` lookups with it fail open).
 *
 * Previewing a MOVE: every function below checks the candidate against a plan with the subject's own
 * placement removed (`previewPlan`) — its slot for a box, its pose for a project-cargo item.
 * `canPlaceContainer` assumes the candidate is not yet in `plan.placements` — handed an already-placed
 * box it reports a self-referencing `cell_conflict` ("X and X occupy the same position"), counts that
 * box's own weight into `stack_weight` and pairs it with itself in `overstow`, i.e. a phantom rejection
 * of the very slot the box already occupies. The draft store strips identically before it commits
 * (`putContainer`/`putBreakbulk`), so the ghost and the commit agree; do not hand these functions a
 * plan that was stripped (or not) by other means.
 */
import type { BreakbulkCargo, Container, Slot, StowagePlan, Vessel } from "@/types/domain";
import type { Rect } from "@/engine/breakbulk-overlap-check";
import {
  breakbulkOccupancy,
  buildStowageModel,
  clipRect,
  occupiedRectsByArea,
  type SlotDef,
  type StowageArea,
} from "@/engine/stowage-model";
import { canPlaceBreakbulk, type BreakbulkPose } from "./can-place-breakbulk";
import { canPlaceContainer } from "./can-place-container";
import { footprintExtents } from "./breakbulk-pose";
import { blocks, type PlacementResult, type PlacementRule, type Reason } from "./reason";

export interface BlockedSlot {
  slot: SlotDef;
  /** The FIRST blocking reason only: the drop is refused for this one reason, and the tooltip needs
   * a line, not the whole list. */
  reason: Reason;
}

/** The three drop outcomes the UI tints from (Phase C, D1): `valid` (place it), `warning` (place it,
 * but it WILL appear in the violations list — the overridable limits), `invalid` (refused). */
export type SlotVerdict = "valid" | "warning" | "invalid";

const firstBlocker = (result: PlacementResult): Reason | null => result.reasons.find(blocks) ?? null;

/** The plan a candidate is checked against: its own placement dropped when it is already on board
 * (see the header). Both kinds of candidate have their own list, so the id is looked for in both — a
 * container id is never a cargo id, and the untouched list keeps its ARRAY identity so the predicate's
 * `occupancyFor` cache stays warm. Returned as the SAME object when the candidate is unplaced — the
 * common case. */
function previewPlan(plan: StowagePlan, subjectId: string): StowagePlan {
  const container = plan.placements.some((p) => p.container_id === subjectId);
  const cargo = plan.breakbulk_placements.some((p) => p.cargo_id === subjectId);
  if (!container && !cargo) return plan;
  return {
    ...plan,
    placements: container ? plan.placements.filter((p) => p.container_id !== subjectId) : plan.placements,
    breakbulk_placements: cargo ? plan.breakbulk_placements.filter((p) => p.cargo_id !== subjectId) : plan.breakbulk_placements,
  };
}

/** Every slot the candidate may go in. Empty is a legitimate answer (nothing fits). */
export function validSlotsFor(vessel: Vessel, plan: StowagePlan, container: Container): SlotDef[] {
  const model = buildStowageModel(vessel);
  const preview = previewPlan(plan, container.id);
  const out: SlotDef[] = [];
  for (const slot of model.slots) {
    if (canPlaceContainer(model, preview, container, slot, vessel).ok) out.push(slot);
  }
  return out;
}

/** The complement of `validSlotsFor` with one blocking reason each — for a red hover tooltip or a
 * "show blocked" layer. Loads a message per blocked slot, so keep it off the pointer-move path. */
export function blockedSlots(vessel: Vessel, plan: StowagePlan, container: Container): BlockedSlot[] {
  const model = buildStowageModel(vessel);
  const preview = previewPlan(plan, container.id);
  const out: BlockedSlot[] = [];
  for (const slot of model.slots) {
    const reason = firstBlocker(canPlaceContainer(model, preview, container, slot, vessel));
    if (reason) out.push({ slot, reason });
  }
  return out;
}

/** The hovered-slot reason, computed for that slot alone — the cheap half of `blockedSlots`. `null`
 * when the slot is fine (or only warns), i.e. when the drop would be accepted. */
export function blockedReasonFor(
  vessel: Vessel,
  plan: StowagePlan,
  container: Container,
  slot: Slot,
): Reason | null {
  return firstBlocker(
    canPlaceContainer(buildStowageModel(vessel), previewPlan(plan, container.id), container, slot, vessel),
  );
}

/** Fold a predicate result into the tint state. Green would promise a clean placement the plan-wide
 * report then flags for a warning-severity reason (D1), so the warning case is its own state. */
export function verdictOf(result: PlacementResult): SlotVerdict {
  if (!result.ok) return "invalid";
  return result.reasons.length > 0 ? "warning" : "valid";
}

/** The item-vs-AREA rules: the footprint not fitting the area at all, the item not fitting under the
 * clear height, its own footprint pressure not fitting the rating. These hold for every pose in the
 * area, which is what makes them the feasibility set. Reasons that depend on WHERE a pose sits
 * (keep-outs, containers, other project cargo, the 20 m band) are deliberately absent: they are the
 * live per-pose verdict's job. Selected OUT of the single predicate's reasons (spec §4.6) — this is
 * not a second rule set, and it must stay a projection of `canPlaceBreakbulk`'s own output.
 * Note `breakbulk_over_pressure` is a warning per D1, so `blocks()` is the wrong filter here: the
 * projection is by rule id. */
const AREA_FIT_RULES: ReadonlySet<PlacementRule> = new Set<PlacementRule>([
  "breakbulk_out_of_deck_area",
  "breakbulk_too_tall",
  "breakbulk_over_pressure",
]);

const firstAreaFit = (result: PlacementResult): Reason | null =>
  result.reasons.find((r) => AREA_FIT_RULES.has(r.rule)) ?? null;

/** One area as the UI draws it, plus whether the item in hand belongs there at all (spec §4.6). */
export interface FreeRegion {
  /** The whole area, not just its rect: the UI labels it and reads `level`/`surfaceY`/`loadRating`. */
  area: StowageArea;
  /** True when the AREA admits this item at all — it fits the rect, its height fits the clear height
   * and its own pressure fits the rating. Occupancy and keep-outs are NOT part of this (see
   * `AREA_FIT_RULES`), so `feasible` is "fits in: weather deck, Hold 2 tank top" for the sidebar, not
   * a promise that a drop succeeds: the ghost's own pose verdict decides that. */
  feasible: boolean;
  /** Why not, when `feasible` is false — the first item-vs-area reason, same shape as
   * `BlockedSlot.reason`. Null when feasible. */
  reason: Reason | null;
  /** The area's keep-outs clipped to `area.rect` — the parts a footprint in this area can actually
   * touch, and the only ones worth drawing (D-P4: BBC's crane foundations sit partly outboard). */
  keepOuts: Rect[];
  /** Ground already taken, for drawing: placed project cargo first, then container stacks. NOT clipped
   * — a stack is drawn whole even where it leaves the area. Read from the plan AS IS: the subject's own
   * current footprint is drawn while it is being dragged (the predicate strips it internally), so the
   * rects here and the `feasible` check are deliberately not the same set. */
  occupied: Rect[];
}

/** Where the item in hand could go, one entry per area of the vessel's model, in the model's own order
 * (spec §4.6; the area-shaped sibling of `validSlotsFor`, same "one predicate, two shapes" rule).
 *
 * Perf: this is a drag/pick-START call, like `validSlotsFor` — memoise it at the call site
 * (`useMemo` keyed on vessel/plan/item) and never run it per pointer move; the move path is
 * `breakbulk-pose.ts` plus one memoised predicate call. It costs one `canPlaceBreakbulk` per area plus
 * one occupancy grouping for the whole call.
 *
 * `feasible` is probed at ONE pose per area: the item tucked into the area rect's stern/port inner
 * corner at rotation 0, which lies inside whenever the footprint fits at all and pokes out on both
 * sides of an axis when it does not. Rotation 0 because the probe answers "does the item belong in
 * this area", not "does this pose work" — the R key must not reshuffle the sidebar list. */
export function freeRegionsFor(vessel: Vessel, plan: StowagePlan, item: BreakbulkCargo): FreeRegion[] {
  const model = buildStowageModel(vessel);
  const preview = previewPlan(plan, item.id);
  const stacksByArea = occupiedRectsByArea(vessel, plan.placements);
  const cargoByArea = breakbulkOccupancy(plan.breakbulk_cargo, plan.breakbulk_placements);
  const [ex, ez] = footprintExtents(item);
  return model.areas.map((area) => {
    const probe: BreakbulkPose = { areaId: area.id, x_m: area.rect.xMin + ex / 2, z_m: area.rect.zMin + ez / 2 };
    const reason = firstAreaFit(canPlaceBreakbulk(model, preview, item, probe, vessel));
    return {
      area,
      feasible: reason === null,
      reason,
      keepOuts: area.keepOuts.map((k) => clipRect(k, area.rect)).filter((r): r is Rect => r !== null),
      occupied: [...(cargoByArea.get(area.id) ?? []), ...(stacksByArea[area.id] ?? [])],
    };
  });
}
