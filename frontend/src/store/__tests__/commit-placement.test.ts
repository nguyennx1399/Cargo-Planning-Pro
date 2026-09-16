/**
 * commit-placement — the ONE resolver behind both drop triggers (drag pointer-up, pick click) and
 * the gesture/pick state machine around it. Node-env, no React: both stores are driven through
 * getState()/setState() like the other store tests.
 *
 * The load-bearing assertions: both triggers reach the same predicate and the same store action
 * (identical outcome and identical rejection reasons), the two are mutually exclusive, and a
 * rejection keeps a pick alive while clearing a drag.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { cancelPlacement, commitPlacement } from "../commit-placement";
import { activeContainerId, usePlanStore } from "../usePlanStore";
import { usePlanDraftStore } from "../usePlanDraftStore";
import { at, box, makePlan, makeTestVessel } from "@/engine/__tests__/test-vessel-fixture";
import type { Slot, StowagePlan } from "@/types/domain";

const vessel = makeTestVessel();
const draft = () => usePlanDraftStore.getState();
const view = () => usePlanStore.getState();
const slot = (bay: number, row: number, tier: number): Slot => ({ bay, row, tier });
const load = (plan: StowagePlan) => draft().loadPlan(vessel, plan);

beforeEach(() => {
  usePlanDraftStore.setState({ vessel: null, plan: null, past: [], future: [] });
  usePlanStore.setState({
    draggingContainerId: null,
    pickedId: null,
    hoveredSlot: null,
    playbackCount: null,
    playbackPlaying: false,
  });
});

describe("commitPlacement", () => {
  it("commits a dragged container through the draft store and ends the drag", () => {
    load(makePlan([box("a"), box("b")], []));
    view().setDraggingContainer("a");

    expect(commitPlacement(slot(2, 2, 82))).toEqual({ ok: true, reasons: [] });
    expect(draft().plan!.placements).toEqual([at("a", 2, 2, 82)]);
    expect(draft().plan!.unplaced).toEqual(["b"]);
    expect(view().draggingContainerId).toBeNull();
    expect(draft().past).toHaveLength(1); // undoable, exactly like any other commit
  });

  it("commits a PICKED container with the same action and the same outcome (no drag gesture)", () => {
    load(makePlan([box("a"), box("b")], []));
    view().setPicked("a");

    expect(commitPlacement(slot(2, 2, 82))?.ok).toBe(true);
    expect(draft().plan!.placements).toEqual([at("a", 2, 2, 82)]); // byte-for-byte the drag path's result
    expect(view().pickedId).toBeNull();
  });

  it("rejects the same target identically for both triggers and writes nothing", () => {
    const plan = makePlan([box("a"), box("b")], [at("a", 2, 2, 82)]);
    load(plan);

    view().setDraggingContainer("b");
    const byDrag = commitPlacement(slot(2, 2, 82));
    view().setPicked("b");
    const byPick = commitPlacement(slot(2, 2, 82));

    expect(byDrag?.reasons).toEqual(byPick?.reasons);
    expect(byDrag?.reasons[0].rule).toBe("cell_conflict");
    expect(draft().plan).toBe(plan); // not even a copy was made, by either path
    expect(draft().past).toEqual([]);
  });

  it("clears a rejected drag but keeps a rejected pick alive (click another slot)", () => {
    load(makePlan([box("a"), box("b")], [at("a", 2, 2, 82)]));

    view().setDraggingContainer("b");
    commitPlacement(slot(2, 2, 82));
    expect(view().draggingContainerId).toBeNull(); // the pointer is already up

    view().setPicked("b");
    commitPlacement(slot(2, 2, 82));
    expect(view().pickedId).toBe("b"); // the WCAG path can retry without re-picking
  });

  it("applies a warning-severity commit (D1: warn and record) and ends the pick", () => {
    // `upper` discharges last, the candidate below it first -> overstow, an overridable limit.
    const plan = makePlan([box("upper", { pod: "MYPKG" }), box("cand", { pod: "VNSGN" })], [at("upper", 2, 2, 84)]);
    load(plan);
    view().setPicked("cand");

    const result = commitPlacement(slot(2, 2, 82));
    expect(result?.ok).toBe(true);
    expect(result?.reasons[0].severity).toBe("warning"); // the caller can surface "recorded"
    expect(draft().plan!.placements).toContainEqual(at("cand", 2, 2, 82));
    expect(view().pickedId).toBeNull();
  });

  it("moves an already-placed container instead of adding a second placement for it", () => {
    load(makePlan([box("a")], [at("a", 2, 2, 82)]));
    view().setPicked("a");

    expect(commitPlacement(slot(2, 1, 82))?.ok).toBe(true);
    expect(draft().plan!.placements).toEqual([at("a", 2, 1, 82)]); // one placement, moved
  });

  it("does nothing without an active drag/pick or without a target", () => {
    load(makePlan([box("a")], []));

    expect(commitPlacement(slot(2, 2, 82))).toBeNull(); // nothing is being placed
    view().setPicked("a");
    expect(commitPlacement(null)).toBeNull(); // released over no slot
    expect(draft().plan!.placements).toEqual([]);
    expect(draft().past).toEqual([]);
    expect(view().pickedId).toBe("a"); // the pick survives a miss
  });
});

describe("drag/pick exclusivity and cancel", () => {
  it("keeps at most one source for the placeholder set", () => {
    view().setDraggingContainer("a");
    expect(activeContainerId(view())).toBe("a");

    view().setPicked("b"); // picking during a drag ends the drag
    expect(activeContainerId(view())).toBe("b");
    expect(view().draggingContainerId).toBeNull();

    view().setDraggingContainer("a"); // and starting a drag drops the pick
    expect(activeContainerId(view())).toBe("a");
    expect(view().pickedId).toBeNull();

    view().setPicked(null); // clearing the pick never clears the drag
    expect(activeContainerId(view())).toBe("a");
  });

  it("pauses playback on drag start (D3) and leaves it running for a pick", () => {
    view().startOrResumePlayback();
    view().setDraggingContainer("a");
    expect(view().playbackPlaying).toBe(false);
    expect(view().playbackCount).toBe(0); // paused, not reset — the planner's position is kept

    view().startOrResumePlayback();
    view().setPicked("b");
    expect(view().playbackPlaying).toBe(true);
  });

  it("cancels both a drag and a pick without writing a plan, keeping the hover", () => {
    load(makePlan([box("a")], []));
    view().setPicked("a");
    // A gesture STARTS by clearing the hover (review H1), so hover-to-inspect is established the way
    // the pointer establishes it: by moving over the grid while the pick is armed.
    usePlanStore.setState({ hoveredSlot: slot(2, 1, 82) });

    cancelPlacement();
    expect(activeContainerId(view())).toBeNull();
    expect(view().hoveredSlot).toEqual(slot(2, 1, 82)); // hover-to-inspect survives the cancel
    expect(draft().plan!.placements).toEqual([]);
    expect(draft().past).toEqual([]);
  });

  it("clears a stale hovered slot when a gesture starts, so a click meant to pick cannot commit it", () => {
    load(makePlan([box("a"), box("b")], []));
    // The picker mesh remounts when its pickable count changes and R3F drops an unmounted object's
    // hover record WITHOUT firing `onPointerOut` (review H1), so this value can outlive the gesture
    // that produced it — it must not survive into the next one.
    usePlanStore.setState({ hoveredSlot: slot(2, 1, 82) });

    view().setPicked("a");
    expect(view().hoveredSlot).toBeNull();
    expect(commitPlacement(null)).toBeNull(); // nothing to commit: the click only picked

    usePlanStore.setState({ hoveredSlot: slot(2, 1, 82) });
    view().setDraggingContainer("b");
    expect(view().hoveredSlot).toBeNull();
  });

  it("clears the pick on a vessel change, like the drag state", () => {
    view().setPicked("a");
    view().resetForVesselChange();
    expect(view().pickedId).toBeNull();
    expect(view().draggingContainerId).toBeNull();
  });
});
