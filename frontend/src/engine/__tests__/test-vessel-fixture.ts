/**
 * Tiny vessel + builders for rule tests.
 * Bays 02 and 06 (20' bays 01/03 and 05/07), rows [2, 1].
 * Under deck tiers 02/04 (limit 60 t), on deck 82/84 (limit 40 t). Reefer plug: bay 06 on-deck tier 82 only.
 */
import type { Container, Placement, PortCall, StackSpec, StowagePlan, Vessel } from "@/types/domain";

export const TEST_PORTS: PortCall[] = [
  { locode: "VNSGN", name: "Ho Chi Minh", sequence: 0, eta: null, etd: null },
  { locode: "SGSIN", name: "Singapore", sequence: 1, eta: null, etd: null },
  { locode: "MYPKG", name: "Port Klang", sequence: 2, eta: null, etd: null },
];

export function makeTestVessel(): Vessel {
  const stacks: StackSpec[] = [];
  for (const bay of [2, 6]) {
    for (const row of [2, 1]) {
      stacks.push({ bay, row, deck: "under", tiers: [2, 4], max_weight_t: 60, max_height_m: null, reefer_tiers: [] });
      stacks.push({ bay, row, deck: "on", tiers: [82, 84], max_weight_t: 40, max_height_m: null, reefer_tiers: bay === 6 ? [82] : [] });
    }
  }
  return { id: "test", name: "Test", imo: null, length_m: 60, beam_m: 10, bays: [2, 6], rows: [2, 1], stacks };
}

/** A 40' dry box of 10 t to SGSIN unless overridden. */
export const box = (id: string, patch: Partial<Container> = {}): Container => ({
  id, size: "40", type: "DRY", high_cube: false, weight_t: 10, pol: "VNSGN", pod: "SGSIN", imdg_class: null, oog: false, ...patch,
});

export const at = (containerId: string, bay: number, row: number, tier: number): Placement => ({
  container_id: containerId, slot: { bay, row, tier },
});

export const makePlan = (containers: Container[], placements: Placement[]): StowagePlan => ({
  id: "p", vessel_id: "test", voyage: "T1", ports: TEST_PORTS, containers, placements, unplaced: [],
  breakbulk_cargo: [], breakbulk_placements: [],
});
