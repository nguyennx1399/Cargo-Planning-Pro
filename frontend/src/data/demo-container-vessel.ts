/**
 * Generated demo container vessel "MV Demo Horizon" (~1,600 TEU nominal).
 * SYNTHETIC data for the frontend-only demo, not a real ship.
 * 10 x 40' bays (02..38, bow -> stern); 20' bays are the odd pairs (01/03, 05/07, ...).
 * 10 bays x (8 rows x 5 tiers under + 10 rows x 4 tiers on deck) = 800 x 40' cells = 1,600 TEU.
 */
import type { DeckLevel, StackSpec, Vessel } from "@/types/domain";
import { DEMO_HORIZON_GEOMETRY_ID } from "./demo-horizon-geometry";

export const DEMO_VESSEL_ID = "demo-horizon";

const FORTY_BAYS = Array.from({ length: 10 }, (_, i) => 2 + 4 * i);

/** Rows listed port -> starboard (even = port, odd = starboard, counting outward from centreline). */
const ON_DECK_ROWS = [10, 8, 6, 4, 2, 1, 3, 5, 7, 9];
const UNDER_DECK_ROWS = [8, 6, 4, 2, 1, 3, 5, 7];

// Stack limits are tuned so that manual edits can break them in the demo.
const DECK_TEMPLATE: Record<DeckLevel, { rows: number[]; tiers: number[]; maxWeightT: number }> = {
  under: { rows: UNDER_DECK_ROWS, tiers: [2, 4, 6, 8, 10], maxWeightT: 130 },
  on: { rows: ON_DECK_ROWS, tiers: [82, 84, 86, 88], maxWeightT: 90 },
};

/** Reefer plugs: on-deck tiers 82/84 in the four aftmost bays (close to the power supply aft). */
const REEFER_BAYS = FORTY_BAYS.slice(-4);
const REEFER_TIERS = [82, 84];

export function buildDemoVessel(): Vessel {
  const stacks: StackSpec[] = [];
  for (const bay of FORTY_BAYS) {
    for (const deck of ["under", "on"] as const) {
      const t = DECK_TEMPLATE[deck];
      for (const row of t.rows) {
        stacks.push({
          bay,
          row,
          deck,
          tiers: [...t.tiers],
          max_weight_t: t.maxWeightT,
          max_height_m: null,
          reefer_tiers: deck === "on" && REEFER_BAYS.includes(bay) ? [...REEFER_TIERS] : [],
        });
      }
    }
  }
  return {
    id: DEMO_VESSEL_ID,
    name: "MV Demo Horizon",
    imo: null,
    length_m: 172,
    beam_m: 27.4,
    bays: [...FORTY_BAYS],
    rows: [...ON_DECK_ROWS],
    stacks,
    geometry_id: DEMO_HORIZON_GEOMETRY_ID,
  };
}
