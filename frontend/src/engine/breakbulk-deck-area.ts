/**
 * Thin wrappers over the StowageModel (spec §7 Phase A): every accessor resolves the model's area
 * by id and returns the same shape it always did, so the six existing callers
 * (naive-fill-breakbulk, breakbulk-validation-rules, breakbulk-mesh-builder, lib/breakbulk-weight-item,
 * Sidebar, and the tests) keep compiling and behaving identically.
 *
 * TEMPORARY SHIM — Validation Session 1 decided this file is deleted in Phase E once its callers
 * are migrated onto the model directly. Do not add new exports here; add them to
 * engine/stowage-model/ instead.
 *
 * Semantics preserved from the pre-refactor version: an unknown *hold* id has no area at all
 * (callers treat it as "no usable area"), while the weather deck of a vessel without a declared
 * `breakbulk_deck` is a real area backed by the fraction-of-LOA approximation.
 */
import type { BreakbulkKeepOut, Vessel } from "@/types/domain";
import { LAYOUT } from "@/lib/geometry";
import { buildStowageModel } from "@/engine/stowage-model/build-stowage-model";
import { WEATHER_DECK_AREA_ID, type StowageArea } from "@/engine/stowage-model/types";

export interface DeckArea {
  xMin: number;
  xMax: number;
  zMin: number;
  zMax: number;
}

export { WEATHER_DECK_AREA_ID, areaIdOf } from "@/engine/stowage-model/types";

/** The model's area for an id, defaulting to the weather deck. `undefined` for an unknown hold id.
 * The falsy check (not `??`) matches the original `layoutFor`, which treated "" as the weather
 * deck. */
function areaFor(vessel: Vessel, areaId?: string): StowageArea | undefined {
  return buildStowageModel(vessel).areaById.get(areaId ? areaId : WEATHER_DECK_AREA_ID);
}

/** All stowage area ids for a vessel: the weather deck first, then its holds in declared order. */
export function stowageAreaIds(vessel: Vessel): string[] {
  return buildStowageModel(vessel).areas.map((a) => a.id);
}

export function isKnownArea(vessel: Vessel, areaId?: string): boolean {
  return areaFor(vessel, areaId) !== undefined;
}

export function isUnderDeck(areaId?: string): boolean {
  return !!areaId && areaId !== WEATHER_DECK_AREA_ID;
}

export function areaLabel(vessel: Vessel, areaId?: string): string {
  return areaFor(vessel, areaId)?.label ?? `unknown area "${areaId}"`;
}

/** Usable rectangle for breakbulk cargo in an area (weather deck by default). An unknown hold id
 * yields an empty rectangle, so every footprint in it reads as out of area. */
export function deckArea(vessel: Vessel, areaId?: string): DeckArea {
  const area = areaFor(vessel, areaId);
  if (!area) return { xMin: 0, xMax: 0, zMin: 0, zMax: 0 };
  return { ...area.rect };
}

/** Structures inside an area that cargo footprints must not overlap (none for generic vessels). */
export function deckKeepOuts(vessel: Vessel, areaId?: string): BreakbulkKeepOut[] {
  return areaFor(vessel, areaId)?.keepOuts ?? [];
}

/** Scene-y of the surface breakbulk cargo rests on (main deck = 0; a tank top is negative). */
export function cargoBaseHeight(vessel: Vessel, areaId?: string): number {
  return areaFor(vessel, areaId)?.surfaceY ?? LAYOUT.hatchHeight;
}

/** Max item height above the resting surface, or Infinity when the area doesn't declare one. */
export function maxCargoHeight(vessel: Vessel, areaId?: string): number {
  return areaFor(vessel, areaId)?.maxHeight ?? Infinity;
}

/** Rated uniform load of the resting surface (t/m²), if declared. */
export function deckLoadRating(vessel: Vessel, areaId?: string): number | undefined {
  return areaFor(vessel, areaId)?.loadRating;
}
