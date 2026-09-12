import type { Placement, Vessel } from "@/types/domain";
import { DIM, LAYOUT } from "@/lib/geometry";

export interface XZone {
  xMin: number;
  xMax: number;
}

const ON_DECK_TIER_THRESHOLD = 80; // matches ContainerInstances.tsx's own on-deck check

/** A bay's center in the SAME vessel.length_m/2-symmetric convention BreakbulkPlacement.x_m uses
 * (see the big comment on that interface in types/domain.ts) — NOT the AP-referenced ship-frame
 * lib/ship-frame.ts uses. This is lib/geometry.ts's bayCenterX fallback formula (a scene x,
 * midship-relative) shifted by +length_m/2 to match x_m's origin, kept self-contained here
 * rather than importing bayCenterX so this file never needs a VesselGeometry. Correctness note:
 * this MUST stay in the same convention as x_m for onDeckBayZones' overlap checks to be
 * meaningful — do not "fix" this to produce true ship-frame without also updating every
 * BreakbulkPlacement.x_m producer/consumer (see phase-03 plan's Deviations for the bug this
 * caused when the mesh builder briefly assumed x_m WAS true ship-frame). */
function bayCenterXVesselRelative(vessel: Vessel, bay: number): number {
  const i = vessel.bays.indexOf(bay);
  const pitch = DIM.len40 + LAYOUT.bayGap;
  return vessel.length_m - LAYOUT.bowMargin - (i + 0.5) * pitch;
}

/** x ranges (in BreakbulkPlacement.x_m's convention) occupied by bays that ACTUALLY carry an
 * on-deck container in the current plan — breakbulk cargo must not be placed over these.
 * Deliberately reads `placements`, not `vessel.stacks`: the vessel declares on-deck CAPACITY for
 * every bay regardless of what's loaded, so keying off stacks would forbid the entire deck even
 * on an empty ship. Approximates each occupied bay's footprint as one 40'-container length (DEMO
 * simplification, ignores actual mix of sizes in that bay). */
export function onDeckBayZones(vessel: Vessel, placements: Placement[]): XZone[] {
  const onDeckBays = new Set(placements.filter((p) => p.slot.tier >= ON_DECK_TIER_THRESHOLD).map((p) => p.slot.bay));
  return [...onDeckBays].map((bay) => {
    const center = bayCenterXVesselRelative(vessel, bay);
    return { xMin: center - DIM.len40 / 2, xMax: center + DIM.len40 / 2 };
  });
}
