/**
 * bay-pairs.ts — the ship's container stow as print-style bay SHEETS (all-bay overview plan, phase 01).
 *
 * THE CONVENTION (SEACOS / MACS3 and printed bay plans): one section per 20' (ODD) bay. A 40' bay `b`
 * owns two of them — FORE `b − 1` and AFT `b + 1`, bays being numbered bow → stern. A 20' box is drawn
 * in its own odd section; a 40' box covers both, so it is drawn in the FORE section and marked "×" in
 * the AFT one (`fortyTail`). Rows are `vessel.rows` order (port → starboard, even … odd), tiers
 * descending so the list reads top → bottom.
 *
 * WHY IT READS THE VALIDATION CONTEXT instead of walking placements itself: the context already maps
 * every placement to its 40' cell and HALVES (`cells[..].fore/aft`, a 40' id in both). Drawing from the
 * same lookup the rules judge is what makes the sheet and the Check tab unable to disagree — and it is
 * what fixes the old bay view, which kept `slot.bay === 40' bay` and so never showed a 20' box.
 */
import type { Container, DeckLevel, StowagePlan, Vessel } from "@/types/domain";
import { visiblePlacements } from "@/engine/playback-slice";
import { cellKey, type ValidationContext } from "@/engine/validation-context";

export type CellKind = "twenty" | "forty" | "fortyTail";

export interface SheetCell {
  kind: CellKind;
  box: Container;
}

/** One 20' bay's section; cells keyed `${row}:${tier}`. */
export interface OddSection {
  bay: number;
  cells: Map<string, SheetCell>;
}

export interface BayPairLayout {
  fortyBay: number;
  fore: OddSection;
  aft: OddSection;
  /** Every row with a stack on either deck, port → starboard: both decks share these columns. */
  rows: number[];
  /** Descending, per deck (drawn top → bottom). */
  tiers: Record<DeckLevel, number[]>;
  /** `${deck}|${row}` → that stack's tiers. A row without a stack is a blank column on that deck, and a
   * tier the stack does not have is a blank cell (stacks of one bay can differ in height). */
  stackTiers: ReadonlyMap<string, ReadonlySet<number>>;
}

export const sheetCellKey = (row: number, tier: number): string => `${row}:${tier}`;
export const stackSlotKey = (deck: DeckLevel, row: number): string => `${deck}|${row}`;

/** The plan as the loading-sequence playback currently shows it (all of it when not playing). */
export function visiblePlan(plan: StowagePlan, playbackCount: number | null): StowagePlan {
  return playbackCount === null ? plan : { ...plan, placements: visiblePlacements(plan.placements, playbackCount) };
}

/** Every 40' bay of the vessel as a fore/aft pair of odd sections, bow → stern. `ctx` must be built
 * from the VISIBLE plan (`visiblePlan`), so playback hides boxes here exactly as it does in 3D. */
export function bayPairLayouts(vessel: Vessel, ctx: ValidationContext): BayPairLayout[] {
  return vessel.bays.map((fortyBay) => {
    const stacks = vessel.stacks.filter((st) => st.bay === fortyBay);
    const stackTiers = new Map(stacks.map((st) => [stackSlotKey(st.deck, st.row), new Set(st.tiers)] as const));
    const rows = vessel.rows.filter((r) => stacks.some((st) => st.row === r));
    const tiersOf = (deck: DeckLevel) =>
      [...new Set(stacks.filter((st) => st.deck === deck).flatMap((st) => st.tiers))].sort((a, b) => b - a);

    const fore: OddSection = { bay: fortyBay - 1, cells: new Map() };
    const aft: OddSection = { bay: fortyBay + 1, cells: new Map() };
    for (const st of stacks) {
      for (const tier of st.tiers) {
        const occupancy = ctx.cells.get(cellKey(fortyBay, st.row, tier));
        if (!occupancy) continue;
        const key = sheetCellKey(st.row, tier);
        const boxOf = (id: string | undefined) => (id ? ctx.containers.get(id) : undefined);
        // A 40' id is listed in BOTH halves. More than one id in a half is a cell conflict the rules
        // report; the sheet draws the first and leaves the verdict to the Check tab.
        const fortyId = occupancy.fore.find((id) => occupancy.aft.includes(id));
        const forty = boxOf(fortyId);
        if (forty) {
          fore.cells.set(key, { kind: "forty", box: forty });
          aft.cells.set(key, { kind: "fortyTail", box: forty });
          continue;
        }
        const foreBox = boxOf(occupancy.fore[0]);
        const aftBox = boxOf(occupancy.aft[0]);
        if (foreBox) fore.cells.set(key, { kind: "twenty", box: foreBox });
        if (aftBox) aft.cells.set(key, { kind: "twenty", box: aftBox });
      }
    }
    return { fortyBay, fore, aft, rows, tiers: { on: tiersOf("on"), under: tiersOf("under") }, stackTiers };
  });
}
