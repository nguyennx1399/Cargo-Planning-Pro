/**
 * color-legend.ts — the key for the bay sheet's cell colours, with counts (all-bay overview, phase 01).
 *
 * The colours come from the SAME functions the cells use (`containerColor`'s inputs: the POD map,
 * `TYPE_COLORS`/`IMDG_COLOR`, `weightColor`), so a legend chip can never disagree with a cell. Counts are
 * of PLACED boxes (what the sheet draws), so the chips sum to the "placed" figure.
 */
import type { Container, PortCall } from "@/types/domain";
import type { ColorMode } from "@/store/usePlanStore";
import { IMDG_COLOR, TYPE_COLORS, weightColor } from "@/lib/colors";

export interface LegendEntry {
  label: string;
  color: string;
  count: number;
}

/** The weight ramp saturates at 30 t (`weightColor`); bands are drawn with their MIDDLE's colour. */
const WEIGHT_BANDS: { label: string; min: number; max: number; mid: number }[] = [
  { label: "< 10 t", min: 0, max: 10, mid: 5 },
  { label: "10–20 t", min: 10, max: 20, mid: 15 },
  { label: "20–30 t", min: 20, max: 30, mid: 25 },
  { label: "≥ 30 t", min: 30, max: Infinity, mid: 30 },
];

/** Unknown POD falls back to this in `containerColor`; the legend names it rather than hiding it. */
const OTHER_POD_COLOR = "#999999";

export function colorLegend(
  boxes: readonly Container[],
  mode: ColorMode,
  pods: Record<string, string>,
  ports: readonly PortCall[],
): LegendEntry[] {
  if (mode === "weight") {
    return WEIGHT_BANDS.map((b) => ({
      label: b.label,
      color: weightColor(b.mid),
      count: boxes.filter((c) => c.weight_t >= b.min && c.weight_t < b.max).length,
    }));
  }
  if (mode === "type") {
    // IMDG wins over the type colour in the cells, so an IMDG box is counted there and nowhere else.
    const entries: LegendEntry[] = (Object.keys(TYPE_COLORS) as Container["type"][])
      .map((t) => ({ label: t.replace("_", " "), color: TYPE_COLORS[t], count: boxes.filter((c) => !c.imdg_class && c.type === t).length }))
      .filter((e) => e.count > 0);
    const imdg = boxes.filter((c) => c.imdg_class).length;
    return imdg > 0 ? [...entries, { label: "IMDG", color: IMDG_COLOR, count: imdg }] : entries;
  }
  // POD, in rotation order; only ports something is going to.
  const ordered = [...ports].sort((a, b) => a.sequence - b.sequence);
  const entries = ordered
    .map((p) => ({ label: p.locode, color: pods[p.locode] ?? OTHER_POD_COLOR, count: boxes.filter((c) => c.pod === p.locode).length }))
    .filter((e) => e.count > 0);
  const known = new Set(ordered.map((p) => p.locode));
  const other = boxes.filter((c) => !known.has(c.pod)).length;
  return other > 0 ? [...entries, { label: "Other", color: OTHER_POD_COLOR, count: other }] : entries;
}
