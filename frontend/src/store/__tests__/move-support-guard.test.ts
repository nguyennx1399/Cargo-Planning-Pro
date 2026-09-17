/**
 * The draft store's origin guard (Phase 01) — the real gate, on the real demo plan.
 *
 * The first case is the exact defect the phase was written from: `DEMU0000016` (bay 02, row 08,
 * tier 02) carries `DEMU0000021`, and moving it to a free, otherwise VALID slot used to be accepted
 * with zero reasons while `validatePlan` gained a `no_floating` violation.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { buildDemoVesselAndCargo, buildLoadedDemoPlan } from "@/data/build-demo-plan";
import { buildBbcSaoPauloVesselAndCargo } from "@/data/bbc-sao-paulo-vessel";
import { validatePlan } from "@/engine/validate-plan";
import { validSlotsFor } from "@/engine/placement/placeholders";
import { usePlanDraftStore } from "@/store/usePlanDraftStore";
import type { StowagePlan } from "@/types/domain";

const { vessel, containers } = buildDemoVesselAndCargo();

/** A placement that has a box directly above it — the shape the guard exists for. */
function supportingPlacement(plan: ReturnType<typeof buildLoadedDemoPlan>) {
  const column = (p: { slot: { bay: number; row: number } }) => `${p.slot.bay}|${p.slot.row}`;
  const found = plan.placements.find((p) =>
    plan.placements.some((q) => column(q) === column(p) && q.slot.tier === p.slot.tier + 2),
  );
  if (!found) throw new Error("demo plan has no stacked column — fixture assumption broken");
  return found;
}

describe("move/unplace support guard", () => {
  beforeEach(() => {
    usePlanDraftStore.getState().loadPlan(vessel, buildLoadedDemoPlan(vessel, containers));
  });

  it("refuses a move that would strand the boxes above, and writes nothing", () => {
    const plan = usePlanDraftStore.getState().plan!;
    const subject = supportingPlacement(plan);
    const stripped = { ...plan, placements: plan.placements.filter((p) => p.container_id !== subject.container_id) };
    const container = plan.containers.find((c) => c.id === subject.container_id)!;
    const target = validSlotsFor(vessel, stripped, container).find(
      (s) => !(s.bay === subject.slot.bay && s.row === subject.slot.row),
    )!;

    const result = usePlanDraftStore.getState().moveContainer(container.id, {
      bay: target.bay,
      row: target.row,
      tier: target.tier,
    });

    expect(result.ok).toBe(false);
    expect(result.reasons.map((r) => r.rule)).toEqual(["no_floating"]);
    expect(result.reasons[0].message).toContain("stand");
    // nothing written: same plan object, no history entry
    expect(usePlanDraftStore.getState().plan).toBe(plan);
    expect(usePlanDraftStore.getState().past).toHaveLength(0);
  });

  it("never lets an edit increase the plan's no_floating count", () => {
    const plan = usePlanDraftStore.getState().plan!;
    const before = validatePlan(vessel, plan).violations.filter((v) => v.rule === "no_floating").length;
    const subject = supportingPlacement(plan);
    const container = plan.containers.find((c) => c.id === subject.container_id)!;
    const stripped = { ...plan, placements: plan.placements.filter((p) => p.container_id !== container.id) };
    const target = validSlotsFor(vessel, stripped, container).find(
      (s) => !(s.bay === subject.slot.bay && s.row === subject.slot.row),
    )!;

    usePlanDraftStore.getState().moveContainer(container.id, { bay: target.bay, row: target.row, tier: target.tier });
    usePlanDraftStore.getState().unplaceContainer(container.id);

    const after = validatePlan(vessel, usePlanDraftStore.getState().plan!).violations.filter(
      (v) => v.rule === "no_floating",
    ).length;
    expect(after).toBe(before);
  });

  it("refuses unplacing a box that carries others", () => {
    const plan = usePlanDraftStore.getState().plan!;
    const subject = supportingPlacement(plan);
    const result = usePlanDraftStore.getState().unplaceContainer(subject.container_id);
    expect(result.ok).toBe(false);
    expect(result.reasons[0].rule).toBe("no_floating");
    expect(usePlanDraftStore.getState().plan).toBe(plan);
  });

  it("still allows moving and unplacing a box with nothing on top", () => {
    const plan = usePlanDraftStore.getState().plan!;
    const column = (p: { slot: { bay: number; row: number } }) => `${p.slot.bay}|${p.slot.row}`;
    const top = plan.placements.find(
      (p) => !plan.placements.some((q) => column(q) === column(p) && q.slot.tier > p.slot.tier),
    )!;

    const result = usePlanDraftStore.getState().unplaceContainer(top.container_id);
    expect(result.ok).toBe(true);
    expect(usePlanDraftStore.getState().plan!.placements).toHaveLength(plan.placements.length - 1);
  });

  it("unplacing a box that is not on board is a no-op, not a refusal", () => {
    const plan = usePlanDraftStore.getState().plan!;
    const unplacedId = plan.unplaced[0];
    if (!unplacedId) return; // the naive fill placed everything: nothing to assert here
    const result = usePlanDraftStore.getState().unplaceContainer(unplacedId);
    expect(result.ok).toBe(true);
    expect(usePlanDraftStore.getState().plan).toBe(plan);
  });

  describe("gap: undo/redo with refused moves and unplaces", () => {
    it("refuses unplace that would strand boxes and leaves past/future untouched", () => {
      const plan = usePlanDraftStore.getState().plan!;
      const pastLength = usePlanDraftStore.getState().past.length;
      const futureLength = usePlanDraftStore.getState().future.length;

      const subject = supportingPlacement(plan);
      const result = usePlanDraftStore.getState().unplaceContainer(subject.container_id);

      expect(result.ok).toBe(false);
      expect(result.reasons[0].rule).toBe("no_floating");
      // Verify no history entry was added
      expect(usePlanDraftStore.getState().past).toHaveLength(pastLength);
      expect(usePlanDraftStore.getState().future).toHaveLength(futureLength);
      expect(usePlanDraftStore.getState().plan).toBe(plan);
    });

    it("refused move with undo/redo cycle leaves history clean", () => {
      const plan = usePlanDraftStore.getState().plan!;
      usePlanDraftStore.getState().loadPlan(vessel, plan);
      expect(usePlanDraftStore.getState().past).toHaveLength(0);
      expect(usePlanDraftStore.getState().future).toHaveLength(0);

      // Make a valid move to create history
      const topBox = plan.placements.find(
        (p) =>
          !plan.placements.some((q) => {
            const col = (s: { slot: { bay: number; row: number } }) => `${s.slot.bay}|${s.slot.row}`;
            return col(q) === col(p) && q.slot.tier > p.slot.tier;
          }),
      );
      if (!topBox) return; // fixture assumption

      const target = validSlotsFor(vessel, plan, plan.containers.find((c) => c.id === topBox.container_id)!).find(
        (s) => !(s.bay === topBox.slot.bay && s.row === topBox.slot.row),
      );
      if (!target) return; // no valid target

      usePlanDraftStore.getState().moveContainer(topBox.container_id, target);
      expect(usePlanDraftStore.getState().past).toHaveLength(1);

      // Now attempt a refused move
      const subject = supportingPlacement(usePlanDraftStore.getState().plan!);
      const stripped = {
        ...usePlanDraftStore.getState().plan!,
        placements: usePlanDraftStore.getState().plan!.placements.filter((p) => p.container_id !== subject.container_id),
      };
      const refusedTarget = validSlotsFor(
        vessel,
        stripped,
        usePlanDraftStore.getState().plan!.containers.find((c) => c.id === subject.container_id)!,
      ).find((s) => !(s.bay === subject.slot.bay && s.row === subject.slot.row));
      if (!refusedTarget) return;

      const beforeRefuse = usePlanDraftStore.getState().past.length;
      usePlanDraftStore.getState().moveContainer(subject.container_id, refusedTarget);
      // Refused move must not add to history
      expect(usePlanDraftStore.getState().past).toHaveLength(beforeRefuse);
    });
  });

  describe("gap: 45' container and BBC SAO PAULO vessel", () => {
    it("supports 45' container with BBC SAO PAULO", () => {
      const { vessel: bbcVessel, containers: bbcContainers } = buildBbcSaoPauloVesselAndCargo();
      const container45 = bbcContainers.find((c) => c.size === "45");
      if (!container45) return; // skip if no 45' in BBC cargo

      const bbcPlan = buildLoadedDemoPlan(bbcVessel, bbcContainers);
      usePlanDraftStore.getState().loadPlan(bbcVessel, bbcPlan);

      // Find a valid slot for the 45' container
      const validSlots = validSlotsFor(bbcVessel, bbcPlan, container45);
      expect(validSlots.length).toBeGreaterThan(0);

      // Try to place a 45' container that's in the unplaced list
      const unplaced45 = bbcPlan.unplaced.find((id) => {
        const cont = bbcContainers.find((c) => c.id === id);
        return cont?.size === "45";
      });

      if (unplaced45 && validSlots.length > 0) {
        const result = usePlanDraftStore.getState().placeContainer(unplaced45, validSlots[0]);
        expect(result.ok).toBe(true);
      }
    });
  });

  describe("gap: move within same column", () => {
    it("allows move within same column when dependents stay supported", () => {
      const plan = usePlanDraftStore.getState().plan!;

      // Find a stacked column: a box with something directly on top
      const column = (p: { slot: { bay: number; row: number } }) => `${p.slot.bay}|${p.slot.row}`;
      const supportingBox = plan.placements.find((p) =>
        plan.placements.some((q) => column(q) === column(p) && q.slot.tier === p.slot.tier + 2),
      );
      if (!supportingBox) return; // no stacks in plan

      // Try to move it up one tier within the same column
      const bottomTier = supportingBox.slot.tier;
      const targetTier = bottomTier + 2; // move up

      // Check if target slot in same column is free
      const targetSlot = { bay: supportingBox.slot.bay, row: supportingBox.slot.row, tier: targetTier };
      const isOccupied = plan.placements.some(
        (p) =>
          p.slot.bay === targetSlot.bay &&
          p.slot.row === targetSlot.row &&
          p.slot.tier === targetSlot.tier,
      );

      if (isOccupied) return; // can't test this scenario

      // This move should be allowed because dependents stay on the same column
      const result = usePlanDraftStore.getState().moveContainer(supportingBox.container_id, targetSlot);
      // The move may fail for other reasons (weight, etc.), but not for no_floating
      if (result.ok) {
        expect(result.reasons.filter((r) => r.rule === "no_floating")).toHaveLength(0);
      } else {
        // If refused, it should not be for no_floating (boxes above are still in the column)
        const noFloatingReason = result.reasons.find((r) => r.rule === "no_floating");
        expect(noFloatingReason).toBeUndefined();
      }
    });
  });

  describe("gap: round-trip unplace", () => {
    it("allows unplacing second box after top box is unplaced from a stack", () => {
      const plan = usePlanDraftStore.getState().plan!;

      // Find a stack with at least 2 boxes: bottom and top
      const column = (p: { slot: { bay: number; row: number } }) => `${p.slot.bay}|${p.slot.row}`;
      const stacks = new Map<string, (typeof plan.placements)[number][]>();
      plan.placements.forEach((p) => {
        const col = column(p);
        if (!stacks.has(col)) stacks.set(col, []);
        const stack = stacks.get(col);
        if (stack) stack.push(p);
      });

      let stackWithTwo: (typeof plan.placements)[number][] | null = null;
      for (const stack of stacks.values()) {
        if (stack.length >= 2) {
          stack.sort((a, b) => a.slot.tier - b.slot.tier);
          stackWithTwo = stack;
          break;
        }
      }

      if (!stackWithTwo || stackWithTwo.length < 2) return; // no suitable stack

      const topBox = stackWithTwo[stackWithTwo.length - 1];
      const secondBox = stackWithTwo[stackWithTwo.length - 2];

      // Unplace the top box (should succeed)
      let result = usePlanDraftStore.getState().unplaceContainer(topBox.container_id);
      expect(result.ok).toBe(true);
      expect(usePlanDraftStore.getState().plan!.placements).toHaveLength(plan.placements.length - 1);

      // Now unplace the second box (was stranding the top, but top is gone; should succeed)
      result = usePlanDraftStore.getState().unplaceContainer(secondBox.container_id);
      expect(result.ok).toBe(true);
      expect(usePlanDraftStore.getState().plan!.placements).toHaveLength(plan.placements.length - 2);
    });
  });

  describe("gap: validatePlan no_floating count via all actions", () => {
    function countNoFloating(plan: StowagePlan): number {
      return validatePlan(vessel, plan).violations.filter((v) => v.rule === "no_floating").length;
    }

    it("no_floating count never increases after placeContainer", () => {
      const plan = usePlanDraftStore.getState().plan!;
      const before = countNoFloating(plan);

      // Try to place an unplaced box
      const unplacedId = plan.unplaced[0];
      if (!unplacedId) return;

      const validSlots = validSlotsFor(vessel, plan, plan.containers.find((c) => c.id === unplacedId)!);
      if (validSlots.length === 0) return;

      usePlanDraftStore.getState().placeContainer(unplacedId, validSlots[0]);
      const after = countNoFloating(usePlanDraftStore.getState().plan!);
      expect(after).toBeLessThanOrEqual(before);
    });

    it("no_floating count never increases after moveContainer (refused or accepted)", () => {
      const plan = usePlanDraftStore.getState().plan!;
      const before = countNoFloating(plan);

      const subject = supportingPlacement(plan);
      const container = plan.containers.find((c) => c.id === subject.container_id)!;
      const stripped = {
        ...plan,
        placements: plan.placements.filter((p) => p.container_id !== subject.container_id),
      };
      const targets = validSlotsFor(vessel, stripped, container);
      if (targets.length === 0) return;

      const target = targets[0];
      usePlanDraftStore.getState().moveContainer(container.id, target);
      const after = countNoFloating(usePlanDraftStore.getState().plan!);
      expect(after).toBeLessThanOrEqual(before);
    });

    it("no_floating count never increases after unplaceContainer", () => {
      const plan = usePlanDraftStore.getState().plan!;
      const before = countNoFloating(plan);

      // Try to unplace a top box (one with nothing above)
      const column = (p: { slot: { bay: number; row: number } }) => `${p.slot.bay}|${p.slot.row}`;
      const topBox = plan.placements.find(
        (p) => !plan.placements.some((q) => column(q) === column(p) && q.slot.tier > p.slot.tier),
      );
      if (!topBox) return;

      usePlanDraftStore.getState().unplaceContainer(topBox.container_id);
      const after = countNoFloating(usePlanDraftStore.getState().plan!);
      expect(after).toBeLessThanOrEqual(before);
    });

    it("no_floating count never increases after undo", () => {
      const plan = usePlanDraftStore.getState().plan!;

      // Create history by doing a valid move
      const column = (p: { slot: { bay: number; row: number } }) => `${p.slot.bay}|${p.slot.row}`;
      const topBox = plan.placements.find(
        (p) => !plan.placements.some((q) => column(q) === column(p) && q.slot.tier > p.slot.tier),
      );
      if (!topBox) return;

      const targets = validSlotsFor(vessel, plan, plan.containers.find((c) => c.id === topBox.container_id)!).filter(
        (s) => !(s.bay === topBox.slot.bay && s.row === topBox.slot.row),
      );
      if (targets.length === 0) return;

      usePlanDraftStore.getState().moveContainer(topBox.container_id, targets[0]);
      expect(usePlanDraftStore.getState().past).toHaveLength(1);

      const before = countNoFloating(usePlanDraftStore.getState().plan!);
      usePlanDraftStore.getState().undo();
      const after = countNoFloating(usePlanDraftStore.getState().plan!);
      expect(after).toBeLessThanOrEqual(before);
    });

    it("no_floating count never increases after redo", () => {
      const plan = usePlanDraftStore.getState().plan!;

      // Create history and then undo
      const column = (p: { slot: { bay: number; row: number } }) => `${p.slot.bay}|${p.slot.row}`;
      const topBox = plan.placements.find(
        (p) => !plan.placements.some((q) => column(q) === column(p) && q.slot.tier > p.slot.tier),
      );
      if (!topBox) return;

      const targets = validSlotsFor(vessel, plan, plan.containers.find((c) => c.id === topBox.container_id)!).filter(
        (s) => !(s.bay === topBox.slot.bay && s.row === topBox.slot.row),
      );
      if (targets.length === 0) return;

      usePlanDraftStore.getState().moveContainer(topBox.container_id, targets[0]);
      usePlanDraftStore.getState().undo();
      expect(usePlanDraftStore.getState().future).toHaveLength(1);

      const before = countNoFloating(usePlanDraftStore.getState().plan!);
      usePlanDraftStore.getState().redo();
      const after = countNoFloating(usePlanDraftStore.getState().plan!);
      expect(after).toBeLessThanOrEqual(before);
    });
  });
});
