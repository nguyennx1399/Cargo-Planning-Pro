// Interpolates a HydrostaticRow[] table (from hydrostatic-table-calculator.ts, at a discrete
// draft grid) to an arbitrary target displacement — the table only has values AT the drafts it
// was computed for, but a loaded ship's displacement rarely lands exactly on one of them.
import type { HydrostaticRow } from "./hull/hydrostatic-table-calculator";

const NUMERIC_FIELDS: (keyof HydrostaticRow)[] = [
  "draft_m",
  "displacement_volume_m3",
  "displacement_t",
  "kb_m",
  "lcb_m",
  "waterplane_area_m2",
  "lcf_m",
  "tpc_t_per_cm",
  "bmt_m",
  "kmt_m",
  "bml_m",
  "mtc_t_m_per_cm",
  "cb",
  "cm",
  "cwp",
];

function lerpRow(a: HydrostaticRow, b: HydrostaticRow, f: number): HydrostaticRow {
  const row = {} as HydrostaticRow;
  for (const key of NUMERIC_FIELDS) row[key] = a[key] + (b[key] - a[key]) * f;
  return row;
}

/** Linearly interpolates every field of the table between the two rows bracketing
 * `targetDisplacementT` (sorted by displacement first, so caller doesn't need an ordered
 * `drafts` list). Returns null when the target is outside the table's own range — no
 * extrapolation (RT-2: don't silently guess beyond what was actually computed). */
export function interpolateHydrostatics(table: HydrostaticRow[], targetDisplacementT: number): HydrostaticRow | null {
  if (table.length < 2) return null;
  const sorted = [...table].sort((a, b) => a.displacement_t - b.displacement_t);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  if (targetDisplacementT < min.displacement_t || targetDisplacementT > max.displacement_t) return null;

  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (targetDisplacementT >= a.displacement_t && targetDisplacementT <= b.displacement_t) {
      const f = b.displacement_t === a.displacement_t ? 0 : (targetDisplacementT - a.displacement_t) / (b.displacement_t - a.displacement_t);
      return lerpRow(a, b, f);
    }
  }
  return null;
}
