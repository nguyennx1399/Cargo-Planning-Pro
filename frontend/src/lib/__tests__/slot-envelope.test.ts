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
import { slotEnvelopeBoxes, slotEnvelopes } from "@/lib/slot-envelope";

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

/**
 * The stowage bounding box (bounding-box plan, phase 01): the same fold with a ceiling. What matters is
 * that the box encloses every slot of its level ENTIRELY — floor under the lowest box, ceiling over the
 * highest — and that it agrees with the flat outline about the level's footprint.
 */
describe("slotEnvelopeBoxes", () => {
  it("returns nothing for an empty set", () => {
    expect(slotEnvelopeBoxes([], DIM.height)).toEqual([]);
  });

  it.each(vessels)("encloses every whole box of its level on %s", (id) => {
    const { vessel } = getVesselCatalogEntry(id);
    const slots = buildStowageModel(vessel).slots;
    for (const box of slotEnvelopeBoxes(slots, DIM.height)) {
      for (const slot of slots.filter((s) => s.deck === box.deck)) {
        expect(slot.rect.xMin).toBeGreaterThanOrEqual(box.rect.xMin);
        expect(slot.rect.xMax).toBeLessThanOrEqual(box.rect.xMax);
        expect(slot.rect.zMin).toBeGreaterThanOrEqual(box.rect.zMin);
        expect(slot.rect.zMax).toBeLessThanOrEqual(box.rect.zMax);
        // the WHOLE box fits vertically — floor under its base, ceiling over its top
        expect(box.floorY).toBeLessThanOrEqual(slot.center[1] - DIM.height / 2 + 1e-9);
        expect(box.ceilY).toBeGreaterThanOrEqual(slot.center[1] + DIM.height / 2 - 1e-9);
      }
    }
  });

  it("the ceiling is a tier TOP, not a centre — it clears the highest slot by half a box", () => {
    const { vessel } = getVesselCatalogEntry("demo-horizon");
    const onDeck = buildStowageModel(vessel).slots.filter((s) => s.deck === "on");
    const highestCentre = Math.max(...onDeck.map((s) => s.center[1]));
    const [box] = slotEnvelopeBoxes(onDeck, DIM.height);
    expect(box.ceilY).toBeCloseTo(highestCentre + DIM.height / 2, 6);
  });

  it.each(vessels)("agrees with the flat outline about each level's footprint and floor on %s", (id) => {
    const { vessel } = getVesselCatalogEntry(id);
    const slots = buildStowageModel(vessel).slots;
    const flat = slotEnvelopes(slots, DIM.height);
    const boxes = slotEnvelopeBoxes(slots, DIM.height);
    expect(boxes.map((b) => b.deck)).toEqual(flat.map((f) => f.deck));
    boxes.forEach((box, i) => {
      expect(box.rect).toEqual(flat[i].rect);
      expect(box.floorY).toBeCloseTo(flat[i].y, 9);
    });
  });

  it("keeps the two deck volumes apart — the on-deck floor sits above the under-deck ceiling", () => {
    const { vessel } = getVesselCatalogEntry("demo-horizon");
    const [onDeck, underDeck] = slotEnvelopeBoxes(buildStowageModel(vessel).slots, DIM.height);
    expect(onDeck.deck).toBe("on");
    expect(underDeck.deck).toBe("under");
    expect(onDeck.floorY).toBeGreaterThanOrEqual(underDeck.ceilY);
  });
});
