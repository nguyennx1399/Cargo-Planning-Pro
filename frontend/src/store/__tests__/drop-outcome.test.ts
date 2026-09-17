/**
 * drop-outcome — the lifetime table in `store/commit-placement.ts`'s header, row by row (P1/D5;
 * review M2/M3/M6). Split out of `commit-placement.test.ts` so both files stay under the repo's
 * 200-LOC rule; the resolver's own behaviour (both triggers, exclusivity, cancel) stays there.
 *
 * Why the outcome is store state at all: a refused DRAG is cleared by the resolver, so there would be
 * nothing left to hang the message on, and a rejected PICK must keep its reason after the click that
 * produced it (M2). Every row below is a behaviour a surface depends on: the chip and the Sidebar read
 * it, the bay plan renders the "bayplan" ones, and the three clearing triggers are what stop a stale
 * "Not placed — …" from sitting under the inspector (M6).
 */
import { beforeEach, describe, expect, it } from "vitest";
import { commitPlacement } from "../commit-placement";
import { usePlanStore } from "../usePlanStore";
import { usePlanDraftStore } from "../usePlanDraftStore";
import { at, box, makePlan, makeTestVessel } from "@/engine/__tests__/test-vessel-fixture";
import type { Slot, StowagePlan } from "@/types/domain";

const vessel = makeTestVessel();
const draft = () => usePlanDraftStore.getState();
const view = () => usePlanStore.getState();
const slot = (bay: number, row: number, tier: number): Slot => ({ bay, row, tier });
const load = (plan: StowagePlan) => draft().loadPlan(vessel, plan);
const outcome = () => view().dropOutcome;

beforeEach(() => {
  usePlanDraftStore.setState({ vessel: null, plan: null, past: [], future: [] });
  usePlanStore.setState({
    draggingContainerId: null, pickedId: null, hoveredSlot: null, dropOutcome: null,
    playbackCount: null, playbackPlaying: false,
  });
});

/** A refused commit: `b` is unplaced and its target is occupied by `a`, so `cell_conflict` blocks. */
const refused = () => load(makePlan([box("a"), box("b")], [at("a", 2, 2, 82)]));

describe("dropOutcome", () => {
  it("records a refused commit for both triggers, keeping a rejected PICK armed (M2)", () => {
    refused();
    view().setPicked("b");
    const byPick = commitPlacement(slot(2, 2, 82));

    expect(outcome()).toEqual({
      target: { kind: "slot", slot: slot(2, 2, 82) },
      message: byPick!.reasons[0].message, ok: false, origin: "scene",
    });
    expect(view().pickedId).toBe("b"); // the WCAG path may click another slot — the reason stays on screen

    view().setDraggingContainer("b");
    commitPlacement(slot(2, 2, 82), "bayplan");
    expect(view().draggingContainerId).toBeNull();
    expect(outcome()?.origin).toBe("bayplan"); // the panel renders it in place; the chip does not
  });

  it("records an applied warning as ok, and a clean accept as nothing at all (M3)", () => {
    // `upper` discharges last and the candidate below it first -> overstow, D1's overridable limit.
    load(makePlan([box("upper", { pod: "MYPKG" }), box("cand", { pod: "VNSGN" })], [at("upper", 2, 2, 84)]));
    view().setPicked("cand");
    const warned = commitPlacement(slot(2, 2, 82));

    expect(outcome()).toEqual({
      target: { kind: "slot", slot: slot(2, 2, 82) },
      message: warned!.reasons[0].message, ok: true, origin: "scene",
    });
    expect(warned?.reasons[0].severity).toBe("warning");

    load(makePlan([box("a")], []));
    view().setDraggingContainer("a");
    commitPlacement(slot(2, 2, 82));
    expect(outcome()).toBeNull(); // a clean drop recorded nothing, so there is nothing to say
  });

  it("retires the outcome on a DIFFERENT slot, never on leaving the canvas (M6)", () => {
    refused();
    view().setPicked("b");
    commitPlacement(slot(2, 2, 82));
    expect(outcome()).not.toBeNull();

    view().setHoveredSlot(slot(2, 2, 82)); // its own slot: the hand-over must not blank the message
    expect(outcome()).not.toBeNull();
    view().setHoveredSlot(null); // leaving the canvas must not wipe it before it has been read
    expect(outcome()).not.toBeNull();
    view().setHoveredSlot(slot(2, 1, 82)); // a different slot: the planner has moved on
    expect(outcome()).toBeNull();
  });

  it("clears on a new gesture and on a vessel change", () => {
    refused();
    view().setPicked("b");
    commitPlacement(slot(2, 2, 82));
    view().setDraggingContainer("b"); // a gesture start retires the previous outcome
    expect(outcome()).toBeNull();

    commitPlacement(slot(2, 2, 82)); // refused again, this time by the drag path
    expect(outcome()).not.toBeNull();
    view().resetForVesselChange();
    expect(outcome()).toBeNull();
  });
});
