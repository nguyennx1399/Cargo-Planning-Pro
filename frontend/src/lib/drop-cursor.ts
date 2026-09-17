/**
 * drop-cursor.ts — the viewport's cursor class, "what the next release would do", shown BEFORE it
 * happens (P1, requirement 6; acceptance step 26). Split out of `drop-feedback.ts` (200-LOC rule):
 * that module owns what a drop SAYS, this one owns what the pointer LOOKS like while it is being
 * aimed. Both are pure — no three/react/store imports, so the whole truth table is node-testable.
 *
 * Re-exported by `drop-feedback.ts`, which is where every reader has always imported it from.
 */
import type { DropVerdict } from "./drop-verdict";

/** Everything the cursor's appearance depends on. */
export interface DropCursorState {
  /** A drag is in flight — the button is held (a list drag, or a 3D move past the 4 px threshold). */
  dragging: boolean;
  /** An item is in hand: dragged OR picked, container OR project cargo. */
  active: boolean;
  /** The verdict of the target under the cursor, or null when no target is hovered. */
  verdict: DropVerdict["verdict"] | null;
  /** A placed item is under the cursor, with nothing in hand. */
  overContainer: boolean;
}

/**
 * The truth table, first match wins:
 *  - a drag in flight             → closed hand;
 *  - in hand, over a refused target → not-allowed (the next release would be refused);
 *  - in hand, over a target        → pointer (it would land);
 *  - in hand, over anything else   → crosshair ("point at a target");
 *  - nothing in hand, over an item → open hand: this is what makes the ≤4 px select / >4 px move
 *                                    threshold discoverable BEFORE the gesture starts;
 *  - otherwise                     → "" (the default arrow).
 *
 * Returned as Tailwind utility names, spelled out as literals so Tailwind's scanner generates them.
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
