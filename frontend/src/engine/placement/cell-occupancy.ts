/**
 * cell-occupancy.ts — "which 20' halves of this cell are taken", the one plan-shaped answer.
 *
 * Extracted because there were about to be THREE of these: `can-place-container.ts` builds a memoised
 * plan index for its own sweep, `support-dependents.ts` folds the placement list directly, and the
 * landing rule needs the same question again. The predicate keeps its index (it answers ~900 slots per
 * gesture and needs the speed); the two callers that ask a handful of times per edit share this.
 *
 * Deliberately a scan, not an index: it runs a few times per edit — never on the pointer-move path of a
 * sweep — and a second index keyed differently from the predicate's is exactly the duplicate that
 * drifts.
 */
import type { StowagePlan, Vessel } from "@/types/domain";
import { bayPosition, type HalfSide } from "@/engine/slot-helpers";

export type CellHalves = Record<HalfSide, boolean>;

/** Halves of `(fortyBay, row, tier)` occupied by SOME placed box. */
export function occupiedHalvesAt(
  vessel: Vessel,
  plan: StowagePlan,
  fortyBay: number,
  row: number,
  tier: number,
): CellHalves {
  const halves: CellHalves = { fore: false, aft: false };
  for (const p of plan.placements) {
    if (p.slot.row !== row || p.slot.tier !== tier) continue;
    const pos = bayPosition(p.slot.bay, vessel.bays);
    if (!pos || pos.fortyBay !== fortyBay) continue;
    for (const half of pos.halves) halves[half] = true;
  }
  return halves;
}

/** True when every half in `halves` is occupied — "is this cell able to carry a box covering them". */
export const allHalvesOccupied = (cell: CellHalves, halves: readonly HalfSide[]): boolean =>
  halves.every((half) => cell[half]);

/** True when no half in `halves` is taken — "is there room here for a box covering them". */
export const allHalvesFree = (cell: CellHalves, halves: readonly HalfSide[]): boolean =>
  halves.every((half) => !cell[half]);
