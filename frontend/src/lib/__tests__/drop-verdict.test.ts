/**
 * drop-verdict — the pure layer that turns a slot into the UI's tint + one-line reason (Phase C).
 *
 * The load-bearing assertions are about AGREEMENT, because this module is the only place a second
 * `canPlaceContainer` call happens (the placeholder tint pass): a slot the engine calls valid must
 * never come back `invalid` here, and the reason attached to a verdict must carry that verdict's own
 * severity — a warning is never shown as the reason a drop was refused (D1).
 *
 * The 20'-box case pins the acceptance line "A 20' box shows no placeholders in 40' bays": the valid
 * set is the ODD (half) bays only, on both real vessels. There is no DOM test anywhere in this repo
 * and none is added here — the pointer/keyboard path is verified by hand.
 */
import { describe, expect, it } from "vitest";
import { DROP_TINT, verdictForSlot, verdictsForSlots } from "../drop-verdict";
import { validSlotsFor } from "@/engine/placement/placeholders";
import { HIGHLIGHT } from "@/lib/colors";
import { buildBbcSaoPauloVesselAndCargo } from "@/data/bbc-sao-paulo-vessel";
import { buildDemoVesselAndCargo, buildLoadedDemoPlan } from "@/data/build-demo-plan";
import type { Container, StowagePlan, Vessel } from "@/types/domain";

const bbc = buildBbcSaoPauloVesselAndCargo();
const demo = buildDemoVesselAndCargo();

const REAL: [string, Vessel, StowagePlan][] = [
  ["MV Demo Horizon", demo.vessel, buildLoadedDemoPlan(demo.vessel, demo.containers)],
  ["BBC SAO PAULO", bbc.vessel, buildLoadedDemoPlan(bbc.vessel, bbc.containers)],
];

/** A candidate of the requested shape from the fleet itself, so the checks run on real cargo. */
const candidate = (containers: Container[], pick: (c: Container) => boolean) => containers.find(pick);

describe("verdictForSlot", () => {
  it.each(REAL)("agrees with the valid set on %s — a placeholder is never invalid", (_name, vessel, plan) => {
    const forty = candidate(plan.containers, (c) => c.size === "40")!;
    const valid = validSlotsFor(vessel, plan, forty);

    expect(valid.length).toBeGreaterThan(0);
    for (const slot of valid) {
      expect(verdictForSlot(vessel, plan, forty, slot).verdict, `${slot.key} must not be refused`).not.toBe("invalid");
      // The acceptance line's other half: a 40' box is never offered a 20' (odd) half position.
      expect(slot.bay % 2, `${slot.key} is not an even (40') bay`).toBe(0);
    }
  });

  it.each(REAL)("attaches a reason of the verdict's own severity on %s", (_name, vessel, plan) => {
    const forty = candidate(plan.containers, (c) => c.size === "40")!;
    // A forbidden slot (the bay the size does not fit) must come back invalid with an error reason.
    const wrongBaySlot = { bay: forty.size === "40" ? 1 : 2, row: vessel.rows[0], tier: 82 };
    const refused = verdictForSlot(vessel, plan, forty, wrongBaySlot);
    if (refused.verdict === "invalid") expect(refused.reason?.severity).toBe("error");

    for (const slot of validSlotsFor(vessel, plan, forty)) {
      const { verdict, reason } = verdictForSlot(vessel, plan, forty, slot);
      if (verdict === "warning") expect(reason?.severity).toBe("warning");
      else expect(reason).toBeNull();
    }
  });

  it.each(REAL)("previews a MOVE on the box's own slot as allowed on %s", (_name, vessel, plan) => {
    const placement = plan.placements[0];
    expect(placement).toBeDefined();
    const container = plan.containers.find((c) => c.id === placement.container_id)!;

    // Without the engine's own-placement strip this reports a self-referencing cell_conflict.
    expect(verdictForSlot(vessel, plan, container, placement.slot).verdict).not.toBe("invalid");
  });

  it("keeps the 20' set on ODD (half) bays only, and never empty on either vessel", () => {
    for (const [name, vessel, plan] of REAL) {
      const twenty = candidate(plan.containers, (c) => c.size === "20");
      if (!twenty) continue;
      const valid = validSlotsFor(vessel, plan, twenty);
      expect(valid.length, `${name}: a 20' box has half-bay positions`).toBeGreaterThan(0);
      for (const slot of valid) {
        expect(slot.bay % 2, `${name}: ${slot.key} is not an odd (20') bay`).toBe(1);
      }
    }
  });

  it("offers BBC SAO PAULO bay 22 on deck as a 40' target (the acceptance script's slot)", () => {
    const forty = candidate(bbc.containers, (c) => c.size === "40")!;
    const keys = new Set(validSlotsFor(bbc.vessel, buildLoadedDemoPlan(bbc.vessel, bbc.containers), forty).map((s) => s.bay));
    expect(keys.has(22)).toBe(true);
  });
});

describe("verdictsForSlots", () => {
  it("matches the one-slot path key for key", () => {
    const plan = buildLoadedDemoPlan(bbc.vessel, bbc.containers);
    const forty = plan.containers.find((c) => c.size === "40")!;
    const slots = validSlotsFor(bbc.vessel, plan, forty).slice(0, 25);
    const byKey = verdictsForSlots(bbc.vessel, plan, forty, slots);

    expect(byKey.size).toBe(slots.length);
    for (const slot of slots) {
      expect(byKey.get(slot.key)).toEqual(verdictForSlot(bbc.vessel, plan, forty, slot));
    }
  });
});

describe("DROP_TINT", () => {
  it("covers all three verdicts with the shared drop tokens", () => {
    expect(DROP_TINT).toEqual({
      valid: HIGHLIGHT.valid,
      warning: HIGHLIGHT.warning,
      invalid: HIGHLIGHT.invalid,
    });
  });
});
