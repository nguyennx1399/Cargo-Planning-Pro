/**
 * drop-target.ts — "is the recorded drop outcome about the thing the planner is looking at now?"
 * (the staleness row of the lifetime table in `store/commit-placement.ts`).
 *
 * Split out of `usePlanStore.ts` when the outcome's target became a union: the SLOT rule lives in
 * `setHoveredSlot` and the POSE rule in the hand slice's `setHoveredPose`, and one rule implemented
 * twice is how two surfaces start disagreeing about the same outcome. It is pure (`drop-feedback`
 * types only), so the whole rule is node-testable without a store.
 *
 * Compared WITHIN a kind (Phase 03, decision 4): a slot and a pose are different questions, so
 * entering a pose does not retire a slot outcome. It does not need to — starting any gesture clears
 * the outcome outright, so an outcome can only ever meet a hover from the same kind of gesture.
 */
import type { DropTarget } from "./drop-feedback";

/** The identity of a target, used ONLY to answer "same target?" — never as a plan or model key. The
 * pose half deliberately mirrors `pose-verdict.ts`'s private memo key; the two are separate concerns
 * (this one is staleness, that one is memoisation) and are allowed to diverge. */
export function targetKey(target: DropTarget): string {
  if (target.kind === "slot") {
    const { bay, row, tier } = target.slot;
    return `slot|${bay}|${row}|${tier}`;
  }
  const { areaId, x_m, z_m, rotation_deg } = target.pose;
  return `pose|${areaId ?? ""}|${x_m}|${z_m}|${rotation_deg ?? 0}`;
}

/** True when hovering `next` makes the last outcome stale: a DIFFERENT target was entered, so the
 * planner has moved on (review M6). Leaving the canvas (`next === null`) never clears it — the
 * message must outlive the pointer, which is why it is store state at all. Entering the outcome's OWN
 * target does not clear it either: its hover text is byte-identical to the outcome's
 * (`drop-feedback.ts`), so clearing would flicker the line. */
export function staleOutcome(outcome: { target: DropTarget } | null, next: DropTarget | null): boolean {
  if (!outcome || !next || next.kind !== outcome.target.kind) return false;
  return targetKey(next) !== targetKey(outcome.target);
}
