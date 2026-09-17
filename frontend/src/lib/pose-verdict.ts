/**
 * pose-verdict.ts — the POSE half of the verdict layer (Phase D): "what would dropping THIS item at
 * THIS position do". A container has a discrete slot (`verdictForSlot`/`verdictsForSlots` in
 * `lib/drop-verdict.ts`); project cargo is free-positioned, so its target is a `BreakbulkPose` — the
 * same question, split by target rather than by mechanism, which is why the two modules share
 * `toVerdict` and hold the same rules:
 *
 *  - ONE predicate call per pointer move. The ghost, the at-cursor chip and the sidebar readout all
 *    name the pose under the pointer, so `verdictForPose` memoises ONE entry (review M4's fix, applied
 *    to the pose path). The key is the pose's own NUMBERS, not its object identity: the drop plane
 *    publishes a fresh object per move, and a move that snaps back onto the cell it was already on is
 *    the same question.
 *  - The subject's OWN placement is stripped. Mirrors `subjectStrippedPlan`'s container twin for the
 *    same reason (a MOVE must be judged exactly like a first placement — `canPlaceBreakbulk` already
 *    excludes the subject's own rect and band weight, and the strip is what keeps the overlap wording
 *    identical too). Container placements keep their ARRAY identity, which is what keeps
 *    `canPlaceBreakbulk`'s own occupancy cache warm.
 *  - No UI-local placement rule anywhere: this is the same `canPlaceBreakbulk` gate the commit calls.
 */
import type { BreakbulkCargo, StowagePlan, Vessel } from "@/types/domain";
import { buildStowageModel } from "@/engine/stowage-model";
import { canPlaceBreakbulk, type BreakbulkPose } from "@/engine/placement/can-place-breakbulk";
import { toVerdict, type DropVerdict } from "./drop-verdict";

/** One stripped plan per (plan, cargo id). Plans are immutable by contract (the draft store always
 * builds a new one), so this can never go stale, and the WeakMap releases with the plan. */
const cargoStripCache = new WeakMap<StowagePlan, Map<string, StowagePlan>>();

/** The candidate's own breakbulk placement removed — the pose-shaped `subjectStrippedPlan`. */
function subjectStrippedPlanForCargo(plan: StowagePlan, cargoId: string): StowagePlan {
  let byId = cargoStripCache.get(plan);
  if (!byId) {
    byId = new Map();
    cargoStripCache.set(plan, byId);
  }
  const cached = byId.get(cargoId);
  if (cached) return cached;
  const stripped = plan.breakbulk_placements.some((p) => p.cargo_id === cargoId)
    ? { ...plan, breakbulk_placements: plan.breakbulk_placements.filter((p) => p.cargo_id !== cargoId) }
    : plan; // not placed (the common case): the plan itself, identity preserved
  byId.set(cargoId, stripped);
  return stripped;
}

/** The pose as a memo key — same numbers, same question. `rotation_deg` is normalised because an
 * absent rotation and 0 are the same pose to the predicate. */
const poseKeyOf = (pose: BreakbulkPose): string =>
  `${pose.areaId ?? ""}|${pose.x_m}|${pose.z_m}|${pose.rotation_deg ?? 0}`;

/** One-entry hover memo, the sibling of `drop-verdict.ts`'s `lastVerdict`. Deliberately one entry with
 * identity keys for the vessel/plan/item: it holds references to the current vessel and plan only, and
 * every new pose replaces it, so the previous vessel's plan is released with it. */
let lastPoseVerdict: {
  vessel: Vessel;
  plan: StowagePlan;
  cargoId: string;
  poseKey: string;
  verdict: DropVerdict;
} | null = null;

/** Verdict for ONE pose of ONE project-cargo item. `pose` is expected to be what `breakbulk-pose.ts`
 * produced for the pointer (snapped, then clamped into the area), but nothing here depends on that: a
 * pose that still breaks a rule reports that rule, which is what makes the clamp safe (it never
 * relaxes a limit) and the ghost honest. */
export function verdictForPose(
  vessel: Vessel,
  plan: StowagePlan,
  item: BreakbulkCargo,
  pose: BreakbulkPose,
): DropVerdict {
  const poseKey = poseKeyOf(pose);
  const memo = lastPoseVerdict;
  if (
    memo &&
    memo.vessel === vessel &&
    memo.plan === plan &&
    memo.cargoId === item.id &&
    memo.poseKey === poseKey
  ) {
    return memo.verdict;
  }
  const verdict = toVerdict(
    canPlaceBreakbulk(buildStowageModel(vessel), subjectStrippedPlanForCargo(plan, item.id), item, pose, vessel),
  );
  lastPoseVerdict = { vessel, plan, cargoId: item.id, poseKey, verdict };
  return verdict;
}
