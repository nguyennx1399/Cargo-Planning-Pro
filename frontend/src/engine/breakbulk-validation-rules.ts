/**
 * Breakbulk-only validation rules — deliberately separate from validation-rules.ts/ALL_RULES,
 * which are built entirely around the slot-based bay/row/tier grid (StackSpec, cells, columns).
 * Breakbulk cargo has none of that, so its rules operate on BreakbulkCargo/BreakbulkPlacement
 * directly rather than forcing it through the slot-based ValidationContext.
 */
import type { BreakbulkCargo, BreakbulkPlacement, Vessel, Violation } from "@/types/domain";
import { deckArea } from "./breakbulk-deck-area";
import { footprintRect, rectsOverlap } from "./breakbulk-overlap-check";
import { onDeckBayZones } from "./breakbulk-forbidden-zones";
import type { Placement } from "@/types/domain";

/** DEMO approximation, not real structural deck strength — see plan.md "Ngoài phạm vi". */
const OVERWEIGHT_BAND_M = 20;
const OVERWEIGHT_LIMIT_T = 200;

function violation(rule: string, message: string, cargoId: string): Violation {
  return { rule, severity: "error", message, container_ids: [cargoId], slots: [] };
}

export function breakbulkOutOfDeckArea(vessel: Vessel, cargo: BreakbulkCargo[], placements: BreakbulkPlacement[]): Violation[] {
  const area = deckArea(vessel);
  const byId = new Map(cargo.map((c) => [c.id, c]));
  const out: Violation[] = [];
  for (const p of placements) {
    const item = byId.get(p.cargo_id);
    if (!item) continue;
    const rect = footprintRect(item, p);
    if (rect.xMin < area.xMin || rect.xMax > area.xMax || rect.zMin < area.zMin || rect.zMax > area.zMax) {
      out.push(violation("breakbulk_out_of_deck_area", `${p.cargo_id}: footprint extends outside the usable deck area`, p.cargo_id));
    }
  }
  return out;
}

export function breakbulkOverlap(cargo: BreakbulkCargo[], placements: BreakbulkPlacement[]): Violation[] {
  const byId = new Map(cargo.map((c) => [c.id, c]));
  const out: Violation[] = [];
  for (let i = 0; i < placements.length; i++) {
    const a = byId.get(placements[i].cargo_id);
    if (!a) continue;
    const rectA = footprintRect(a, placements[i]);
    for (let j = i + 1; j < placements.length; j++) {
      const b = byId.get(placements[j].cargo_id);
      if (!b) continue;
      if (rectsOverlap(rectA, footprintRect(b, placements[j]))) {
        out.push(violation("breakbulk_overlap", `${placements[i].cargo_id} overlaps ${placements[j].cargo_id}`, placements[i].cargo_id));
      }
    }
  }
  return out;
}

export function breakbulkOverlapsContainer(vessel: Vessel, cargo: BreakbulkCargo[], placements: BreakbulkPlacement[], containerPlacements: Placement[]): Violation[] {
  const zones = onDeckBayZones(vessel, containerPlacements);
  const byId = new Map(cargo.map((c) => [c.id, c]));
  const out: Violation[] = [];
  for (const p of placements) {
    const item = byId.get(p.cargo_id);
    if (!item) continue;
    const rect = footprintRect(item, p);
    if (zones.some((z) => rect.xMin < z.xMax && rect.xMax > z.xMin)) {
      out.push(violation("breakbulk_overlaps_container", `${p.cargo_id}: footprint overlaps an on-deck container bay`, p.cargo_id));
    }
  }
  return out;
}

export function breakbulkOverweight(vessel: Vessel, cargo: BreakbulkCargo[], placements: BreakbulkPlacement[]): Violation[] {
  const area = deckArea(vessel);
  const byId = new Map(cargo.map((c) => [c.id, c]));
  const out: Violation[] = [];
  for (let bandStart = area.xMin; bandStart < area.xMax; bandStart += OVERWEIGHT_BAND_M) {
    const bandEnd = bandStart + OVERWEIGHT_BAND_M;
    let weight = 0;
    const idsInBand: string[] = [];
    for (const p of placements) {
      const item = byId.get(p.cargo_id);
      if (!item) continue;
      if (p.x_m >= bandStart && p.x_m < bandEnd) {
        weight += item.weight_t;
        idsInBand.push(p.cargo_id);
      }
    }
    if (weight > OVERWEIGHT_LIMIT_T) {
      out.push(violation("breakbulk_overweight", `Deck band ${bandStart.toFixed(0)}-${bandEnd.toFixed(0)}m: ${weight.toFixed(0)}t exceeds the ${OVERWEIGHT_LIMIT_T}t demo limit`, idsInBand[0]));
    }
  }
  return out;
}
