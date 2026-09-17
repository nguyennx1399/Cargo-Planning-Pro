/**
 * drop-feedback.ts — the ONE wording for what a drop would do, and the ONE wording for what it did
 * (P1, decision D4). Pure: no three/react/store imports, so every sentence the planner reads can be
 * asserted in a node test.
 *
 * Three surfaces say the same thing about the same result — the at-cursor chip, the Sidebar's
 * Container readout and the 2D bay-plan notice — and one more (the ghost/placeholders) shows its
 * tint. Before this module the refusal and the "recorded, not fatal" sentence were string literals in
 * `ContainerInspector.tsx` AND in `BayPlanView.tsx`, worded differently for the same outcome
 * ("Recorded, not blocked: …" vs "Recorded, not blocked — the checks below will list it: …"). Now
 * there is one function per wording, so no two surfaces can disagree.
 *
 * The vocabulary is deliberately the engine's own: the reason text comes from the predicate that
 * gated the drop, never from a UI-local rule.
 */
import type { BreakbulkCargo, Slot } from "@/types/domain";
import { blocks, type PlacementResult, type Reason } from "@/engine/placement/reason";
import type { BreakbulkPose } from "@/engine/placement/can-place-breakbulk";
import { slotCode } from "@/engine/slot-helpers";
import type { DropVerdict } from "./drop-verdict";

/** Where a committed drop came from. The 3D canvas may render its outcome AT THE CURSOR (the chip);
 * a 2D bay-plan cell renders it in the panel instead — a chip beside a cell the planner is not
 * pointing at would be describing the wrong grid. */
export type DropOrigin = "scene" | "bayplan";

/**
 * What a drop was aimed at. A container lands in a discrete `Slot`; project cargo lands at a free
 * `BreakbulkPose` inside an area (Phase D). ONE record type for both, discriminated by `kind`, so the
 * single outcome record and every reader of it never need a parallel field — two fields describing
 * one drop is exactly the failure Phase 03's risk table guards against.
 */
export type DropTarget = { kind: "slot"; slot: Slot } | { kind: "pose"; pose: BreakbulkPose };

/** The two doors to `DropTarget`, so a call site never spells the discriminant itself. */
export const slotTarget = (slot: Slot): DropTarget => ({ kind: "slot", slot });
export const poseTarget = (pose: BreakbulkPose): DropTarget => ({ kind: "pose", pose });

/** The outcome of the LAST committed drop, kept in `usePlanStore` after the gesture it ended so it
 * outlives the pointer leaving the target (P1/D5; review M2/M3/M6). Written by
 * `store/commit-placement.ts` only — never assembled by a component — and cleared by the lifetime
 * table documented there. */
export interface DropOutcome {
  /** The target the drop was attempted on — what `setHoveredSlot`/`setHoveredPose` compare against to
   * decide staleness (within the same `kind` only: a slot and a pose are different questions). */
  target: DropTarget;
  /** A `Reason.message` verbatim (see `quotedReason`), never a re-worded copy. */
  message: string;
  /** false = refused, nothing was written. true = it LANDED and the reason is recorded: the plan-wide
   * checks will list it (D1's overridable limits). */
  ok: boolean;
  origin: DropOrigin;
}

/** The three states of a drop — and, deliberately, the `styles.css` class name for each: `.ok` /
 * `.warn` / `.error` carry the same hex tokens as `HIGHLIGHT.valid` / `warning` / `invalid`, so
 * whatever renders a tone gets the canvas's colour with no mapping table of its own. */
export type DropTone = "ok" | "warn" | "error";

export interface DropFeedback {
  tone: DropTone;
  /** Names what is under the cursor (`Slot 220082 — placing DEMU0001136`), or null for a committed
   * outcome, which is already about a slot the chip may no longer be over. */
  headline: string | null;
  /** The ONE sentence about the verdict/outcome. */
  detail: string;
}

/** `DropVerdict.reason` is non-null for both of the non-clean verdicts (`drop-verdict.ts` takes it
 * from the result's own reasons), so this is unreachable — it exists so a broken invariant renders as
 * a visible sentence rather than as "undefined" beside the word "Refused". */
const REASON_FALLBACK = "reason unavailable";

/**
 * The reason a surface should QUOTE for a predicate/commit result: a refusal quotes its first BLOCKING
 * reason — a warning must never be shown as the reason a drop was refused — while an
 * accepted-with-warnings result quotes its first reason, which is the warning being recorded.
 *
 * Mirrors `lib/drop-verdict.ts`'s private `toVerdict` on purpose: the hover verdict and the
 * post-commit outcome must quote the SAME reason for the same result, or a rejected pick's text would
 * change wording the moment it becomes an outcome. It is not a theoretical difference — `overstow`
 * (a warning) is pushed after every error except `breakbulk_overlaps_container`, so for a slot that
 * is both an overstow and an overlap a plain `reasons[0]` really is a warning on a REFUSED result.
 * (Collapsing this and `toVerdict` into one helper needs an edit to `lib/drop-verdict.ts`, which P1
 * does not own — recorded as a follow-up.)
 */
export function quotedReason(result: PlacementResult): Reason | null {
  if (result.ok) return result.reasons[0] ?? null;
  return result.reasons.find(blocks) ?? result.reasons[0] ?? null;
}

/** The record a commit leaves behind, or null when there is nothing to record (a clean accept — see
 * the lifetime table in `commit-placement.ts`). Private: the two typed doors below are the call
 * sites, so a slot outcome and a pose outcome cannot be built through different code. */
function outcomeOf(result: PlacementResult, target: DropTarget, origin: DropOrigin): DropOutcome | null {
  const reason = quotedReason(result);
  if (!reason) return null;
  return { target, message: reason.message, ok: result.ok, origin };
}

/** The SLOT door — signature unchanged from P1, which is what keeps the existing outcome tests and
 * both container commit triggers reading exactly as they did. */
export function dropOutcomeOf(result: PlacementResult, slot: Slot, origin: DropOrigin): DropOutcome | null {
  return outcomeOf(result, slotTarget(slot), origin);
}

/** The POSE door (Phase D): the same record for a project-cargo drop, whose target has no slot. */
export function dropPoseOutcomeOf(result: PlacementResult, pose: BreakbulkPose, origin: DropOrigin): DropOutcome | null {
  return outcomeOf(result, poseTarget(pose), origin);
}

/** The ONE sentence about a hover verdict, shared by the slot and the pose headline — a container and
 * a project-cargo item must never describe the same verdict with different words (the reason one
 * would drift is that the two headlines are built in two places). */
const verdictDetail = (verdict: DropVerdict): { tone: DropTone; detail: string } => {
  const message = verdict.reason?.message ?? REASON_FALLBACK;
  if (verdict.verdict === "invalid") return { tone: "error", detail: `Refused: ${message}` };
  if (verdict.verdict === "warning") {
    return { tone: "warn", detail: `Recorded, not refused — the checks below will list it: ${message}` };
  }
  return { tone: "ok", detail: "Clean drop — no rule is triggered." };
};

/**
 * What a drop on `slot` would do, as `{tone, headline, detail}` (requirement 1). The wording is
 * byte-identical to `dropOutcomeText`'s for the same outcome, so the hand-over from "hovering" to
 * "committed" is seamless.
 *
 * `containerId` is a third argument because the headline names the box in hand and the `DropVerdict`
 * object carries only `{verdict, reason}` — the phase file's two-argument sketch has no way to say
 * WHICH container is being placed.
 */
export function dropVerdictText(slot: Slot, verdict: DropVerdict, containerId: string): DropFeedback {
  return { headline: `Slot ${slotCode(slot)} — placing ${containerId}`, ...verdictDetail(verdict) };
}

/**
 * The POSE-shaped headline (Phase D): a project-cargo item has no slot code, so the target is named
 * by the area the pointer is in and the snapped position it is aiming at — plus the rotation when one
 * is set, because a rotated footprint is the one thing the translucent ghost cannot be read for at a
 * glance and `R` would otherwise have no feedback outside the model. `areaLabel` is passed in rather
 * than looked up: this module stays free of the stowage model, and the caller that owns the hovered
 * area (the chip) already has the label.
 */
export function dropPoseVerdictText(
  areaLabel: string,
  pose: BreakbulkPose,
  verdict: DropVerdict,
  itemId: BreakbulkCargo["id"],
): DropFeedback {
  const at = `${pose.x_m.toFixed(1)} / ${pose.z_m.toFixed(1)} m`;
  const angle = pose.rotation_deg === 90 ? " · 90°" : "";
  return { headline: `${areaLabel} ${at}${angle} — placing ${itemId}`, ...verdictDetail(verdict) };
}

/**
 * What the last committed drop did (requirement 2, review M3). An accepted-with-warnings drop is
 * `warn`/amber and says so in words — the drop happened, and the plan-wide checks will name it — so it
 * can never read like the red refusal beside it.
 */
export function dropOutcomeText(outcome: DropOutcome): DropFeedback {
  return outcome.ok
    ? {
        tone: "warn",
        headline: null,
        detail: `Placed. Recorded, not blocked — the checks below will list it: ${outcome.message}`,
      }
    : { tone: "error", headline: null, detail: `Not placed — ${outcome.message}` };
}

/** The cursor truth table moved to its own module for the 200-LOC rule; re-exported here because
 * this is the import every reader has always used (and `lib/__tests__/drop-feedback.test.ts`). */
export { dropCursorClass, type DropCursorState } from "./drop-cursor";
