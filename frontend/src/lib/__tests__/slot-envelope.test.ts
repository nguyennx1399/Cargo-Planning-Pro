/**
 * The envelope fold (Phase 02), over the REAL slots of both vessels.
 *
 * The property that matters is containment: every slot the placeholders draw must lie inside its
 * level's outline, or the border is lying about the region it encloses.
 */
import { describe, expect, it } from "vitest";
import { getVesselCatalogEntry } from "@/data/vessel-catalog";
import { buildStowageModel, type SlotDef } from "@/engine/stowage-model";
import { DIM } from "@/lib/geometry";
import { slotEnvelopes } from "@/lib/slot-envelope";

const vessels = ["bbc-sao-paulo", "demo-horizon"] as const;

describe("slotEnvelopes", () => {
  it("returns nothing for an empty set", () => {
    expect(slotEnvelopes([], DIM.height)).toEqual([]);
  });

  it.each(vessels)("encloses every slot of its own deck level on %s", (id) => {
    const { vessel } = getVesselCatalogEntry(id);
    const slots = buildStowageModel(vessel).slots;
    const envelopes = slotEnvelopes(slots, DIM.height);
    expect(envelopes.length).toBeGreaterThan(0);

    for (const envelope of envelopes) {
      const own = slots.filter((s) => s.deck === envelope.deck);
      expect(own.length).toBeGreaterThan(0);
      for (const slot of own) {
        expect(slot.rect.xMin).toBeGreaterThanOrEqual(envelope.rect.xMin);
        expect(slot.rect.xMax).toBeLessThanOrEqual(envelope.rect.xMax);
        expect(slot.rect.zMin).toBeGreaterThanOrEqual(envelope.rect.zMin);
        expect(slot.rect.zMax).toBeLessThanOrEqual(envelope.rect.zMax);
        // the outline sits at or below every box it encloses, never slicing through one
        expect(envelope.y).toBeLessThanOrEqual(slot.center[1]);
      }
    }
  });

  it.each(vessels)("splits the levels and keeps 'on' above 'under' on %s", (id) => {
    const { vessel } = getVesselCatalogEntry(id);
    const envelopes = slotEnvelopes(buildStowageModel(vessel).slots, DIM.height);
    expect(envelopes.map((e) => e.deck)).toEqual(["on", "under"]); // fixed order, not input order
    const [onDeck, underDeck] = envelopes;
    expect(onDeck.y).toBeGreaterThan(underDeck.y);
  });

  it("puts the outline at the lowest tier's BASE, not at a slot centre", () => {
    const { vessel } = getVesselCatalogEntry("demo-horizon");
    const slots = buildStowageModel(vessel).slots.filter((s) => s.deck === "under");
    const lowestCentre = Math.min(...slots.map((s) => s.center[1]));
    const [envelope] = slotEnvelopes(slots, DIM.height);
    expect(envelope.y).toBeCloseTo(lowestCentre - DIM.height / 2, 6);
  });

  it("a taller candidate (high cube) drops the outline further, by half the extra height", () => {
    const { vessel } = getVesselCatalogEntry("demo-horizon");
    const slots = buildStowageModel(vessel).slots;
    const [standard] = slotEnvelopes(slots, DIM.height);
    const [highCube] = slotEnvelopes(slots, DIM.heightHC);
    expect(standard.y - highCube.y).toBeCloseTo((DIM.heightHC - DIM.height) / 2, 6);
  });

  it("a single slot gives that slot's own rect", () => {
    const { vessel } = getVesselCatalogEntry("demo-horizon");
    const one: SlotDef = buildStowageModel(vessel).slots[0];
    const [envelope] = slotEnvelopes([one], DIM.height);
    expect(envelope.rect).toEqual(one.rect);
    expect(envelope.deck).toBe(one.deck);
  });
});
