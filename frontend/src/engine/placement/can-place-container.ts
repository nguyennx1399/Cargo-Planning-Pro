/**
 * canPlaceContainer — spec §4.5's per-slot checks for ONE candidate box (model + plan + slot).
 *
 * The single predicate behind the drop preview, the placeholders and the store's commit: the UI can
 * never promise a slot the validator would then flag, because these checks reuse the same primitives
 * and wording as `engine/validation-rules.ts` (placement-checks.ts, slot-helpers, the stowage model).
 * Deliberately NOT `buildValidationContext` — that is plan-wide, while a drag start evaluates ~900
 * slot-tiers against the SAME plan, which is why the per-plan lookups are memoised below.
 *
 * `vessel` is last on purpose: `StowageModel` carries no vessel and no `StackSpec` (no
 * `reefer_tiers`/`max_height_m`/tier list), so `plugOk`, `tierBelow` and the 40'-bay column keys all
 * need it passed explicitly rather than duplicated here.
 *
 * Every blocking rule of the plan-wide report that a single placement can trigger is mirrored here —
 * including `twenty_on_forty`, which §4.5's list omits but `ALL_RULES` blocks on. The only predicate
 * rule with no report counterpart is `max_height` (a per-slot clearance check the report has no rule
 * for), which can refuse a drop the report stays silent about — the safe direction.
 */
import type { Container, Slot, StackSpec, StowagePlan, Vessel } from "@/types/domain";
import { DIM } from "@/lib/geometry";
import { bayPosition, deckOf, isFortyBay } from "@/engine/slot-helpers";
import { plugOk, sizeFitsBay, tierBelow } from "@/engine/placement-checks";
import { rectsOverlap, type Rect } from "@/engine/breakbulk-overlap-check";
import { WEATHER_DECK_AREA_ID, breakbulkOccupancy, type StowageModel } from "@/engine/stowage-model";
import { resultOf, type PlacementResult, type Reason } from "./reason";
import {
  cellConflictReasons,
  overstowReasons,
  pad2,
  reason,
  twentyOnFortyReasons,
  type CellHalves,
  type ColumnBox,
} from "./placement-reason-builders";

/** The stack-weight rule's own float-sum tolerance (0.1 t weights don't sum exactly). */
const WEIGHT_TOLERANCE_T = 1e-9;

/** One placed box with everything the checks need, keyed by its 40'-bay column. */
interface IndexedPlacement extends ColumnBox {
  weightT: number;
}
interface PlanIndex {
  /** `vessel.bays` the index was built against: a mismatched vessel rebuilds instead of mis-mapping
   * 20'/40' halves. */
  bays: readonly number[];
  podSequence: Map<string, number>;
  cells: Map<string, CellHalves>; // `fortyBay|row|tier` -> ids per 20' half
  columns: Map<string, IndexedPlacement[]>; // `fortyBay|row|deck` -> the boxes standing there
  /** Ids the plan knows to be longer than 20' — `twenty_on_forty`'s filter (see the rule). */
  nonTwenty: ReadonlySet<string>;
  breakbulk: Map<string, Rect[]>; // areaId -> placed breakbulk footprints
}

function buildIndex(vessel: Vessel, plan: StowagePlan): PlanIndex {
  const byId = new Map(plan.containers.map((c) => [c.id, c] as const));
  const podSequence = new Map(plan.ports.map((p) => [p.locode, p.sequence] as const));
  const cells = new Map<string, CellHalves>();
  const columns = new Map<string, IndexedPlacement[]>();

  for (const p of plan.placements) {
    const container = byId.get(p.container_id);
    if (!container) continue; // orphan (no cargo row): the plan rules skip these too
    const pos = bayPosition(p.slot.bay, vessel.bays);
    if (!pos) continue; // bay not on this vessel — `slot_exists` owns that case
    const entry: IndexedPlacement = {
      id: container.id, tier: p.slot.tier, weightT: container.weight_t,
      podSeq: podSequence.get(container.pod ?? "") ?? 0, halves: pos.halves,
    };
    const columnKey = `${pos.fortyBay}|${p.slot.row}|${deckOf(p.slot.tier)}`;
    const column = columns.get(columnKey);
    if (column) column.push(entry);
    else columns.set(columnKey, [entry]);

    const cellKey = `${pos.fortyBay}|${p.slot.row}|${p.slot.tier}`;
    const cell = cells.get(cellKey) ?? { fore: [], aft: [] };
    for (const half of pos.halves) cell[half].push(container.id);
    cells.set(cellKey, cell);
  }
  // Bottom -> top, exactly as `buildValidationContext` sorts them (:104): the overstow selection
  // scans UPWARD from a box, so a column left in plan order would blame the wrong neighbour.
  for (const column of columns.values()) column.sort((a, b) => a.tier - b.tier);
  const nonTwenty = new Set(plan.containers.filter((c) => c.size !== "20").map((c) => c.id));
  const breakbulk = breakbulkOccupancy(plan.breakbulk_cargo, plan.breakbulk_placements);
  return { bays: vessel.bays, podSequence, cells, columns, nonTwenty, breakbulk };
}
const indexCache = new WeakMap<StowagePlan, PlanIndex>();

/** Memoised on plan identity — plans are immutable by contract (the draft store always produces a
 * new one), the same discipline `buildStowageModel`'s own cache relies on. */
function indexFor(vessel: Vessel, plan: StowagePlan): PlanIndex {
  const cached = indexCache.get(plan);
  if (cached && cached.bays === vessel.bays) return cached;
  const built = buildIndex(vessel, plan);
  indexCache.set(plan, built);
  return built;
}

/** The StackSpec the plan-wide rules attribute a column to: those keys use the 40' bay, so a 20' box
 * in an odd bay is limited by its 40' parent's spec (see `stackKey` in validation-context.ts). */
const stackFor = (vessel: Vessel, fortyBay: number, row: number, deck: "on" | "under"): StackSpec | undefined =>
  vessel.stacks.find((s) => s.bay === fortyBay && s.row === row && s.deck === deck);

export function canPlaceContainer(
  model: StowageModel,
  plan: StowagePlan,
  container: Container,
  slot: Slot,
  vessel: Vessel,
): PlacementResult {
  const reasons: Reason[] = [];
  const { bay, row, tier } = slot;
  const deck = deckOf(tier);
  const slotDef = model.slotByKey.get(`${bay}|${row}|${tier}`);
  const pos = bayPosition(bay, vessel.bays);

  if (!slotDef) {
    const message = pos
      ? `${container.id}: slot does not exist on vessel`
      : `${container.id}: bay ${pad2(bay)} does not exist on vessel`;
    reasons.push(reason("slot_exists", message));
  }
  if (!sizeFitsBay(container, bay)) {
    const bayKind = isFortyBay(bay) ? "40'" : "20'";
    reasons.push(reason("size_fits_bay", `${container.id}: ${container.size}' container in ${bayKind} bay ${pad2(bay)}`));
  }

  const index = indexFor(vessel, plan);
  if (pos) {
    const columnKey = `${pos.fortyBay}|${row}|${deck}`;
    const stack = stackFor(vessel, pos.fortyBay, row, deck);
    reasons.push(...cellConflictReasons(index.cells.get(`${pos.fortyBay}|${row}|${tier}`), pos.halves, container.id));
    if (stack) {
      const below = tierBelow(stack, tier);
      const belowCell = below === null ? undefined : index.cells.get(`${pos.fortyBay}|${row}|${below}`);
      // `twenty_on_forty` (ALL_RULES' 4th rule) — a 20' may not stand on a non-20' below it.
      if (container.size === "20") {
        reasons.push(...twentyOnFortyReasons(belowCell, pos.halves, container.id, index.nonTwenty));
      }
      const emptyHalf = below === null ? undefined : pos.halves.find((h) => !belowCell || belowCell[h].length === 0);
      if (below !== null && emptyHalf) {
        const where = pos.halves.length === 2 ? `${emptyHalf} half of tier ${pad2(below)}` : `tier ${pad2(below)}`;
        reasons.push(reason("no_floating", `${container.id}: no container below (${where} empty)`));
      }
      if (!plugOk(container, stack, tier)) {
        reasons.push(reason("reefer_plug", `${container.id}: reefer on slot without plug`));
      }
      const total = (index.columns.get(columnKey) ?? []).reduce((sum, e) => sum + e.weightT, 0) + container.weight_t;
      if (total > stack.max_weight_t + WEIGHT_TOLERANCE_T) {
        reasons.push(reason("stack_weight", `Stack bay ${pad2(stack.bay)} row ${pad2(stack.row)} (${stack.deck} deck): ${total.toFixed(1)}t > limit ${stack.max_weight_t.toFixed(0)}t`));
      }
      const heightM = container.high_cube ? DIM.heightHC : DIM.height;
      if (stack.max_height_m !== null && heightM > stack.max_height_m + WEIGHT_TOLERANCE_T) {
        reasons.push(reason("max_height", `${container.id}: ${heightM}m tall box exceeds the ${stack.max_height_m}m clear height of bay ${pad2(stack.bay)} row ${pad2(stack.row)} (${stack.deck} deck)`));
      }
    }
    const seq = index.podSequence.get(container.pod ?? "") ?? 0;
    reasons.push(...overstowReasons(index.columns.get(columnKey), tier, seq, container.id, pos.halves));
  }

  if (slotDef) {
    // Areas this stack occupies, matching Phase A's occupancy mapping: on deck the weather deck,
    // under deck every hold area the footprint overlaps.
    const areas = model.areas.filter((a) =>
      deck === "on" ? a.id === WEATHER_DECK_AREA_ID : !a.onDeck && rectsOverlap(slotDef.rect, a.rect),
    );
    for (const area of areas) {
      const rects = index.breakbulk.get(area.id);
      if (!rects) continue;
      if (rects.some((r) => rectsOverlap(slotDef.rect, r))) {
        reasons.push(reason("breakbulk_overlaps_container", `${container.id}: slot overlaps breakbulk cargo in ${area.label}`));
        break; // one reason is enough to block, and the message names the area
      }
    }
  }
  return resultOf(reasons);
}
