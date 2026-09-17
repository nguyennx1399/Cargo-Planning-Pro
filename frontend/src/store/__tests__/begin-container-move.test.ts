/**
 * The gesture-start gate (Phase 01): a box carrying others is refused when it is PICKED UP, not after
 * the planner has chosen a target. Covers the wiring `ContainerInstances`' press handler calls.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { buildDemoVesselAndCargo, buildLoadedDemoPlan } from "@/data/build-demo-plan";
import { canBeginContainerMove } from "@/store/begin-container-move";
import { usePlanStore } from "@/store/usePlanStore";

const { vessel, containers } = buildDemoVesselAndCargo();
const plan = buildLoadedDemoPlan(vessel, containers);
const column = (p: { slot: { bay: number; row: number } }) => `${p.slot.bay}|${p.slot.row}`;

const supporting = plan.placements.find((p) =>
  plan.placements.some((q) => column(q) === column(p) && q.slot.tier === p.slot.tier + 2),
)!;
const topOfStack = plan.placements.find(
  (p) => !plan.placements.some((q) => column(q) === column(p) && q.slot.tier > p.slot.tier),
)!;

describe("canBeginContainerMove", () => {
  beforeEach(() => {
    usePlanStore.getState().setDropOutcome(null);
  });

  it("refuses a box that carries others and records the reason", () => {
    expect(canBeginContainerMove(vessel, plan, supporting.container_id)).toBe(false);
    const outcome = usePlanStore.getState().dropOutcome;
    expect(outcome?.ok).toBe(false);
    expect(outcome?.message).toContain("on this slot");
    // the record is about the slot the box is STANDING in, not some target it never reached
    expect(outcome?.target).toEqual({ kind: "slot", slot: supporting.slot });
  });

  it("allows the top box of a stack and records nothing", () => {
    expect(canBeginContainerMove(vessel, plan, topOfStack.container_id)).toBe(true);
    expect(usePlanStore.getState().dropOutcome).toBeNull();
  });

  it("allows a box that is not on board", () => {
    expect(canBeginContainerMove(vessel, plan, "not-in-this-plan")).toBe(true);
    expect(usePlanStore.getState().dropOutcome).toBeNull();
  });
});
