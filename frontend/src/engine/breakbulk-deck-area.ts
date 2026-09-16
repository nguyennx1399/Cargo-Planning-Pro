import type { BreakbulkDeckLayout, BreakbulkKeepOut, BreakbulkPlacement, Vessel } from "@/types/domain";
import { LAYOUT } from "@/lib/geometry";

export interface DeckArea {
  xMin: number;
  xMax: number;
  zMin: number;
  zMax: number;
}

/** Id of the weather deck — what a BreakbulkPlacement without `area_id` rests on. */
export const WEATHER_DECK_AREA_ID = "weather_deck";

/** Margin fractions of LOA kept clear at bow (anchor gear, sightlines) and stern (superstructure,
 * mooring). A DEMO approximation from vessel.length_m/beam_m only — NOT a real GA deck layout
 * (hatch covers, cargo rails, crane reach aren't modeled). Used only for vessels WITHOUT a
 * `breakbulk_deck` layout. See plan.md "Ngoài phạm vi". */
const BOW_MARGIN_FRACTION = 0.15;
const STERN_MARGIN_FRACTION = 0.15;
const BEAM_MARGIN_M = 1.5; // clear of the shell plating on each side

export const areaIdOf = (placement: Pick<BreakbulkPlacement, "area_id">): string => placement.area_id ?? WEATHER_DECK_AREA_ID;

/** The layout behind an area id: the weather deck's `breakbulk_deck`, or a hold area. `null` for
 * an unknown hold id (callers treat that as "no usable area"); `undefined` for the weather deck of
 * a vessel without a declared layout (callers fall back to the generic approximation). */
function layoutFor(vessel: Vessel, areaId?: string): BreakbulkDeckLayout | undefined | null {
  if (!areaId || areaId === WEATHER_DECK_AREA_ID) return vessel.breakbulk_deck;
  return vessel.breakbulk_holds?.find((h) => h.id === areaId) ?? null;
}

/** All stowage area ids for a vessel: the weather deck first, then its holds in declared order. */
export function stowageAreaIds(vessel: Vessel): string[] {
  return [WEATHER_DECK_AREA_ID, ...(vessel.breakbulk_holds ?? []).map((h) => h.id)];
}

export function isKnownArea(vessel: Vessel, areaId?: string): boolean {
  return layoutFor(vessel, areaId) !== null;
}

export function isUnderDeck(areaId?: string): boolean {
  return !!areaId && areaId !== WEATHER_DECK_AREA_ID;
}

export function areaLabel(vessel: Vessel, areaId?: string): string {
  if (!areaId || areaId === WEATHER_DECK_AREA_ID) return "weather deck";
  return vessel.breakbulk_holds?.find((h) => h.id === areaId)?.label ?? `unknown area "${areaId}"`;
}

/** Usable rectangle for breakbulk cargo in an area (weather deck by default). x is NOT AP-referenced
 * ship-frame — it's vessel.length_m/2-symmetric (0 at the LOA's stern end, length_m at the bow tip),
 * matching BreakbulkPlacement.x_m's documented convention in types/domain.ts (which also explains
 * why: this whole subsystem deliberately avoids needing VesselGeometry). z is +starboard, centered
 * on the centerline. A declared layout wins; otherwise the weather deck uses bow/stern/beam margins.
 * An unknown hold id yields an empty rectangle, so every footprint in it reads as out of area. */
export function deckArea(vessel: Vessel, areaId?: string): DeckArea {
  const l = layoutFor(vessel, areaId);
  if (l === null) return { xMin: 0, xMax: 0, zMin: 0, zMax: 0 };
  if (l) return { ...l.area };
  const bowMargin = vessel.length_m * BOW_MARGIN_FRACTION;
  const sternMargin = vessel.length_m * STERN_MARGIN_FRACTION;
  return {
    xMin: sternMargin,
    xMax: vessel.length_m - bowMargin,
    zMin: -vessel.beam_m / 2 + BEAM_MARGIN_M,
    zMax: vessel.beam_m / 2 - BEAM_MARGIN_M,
  };
}

/** Structures inside an area that cargo footprints must not overlap (none for generic vessels). */
export function deckKeepOuts(vessel: Vessel, areaId?: string): BreakbulkKeepOut[] {
  return layoutFor(vessel, areaId)?.keep_out ?? [];
}

/** Scene-y of the surface breakbulk cargo rests on (main deck = 0). Generic vessels use the same
 * LAYOUT.hatchHeight on-deck containers use; a declared layout gives its real surface (a tank top
 * is negative — below the main deck). */
export function cargoBaseHeight(vessel: Vessel, areaId?: string): number {
  return layoutFor(vessel, areaId)?.cargo_base_height_m ?? LAYOUT.hatchHeight;
}

/** Max item height above the resting surface, or Infinity when the area doesn't declare one. */
export function maxCargoHeight(vessel: Vessel, areaId?: string): number {
  return layoutFor(vessel, areaId)?.max_cargo_height_m ?? Infinity;
}

/** Rated uniform load of the resting surface (t/m²), if declared. */
export function deckLoadRating(vessel: Vessel, areaId?: string): number | undefined {
  return layoutFor(vessel, areaId)?.deck_load_t_per_m2;
}
