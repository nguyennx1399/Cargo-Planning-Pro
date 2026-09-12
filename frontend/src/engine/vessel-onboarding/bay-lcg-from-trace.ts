// Turns clicked bay-centre points (already run through a calibrated drawing transform, so
// their x is already ship-frame meters) into VesselGeometry.bay_lcg_m — the real per-bay LCG
// that lib/geometry.ts's bayCenterX falls back to once it exists (see phase-01's seam).
export interface BayClick {
  bay: number;
  xShipFrameM: number;
}

/** Builds bay_lcg_m from calibrated clicks. Later clicks for the same bay overwrite earlier
 * ones (re-clicking to correct a mistake), which is the simplest sane behavior for a UI list. */
export function bayLcgFromClicks(clicks: BayClick[]): Record<number, number> {
  const result: Record<number, number> = {};
  for (const c of clicks) result[c.bay] = c.xShipFrameM;
  return result;
}

/** Sanity check: every clicked bay must be one the vessel actually has, and there should be no
 * bay with wildly inconsistent LCG vs. its neighbors by declared bay order (a possible sign of
 * a mis-click) — flagged as a warning, not blocked, since a real ship can have uneven bay pitch. */
export function checkBayLcgAgainstVessel(bayLcgM: Record<number, number>, vesselBays: number[]): string[] {
  const warnings: string[] = [];
  for (const bay of Object.keys(bayLcgM).map(Number)) {
    if (!vesselBays.includes(bay)) warnings.push(`bay ${bay} is not one of this vessel's declared bays`);
  }
  const orderedKnown = vesselBays.filter((b) => bayLcgM[b] !== undefined);
  for (let i = 1; i < orderedKnown.length; i++) {
    const prev = orderedKnown[i - 1];
    const cur = orderedKnown[i];
    if (bayLcgM[cur] === bayLcgM[prev]) {
      warnings.push(`bay ${cur} has the same LCG as bay ${prev} — likely a duplicate click`);
    }
  }
  return warnings;
}
