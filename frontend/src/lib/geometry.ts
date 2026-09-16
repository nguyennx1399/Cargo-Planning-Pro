import type { Slot, Vessel } from "@/types/domain";
import type { VesselGeometry } from "@/types/vessel-geometry";
import { bayPosition } from "@/engine/slot-helpers";
import { shipToScene } from "./ship-frame";

// ISO container dimensions (m). Axes: x = longitudinal (bow +x), y = up, z = transverse (starboard +z)
export const DIM = {
  len20: 6.058,
  len40: 12.192,
  len45: 13.716,
  width: 2.438,
  height: 2.591,
  heightHC: 2.896,
} as const;

// Layout tuning for the simplified hull. TODO(phase-1): take real LCG/TCG/VCG per slot from vessel profile.
export const LAYOUT = {
  bayGap: 1.2, // space between 40' bays (hatch coamings, lashing bridges)
  rowGap: 0.06,
  tierPitch: 2.65, // vertical grid per tier (container + fittings)
  bowMargin: 22, // from bow tip to first bay
  hatchHeight: 0.6, // hatch cover above deck
  holdTiers: 4,
};

/**
 * Vertical space reserved for the under-deck stack, sized from the vessel's own tallest
 * under-deck StackSpec (same tier convention as tierCenterY: starts at 2, steps by 2) rather
 * than a fixed tier count — a mismatch here used to let the top under-deck container overlap
 * into the on-deck stack's space whenever a vessel had more under-deck tiers than LAYOUT.holdTiers
 * assumed. Falls back to the LAYOUT.holdTiers-based estimate only when a vessel has no under-deck
 * stacks at all (e.g. minimal test fixtures).
 */
export function holdDepth(vessel: Vessel): number {
  const underTiers = vessel.stacks
    .filter((s) => s.deck === "under")
    .flatMap((s) => s.tiers);
  if (underTiers.length === 0) return LAYOUT.holdTiers * LAYOUT.tierPitch + 0.4;
  const maxK = (Math.max(...underTiers) - 2) / 2;
  return (maxK + 1) * LAYOUT.tierPitch + 0.4;
}

/**
 * Distance from a 40' bay's centre to the centre of one of its two 20' halves. A 40' cell spans both
 * 20' positions, so each half sits half a container length off the middle, toward its own end.
 */
export const HALF_BAY_OFFSET_M = (DIM.len40 - DIM.len20) / 2;

/**
 * Bay centre, in scene x. Uses `geometry.bay_lcg_m` (a real, calibrated ship-frame LCG from
 * vessel onboarding — vessel-3d-model-pipeline phase 5) when available, routed through
 * `shipToScene`; otherwise falls back to the tuned LAYOUT constants below.
 * TODO(phase-5): drop the fallback once every vessel has calibrated bay LCGs.
 *
 * An ODD bay (a 20' half position, see slot-helpers.bayPosition) has no bay of its own to index, so
 * it is the centre of its 40' parent offset by HALF_BAY_OFFSET_M — toward the bow for the fore half.
 * Bays are numbered bow -> stern and scene x is bow-positive, so the fore half (parent bay - 1) is
 * the +x one. Routing through the parent also keeps a declared layout (`bay_center_x_m`) and
 * calibrated LCGs authoritative for halves, which have no entries of their own.
 */
export function bayCenterX(
  vessel: Vessel,
  bay: number,
  geometry?: VesselGeometry,
): number {
  // A vessel-declared container layout (built from its stowage spec) is the real bay position.
  const declared = vessel.container_layout?.bay_center_x_m[bay];
  if (declared !== undefined) return declared - vessel.length_m / 2;
  const calibratedLcg = geometry?.bay_lcg_m?.[bay];
  if (calibratedLcg !== undefined && geometry) {
    return shipToScene(geometry, [calibratedLcg, 0, 0])[0];
  }
  const i = vessel.bays.indexOf(bay);
  const pitch = DIM.len40 + LAYOUT.bayGap;
  if (i >= 0) return vessel.length_m / 2 - LAYOUT.bowMargin - (i + 0.5) * pitch;

  // No such bay of its own: an odd (20') bay is a half of the 40' bay the validator maps it to.
  const pos = bayPosition(bay, vessel.bays);
  if (!pos) return vessel.length_m / 2 - LAYOUT.bowMargin + 0.5 * pitch; // bay not on this vessel at all
  const offset = pos.halves.includes("fore") ? HALF_BAY_OFFSET_M : -HALF_BAY_OFFSET_M;
  return bayCenterX(vessel, pos.fortyBay, geometry) + offset;
}

export function rowCenterZ(vessel: Vessel, row: number): number {
  const j = vessel.rows.indexOf(row);
  const n = vessel.rows.length;
  return (j - (n - 1) / 2) * (DIM.width + LAYOUT.rowGap);
}

/** The 40' bay a tier's declared base is keyed by: an odd (20') bay has no entry of its own, so it
 * reads its parent's (bayPosition). Without this a declared vessel's half-slots would silently fall
 * back to the generic hatch/hold height — wrong by metres on BBC SAO PAULO, where the hatch covers
 * are at 4.8 m and the tank tops well below 0. */
const baseBayOf = (vessel: Vessel, bay: number): number =>
  bayPosition(bay, vessel.bays)?.fortyBay ?? bay;

/** Tier centre in scene y. With `bay` and a vessel `container_layout`, the bottom tier rests on that
 * bay's real surface (hatch-cover top on deck; tank top or tweendeck level below); otherwise the
 * generic hatchHeight / holdDepth layout. */
export function tierCenterY(tier: number, vessel: Vessel, bay?: number): number {
  const onDeck = tier >= 80;
  const k = onDeck ? (tier - 82) / 2 : (tier - 2) / 2;
  const layout = vessel.container_layout;
  const baseBay = bay === undefined ? undefined : baseBayOf(vessel, bay);
  const declaredBase =
    baseBay === undefined || !layout
      ? undefined
      : onDeck
        ? layout.on_deck_base_y_m[baseBay]
        : layout.under_deck_base_y_m[baseBay];
  const base = declaredBase ?? (onDeck ? LAYOUT.hatchHeight : -holdDepth(vessel));
  return base + k * LAYOUT.tierPitch + LAYOUT.tierPitch / 2;
}

export function slotToPosition(
  vessel: Vessel,
  slot: Slot,
): [number, number, number] {
  return [
    bayCenterX(vessel, slot.bay),
    tierCenterY(slot.tier, vessel, slot.bay),
    rowCenterZ(vessel, slot.row),
  ];
}
