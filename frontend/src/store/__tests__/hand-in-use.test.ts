/**
 * `handInUse` — the viewer's "get the ship out of the way" condition.
 *
 * Worth its own test because the thing it drives (the hull's `hidden` prop) is not reachable from a
 * node test: a wrong answer here is an invisible ship, and the only other guard is a human looking at
 * the canvas. The cases below are exactly the four the rule exists for.
 */
import { describe, expect, it } from "vitest";
import { dragInFlight, handInUse, usePlanStore } from "@/store/usePlanStore";

const state = () => usePlanStore.getState();

describe("handInUse", () => {
  it("is false with nothing in hand", () => {
    state().cancelHand();
    expect(handInUse(state())).toBe(false);
  });

  it("is true for a container DRAG and for a container PICK", () => {
    state().setDraggingContainer("DEMU0000001");
    expect(handInUse(state())).toBe(true);
    state().setPicked("DEMU0000001");
    expect(handInUse(state())).toBe(true);
  });

  it("is true for a project-cargo gesture, both modes", () => {
    state().setHand({ kind: "breakbulk", id: "BB001" }, "drag");
    expect(handInUse(state())).toBe(true);
    state().setHand({ kind: "breakbulk", id: "BB001" }, "pick");
    expect(handInUse(state())).toBe(true);
  });

  it("is BROADER than dragInFlight — a pick holds no button but still needs the view", () => {
    state().setPicked("DEMU0000001");
    expect(dragInFlight(state())).toBe(false);
    expect(handInUse(state())).toBe(true);
  });

  it("goes false again on every way a gesture can end", () => {
    for (const end of [
      () => state().cancelHand(),
      () => state().endDrag(),
      () => state().resetForVesselChange(),
    ]) {
      state().setHand({ kind: "breakbulk", id: "BB001" }, "drag");
      expect(handInUse(state())).toBe(true);
      end();
      expect(handInUse(state())).toBe(false);
    }
  });
});
