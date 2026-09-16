/**
 * The StowageModel vocabulary — one model per vessel, the single source of truth the packer,
 * validator, 3D renderer, bay plan and drag-and-drop all read (spec §4.1).
 *
 * `WEATHER_DECK_AREA_ID`/`areaIdOf` live here rather than in engine/breakbulk-deck-area.ts so that
 * file can re-export them while importing the builder: putting them the other way round would make
 * breakbulk-deck-area -> occupancy -> breakbulk-deck-area an import cycle.
 */
import type { BreakbulkKeepOut } from "@/types/domain";
import type { Rect } from "@/engine/breakbulk-overlap-check";

/** The three stowage levels a vessel can have. Same union as the stowage spec's CargoSpaceLevel. */
export type StowageLevel = "weather_deck" | "tweendeck" | "tank_top";

/** Id of the weather deck — what a BreakbulkPlacement without `area_id` rests on. */
export const WEATHER_DECK_AREA_ID = "weather_deck";

export interface StowageArea {
  id: string;
  label: string;
  level: StowageLevel;
  hold?: string;
  onDeck: boolean;
  /** Usable rectangle, in BreakbulkPlacement.x_m's length_m/2-symmetric convention (see the
   * comment on that interface in types/domain.ts) — NOT AP-referenced ship-frame. */
  rect: Rect;
  keepOuts: BreakbulkKeepOut[];
  /** Scene y of the surface cargo rests on (main deck = 0; a tank top is negative). */
  surfaceY: number;
  /** Max item height above the resting surface; Infinity when the area declares none. */
  maxHeight: number;
  /** Rated uniform load of the surface (t/m²), when declared. */
  loadRating?: number;
  /** `generic` = the fraction-of-LOA approximation, not a real GA layout. Phase D badges these. */
  source: "declared" | "generic";
}

export interface SlotDef {
  /** "bay|row|tier" — the model's authoritative slot key. */
  key: string;
  bay: number;
  row: number;
  tier: number;
  deck: "on" | "under";
  /** Plan-view footprint in the slot's own size, x_m convention: an even (40') bay covers a 40' cell,
   * an odd (20') bay one half of its parent — the same convention `sizeFitsBay` uses to pick a bay. */
  rect: Rect;
  /** Scene position — identical to slotToPosition(vessel, slot). */
  center: [number, number, number];
  /** The stowage area this stack stands in/over, or null when it overlaps none. */
  areaId: string | null;
  maxStackWeightT: number;
}

export interface StowageModel {
  vesselId: string;
  lengthM: number;
  beamM: number;
  areas: StowageArea[];
  areaById: Map<string, StowageArea>;
  slots: SlotDef[];
  slotByKey: Map<string, SlotDef>;
}

/** One bay/row/deck footprint that actually carries a container (never merely capacity). */
export interface OccupiedStack {
  bay: number;
  row: number;
  deck: "on" | "under";
  /** x_m convention, matching SlotDef.rect. */
  rect: Rect;
}

/** The area a placement belongs to, defaulting to the weather deck. */
export const areaIdOf = (placement: { area_id?: string }): string =>
  placement.area_id ?? WEATHER_DECK_AREA_ID;
