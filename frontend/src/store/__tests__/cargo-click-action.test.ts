/**
 * The click state machine (Phase 01). Every row of the table in `cargo-click-action.ts`, plus the two
 * properties the rule exists to guarantee: one click never arms a hand, and a gesture in flight is
 * never hijacked.
 */
import { describe, expect, it } from "vitest";
import { cargoClickAction, type CargoClickState } from "@/store/cargo-click-action";

const nothingInHand: CargoClickState = { selectedId: null, inHand: null };

describe("cargoClickAction", () => {
  it("first click on an untouched item selects it", () => {
    expect(cargoClickAction(nothingInHand, "A")).toBe("select");
  });

  it("clicking a DIFFERENT item than the selected one selects that one instead", () => {
    expect(cargoClickAction({ selectedId: "A", inHand: null }, "B")).toBe("select");
  });

  it("a second click on the SAME selected item picks it up", () => {
    expect(cargoClickAction({ selectedId: "A", inHand: null }, "A")).toBe("pick");
  });

  it("clicking the item you are holding puts it down — either kind", () => {
    expect(cargoClickAction({ selectedId: "A", inHand: { kind: "container", id: "A" } }, "A")).toBe("putDown");
    expect(cargoClickAction({ selectedId: null, inHand: { kind: "breakbulk", id: "BB1" } }, "BB1")).toBe("putDown");
  });

  it("ignores a click on another item while something is in hand — no mid-gesture swap", () => {
    expect(cargoClickAction({ selectedId: "B", inHand: { kind: "container", id: "A" } }, "B")).toBe("ignore");
    expect(cargoClickAction({ selectedId: null, inHand: { kind: "breakbulk", id: "BB1" } }, "A")).toBe("ignore");
  });

  it("never arms a hand on a single click, whatever is selected", () => {
    for (const selectedId of [null, "B", "C"]) {
      expect(cargoClickAction({ selectedId, inHand: null }, "A")).toBe("select");
    }
  });

  it("the hand outranks the selection: a stale selection cannot turn a click into a pick", () => {
    // selectedId still points at A from before the gesture; A is not what is in hand.
    expect(cargoClickAction({ selectedId: "A", inHand: { kind: "container", id: "Z" } }, "A")).toBe("ignore");
  });
});
