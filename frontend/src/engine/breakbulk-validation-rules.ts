/**
 * Breakbulk-only validation rules — deliberately separate from validation-rules.ts/ALL_RULES,
 * which are built entirely around the slot-based bay/row/tier grid (StackSpec, cells, columns).
 * Breakbulk cargo has none of that, so its rules operate on BreakbulkCargo/BreakbulkPlacement
 * directly rather than forcing it through the slot-based ValidationContext.
 *
 * Every rule is per stowage area (weather deck, or a hold via BreakbulkPlacement.area_id): an item
 * on the hatch covers can't overlap one on the tank top below it, and each area has its own
 * rectangle, keep-outs, clear height and rated load.
 */
import type { BreakbulkCargo, BreakbulkPlacement, Placement, Vessel, Violation } from "@/types/domain";
import {
  areaIdOf,
  areaLabel,
  deckArea,
  deckKeepOuts,
  deckLoadRating,
  isKnownArea,
  maxCargoHeight,
  WEATHER_DECK_AREA_ID,
} from "./breakbulk-deck-area";
import { footprintRect, rectsOverlap } from "./breakbulk-overlap-check";
import { onDeckBayZones, underDeckBayZones } from "./breakbulk-forbidden-zones";

/** DEMO approximation, not real structural deck strength — see plan.md "Ngoài phạm vi". */
const OVERWEIGHT_BAND_M = 20;
const OVERWEIGHT_LIMIT_T = 200;

function violation(rule: string, message: string, cargoId: string): Violation {
  return { rule, severity: "error", message, container_ids: [cargoId], slots: [] };
}

// Placement stores a rect's CENTER (x_m/z_m), so footprintRect reconstructs edges as
// center +/- extent/2 — for edge-of-deck placements (center derived from area.xMin/zMin
// themselves), that round-trip doesn't always reproduce the exact original bound
// (e.g. (25.8 + 31) - 31 = 25.799999999999997 in IEEE 754). A zero-tolerance comparison here
// flags those as real violations even though the placement is legitimately at the boundary —
// found via the real demo breakbulk set, not a contrived case. Same order of tolerance the
// naive-fill-breakbulk tests already use for this exact reason (see their `- 1e-9` assertions).
const EDGE_TOLERANCE_M = 1e-6;

/** Placements with their cargo item resolved, grouped by stowage area id. */
function byArea(cargo: BreakbulkCargo[], placements: BreakbulkPlacement[]) {
  const items = new Map(cargo.map((c) => [c.id, c]));
  const groups = new Map<string, { p: BreakbulkPlacement; item: BreakbulkCargo }[]>();
  for (const p of placements) {
    const item = items.get(p.cargo_id);
    if (!item) continue;
    const key = areaIdOf(p);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push({ p, item });
  }
  return groups;
}

export function breakbulkOutOfDeckArea(vessel: Vessel, cargo: BreakbulkCargo[], placements: BreakbulkPlacement[]): Violation[] {
  const out: Violation[] = [];
  for (const [areaId, entries] of byArea(cargo, placements)) {
    if (!isKnownArea(vessel, areaId)) {
      for (const { p } of entries) out.push(violation("breakbulk_out_of_deck_area", `${p.cargo_id}: unknown stowage area "${areaId}"`, p.cargo_id));
      continue;
    }
    const area = deckArea(vessel, areaId);
    for (const { p, item } of entries) {
      const rect = footprintRect(item, p);
      if (
        rect.xMin < area.xMin - EDGE_TOLERANCE_M ||
        rect.xMax > area.xMax + EDGE_TOLERANCE_M ||
        rect.zMin < area.zMin - EDGE_TOLERANCE_M ||
        rect.zMax > area.zMax + EDGE_TOLERANCE_M
      ) {
        const where = areaId === WEATHER_DECK_AREA_ID ? "the usable deck area" : areaLabel(vessel, areaId);
        out.push(violation("breakbulk_out_of_deck_area", `${p.cargo_id}: footprint extends outside ${where}`, p.cargo_id));
      }
    }
  }
  return out;
}

export function breakbulkOverlap(cargo: BreakbulkCargo[], placements: BreakbulkPlacement[]): Violation[] {
  const out: Violation[] = [];
  for (const entries of byArea(cargo, placements).values()) {
    for (let i = 0; i < entries.length; i++) {
      const rectA = footprintRect(entries[i].item, entries[i].p);
      for (let j = i + 1; j < entries.length; j++) {
        if (rectsOverlap(rectA, footprintRect(entries[j].item, entries[j].p))) {
          out.push(violation("breakbulk_overlap", `${entries[i].p.cargo_id} overlaps ${entries[j].p.cargo_id}`, entries[i].p.cargo_id));
        }
      }
    }
  }
  return out;
}

/** Breakbulk cargo on the weather deck must clear on-deck container bays; cargo in a hold must clear
 * under-deck container bays. */
export function breakbulkOverlapsContainer(vessel: Vessel, cargo: BreakbulkCargo[], placements: BreakbulkPlacement[], containerPlacements: Placement[]): Violation[] {
  const deckZones = onDeckBayZones(vessel, containerPlacements);
  const holdZones = underDeckBayZones(vessel, containerPlacements);
  const out: Violation[] = [];
  for (const [areaId, entries] of byArea(cargo, placements)) {
    const onDeck = areaId === WEATHER_DECK_AREA_ID;
    const zones = onDeck ? deckZones : holdZones;
    for (const { p, item } of entries) {
      const rect = footprintRect(item, p);
      if (zones.some((z) => rect.xMin < z.xMax && rect.xMax > z.xMin)) {
        out.push(violation("breakbulk_overlaps_container", `${p.cargo_id}: footprint overlaps ${onDeck ? "an on-deck" : "an under-deck"} container bay`, p.cargo_id));
      }
    }
  }
  return out;
}

export function breakbulkOverweight(vessel: Vessel, cargo: BreakbulkCargo[], placements: BreakbulkPlacement[]): Violation[] {
  const out: Violation[] = [];
  for (const [areaId, entries] of byArea(cargo, placements)) {
    if (!isKnownArea(vessel, areaId)) continue;
    const area = deckArea(vessel, areaId);
    const rating = deckLoadRating(vessel, areaId);
    // Area with a rated surface: rating × the band's usable area (still a uniform-load
    // simplification — no point-load/lashing check). Otherwise the generic DEMO limit.
    const limitT = rating ? Math.round(rating * OVERWEIGHT_BAND_M * (area.zMax - area.zMin)) : OVERWEIGHT_LIMIT_T;
    const onDeck = areaId === WEATHER_DECK_AREA_ID;
    for (let bandStart = area.xMin; bandStart < area.xMax; bandStart += OVERWEIGHT_BAND_M) {
      const bandEnd = bandStart + OVERWEIGHT_BAND_M;
      const inBand = entries.filter(({ p }) => p.x_m >= bandStart && p.x_m < bandEnd);
      const weight = inBand.reduce((sum, e) => sum + e.item.weight_t, 0);
      if (weight > limitT) {
        const what = rating ? `${limitT}t ${onDeck ? "hatch-cover" : "rated"} limit (${rating} t/m²)` : `${limitT}t demo limit`;
        const where = onDeck ? "Deck band" : `${areaLabel(vessel, areaId)} band`;
        out.push(violation("breakbulk_overweight", `${where} ${bandStart.toFixed(0)}-${bandEnd.toFixed(0)}m: ${weight.toFixed(0)}t exceeds the ${what}`, inBand[0].p.cargo_id));
      }
    }
  }
  return out;
}

/** Footprint overlaps one of the area's declared keep-out structures (crane pedestal etc.). */
export function breakbulkInKeepOut(vessel: Vessel, cargo: BreakbulkCargo[], placements: BreakbulkPlacement[]): Violation[] {
  const out: Violation[] = [];
  for (const [areaId, entries] of byArea(cargo, placements)) {
    const keepOuts = deckKeepOuts(vessel, areaId);
    if (keepOuts.length === 0) continue;
    for (const { p, item } of entries) {
      const rect = footprintRect(item, p);
      const hit = keepOuts.find((k) => rectsOverlap(rect, k));
      if (hit) out.push(violation("breakbulk_in_keep_out", `${p.cargo_id}: footprint overlaps ${hit.label}`, p.cargo_id));
    }
  }
  return out;
}

/** Item is taller than the area's declared clear height (deck above, hatch covers, stowed jibs…). */
export function breakbulkTooTall(vessel: Vessel, cargo: BreakbulkCargo[], placements: BreakbulkPlacement[]): Violation[] {
  const out: Violation[] = [];
  for (const [areaId, entries] of byArea(cargo, placements)) {
    const limit = maxCargoHeight(vessel, areaId);
    if (!Number.isFinite(limit)) continue;
    for (const { p, item } of entries) {
      if (item.height_m > limit + EDGE_TOLERANCE_M) {
        out.push(violation("breakbulk_too_tall", `${p.cargo_id}: ${item.height_m}m tall exceeds the ${limit}m clear height in ${areaLabel(vessel, areaId)}`, p.cargo_id));
      }
    }
  }
  return out;
}

/** The item's own footprint pressure (weight ÷ footprint area) exceeds the surface's rated load —
 * catches a single heavy, compact piece that a 20 m band average would hide. */
export function breakbulkOverPressure(vessel: Vessel, cargo: BreakbulkCargo[], placements: BreakbulkPlacement[]): Violation[] {
  const out: Violation[] = [];
  for (const [areaId, entries] of byArea(cargo, placements)) {
    const rating = deckLoadRating(vessel, areaId);
    if (rating === undefined) continue;
    for (const { p, item } of entries) {
      const pressure = item.weight_t / (item.length_m * item.width_m);
      if (pressure > rating + 1e-9) {
        out.push(violation("breakbulk_over_pressure", `${p.cargo_id}: ${pressure.toFixed(2)} t/m² exceeds the ${rating} t/m² rating of ${areaLabel(vessel, areaId)}`, p.cargo_id));
      }
    }
  }
  return out;
}
