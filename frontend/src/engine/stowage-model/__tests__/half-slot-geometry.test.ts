/**
 * Half-slot geometry — a 20' (odd) bay must sit where the validator addresses it: `bayPosition` maps
 * it onto its parent 40' bay's fore/aft half, and `SlotDef.center` is required to be identical to
 * `slotToPosition(vessel, slot)`, so both are checked against the model on the two real vessels rather
 * than against restated arithmetic.
 *
 * The two regressions this pins (both measured before the fix):
 *  - `bayCenterX` indexed `vessel.bays`, where an odd bay is absent (-1) — so a half-slot fell into
 *    the "unknown bay" branch and landed off the vessel entirely;
 *  - `tierCenterY` read `container_layout.on_deck_base_y_m[bay]`, which has no odd-bay entry, so a
 *    declared vessel's half-slot silently used the generic hatch height instead of the parent bay's
 *    real surface (on BBC SAO PAULO that is 4.8 m vs 0.6 m).
 */
import { describe, expect, it } from "vitest";
import { buildStowageModel } from "../build-stowage-model";
import { bayPosition } from "@/engine/slot-helpers";
import { HALF_BAY_OFFSET_M, LAYOUT, tierCenterY } from "@/lib/geometry";
import { buildBbcSaoPauloVessel } from "@/data/bbc-sao-paulo-vessel";
import { buildDemoVessel } from "@/data/demo-container-vessel";
import type { Vessel } from "@/types/domain";

const REAL: [string, Vessel][] = [
  ["MV Demo Horizon", buildDemoVessel()],
  ["BBC SAO PAULO", buildBbcSaoPauloVessel()],
];

describe("half-slot centres", () => {
  it("sits half a container fore/aft of its 40' parent, fore toward the bow (+x)", () => {
    for (const [label, vessel] of REAL) {
      const model = buildStowageModel(vessel);
      const odd = model.slots.filter((s) => s.bay % 2 === 1);
      expect(odd.length, label).toBeGreaterThan(0);

      for (const slot of odd) {
        const fore = bayPosition(slot.bay, vessel.bays)!.halves.includes("fore");
        const parent = model.slotByKey.get(`${bayPosition(slot.bay, vessel.bays)!.fortyBay}|${slot.row}|${slot.tier}`)!;
        const at = `${label} bay ${slot.bay} row ${slot.row} tier ${slot.tier}`;

        expect(slot.center[0] - parent.center[0], at).toBeCloseTo(fore ? HALF_BAY_OFFSET_M : -HALF_BAY_OFFSET_M, 9);
        // Bays are numbered bow -> stern and scene x is bow-positive, so the fore half is the +x one.
        expect(Math.sign(slot.center[0] - parent.center[0]), at).toBe(fore ? 1 : -1);
        // A half shares its parent's column: same tier, same deck base, same row centre.
        expect([slot.center[1], slot.center[2]], at).toEqual([parent.center[1], parent.center[2]]);
      }
    }
  });

  it("keeps both halves inside the 40' cell they belong to, and 20' long", () => {
    for (const [label, vessel] of REAL) {
      const model = buildStowageModel(vessel);
      for (const slot of model.slots) {
        if (slot.bay % 2 === 0) continue;
        const parent = model.slotByKey.get(`${bayPosition(slot.bay, vessel.bays)!.fortyBay}|${slot.row}|${slot.tier}`)!;
        const at = `${label} bay ${slot.bay} row ${slot.row} tier ${slot.tier}`;

        expect(slot.rect.xMin, at).toBeGreaterThanOrEqual(parent.rect.xMin - 1e-9);
        expect(slot.rect.xMax, at).toBeLessThanOrEqual(parent.rect.xMax + 1e-9);
        expect(slot.rect.zMin, at).toBe(parent.rect.zMin);
        expect(slot.rect.xMax - slot.rect.xMin, at).toBeCloseTo(6.058, 9); // a 20' box, not a 40' one
      }
    }
  });
});

describe("declared deck bases", () => {
  it("rests a declared vessel's half-slot on its parent bay's declared surface", () => {
    const vessel = buildBbcSaoPauloVessel();
    const layout = vessel.container_layout!;
    const model = buildStowageModel(vessel);

    // On deck: every half-slot's bottom tier must sit at its parent's declared hatch-cover top, which
    // on BBC is 4.8 m — far from LAYOUT.hatchHeight, so the generic fallback cannot pass this.
    const onDeck = model.slots.filter((s) => s.bay % 2 === 1 && s.tier === 82);
    expect(onDeck.length).toBeGreaterThan(0);
    for (const slot of onDeck) {
      const parent = bayPosition(slot.bay, vessel.bays)!.fortyBay;
      const declared = layout.on_deck_base_y_m[parent];
      expect(declared, `bay ${parent}`).toBeDefined();
      expect(declared).not.toBe(LAYOUT.hatchHeight);
      expect(slot.center[1], `bay ${slot.bay}`).toBeCloseTo(tierCenterY(slot.tier, vessel, parent), 9);
      const generic = tierCenterY(slot.tier, { ...vessel, container_layout: undefined }, slot.bay);
      expect(slot.center[1], `bay ${slot.bay} must not use the generic deck height`).not.toBeCloseTo(generic, 9);
    }

    // Under deck, where the parent declares a base of its own (bays 06…34 do, bay 02 does not).
    const underDeck = model.slots.filter(
      (s) => s.bay % 2 === 1 && s.tier === 2 && layout.under_deck_base_y_m[bayPosition(s.bay, vessel.bays)!.fortyBay] !== undefined,
    );
    expect(underDeck.length).toBeGreaterThan(0);
    for (const slot of underDeck) {
      const parent = bayPosition(slot.bay, vessel.bays)!.fortyBay;
      expect(slot.center[1], `bay ${slot.bay}`).toBe(layout.under_deck_base_y_m[parent]! + LAYOUT.tierPitch / 2);
    }
  });
});
