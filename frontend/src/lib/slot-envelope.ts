/**
 * slot-envelope.ts — "where on this ship can the box in hand go, roughly" (Phase 02 of the drag
 * visibility plan), pure.
 *
 * WHY: a container gesture draws one translucent box per valid slot and nothing that answers the
 * question at a glance. Project cargo has had that border since Phase D (`AreaRectOutline` around each
 * stowage area); this is the container-shaped version of it, so both kinds of cargo speak one visual
 * language.
 *
 * WHAT IT DELIBERATELY IS NOT: a precise region. A bounding rect over scattered valid slots CLAIMS
 * GROUND THAT IS NOT VALID — if the only free slots are in bays 02 and 38, the envelope spans the
 * whole ship. That is accepted, and it is what "the border, in general, of the available area" asks
 * for: the per-slot placeholders remain the precise layer, and the predicate remains the only
 * authority on a specific slot. Do not "fix" this into a per-slot hull or a union of bay rects without
 * re-reading that decision (the per-bay alternative is written up in the phase file).
 *
 * ONE ENVELOPE PER DECK LEVEL, because the two levels sit at different heights and a single rect
 * spanning both would float in between, describing neither.
 */
import type { Rect } from "@/engine/breakbulk-overlap-check";
import type { SlotDef } from "@/engine/stowage-model";

export interface SlotEnvelope {
  deck: "on" | "under";
  /** Bounding rect of that level's slots, in `SlotDef.rect`'s own x_m convention — so it feeds
   * `AreaRectOutline` with no conversion, exactly as a `StowageArea.rect` does. */
  rect: Rect;
  /** The level's floor: the BASE of its lowest tier, not a slot centre. An outline drawn at a centre
   * would cut the placeholder boxes in half. */
  y: number;
}

/** Deck order is fixed, not derived from the input: the drawn order must not depend on which slot the
 * model happens to list first. */
const DECKS: readonly ("on" | "under")[] = ["on", "under"];

/**
 * One envelope per deck level that has at least one slot in `slots`.
 *
 * `heightM` is the candidate's own box height (a high-cube is taller), used only to turn the lowest
 * tier's CENTRE into that tier's base — the caller already knows it because it draws the placeholders
 * with it.
 *
 * Empty in, empty out: no gesture and no valid slots are the same answer here, and the caller renders
 * nothing rather than a degenerate rect at the origin.
 */
export function slotEnvelopes(slots: readonly SlotDef[], heightM: number): SlotEnvelope[] {
  return foldByDeck(slots).map(({ deck, rect, lowestCenterY }) => ({
    deck,
    rect,
    y: lowestCenterY - heightM / 2,
  }));
}

/** The VOLUME one deck level's slots occupy: the flat envelope plus a ceiling. */
export interface SlotEnvelopeBox {
  deck: "on" | "under";
  /** Same convention as `SlotEnvelope.rect`. */
  rect: Rect;
  /** Base of the lowest tier — the same floor `slotEnvelopes` reports as `y`. */
  floorY: number;
  /** TOP of the highest tier. A tier CENTRE here would draw a box that slices the top row of cargo in
   * half — the same mistake the floor's own comment warns about. */
  ceilY: number;
}

/**
 * One box per deck level — the "stowage bounding box" view (bounding-box plan, phase 01).
 *
 * `boxHeightM` has no candidate to come from here (nothing is in hand), so callers pass the STANDARD
 * container height: the box describes the grid, not a particular box, and a high-cube on the top tier
 * will poke out by the difference (~0.3 m). The alternative — always high-cube — over-states the volume
 * of every vessel.
 *
 * `model.slots` lists each 40' cell AND its two 20' halves; that is harmless here, because both halves
 * lie inside their parent's rect and the fold only takes extremes.
 */
export function slotEnvelopeBoxes(slots: readonly SlotDef[], boxHeightM: number): SlotEnvelopeBox[] {
  return foldByDeck(slots).map(({ deck, rect, lowestCenterY, highestCenterY }) => ({
    deck,
    rect,
    floorY: lowestCenterY - boxHeightM / 2,
    ceilY: highestCenterY + boxHeightM / 2,
  }));
}

/** The shared fold behind both answers: per deck level, the bounding rect and the lowest / highest slot
 * centre. ONE pass, so the flat outline and the box can never disagree about a level's extent. */
function foldByDeck(
  slots: readonly SlotDef[],
): { deck: "on" | "under"; rect: Rect; lowestCenterY: number; highestCenterY: number }[] {
  const out: { deck: "on" | "under"; rect: Rect; lowestCenterY: number; highestCenterY: number }[] = [];
  for (const deck of DECKS) {
    const onThisDeck = slots.filter((s) => s.deck === deck);
    if (onThisDeck.length === 0) continue;

    let { xMin, xMax, zMin, zMax } = onThisDeck[0].rect;
    let lowestCenterY = onThisDeck[0].center[1];
    let highestCenterY = onThisDeck[0].center[1];
    for (const slot of onThisDeck) {
      xMin = Math.min(xMin, slot.rect.xMin);
      xMax = Math.max(xMax, slot.rect.xMax);
      zMin = Math.min(zMin, slot.rect.zMin);
      zMax = Math.max(zMax, slot.rect.zMax);
      lowestCenterY = Math.min(lowestCenterY, slot.center[1]);
      highestCenterY = Math.max(highestCenterY, slot.center[1]);
    }
    out.push({ deck, rect: { xMin, xMax, zMin, zMax }, lowestCenterY, highestCenterY });
  }
  return out;
}
