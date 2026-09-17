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
import type { Slot } from "@/types/domain";
import { blocks, type PlacementResult, type Reason } from "@/engine/placement/reason";
import { slotCode } from "@/engine/slot-helpers";
import type { DropVerdict } from "./drop-verdict";

/** Where a committed drop came from. The 3D canvas may render its outcome AT THE CURSOR (the chip);
 * a 2D bay-plan cell renders it in the panel instead — a chip beside a cell the planner is not
 * pointing at would be describing the wrong grid. */
export type DropOrigin = "scene" | "bayplan";

/** The outcome of the LAST committed drop, kept in `usePlanStore` after the gesture it ended so it
 * outlives the pointer leaving the slot (P1/D5; review M2/M3/M6). Written by `commitPlacement` only —
 * never assembled by a component — and cleared by the lifetime table documented in
 * `store/commit-placement.ts`. */
export interface DropOutcome {
  /** The slot the drop was attempted on — what `setHoveredSlot` compares against to decide staleness. */
  slot: Slot;
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
 * the lifetime table in `commit-placement.ts`). */
export function dropOutcomeOf(
  result: PlacementResult,
  slot: Slot,
  origin: DropOrigin,
): DropOutcome | null {
  const reason = quotedReason(result);
  if (!reason) return null;
  return { slot, message: reason.message, ok: result.ok, origin };
}

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
  const headline = `Slot ${slotCode(slot)} — placing ${containerId}`;
  const message = verdict.reason?.message ?? REASON_FALLBACK;
  if (verdict.verdict === "invalid") return { tone: "error", headline, detail: `Refused: ${message}` };
  if (verdict.verdict === "warning") {
    return {
      tone: "warn",
      headline,
      detail: `Recorded, not refused — the checks below will list it: ${message}`,
    };
  }
  return { tone: "ok", headline, detail: "Clean drop — no rule is triggered." };
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

/** Everything the cursor's appearance depends on (requirement 6). */
export interface DropCursorState {
  /** A drag is in flight — the button is held (a list drag, or a 3D move past the 4 px threshold). */
  dragging: boolean;
  /** A container is in hand: dragged OR picked. */
  active: boolean;
  /** The verdict of the slot under the cursor, or null when no slot is hovered. */
  verdict: DropVerdict["verdict"] | null;
  /** A placed container is under the cursor, with nothing in hand. */
  overContainer: boolean;
}

/**
 * The viewport's cursor class — the truth table, first match wins (requirement 6; acceptance step 26).
 * Returned as Tailwind utility names, spelled out as literals so Tailwind's scanner generates them:
 *  - a drag in flight            → closed hand;
 *  - in hand, over a refused slot → not-allowed (the next release would be refused);
 *  - in hand, over a slot         → pointer (it would land);
 *  - in hand, over anything else  → crosshair ("point at a slot");
 *  - nothing in hand, over a box  → open hand: this is what makes the ≤4 px select / >4 px move
 *                                   threshold discoverable BEFORE the gesture starts;
 *  - otherwise                    → "" (the default arrow).
 */
export function dropCursorClass(state: DropCursorState): string {
  if (state.dragging) return "cursor-grabbing";
  if (state.active) {
    if (state.verdict === "invalid") return "cursor-not-allowed";
    if (state.verdict !== null) return "cursor-pointer";
    return "cursor-crosshair";
  }
  return state.overContainer ? "cursor-grab" : "";
}
