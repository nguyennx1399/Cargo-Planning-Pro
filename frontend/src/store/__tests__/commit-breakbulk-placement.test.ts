/**
 * commitBreakbulkPlacement — the POSE-shaped door into the ONE commit resolver (Phase D). Node-env, no
 * React: both stores are driven through getState()/setState(), like the container tests. The
 * assertions mirror `commit-placement.test.ts` row for row, because the point of the design is that
 * there is only ONE table: both triggers reach the same store action with the same outcome, a refusal
 * writes nothing, a refused drag is cleared while a refused pick stays armed, a recorded warning is
 * `ok:true` with its reason, and a clean accept records nothing. A CONTAINER in hand commits nothing
 * here. The vessel is BBC SAO PAULO and the poses are its Hold 2 aft main-deck section.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { commitBreakbulkPlacement } from "../commit-placement";
import { activeContainerId, usePlanStore } from "../usePlanStore";
import { usePlanDraftStore } from "../usePlanDraftStore";
import { buildBbcSaoPauloVesselAndCargo } from "@/data/bbc-sao-paulo-vessel";
import type { BreakbulkCargo, BreakbulkPlacement, StowagePlan } from "@/types/domain";
import type { BreakbulkPose } from "@/engine/placement/can-place-breakbulk";

const bbc = buildBbcSaoPauloVesselAndCargo();
const draft = () => usePlanDraftStore.getState();
const view = () => usePlanStore.getState();
const AREA = "main_deck_aft_hold2";

/** 6 × 2.4 m = 14.4 m²: 10 t is 0.69 t/m² (clean), 40 t is 2.78 t/m² (over the section's 2.5 rating). */
const cargo = (patch: Partial<BreakbulkCargo> = {}): BreakbulkCargo => ({
  id: "GENSET", category: "wind_turbine_nacelle", length_m: 6, width_m: 2.4, height_m: 3,
  weight_t: 10, kg_above_base_m: 1.2, pol: "A", pod: "B", ...patch,
});

/** Inside the section at x 17-23 m, z 3.8-6.2 m (Hold 2 aft: 2.5 t/m² over x 11.5-31.1, z ±9.1). */
const pose = (patch: Partial<BreakbulkPose> = {}): BreakbulkPose => ({
  areaId: AREA, x_m: 20, z_m: 5, rotation_deg: 0, ...patch,
});

/** No containers: the plan's stack check is skipped, so a case is about the ITEM and nothing else. */
const makePlan = (items: BreakbulkCargo[], placements: BreakbulkPlacement[] = []): StowagePlan => ({
  id: "p", vessel_id: bbc.vessel.id, voyage: "T", ports: [], containers: [], placements: [],
  unplaced: [], breakbulk_cargo: items, breakbulk_placements: placements,
});

/** The placement `putBreakbulk` writes for a pose (the draft store's own shape). */
const placedAt = (p: BreakbulkPose, patch: Partial<BreakbulkPlacement> = {}): BreakbulkPlacement => ({
  cargo_id: "GENSET", x_m: p.x_m, z_m: p.z_m, rotation_deg: p.rotation_deg ?? 0, area_id: p.areaId, ...patch,
});

/** The item in hand, the way the sidebar hands it over (a pick — the WCAG 2.5.7 path). */
const inHand = (id = "GENSET") => view().setHand({ kind: "breakbulk", id }, "pick");

beforeEach(() => {
  usePlanDraftStore.setState({ vessel: null, plan: null, past: [], future: [] });
  usePlanStore.setState({ inHand: null, handMode: "pick", handRotation: 0, hoveredPose: null, hoveredSlot: null, dropOutcome: null, draggingContainerId: null, pickedId: null });
});

describe("commitBreakbulkPlacement", () => {
  it("commits an item onto a pose through the draft store and ends the gesture", () => {
    draft().loadPlan(bbc.vessel, makePlan([cargo()]));
    inHand();

    expect(commitBreakbulkPlacement(pose())).toEqual({ ok: true, reasons: [] });
    expect(draft().plan!.breakbulk_placements).toEqual([placedAt(pose())]);
    expect(view().inHand).toBeNull(); // nothing left to place: one item is one pose
    expect(draft().past).toHaveLength(1); // undoable, like any other commit
    expect(view().dropOutcome).toBeNull(); // a clean drop records nothing
  });

  it("commits a DRAGGED item through the same action and the same result", () => {
    draft().loadPlan(bbc.vessel, makePlan([cargo()]));
    view().setHand({ kind: "breakbulk", id: "GENSET" }, "drag");

    expect(commitBreakbulkPlacement(pose())?.ok).toBe(true);
    expect(draft().plan!.breakbulk_placements).toEqual([placedAt(pose())]);
    expect(view().inHand).toBeNull();
  });

  it("carries the hand's rotation into the committed placement", () => {
    draft().loadPlan(bbc.vessel, makePlan([cargo()]));
    inHand();
    view().rotateHand(); // 0 -> 90, the R key

    expect(view().handRotation).toBe(90);
    commitBreakbulkPlacement(pose({ rotation_deg: view().handRotation }));
    expect(draft().plan!.breakbulk_placements).toEqual([placedAt(pose(), { rotation_deg: 90 })]);
  });

  it("refuses the same pose identically for both triggers, writing nothing", () => {
    const plan = makePlan([cargo()]);
    draft().loadPlan(bbc.vessel, plan);
    const outOfArea = pose({ x_m: 5 }); // footprint 2-8 m against the section's xMin of 11.5 m

    inHand();
    const byPick = commitBreakbulkPlacement(outOfArea);
    view().setHand({ kind: "breakbulk", id: "GENSET" }, "drag");
    const byDrag = commitBreakbulkPlacement(outOfArea);

    expect(byDrag?.reasons).toEqual(byPick?.reasons);
    expect(byDrag?.reasons[0].rule).toBe("breakbulk_out_of_deck_area");
    expect(draft().plan).toBe(plan); // not even a copy was made, by either trigger
    expect(draft().past).toEqual([]);
  });

  it("clears a refused drag but keeps a refused pick alive (click another pose)", () => {
    draft().loadPlan(bbc.vessel, makePlan([cargo()]));
    view().setHand({ kind: "breakbulk", id: "GENSET" }, "drag");
    commitBreakbulkPlacement(pose({ x_m: 5 }));
    expect(view().inHand).toBeNull(); // the pointer is already up

    inHand();
    commitBreakbulkPlacement(pose({ x_m: 5 }));
    expect(view().inHand).toEqual({ kind: "breakbulk", id: "GENSET" }); // the WCAG path can retry
    expect(view().dropOutcome).toMatchObject({ ok: false, target: { kind: "pose" } });
  });

  it("applies a warning-severity commit (D1: warn and record) and ends the pick", () => {
    draft().loadPlan(bbc.vessel, makePlan([cargo({ weight_t: 40 })]));
    inHand();

    const result = commitBreakbulkPlacement(pose());
    expect(result?.ok).toBe(true); // it LANDS: an overridable limit, not a refusal
    expect(result?.reasons[0].rule).toBe("breakbulk_over_pressure");
    expect(result?.reasons[0].severity).toBe("warning");
    expect(draft().plan!.breakbulk_placements).toEqual([placedAt(pose())]);
    expect(view().inHand).toBeNull();
    expect(view().dropOutcome).toEqual({
      target: { kind: "pose", pose: pose() },
      message: result!.reasons[0].message, ok: true, origin: "scene",
    });
  });

  it("moves an already-placed item instead of adding a second placement", () => {
    draft().loadPlan(bbc.vessel, makePlan([cargo()], [placedAt(pose())]));
    inHand();
    const elsewhere = pose({ x_m: 26, z_m: -5 });

    expect(commitBreakbulkPlacement(elsewhere)?.ok).toBe(true);
    expect(draft().plan!.breakbulk_placements).toEqual([placedAt(elsewhere)]); // one placement, moved
  });

  it("does nothing for a CONTAINER hand — one field, one kind of gesture at a time", () => {
    draft().loadPlan(bbc.vessel, makePlan([cargo()]));
    view().setDraggingContainer("DEMU1");

    expect(commitBreakbulkPlacement(pose())).toBeNull();
    expect(activeContainerId(view())).toBe("DEMU1");
    expect(draft().plan!.breakbulk_placements).toEqual([]);
  });

  it("does nothing without a pose, keeping the item in hand", () => {
    draft().loadPlan(bbc.vessel, makePlan([cargo()]));
    inHand();

    expect(commitBreakbulkPlacement(null)).toBeNull(); // released over no area at all
    expect(draft().plan!.breakbulk_placements).toEqual([]);
    expect(view().inHand).not.toBeNull(); // the pick survives a miss, exactly as the slot path does
  });
});

describe("the pose outcome's lifetime", () => {
  it("retires the outcome on a DIFFERENT pose, never on leaving the canvas", () => {
    draft().loadPlan(bbc.vessel, makePlan([cargo()]));
    inHand();
    commitBreakbulkPlacement(pose({ x_m: 5 }));
    expect(view().dropOutcome).not.toBeNull();

    view().setHoveredPose(pose({ x_m: 5 })); // its own pose: the hand-over must not blank the message
    expect(view().dropOutcome).not.toBeNull();
    view().setHoveredPose(null); // leaving the canvas must not wipe it before it has been read
    expect(view().dropOutcome).not.toBeNull();
    view().setHoveredPose(pose({ x_m: 5.5 })); // a different pose: the planner has moved on
    expect(view().dropOutcome).toBeNull();
  });

  it("keeps the pose's OBJECT while the pointer stays on one snapped cell", () => {
    // The drop plane hands over a freshly built pose per pointer move; a move that snaps back onto the
    // cell it was already on must not re-render the ghost (the whole reason `setHoveredPose` compares).
    view().setHoveredPose(pose());
    const first = view().hoveredPose;
    view().setHoveredPose(pose());

    expect(view().hoveredPose).toBe(first);
  });

  it("clears on a new gesture and on a vessel change, like the slot path", () => {
    draft().loadPlan(bbc.vessel, makePlan([cargo()]));
    inHand();
    commitBreakbulkPlacement(pose({ x_m: 5 }));
    view().rotateHand();
    view().setHoveredPose(pose());

    view().setHand({ kind: "breakbulk", id: "GENSET" }, "pick"); // a gesture start retires it
    expect(view().dropOutcome).toBeNull();
    expect(view().hoveredPose).toBeNull();
    expect(view().handRotation).toBe(0); // a newly lifted item is not the one just rotated

    view().setHoveredPose(pose());
    view().resetForVesselChange();
    expect(view().hoveredPose).toBeNull();
    expect(view().inHand).toBeNull();
    expect(view().handMode).toBe("pick");
  });
});
