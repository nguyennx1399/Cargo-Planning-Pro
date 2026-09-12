// Parses an offsets table from CSV text, in either shape a shipyard export might use. Output
// is a RAW table — units and station addressing are NOT yet resolved (offsets-normalizer.ts
// does that) — so parsing never needs to know the target vessel's LBP/frames.
export interface ParseError {
  line: number;
  message: string;
}

export interface RawOffsetsTable {
  stations: number[]; // raw station values as given, one per row (may repeat in long format)
  waterlines: number[]; // raw waterline values as given, ascending order of first appearance
  values: (number | null)[][]; // [station index][waterline index]
}

const NULL_TOKENS = new Set(["", "-", "—", "–"]); // blank, hyphen, em dash, en dash

function toNumberOrNull(token: string): number | null | undefined {
  const t = token.trim();
  if (NULL_TOKENS.has(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined; // undefined = not parseable at all
}

function splitCsvLine(line: string): string[] {
  return line.split(",").map((c) => c.trim());
}

/** Long format: header `station,waterline_z,half_breadth` (extra columns ignored), one row per
 * (station, waterline) pair. Missing (station, waterline) combinations are padded with null —
 * expected at bulb/knuckle stations, not an error. */
export function parseOffsetsCsvLong(text: string): { table: RawOffsetsTable } | { errors: ParseError[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return { errors: [{ line: 1, message: "expected a header row and at least one data row" }] };

  const errors: ParseError[] = [];
  const stationOrder: number[] = [];
  const waterlineOrder: number[] = [];
  const cellsByStation = new Map<number, Map<number, number | null>>();

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    if (cols.length < 3) {
      errors.push({ line: i + 1, message: `expected 3 columns (station, waterline_z, half_breadth), got ${cols.length}` });
      continue;
    }
    const station = Number(cols[0]);
    const waterline = Number(cols[1]);
    const value = toNumberOrNull(cols[2]);
    if (!Number.isFinite(station)) {
      errors.push({ line: i + 1, message: `invalid station value ${JSON.stringify(cols[0])}` });
      continue;
    }
    if (!Number.isFinite(waterline)) {
      errors.push({ line: i + 1, message: `invalid waterline value ${JSON.stringify(cols[1])}` });
      continue;
    }
    if (value === undefined) {
      errors.push({ line: i + 1, message: `invalid half-breadth value ${JSON.stringify(cols[2])}` });
      continue;
    }
    if (!stationOrder.includes(station)) stationOrder.push(station);
    if (!waterlineOrder.includes(waterline)) waterlineOrder.push(waterline);
    if (!cellsByStation.has(station)) cellsByStation.set(station, new Map());
    cellsByStation.get(station)!.set(waterline, value);
  }

  if (errors.length > 0) return { errors };

  const values = stationOrder.map((s) => waterlineOrder.map((w) => cellsByStation.get(s)!.get(w) ?? null));
  return { table: { stations: stationOrder, waterlines: waterlineOrder, values } };
}

/** Wide format: header row = `station,<wl0>,<wl1>,...`; each data row = station value followed
 * by half-breadths at each header waterline, in the same column order. */
export function parseOffsetsCsvWide(text: string): { table: RawOffsetsTable } | { errors: ParseError[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return { errors: [{ line: 1, message: "expected a header row and at least one data row" }] };

  const header = splitCsvLine(lines[0]);
  const waterlines = header.slice(1).map(Number);
  const badWl = waterlines.findIndex((w) => !Number.isFinite(w));
  if (badWl !== -1) {
    return { errors: [{ line: 1, message: `invalid waterline header value ${JSON.stringify(header[badWl + 1])}` }] };
  }

  const errors: ParseError[] = [];
  const stations: number[] = [];
  const values: (number | null)[][] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    if (cols.length !== waterlines.length + 1) {
      errors.push({ line: i + 1, message: `expected ${waterlines.length + 1} columns, got ${cols.length}` });
      continue;
    }
    const station = Number(cols[0]);
    if (!Number.isFinite(station)) {
      errors.push({ line: i + 1, message: `invalid station value ${JSON.stringify(cols[0])}` });
      continue;
    }
    const row = cols.slice(1).map(toNumberOrNull);
    const badCell = row.findIndex((v) => v === undefined);
    if (badCell !== -1) {
      errors.push({ line: i + 1, message: `invalid half-breadth value ${JSON.stringify(cols[badCell + 1])}` });
      continue;
    }
    stations.push(station);
    values.push(row as (number | null)[]);
  }

  if (errors.length > 0) return { errors };
  return { table: { stations, waterlines, values } };
}

export function parseOffsetsCsv(
  text: string,
  format: "long" | "wide"
): { table: RawOffsetsTable } | { errors: ParseError[] } {
  return format === "long" ? parseOffsetsCsvLong(text) : parseOffsetsCsvWide(text);
}
