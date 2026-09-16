/**
 * Naive demo-only placement for breakbulk cargo: greedy first-fit shelf-packing (sort by footprint
 * area descending, try each existing z-row in turn laying the item along x — skipping past any x
 * already occupied by an on-deck container, a keep-out or an already-placed item — and open a new
 * row only when no existing row has room). NOT a
 * real bin-packing optimizer — same spirit as naive-fill-plan.ts for containers. Some items may
 * end up unplaced if the deck genuinely doesn't have room (see phase-02 plan's Success Criteria).
 * Vessel-aware when `vessel.breakbulk_deck` / `breakbulk_holds` are set: packs inside each area's
 * rectangle, skips its keep-outs (crane pedestals etc.), and won't use an area whose clear height
 * or rated floor load (t/m²) the item exceeds.
 */
import type { BreakbulkCargo, BreakbulkPlacement, Vessel } from "@/types/domain";
import { deckArea, deckKeepOuts, deckLoadRating, maxCargoHeight, WEATHER_DECK_AREA_ID, type DeckArea } from "./breakbulk-deck-area";
import { footprintRect, rectsOverlap, type Rect } from "./breakbulk-overlap-check";
import { buildStowageModel } from "./stowage-model/build-stowage-model";
import type { XZone } from "./breakbulk-forbidden-zones";

export interface BreakbulkFillResult {
  placements: BreakbulkPlacement[];
  unplaced: string[];
}

/** Finds the leftmost valid x (>= startX) for a rect of the given length/width at z=rowZ within
 * the deck's x bounds, skipping past any forbidden zone or already-placed rect that blocks it.
 * Returns null if no valid x remains before running off the deck's x bound. */
function findXInRow(
  startX: number,
  lengthM: number,
  widthM: number,
  rowZ: number,
  area: DeckArea,
  forbiddenXZones: XZone[],
  placedRects: Rect[]
): number | null {
  // placedRects already includes the vessel's keep-out rectangles (seeded by the caller), so a
  // crane pedestal blocks a row exactly like an already-placed item does.
  let x = startX;
  while (x + lengthM <= area.xMax) {
    const rect: Rect = { xMin: x, xMax: x + lengthM, zMin: rowZ, zMax: rowZ + widthM };
    const blockingZone = forbiddenXZones.find((z) => rect.xMin < z.xMax && rect.xMax > z.xMin);
    if (blockingZone) {
      x = blockingZone.xMax;
      continue;
    }
    const blockingRect = placedRects.find((r) => rectsOverlap(rect, r));
    if (blockingRect) {
      x = blockingRect.xMax;
      continue;
    }
    return x;
  }
  return null;
}

export interface BreakbulkFillOptions {
  /** Spill items that don't fit on the weather deck into the vessel's holds (default true). */
  useHolds?: boolean;
  /** x ranges in the holds already taken (e.g. by under-deck container bays). */
  holdForbiddenXZones?: XZone[];
  /** Containers already standing, keyed by stowage area — one rect per bay/row/deck that actually
   * carries a box (engine/stowage-model/occupancy.ts's `occupiedRectsByArea`). Seeded into the
   * area's placed rects so cargo packs around real stacks instead of whole bays across the full
   * beam. NOTE: this must stay an options field — the positional `forbiddenXZones` parameter is
   * frozen because breakbulk-real-vessels-no-violations.test.ts calls it positionally. */
  occupiedRects?: Record<string, Rect[]>;
}

/** Why an item can't go into an area at all, regardless of what's already placed there. */
function areaRejection(vessel: Vessel, item: BreakbulkCargo, areaId: string, area: DeckArea): string | null {
  if (item.length_m > area.xMax - area.xMin || item.width_m > area.zMax - area.zMin) return "footprint";
  if (item.height_m > maxCargoHeight(vessel, areaId)) return "height";
  const rating = deckLoadRating(vessel, areaId);
  if (rating !== undefined && item.weight_t / (item.length_m * item.width_m) > rating) return "pressure";
  return null;
}

/** Shelf-packs `items` (already sorted) into one stowage area; returns what it placed and what's left. */
function packIntoArea(
  vessel: Vessel,
  items: BreakbulkCargo[],
  areaId: string,
  forbiddenXZones: XZone[],
  occupiedRects: Record<string, Rect[]>
): { placements: BreakbulkPlacement[]; leftover: BreakbulkCargo[] } {
  const area = deckArea(vessel, areaId);
  const placements: BreakbulkPlacement[] = [];
  const placedRects: Rect[] = [
    ...deckKeepOuts(vessel, areaId).map(({ xMin, xMax, zMin, zMax }) => ({ xMin, xMax, zMin, zMax })),
    // Container stacks that actually carry boxes block a row exactly like a keep-out does.
    ...(occupiedRects[areaId] ?? []),
  ];
  const leftover: BreakbulkCargo[] = [];
  // Shelf rows, each opened at the z where the previous deepest row ended. Every item tries EVERY
  // existing row first (first-fit), so the free x-length an earlier row left behind — e.g. the
  // 56 m after one 62 m blade on BBC SAO PAULO's hatch envelope — gets used instead of being
  // abandoned the moment a new row opens (the old single-current-row packer placed only 4-5 of
  // the 14 demo items on either vessel). Items wider than their row are still safe: findXInRow
  // checks the FULL rect against every placed rect and keep-out, so they can't overlap the next row.
  const rowStarts: number[] = [];
  let nextRowZ = area.zMin;

  for (const item of items) {
    if (areaRejection(vessel, item, areaId, area)) {
      leftover.push(item); // footprint, overhead clearance or floor pressure rules this area out
      continue;
    }

    let spot: { x: number; z: number } | null = null;
    // Every candidate row is z-bound checked here BEFORE findXInRow — the regression the old
    // packer had (a yacht placed ~4.6 m past the usable beam via an unchecked row-reuse path).
    for (const z of rowStarts) {
      if (z + item.width_m > area.zMax) continue;
      const x = findXInRow(area.xMin, item.length_m, item.width_m, z, area, forbiddenXZones, placedRects);
      if (x !== null) {
        spot = { x, z };
        break;
      }
    }
    if (!spot) {
      // Open a new row at nextRowZ — or, if a keep-out or earlier item blocks every x there (e.g. a
      // crane pedestal intruding into the port row, which left every 62 m blade unplaced), at the
      // inboard edge of the next obstruction instead.
      const candidates = [nextRowZ, ...placedRects.map((r) => r.zMax).filter((z) => z > nextRowZ)].sort((a, b) => a - b);
      for (const z of candidates) {
        if (z + item.width_m > area.zMax) break;
        if (rowStarts.includes(z)) continue;
        const x = findXInRow(area.xMin, item.length_m, item.width_m, z, area, forbiddenXZones, placedRects);
        if (x !== null) {
          spot = { x, z };
          rowStarts.push(z);
          break;
        }
      }
    }
    if (!spot) {
      leftover.push(item); // no row has room and there's no width left for a new one
      continue;
    }

    const placement: BreakbulkPlacement = { cargo_id: item.id, x_m: spot.x + item.length_m / 2, z_m: spot.z + item.width_m / 2, rotation_deg: 0 };
    if (areaId !== WEATHER_DECK_AREA_ID) placement.area_id = areaId;
    placements.push(placement);
    placedRects.push(footprintRect(item, placement));
    nextRowZ = Math.max(nextRowZ, spot.z + item.width_m);
  }
  return { placements, leftover };
}

/**
 * Weather deck first (around any on-deck container bays in `forbiddenXZones`), then — for vessels
 * with `breakbulk_holds` — whatever didn't fit spills into the holds in declared order (largest
 * first). On-deck container bays block the deck; under-deck ones (holdForbiddenXZones) the holds. Deliberately naive: it doesn't yet prefer heavy
 * items low for stability, choose tweendeck pontoon levels, or check the hatch opening an item has
 * to be lowered through.
 */
export function naiveFillBreakbulk(
  vessel: Vessel,
  cargo: BreakbulkCargo[],
  forbiddenXZones: XZone[],
  options: BreakbulkFillOptions = {}
): BreakbulkFillResult {
  const occupiedRects = options.occupiedRects ?? {};
  const sorted = [...cargo].sort((a, b) => b.length_m * b.width_m - a.length_m * a.width_m);
  const deck = packIntoArea(vessel, sorted, WEATHER_DECK_AREA_ID, forbiddenXZones, occupiedRects);
  const placements = [...deck.placements];
  let remaining = deck.leftover;
  if (options.useHolds ?? true) {
    // Hold areas come from the model (declared order, largest first) rather than being re-read
    // from vessel.breakbulk_holds — one geometry source.
    for (const area of buildStowageModel(vessel).areas) {
      if (area.onDeck) continue;
      if (remaining.length === 0) break;
      const packed = packIntoArea(vessel, remaining, area.id, options.holdForbiddenXZones ?? [], occupiedRects);
      placements.push(...packed.placements);
      remaining = packed.leftover;
    }
  }
  return { placements, unplaced: remaining.map((c) => c.id) };
}
