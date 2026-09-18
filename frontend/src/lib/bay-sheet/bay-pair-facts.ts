/**
 * bay-pair-facts.ts — what the bay sheet says ABOUT each 40' bay pair (all-bay overview plan, phase 01):
 * 20'/40' counts, weight, free TEU, the worst rule problem, project cargo resting in the bay, and each
 * stack's weight against its limit.
 *
 * Every number comes from an engine source, never a re-derivation:
 *  - stack weight: the SAME `ctx.columns`/`ctx.stacks` the `stackWeight` rule sums, with its tolerance —
 *    so a stack drawn red is exactly a stack the Check tab lists as `stack_weight`;
 *  - problems: the report's own violations, mapped to a bay through their slot codes;
 *  - free space: the stowage model's own slots (a half counts only if the model has a slot for it).
 */
import type { BreakbulkPlacement, Container, DeckLevel, Severity, StowagePlan, ValidationReport, Vessel } from "@/types/domain";
import { bayPosition, parseSlotCode } from "@/engine/slot-helpers";
import { buildValidationContext, cellKey, stackKey } from "@/engine/validation-context";
import { areaIdOf, buildStowageModel } from "@/engine/stowage-model";
import { footprintRect } from "@/engine/breakbulk-overlap-check";
import { bayPairLayouts, stackSlotKey, visiblePlan, type BayPairLayout } from "./bay-pairs";

export interface StackWeight {
  weightT: number;
  maxT: number;
  over: boolean;
}

export interface BayPairFacts {
  n20: number;
  n40: number;
  weightT: number;
  freeTeu: number;
  worst: Severity | null;
  projectCargo: Record<DeckLevel, string[]>;
}

export interface BayPair extends BayPairLayout {
  /** Keyed `${deck}|${row}` (`stackSlotKey`). */
  stackWeights: Map<string, StackWeight>;
  facts: BayPairFacts;
}

/** Same float tolerance the `stackWeight` rule uses for sums of 0.1 t weights. */
const WEIGHT_TOLERANCE_T = 1e-9;

/** The whole sheet: every 40' bay pair bow → stern, with its facts. Pure; the views memoise it. */
export function buildBayPairs(
  vessel: Vessel,
  plan: StowagePlan,
  report: ValidationReport | undefined,
  playbackCount: number | null,
): BayPair[] {
  const visible = visiblePlan(plan, playbackCount);
  const ctx = buildValidationContext(vessel, visible);
  const slotKeys = new Set(buildStowageModel(vessel).slots.map((s) => s.key));
  const worstByBay = worstSeverityByBay(vessel, report);
  const cargoByBay = projectCargoByBay(vessel, plan);

  return bayPairLayouts(vessel, ctx).map((layout) => {
    const b = layout.fortyBay;
    const stackWeights = new Map<string, StackWeight>();
    let n20 = 0;
    let n40 = 0;
    let weightT = 0;
    let freeTeu = 0;
    for (const st of vessel.stacks) {
      if (st.bay !== b) continue;
      const entries = ctx.columns.get(stackKey(b, st.row, st.deck)) ?? [];
      const stackT = entries.reduce((sum, e) => sum + (ctx.containers.get(e.containerId)?.weight_t ?? 0), 0);
      stackWeights.set(stackSlotKey(st.deck, st.row), { weightT: stackT, maxT: st.max_weight_t, over: stackT > st.max_weight_t + WEIGHT_TOLERANCE_T });
      for (const e of entries) e.halves.length === 2 ? n40++ : n20++;
      weightT += stackT;
      for (const tier of st.tiers) freeTeu += freeTeuAt(b, st.row, tier, ctx.cells.get(cellKey(b, st.row, tier)), slotKeys);
    }
    return {
      ...layout,
      stackWeights,
      facts: { n20, n40, weightT, freeTeu, worst: worstByBay.get(b) ?? null, projectCargo: cargoByBay.get(b) ?? { on: [], under: [] } },
    };
  });
}

/** TEU still free in one 40' cell. A half counts only when the model has a slot for it (a 40'-only bay
 * has none, so an empty cell there is 2 TEU through its 40' slot, and a lone 20' cannot occur). */
function freeTeuAt(bay: number, row: number, tier: number, cell: { fore: string[]; aft: string[] } | undefined, slotKeys: ReadonlySet<string>): number {
  const has = (b: number) => slotKeys.has(`${b}|${row}|${tier}`);
  const foreFree = !cell || cell.fore.length === 0;
  const aftFree = !cell || cell.aft.length === 0;
  if (foreFree && aftFree) return has(bay) ? 2 : Number(has(bay - 1)) + Number(has(bay + 1));
  if (foreFree) return Number(has(bay - 1));
  if (aftFree) return Number(has(bay + 1));
  return 0;
}

const RANK: Record<Severity, number> = { error: 0, warning: 1 };

/** The worst severity per 40' bay, from the violations' slot codes. Project-cargo violations carry no
 * slots and so mark no bay — the Check tab lists them. */
function worstSeverityByBay(vessel: Vessel, report: ValidationReport | undefined): Map<number, Severity> {
  const worst = new Map<number, Severity>();
  for (const v of report?.violations ?? []) {
    for (const code of v.slots) {
      let bay: number | undefined;
      try {
        bay = bayPosition(parseSlotCode(code).bay, vessel.bays)?.fortyBay;
      } catch {
        continue; // not a slot code: nothing to place on the sheet
      }
      if (bay === undefined) continue;
      const current = worst.get(bay);
      if (!current || RANK[v.severity] < RANK[current]) worst.set(bay, v.severity);
    }
  }
  return worst;
}

/** Project-cargo ids resting in each 40' bay, per deck: the item's footprint overlaps (in x) the bay's
 * slots IN THE SAME stowage area. Uses the model's own slot rects, so no new geometry. */
function projectCargoByBay(vessel: Vessel, plan: StowagePlan): Map<number, Record<DeckLevel, string[]>> {
  // `${bay}|${deck}|${areaId}` → [xMin, xMax] over that bay's slots
  const extent = new Map<string, [number, number]>();
  for (const s of buildStowageModel(vessel).slots) {
    const bay = bayPosition(s.bay, vessel.bays)?.fortyBay;
    if (bay === undefined || !s.areaId) continue;
    const key = `${bay}|${s.deck}|${s.areaId}`;
    const cur = extent.get(key);
    extent.set(key, cur ? [Math.min(cur[0], s.rect.xMin), Math.max(cur[1], s.rect.xMax)] : [s.rect.xMin, s.rect.xMax]);
  }
  const cargo = new Map(plan.breakbulk_cargo.map((c) => [c.id, c] as const));
  const out = new Map<number, Record<DeckLevel, string[]>>();
  const add = (bay: number, deck: DeckLevel, p: BreakbulkPlacement) => {
    const entry = out.get(bay) ?? { on: [], under: [] };
    entry[deck].push(p.cargo_id);
    out.set(bay, entry);
  };
  for (const p of plan.breakbulk_placements) {
    const item = cargo.get(p.cargo_id);
    if (!item) continue;
    const rect = footprintRect(item, p);
    const area = areaIdOf(p);
    for (const bay of vessel.bays) {
      for (const deck of ["on", "under"] as const) {
        const x = extent.get(`${bay}|${deck}|${area}`);
        if (x && rect.xMin < x[1] && rect.xMax > x[0]) add(bay, deck, p);
      }
    }
  }
  return out;
}

/** Each placed box once — the legend and the footers count these. */
export const boxesOf = (pairs: readonly BayPair[]): Container[] => {
  const seen = new Map<string, Container>();
  for (const pair of pairs) {
    for (const section of [pair.fore, pair.aft]) for (const cell of section.cells.values()) seen.set(cell.box.id, cell.box);
  }
  return [...seen.values()];
};
