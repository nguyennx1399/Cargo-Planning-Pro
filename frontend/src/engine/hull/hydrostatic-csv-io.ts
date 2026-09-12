// Reads a booklet's hydrostatic table from CSV (one column per HydrostaticRow field, any subset
// besides draft_m) and writes the computed table back out. Export escapes CSV formula injection
// (RT-14) — computed values are trustworthy, but this module also has to survive round-tripping
// through a spreadsheet a user might paste booklet numbers into.
import type { HydrostaticRow } from "./hydrostatic-table-calculator";
import type { BookletRow } from "./hydrostatic-booklet-compare";

const FIELD_ORDER: (keyof HydrostaticRow)[] = [
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

export interface CsvParseError {
  line: number;
  message: string;
}

/** Parses a booklet CSV: header = a subset of HydrostaticRow's field names (order doesn't
 * matter, draft_m is required), one row per draft. Unknown headers are ignored (not an error —
 * a booklet export often has extra columns this tool doesn't use). */
export function parseBookletCsv(text: string): { rows: BookletRow[] } | { errors: CsvParseError[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return { errors: [{ line: 1, message: "expected a header row and at least one data row" }] };

  const headers = lines[0].split(",").map((h) => h.trim());
  if (!headers.includes("draft_m")) return { errors: [{ line: 1, message: "missing required column draft_m" }] };

  const errors: CsvParseError[] = [];
  const rows: BookletRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim());
    if (cols.length !== headers.length) {
      errors.push({ line: i + 1, message: `expected ${headers.length} columns, got ${cols.length}` });
      continue;
    }
    const row: Partial<Record<string, number>> = {};
    let badCell = false;
    headers.forEach((h, ci) => {
      if (!FIELD_ORDER.includes(h as keyof HydrostaticRow)) return; // unknown column, ignored
      const n = Number(cols[ci]);
      if (!Number.isFinite(n)) {
        errors.push({ line: i + 1, message: `invalid value ${JSON.stringify(cols[ci])} for column ${h}` });
        badCell = true;
        return;
      }
      row[h] = n;
    });
    if (badCell || row.draft_m === undefined) continue;
    rows.push({ ...row, draft_m: row.draft_m } satisfies BookletRow);
  }

  if (errors.length > 0) return { errors };
  return { rows };
}

/** Escapes a leading `= + - @` (CSV formula injection, RT-14) by prefixing a single quote.
 * Every current HydrostaticRow field is a ship-frame-positive quantity for this product's
 * geometries, so none of our own values trigger it today — but a future field that can be
 * legitimately negative (e.g. an LCB measured +fwd of midship instead of from AP) would have
 * its minus sign quoted too, breaking a straight re-parse. Flagging here rather than adding
 * complexity (a smarter escape that only quotes non-numeric leading `-`) before it's needed. */
function escapeCsvCell(value: string): string {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

export function exportComputedCsv(rows: HydrostaticRow[]): string {
  const header = FIELD_ORDER.join(",");
  const body = rows.map((r) => FIELD_ORDER.map((f) => escapeCsvCell(String(r[f]))).join(","));
  return [header, ...body].join("\n") + "\n";
}
