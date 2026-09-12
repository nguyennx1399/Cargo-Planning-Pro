// Compares computed hydrostatics against the class-approved booklet — small deviations across
// several drafts are the evidence that the hull GEOMETRY is right (plan G3: computed never
// replaces the booklet, it's a cross-check + gap-filler with a visible `computed` label).
import type { HydrostaticRow } from "./hydrostatic-table-calculator";

export type ComparableField = Exclude<keyof HydrostaticRow, "draft_m">;

const RESIDUAL_TOLERANCE_FRACTION_OF_LBP = 0.005; // LCB, LCF: plan-specified ±0.5% LBP
const KMT_MIN_ABS_TOLERANCE_M = 0.05; // plan-specified floor, on top of the 1% relative rule

/** Plan-specified defaults (§ phase-06 "Dung sai đề xuất"). Fields not explicitly called out
 * (KB, BMt, BMl, Awp, Cb, Cm, Cwp) fall back to a generic 1% — reasonable, not plan-mandated;
 * a naval architect should confirm before this becomes a real acceptance gate (unresolved
 * question already flagged in the phase file). */
function defaultToleranceM(field: ComparableField, bookletValue: number, lbpM: number): number {
  const abs = Math.abs(bookletValue);
  switch (field) {
    case "lcb_m":
    case "lcf_m":
      return lbpM * RESIDUAL_TOLERANCE_FRACTION_OF_LBP;
    case "kmt_m":
      return Math.max(abs * 0.01, KMT_MIN_ABS_TOLERANCE_M);
    case "mtc_t_m_per_cm":
      return abs * 0.02;
    case "displacement_t":
    case "tpc_t_per_cm":
    default:
      return abs * 0.01;
  }
}

export interface DeviationCell {
  draft_m: number;
  field: ComparableField;
  computed: number;
  booklet: number;
  deviation: number;
  toleranceM: number;
  pass: boolean;
}

export interface CompareReport {
  cells: DeviationCell[];
  passed: boolean;
  maxDeviationByQuantity: Partial<Record<ComparableField, number>>;
}

export interface BookletRow extends Partial<HydrostaticRow> {
  draft_m: number;
}

const DRAFT_MATCH_TOLERANCE_M = 0.01;

/** Compares each booklet row against the computed row at the SAME draft (nearest within 1cm —
 * booklet drafts are usually the exact grid the computed table was requested at). Only fields
 * actually present in the booklet row are compared — a booklet missing a column isn't an error. */
export function compareHydrostatics(computed: HydrostaticRow[], booklet: BookletRow[], lbpM: number): CompareReport {
  const cells: DeviationCell[] = [];

  for (const bRow of booklet) {
    const cRow = computed.find((r) => Math.abs(r.draft_m - bRow.draft_m) <= DRAFT_MATCH_TOLERANCE_M);
    if (!cRow) continue; // no computed row at this draft — nothing to compare

    for (const rawKey of Object.keys(bRow)) {
      if (rawKey === "draft_m") continue;
      const key = rawKey as ComparableField;
      const bookletValue = bRow[key];
      if (bookletValue === undefined) continue;
      const computedValue = cRow[key];
      const deviation = Math.abs(computedValue - bookletValue);
      const toleranceM = defaultToleranceM(key, bookletValue, lbpM);
      cells.push({ draft_m: bRow.draft_m, field: key, computed: computedValue, booklet: bookletValue, deviation, toleranceM, pass: deviation <= toleranceM });
    }
  }

  const maxDeviationByQuantity: Partial<Record<ComparableField, number>> = {};
  for (const cell of cells) {
    maxDeviationByQuantity[cell.field] = Math.max(maxDeviationByQuantity[cell.field] ?? 0, cell.deviation);
  }

  return { cells, passed: cells.every((c) => c.pass), maxDeviationByQuantity };
}
