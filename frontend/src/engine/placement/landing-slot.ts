/**
 * landing-slot.ts — gravity for the drop TARGET: where a box aimed at a column actually comes to rest.
 *
 * WHY: aiming at a tier with nothing under it used to be a flat refusal (`no_floating`), so the whole
 * upper part of an empty column read red and the planner had to find the one supported tier by eye.
 * Boxes do not hover, and neither should the target — aim at the column, the box lands on the stack top.
 *
 * IT IS A TARGET RULE, NOT A PLACEMENT RULE. Nothing here relaxes anything: the slot this returns is
 * still handed to `canPlaceContainer`, which can still refuse it for a reefer plug, stack weight, clear
 * height, overstow, a cell conflict or breakbulk underneath. The plan-wide `no_floating` rule and the
 * origin-side support guard are untouched — this only moves WHERE the drop is aimed, so a floating
 * placement is never written in the first place.
 *
 * COLUMNS NEVER CROSS THE DECK LINE. `deckOf` splits on/under deck, and the bottom tier of each deck is
 * supported by construction (tank top below, hatch cover on deck). That is what stops a box aimed at the
 * weather deck from sinking into the hold.
 *
 * HALVES. A 20' box needs only its own half free and supported; a 40' box needs both. `bayPosition`
 * gives the halves the candidate covers, exactly as the predicate and the support rule read them — the
 * repo keeps ONE definition of that, and this is not a second one.
 *
 * NO `Container` ARGUMENT, deliberately: the halves follow from the AIMED BAY's parity (odd = one half
 * of its 40' parent, even = both), and a box can only be aimed at a bay its size fits — `sizeFitsBay`
 * filters the pick volumes, and `canPlaceContainer` refuses the mismatch anyway. Taking a container
 * here would imply this rule re-checks size, which it must not: that is the predicate's job.
 */
import type { Slot, StowagePlan, Vessel } from "@/types/domain";
import type { SlotDef } from "@/engine/stowage-model";
import { bayPosition, deckOf } from "@/engine/slot-helpers";
import { allHalvesFree, allHalvesOccupied, occupiedHalvesAt } from "./cell-occupancy";

/**
 * The slot a box aimed at `aimed`'s column would come to rest in: the LOWEST tier that is free for this
 * box and supported.
 *
 * `null` when the column admits none — full, or every free tier sits over a gap that nothing fills.
 * Callers fall back to the aimed slot so the predicate can voice its own refusal, rather than the
 * pointer silently resolving to nothing.
 *
 * Returns the aimed slot unchanged when the vessel has no such column (no `bayPosition`, no `StackSpec`):
 * those are `slot_exists` / `size_fits_bay` cases and belong to the predicate, not to gravity.
 */
export function landingSlotFor(vessel: Vessel, plan: StowagePlan, aimed: Slot): Slot | null {
  const pos = bayPosition(aimed.bay, vessel.bays);
  if (!pos) return aimed;
  const deck = deckOf(aimed.tier);
  const stack = vessel.stacks.find((s) => s.bay === pos.fortyBay && s.row === aimed.row && s.deck === deck);
  if (!stack) return aimed;

  const tiers = [...stack.tiers].sort((a, b) => a - b);
  for (let i = 0; i < tiers.length; i++) {
    const tier = tiers[i];
    const cell = occupiedHalvesAt(vessel, plan, pos.fortyBay, aimed.row, tier);
    // Something already stands on a half this box needs: it cannot rest here, keep climbing.
    if (!allHalvesFree(cell, pos.halves)) continue;
    // The bottom tier of the deck rests on the deck itself; anything higher needs the cell below filled
    // on every half this box covers — the same test `no_floating` applies.
    const supported =
      i === 0 ||
      allHalvesOccupied(occupiedHalvesAt(vessel, plan, pos.fortyBay, aimed.row, tiers[i - 1]), pos.halves);
    if (supported) return { bay: aimed.bay, row: aimed.row, tier };
  }
  return null;
}

/**
 * The subset of `slots` a box would actually come to rest in — at most one per (bay, row, deck) column.
 *
 * The drawn placeholder layer uses this so every box it paints is a real landing spot: once the pointer
 * snaps to the stack top, painting the other valid tiers of a column would promise targets the drop will
 * never use, which is the "drawn layer disagrees with the pickable layer" failure this codebase has
 * already paid for twice.
 *
 * A projection, not a second sweep: it filters the set `validSlotsFor` already produced, keeping the
 * slots that are their OWN landing slot.
 */
export function landingSlotsOnly(
  vessel: Vessel,
  plan: StowagePlan,
  slots: readonly SlotDef[],
): SlotDef[] {
  return slots.filter((slot) => {
    const landing = landingSlotFor(vessel, plan, slot);
    return landing !== null && landing.tier === slot.tier && landing.bay === slot.bay && landing.row === slot.row;
  });
}
