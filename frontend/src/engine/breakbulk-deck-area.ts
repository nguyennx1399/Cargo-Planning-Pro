import type { Vessel } from "@/types/domain";

export interface DeckArea {
  xMin: number;
  xMax: number;
  zMin: number;
  zMax: number;
}

/** Margin fractions of LOA kept clear at bow (anchor gear, sightlines) and stern (superstructure,
 * mooring). A DEMO approximation from vessel.length_m/beam_m only — NOT a real GA deck layout
 * (hatch covers, cargo rails, crane reach aren't modeled). See plan.md "Ngoài phạm vi". */
const BOW_MARGIN_FRACTION = 0.15;
const STERN_MARGIN_FRACTION = 0.15;
const BEAM_MARGIN_M = 1.5; // clear of the shell plating on each side

/** Usable on-deck rectangle for breakbulk cargo. x is NOT AP-referenced ship-frame — it's
 * vessel.length_m/2-symmetric (0 at the LOA's stern end, length_m at the bow tip), matching
 * BreakbulkPlacement.x_m's documented convention in types/domain.ts (which also explains why:
 * this whole subsystem deliberately avoids needing VesselGeometry). z is +starboard, centered on
 * the centerline — no LOA/LBP ambiguity on that axis. Bow margin trims the HIGH end of x (near
 * the bow), stern margin trims the LOW end (near the stern). */
export function deckArea(vessel: Vessel): DeckArea {
  const bowMargin = vessel.length_m * BOW_MARGIN_FRACTION;
  const sternMargin = vessel.length_m * STERN_MARGIN_FRACTION;
  return {
    xMin: sternMargin,
    xMax: vessel.length_m - bowMargin,
    zMin: -vessel.beam_m / 2 + BEAM_MARGIN_M,
    zMax: vessel.beam_m / 2 - BEAM_MARGIN_M,
  };
}
