/**
 * bay-cell-target.ts — what a click on a bay-sheet cell MEANS (all-bay overview, phase 02). Pure, so the
 * rule is node-tested and both the single-bay view and the overview read it identically.
 *
 * With odd-bay sections a click lands on a 20' position. What it targets depends on what is in hand:
 *  - nothing → the box drawn there is selected (a "×" selects its 40' box);
 *  - a 20' box → that odd bay's slot, the section clicked;
 *  - a 40'/45' box → the parent 40' bay's slot, whichever of the two sections was clicked.
 * The slot then goes through the unchanged `commitPlacement(landingSlotFor(...) ?? slot)`, so no
 * placement rule lives here.
 *
 * The valid outline follows the same mapping: a 20' in hand is valid per odd slot; a 40' is valid per 40'
 * slot, and is then outlined in BOTH sections, so the planner sees the whole footprint it would take.
 */
import type { ContainerSize, Slot } from "@/types/domain";

export type SectionSide = "fore" | "aft";

/** The odd (20') bay of a side of a 40' pair: bays run bow → stern, so fore is `b − 1`. */
export const sideBay = (fortyBay: number, side: SectionSide): number => (side === "fore" ? fortyBay - 1 : fortyBay + 1);

/** The slot a click on (side, row, tier) aims at for a box of `size` in hand. */
export function cellTargetSlot(fortyBay: number, side: SectionSide, row: number, tier: number, size: ContainerSize): Slot {
  return { bay: size === "20" ? sideBay(fortyBay, side) : fortyBay, row, tier };
}

/** Whether (side, row, tier) is one of the valid positions (`validKeys`: the model's `bay|row|tier`). */
export function isValidCell(
  validKeys: ReadonlySet<string>,
  fortyBay: number,
  side: SectionSide,
  row: number,
  tier: number,
  size: ContainerSize,
): boolean {
  const slot = cellTargetSlot(fortyBay, side, row, tier, size);
  return validKeys.has(`${slot.bay}|${slot.row}|${slot.tier}`);
}
