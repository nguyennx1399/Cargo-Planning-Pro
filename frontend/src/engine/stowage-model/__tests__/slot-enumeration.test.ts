/**
 * Slot enumeration — which (bay, row, tier) positions the model exposes, and the geometry each one
 * carries. The half-slot (odd bay) cases are the REOPENED Phase A defect: the model used to list only
 * `vessel.stacks[].bay` (the even 40' bays), so a 20' box had no droppable slot at all.
 *
 * The assertions here are the model's half of the contract the validator already implements:
 * `slotExists` looks a placement up by its 40' parent (`bayPosition`) and requires that stack to carry
 * the tier, `SlotDef.center` must equal `slotToPosition`, and `sizeFitsBay` decides a bay by parity.
 * `build-stowage-model.test.ts` covers the areas, the cache and the lookups.
 */
import { describe, expect, it } from "vitest";
import { buildStowageModel } from "../build-stowage-model";
import { allSlots } from "@/engine/all-slots";
import { bayPosition, isFortyBay, parseSlotCode, slotCode } from "@/engine/slot-helpers";
import { DIM, slotToPosition } from "@/lib/geometry";
import { validatePlan } from "@/engine/validate-plan";
import { buildDemoVessel } from "@/data/demo-container-vessel";
import { buildBbcSaoPauloVessel } from "@/data/bbc-sao-paulo-vessel";
import type { Container, StowagePlan, Vessel } from "@/types/domain";

/** A minimal 40'-bay vessel, the fixture `build-stowage-model.test.ts` also uses. */
const crafted: Vessel = {
  id: "crafted",
  name: "Crafted",
  imo: null,
  length_m: 100,
  beam_m: 20,
  bays: [2],
  rows: [1, 3],
  stacks: [
    { bay: 2, row: 1, deck: "under", tiers: [2], max_weight_t: 50, max_height_m: null, reefer_tiers: [] },
    { bay: 2, row: 1, deck: "on", tiers: [82], max_weight_t: 40, max_height_m: null, reefer_tiers: [] },
  ],
  breakbulk_holds: [
    {
      id: "hold_1",
      label: "Hold 1 tank top",
      level: "tank_top",
      hold: "1",
      area: { xMin: 0, xMax: 100, zMin: -10, zMax: 10 },
      keep_out: [],
      cargo_base_height_m: -9.5,
    },
  ],
};

describe("buildStowageModel — slots", () => {
  it("enumerates the 40' slots plus the two 20' halves of every stack bay", () => {
    // Measured counts, not derived by the same code under test: 800 40' slots on the demo vessel and
    // its 1600 halves (each of the 10 stack bays contributes both odd neighbours), 447 + 894 on BBC.
    // The half-slots are the REOPENED Phase A defect — without them a 20' box had 0 usable slots.
    for (const [name, vessel, total, odd] of [
      ["MV Demo Horizon", buildDemoVessel(), 2400, 1600],
      ["BBC SAO PAULO", buildBbcSaoPauloVessel(), 1341, 894],
    ] as const) {
      const model = buildStowageModel(vessel);
      expect(model.slots, name).toHaveLength(total);
      expect(model.slots.filter((s) => s.bay % 2 === 1), name).toHaveLength(odd);
      expect(model.slotByKey.size, name).toBe(total);
      // The 40' grid the packer fills is still enumerated exactly once, unchanged.
      for (const slot of allSlots(vessel)) {
        expect(model.slotByKey.get(`${slot.bay}|${slot.row}|${slot.tier}`), name).toBeDefined();
      }
    }
  });

  it("keeps every half-slot addressable by the validator, with a round-tripping key", () => {
    for (const vessel of [buildDemoVessel(), buildBbcSaoPauloVessel()]) {
      const model = buildStowageModel(vessel);
      const odd = model.slots.filter((s) => s.bay % 2 === 1);
      expect(odd.length).toBeGreaterThan(0);

      for (const slot of odd) {
        const at = `bay ${slot.bay} row ${slot.row} tier ${slot.tier}`;
        // What `validation-rules.slotExists` checks: the 40' parent's stack must carry this tier.
        const pos = bayPosition(slot.bay, vessel.bays);
        expect(pos, at).not.toBeNull();
        const parent = vessel.stacks.find(
          (s) => s.bay === pos!.fortyBay && s.row === slot.row && s.deck === slot.deck,
        );
        expect(parent, at).toBeDefined();
        expect(parent!.tiers, at).toContain(slot.tier);
        expect(slot.maxStackWeightT, at).toBe(parent!.max_weight_t);
        // `key` is the model's authoritative "bay|row|tier" and must survive the code pair.
        expect(slot.key, at).toBe(`${slot.bay}|${slot.row}|${slot.tier}`);
        expect(parseSlotCode(slotCode(slot)), at).toEqual({ bay: slot.bay, row: slot.row, tier: slot.tier });
      }
    }
  });

  it("sizes each slot's footprint by its own bay parity, centred on its centre", () => {
    for (const vessel of [buildDemoVessel(), buildBbcSaoPauloVessel()]) {
      const model = buildStowageModel(vessel);
      for (const slot of model.slots) {
        const at = `bay ${slot.bay} row ${slot.row} tier ${slot.tier}`;
        expect(slot.rect.xMax - slot.rect.xMin, at).toBeCloseTo(isFortyBay(slot.bay) ? DIM.len40 : DIM.len20, 9);
        expect(slot.rect.zMax - slot.rect.zMin, at).toBeCloseTo(DIM.width, 9);
        // Scene x -> x_m is the same shift `coords` uses, so occupancy can never disagree.
        expect((slot.rect.xMin + slot.rect.xMax) / 2, at).toBeCloseTo(slot.center[0] + vessel.length_m / 2, 9);
      }
    }
  });

  it("gives an odd bay to the 40' parent bayPosition names, not to the nearest one", () => {
    // Adjacent 40' bays: bay 03 is the FORE half of bay 04, so it belongs to bay 04's stack. A model
    // that assumed "bay + 1 is the aft half of this bay" would enumerate it under both parents and
    // hand it the wrong weight limit, while the report (which uses bayPosition) would disagree.
    const adjacent: Vessel = {
      ...crafted,
      bays: [2, 4],
      stacks: [
        { bay: 2, row: 1, deck: "on", tiers: [82], max_weight_t: 40, max_height_m: null, reefer_tiers: [] },
        { bay: 4, row: 1, deck: "on", tiers: [82], max_weight_t: 100, max_height_m: null, reefer_tiers: [] },
      ],
    };
    const model = buildStowageModel(adjacent);

    expect(bayPosition(3, adjacent.bays)?.fortyBay).toBe(4);
    expect(model.slotByKey.get("3|1|82")?.maxStackWeightT).toBe(100); // bay 04's stack limits it
    expect(model.slots.filter((s) => s.bay === 3)).toHaveLength(1);
    expect(model.slotByKey.get("1|1|82")?.maxStackWeightT).toBe(40); // fore half of bay 02
    expect(model.slots.map((s) => s.bay).sort()).toEqual([1, 2, 3, 4, 5]); // 02, 04, 01, 03, 05
  });

  it("emits no half-slot for a tier its parent stack lacks — the report rejects those too", () => {
    // The other direction of the same agreement: a half-slot may only exist where `slotExists` finds
    // the parent stack's tier. Enumerating bay 01 tier 84 here would give the predicate a clean slot
    // the report then flags with `slot_exists`.
    const sparse: Vessel = {
      ...crafted,
      stacks: [{ bay: 2, row: 1, deck: "on", tiers: [82], max_weight_t: 40, max_height_m: null, reefer_tiers: [] }],
    };
    const model = buildStowageModel(sparse);
    expect(model.slotByKey.has("2|1|82")).toBe(true);
    expect(model.slotByKey.has("1|1|82")).toBe(true);
    expect(model.slotByKey.has("1|1|84")).toBe(false);

    const box: Container = { id: "t20", size: "20", type: "DRY", high_cube: false, weight_t: 8, pol: "A", pod: "B", imdg_class: null, oog: false };
    const plan: StowagePlan = {
      id: "p", vessel_id: sparse.id, voyage: "T", ports: [], containers: [box], unplaced: [],
      placements: [{ container_id: box.id, slot: { bay: 1, row: 1, tier: 84 } }],
      breakbulk_cargo: [], breakbulk_placements: [],
    };
    expect(validatePlan(sparse, plan).violations.map((v) => v.rule)).toContain("slot_exists");
  });

  it("takes each slot centre from slotToPosition, so the model can't disagree with the renderer", () => {
    for (const vessel of [buildDemoVessel(), buildBbcSaoPauloVessel()]) {
      const model = buildStowageModel(vessel);
      // The spec requires SlotDef.center to be *identical* to the renderer's own position function —
      // so compare against it directly rather than restating the model's own arithmetic. Half-slots
      // (odd bays) are the case that used to get a bogus centre: `vessel.bays.indexOf(bay)` is -1.
      for (const slot of model.slots) {
        expect(slot.center).toEqual(slotToPosition(vessel, { bay: slot.bay, row: slot.row, tier: slot.tier }));
      }
      expect(model.slots.length).toBeGreaterThan(0);
      expect(model.slots.filter((s) => s.bay % 2 === 1).length).toBeGreaterThan(0);
      expect(model.slotByKey.get(model.slots[0].key)).toBe(model.slots[0]);
      expect(model.slots[0].key).toBe(`${model.slots[0].bay}|${model.slots[0].row}|${model.slots[0].tier}`);
    }
  });

  it("carries the stack's own weight limit", () => {
    const model = buildStowageModel(crafted);
    expect(model.slotByKey.get("2|1|2")?.maxStackWeightT).toBe(50);
    expect(model.slotByKey.get("2|1|82")?.maxStackWeightT).toBe(40);
  });

  it("assigns the deck from the tier, and the area from the geometry", () => {
    const model = buildStowageModel(crafted);
    const under = model.slotByKey.get("2|1|2");
    const on = model.slotByKey.get("2|1|82");
    expect(under?.deck).toBe("under");
    expect(on?.deck).toBe("on");
    // The under-deck slot's centre falls inside hold_1; the on-deck slot overlaps the weather deck.
    expect(under?.areaId).toBe("hold_1");
    expect(on?.areaId).toBe("weather_deck");
  });

  it("leaves areaId null when a slot overlaps no area", () => {
    const model = buildStowageModel({ ...crafted, breakbulk_holds: [] });
    // No holds declared, so the under-deck slot's centre matches nothing (the weather deck is the
    // only area and it is on deck).
    expect(model.slotByKey.get("2|1|2")?.areaId).toBeNull();
  });
});
