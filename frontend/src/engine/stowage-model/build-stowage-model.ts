/**
 * buildStowageModel(vessel) — the one place a Vessel's stowage areas and container slots are
 * derived (spec §4.2). The packer, validator, 3D renderer and drag-and-drop all read this instead
 * of re-deriving geometry, which is the "re-derived in several places" gap the spec opened with.
 *
 * Pure: no react/three/zustand. Cached per vessel object identity — `getVesselCatalogEntry`
 * memoises built vessels by id, so the model is stable across renders with no invalidation logic.
 * Test fixtures spread into new objects, which correctly yields fresh entries.
 *
 * Slots (which bay/row/tier shapes exist, 20' halves included) live in ./slot-enumeration.ts; this
 * file owns the areas, the cache and the lookups.
 *
 * Spec §9 suggests a dev-only `Object.freeze` on built vessels to catch mutation. Deliberately not
 * done here: freezing a catalog-owned object would break fixtures that mutate (and the repo's
 * test style spreads rather than mutates), so the cache invariant stays a documented convention.
 */
import type { Vessel } from "@/types/domain";
import { LAYOUT } from "@/lib/geometry";
import { rectContainsPoint } from "./coords";
import { slotDefs } from "./slot-enumeration";
import { WEATHER_DECK_AREA_ID, type StowageArea, type StowageModel } from "./types";

/** Generic-deck margins, reproduced verbatim from the pre-refactor breakbulk-deck-area.ts so a
 * vessel without `breakbulk_deck` gets the identical rectangle (guarded by a unit test). */
const BOW_MARGIN_FRACTION = 0.15;
const STERN_MARGIN_FRACTION = 0.15;
const BEAM_MARGIN_M = 1.5; // clear of the shell plating on each side

/** Weather deck: the vessel's declared layout, else the fraction-of-LOA approximation. Note the
 * generic case still produces a real area (source: "generic") rather than "no area" — only an
 * unknown *hold* id has no area at all, and callers keep treating that as unusable. */
function weatherDeckArea(vessel: Vessel): StowageArea {
  const declared = vessel.breakbulk_deck;
  if (declared) {
    return {
      id: WEATHER_DECK_AREA_ID,
      label: "weather deck",
      level: "weather_deck",
      onDeck: true,
      rect: { ...declared.area },
      keepOuts: declared.keep_out ?? [],
      surfaceY: declared.cargo_base_height_m,
      maxHeight: declared.max_cargo_height_m ?? Infinity,
      ...(declared.deck_load_t_per_m2 !== undefined ? { loadRating: declared.deck_load_t_per_m2 } : {}),
      source: "declared",
    };
  }
  const bowMargin = vessel.length_m * BOW_MARGIN_FRACTION;
  const sternMargin = vessel.length_m * STERN_MARGIN_FRACTION;
  return {
    id: WEATHER_DECK_AREA_ID,
    label: "weather deck",
    level: "weather_deck",
    onDeck: true,
    rect: {
      xMin: sternMargin,
      xMax: vessel.length_m - bowMargin,
      zMin: -vessel.beam_m / 2 + BEAM_MARGIN_M,
      zMax: vessel.beam_m / 2 - BEAM_MARGIN_M,
    },
    keepOuts: [],
    surfaceY: LAYOUT.hatchHeight,
    maxHeight: Infinity,
    source: "generic",
  };
}

/** Under-deck areas, in the vessel's declared order (holdAreasFromSpec already sorts largest
 * first, which is the order the packer spills into them). */
function holdAreas(vessel: Vessel): StowageArea[] {
  return (vessel.breakbulk_holds ?? []).map((h) => ({
    id: h.id,
    label: h.label,
    level: h.level,
    ...(h.hold ? { hold: h.hold } : {}),
    onDeck: false,
    rect: { ...h.area },
    keepOuts: h.keep_out ?? [],
    surfaceY: h.cargo_base_height_m,
    maxHeight: h.max_cargo_height_m ?? Infinity,
    ...(h.deck_load_t_per_m2 !== undefined ? { loadRating: h.deck_load_t_per_m2 } : {}),
    source: "declared" as const,
  }));
}

const modelCache = new WeakMap<Vessel, StowageModel>();

/** Build (or reuse) the vessel's stowage model. */
export function buildStowageModel(vessel: Vessel): StowageModel {
  const cached = modelCache.get(vessel);
  if (cached) return cached;

  const areas = [weatherDeckArea(vessel), ...holdAreas(vessel)];
  const slots = slotDefs(vessel, areas);
  const model: StowageModel = {
    vesselId: vessel.id,
    lengthM: vessel.length_m,
    beamM: vessel.beam_m,
    areas,
    areaById: new Map(areas.map((a) => [a.id, a])),
    slots,
    slotByKey: new Map(slots.map((s) => [s.key, s])),
  };
  modelCache.set(vessel, model);
  return model;
}

/** Every area containing the point — several can match (a hatch cover above a tank top). Pass
 * `onDeck` when the caller knows which level toggle the planner is on, to disambiguate. */
export function areasAt(
  model: StowageModel,
  x_m: number,
  z_m: number,
  onDeck?: boolean,
): StowageArea[] {
  const hit = model.areas.filter((a) => rectContainsPoint(a.rect, x_m, z_m));
  return onDeck === undefined ? hit : hit.filter((a) => a.onDeck === onDeck);
}
