/**
 * Precomputed lookups shared by all rules, built once per validation run.
 * TS port of backend/app/validation/context.py, extended to track the two 20' halves of each 40' cell.
 */
import type {
  Container,
  DeckLevel,
  Placement,
  Slot,
  StackSpec,
  StowagePlan,
  Vessel,
} from "@/types/domain";
import { bayPosition, deckOf, type HalfSide } from "./slot-helpers";

export const HALVES: readonly HalfSide[] = ["fore", "aft"];

/** One placed box inside a 40' column (bay, row, deck). */
export interface ColumnEntry {
  containerId: string;
  placement: Placement;
  fortyBay: number;
  row: number;
  tier: number;
  halves: HalfSide[];
}

/** Box ids occupying each 20' half of one 40' cell. A 40' box appears in both halves. */
export interface CellOccupancy {
  slot: Slot; // reference slot on the 40' (even) bay
  fore: string[];
  aft: string[];
}

export interface ValidationContext {
  vessel: Vessel;
  plan: StowagePlan;
  containers: Map<string, Container>;
  stacks: Map<string, StackSpec>; // stackKey -> spec
  podSequence: Map<string, number>; // UN/LOCODE -> rotation sequence
  columns: Map<string, ColumnEntry[]>; // stackKey -> entries sorted bottom -> top
  cells: Map<string, CellOccupancy>; // cellKey -> occupancy
  unmapped: Placement[]; // bay does not exist on this vessel
  orphans: Placement[]; // container id not in plan.containers
}

export const stackKey = (
  fortyBay: number,
  row: number,
  deck: DeckLevel,
): string => `${fortyBay}|${row}|${deck}`;
export const cellKey = (fortyBay: number, row: number, tier: number): string =>
  `${fortyBay}|${row}|${tier}`;

export function buildValidationContext(
  vessel: Vessel,
  plan: StowagePlan,
): ValidationContext {
  const containers = new Map(plan.containers.map((c) => [c.id, c] as const));
  const stacks = new Map(
    vessel.stacks.map((s) => [stackKey(s.bay, s.row, s.deck), s] as const),
  );
  const podSequence = new Map(
    plan.ports.map((p) => [p.locode, p.sequence] as const),
  );
  const columns = new Map<string, ColumnEntry[]>();
  const cells = new Map<string, CellOccupancy>();
  const unmapped: Placement[] = [];
  const orphans: Placement[] = [];

  for (const p of plan.placements) {
    if (!containers.has(p.container_id)) {
      orphans.push(p);
      continue;
    }
    const pos = bayPosition(p.slot.bay, vessel.bays);
    if (!pos) {
      unmapped.push(p);
      continue;
    }
    const { row, tier } = p.slot;
    const entry: ColumnEntry = {
      containerId: p.container_id,
      placement: p,
      fortyBay: pos.fortyBay,
      row,
      tier,
      halves: pos.halves,
    };

    const sk = stackKey(pos.fortyBay, row, deckOf(tier));
    const column = columns.get(sk);
    if (column) column.push(entry);
    else columns.set(sk, [entry]);

    const ck = cellKey(pos.fortyBay, row, tier);
    let cell = cells.get(ck);
    if (!cell) {
      cell = { slot: { bay: pos.fortyBay, row, tier }, fore: [], aft: [] };
      cells.set(ck, cell);
    }
    for (const half of pos.halves) cell[half].push(p.container_id);
  }
  for (const column of columns.values()) column.sort((a, b) => a.tier - b.tier);

  return {
    vessel,
    plan,
    containers,
    stacks,
    podSequence,
    columns,
    cells,
    unmapped,
    orphans,
  };
}
