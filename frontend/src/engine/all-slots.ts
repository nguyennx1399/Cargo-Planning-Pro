import type { Placement, Slot, Vessel } from "@/types/domain";

/** Every valid slot in the vessel's stow grid, occupied or not — derived from `vessel.stacks`
 * (each StackSpec lists the valid tiers for one bay+row+deck combination). Feeds raycast-to-slot
 * picking for the drag-and-drop editor (E3-04a): the container mesh already resolves occupied
 * slots via its own instances, so this covers the gap — finding a slot with nothing in it yet. */
export function allSlots(vessel: Vessel): Slot[] {
  const slots: Slot[] = [];
  for (const stack of vessel.stacks) {
    for (const tier of stack.tiers)
      slots.push({ bay: stack.bay, row: stack.row, tier });
  }
  return slots;
}

function slotKey(s: Slot): string {
  return `${s.bay}:${s.row}:${s.tier}`;
}

/** `allSlots` minus any slot already covered by a placement — the set an empty-slot picker
 * mesh should actually render, so it never overlaps/depth-fights with occupied containers. */
export function emptySlots(vessel: Vessel, placements: Placement[]): Slot[] {
  const occupied = new Set(placements.map((p) => slotKey(p.slot)));
  return allSlots(vessel).filter((s) => !occupied.has(slotKey(s)));
}
