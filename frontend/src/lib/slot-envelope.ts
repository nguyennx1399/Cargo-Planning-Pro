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
  const out: SlotEnvelope[] = [];
  for (const deck of DECKS) {
    const onThisDeck = slots.filter((s) => s.deck === deck);
    if (onThisDeck.length === 0) continue;

    let { xMin, xMax, zMin, zMax } = onThisDeck[0].rect;
    let lowestCenterY = onThisDeck[0].center[1];
    for (const slot of onThisDeck) {
      xMin = Math.min(xMin, slot.rect.xMin);
      xMax = Math.max(xMax, slot.rect.xMax);
      zMin = Math.min(zMin, slot.rect.zMin);
      zMax = Math.max(zMax, slot.rect.zMax);
      lowestCenterY = Math.min(lowestCenterY, slot.center[1]);
    }
    out.push({ deck, rect: { xMin, xMax, zMin, zMax }, y: lowestCenterY - heightM / 2 });
  }
  return out;
}
