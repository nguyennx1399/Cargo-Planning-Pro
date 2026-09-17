/**
 * cargo-click-action.ts — what a click on an item that is ALREADY ON BOARD means (Phase 01 of the
 * select-to-pick plan).
 *
 * WHY IT EXISTS: until now a click on placed cargo only ever selected it, and the single-pointer path
 * (WCAG 2.5.7 — click to take, click to place) existed solely for UNPLACED items in the sidebar lists.
 * A box already on the ship could therefore only be moved with a held press-drag past the 4 px
 * threshold, which is not a path everyone can perform.
 *
 * WHY IT IS A MODULE AND NOT AN `if` IN THE CLICK HANDLER: the rule is a four-row state machine over
 * (what is selected, what is in hand), it must read identically for both cargo kinds, and neither
 * instance layer is reachable from a node test. A state machine that lives in two R3F components is one
 * that drifts silently.
 *
 * THE RULE — the whole thing:
 *
 * | in hand    | selected     | click on | action    |
 * |------------|--------------|----------|-----------|
 * | nothing    | not this id  | this id  | `select`  |  first click: inspect it (unchanged behaviour)
 * | nothing    | this id      | this id  | `pick`    |  second click on the same item: take it in hand
 * | this id    | —            | this id  | `putDown` |  click what you are holding: put it back
 * | another id | —            | this id  | `ignore`  |  a gesture owns the pointer; never swap mid-gesture
 *
 * `select` deliberately comes FIRST so that one click can never arm a hand: every inspect-by-click
 * would otherwise hide the hull and light up the placeholders, and the planner would be pressing Esc
 * just to look at a box.
 *
 * The `ignore` row is the one that protects a placement: silently swapping the hand to whatever was
 * clicked mid-gesture is how the wrong box ends up in the slot.
 *
 * Deliberately NOT part of the decision:
 *  - `handMode`: a drag and a pick put down the same way, and the trailing click of a drag is already
 *    suppressed by the components' own `movedRef`;
 *  - whether the pick is ALLOWED (a container carrying other boxes is refused by
 *    `canBeginContainerMove`): that is a placement rule, and this module decides intent, not legality.
 */
import type { Hand } from "./hand-slice";

export type CargoClickAction = "select" | "pick" | "putDown" | "ignore";

/** The state this decision reads — structural, so a test needs no store. */
export interface CargoClickState {
  selectedId: string | null;
  inHand: Hand | null;
}

export function cargoClickAction(state: CargoClickState, clickedId: string): CargoClickAction {
  if (state.inHand) return state.inHand.id === clickedId ? "putDown" : "ignore";
  return state.selectedId === clickedId ? "pick" : "select";
}
