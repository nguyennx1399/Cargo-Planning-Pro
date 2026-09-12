// Flags likely typos in an imported offsets table via robust outlier detection (normalized 2nd
// differences, MAD threshold) rather than asking a human to eyeball a few hundred cells. Catches
// the most common transcription error from a PDF scan: a shifted decimal point or transposed
// digits (e.g. 12.45 typed as 1.245).
import type { HullOffsets } from "@/types/vessel-geometry";

export interface FairnessWarning {
  station: number; // index into offsets.stations_x_m
  waterline: number; // index into offsets.waterlines_z_m
  message: string;
}

const DEFAULT_K = 5; // MAD multiplier: how many "typical" deviations away counts as suspect

export interface FairnessCheckOptions {
  k?: number;
  beamM?: number; // if known, tightens the "outside plausible range" check to B/2
}

export function checkOffsetsFairness(offsets: HullOffsets, opts: FairnessCheckOptions = {}): FairnessWarning[] {
  const k = opts.k ?? DEFAULT_K;
  const warnings: FairnessWarning[] = [];
  const isKnuckle = (si: number, wi: number) => offsets.knuckles?.some((kn) => kn.station === si && kn.waterline === wi) ?? false;

  // Along x: for each waterline, look across stations.
  for (let wi = 0; wi < offsets.waterlines_z_m.length; wi++) {
    const column = offsets.stations_x_m.map((_, si) => offsets.half_breadths_m[si][wi]);
    for (const si of suspectIndices(column, offsets.stations_x_m, k)) {
      if (isKnuckle(si, wi)) continue;
      warnings.push({ station: si, waterline: wi, message: `outlier along x at station ${si}, waterline ${wi} (vs its neighbors)` });
    }
  }

  // Along z: for each station, look across waterlines.
  for (let si = 0; si < offsets.stations_x_m.length; si++) {
    const row = offsets.half_breadths_m[si];
    for (const wi of suspectIndices(row, offsets.waterlines_z_m, k)) {
      if (isKnuckle(si, wi)) continue;
      warnings.push({ station: si, waterline: wi, message: `outlier along z at station ${si}, waterline ${wi} (vs its neighbors)` });
    }
  }

  // Sanity: range and self-consistency.
  const allValues = offsets.half_breadths_m.flat().filter((v): v is number => v !== null);
  const observedMax = allValues.length > 0 ? Math.max(...allValues) : 0;
  const upperBound = opts.beamM !== undefined ? opts.beamM / 2 : observedMax;
  offsets.half_breadths_m.forEach((row, si) => {
    row.forEach((v, wi) => {
      if (v === null) return;
      if (v < 0 || v > upperBound * 1.01) {
        warnings.push({ station: si, waterline: wi, message: `half-breadth ${v} outside plausible range [0, ${upperBound.toFixed(3)}]` });
      }
    });
  });

  return dedupeWarnings(warnings);
}

// A genuinely smooth curve (e.g. a parabola) has a near-constant, non-zero 2nd difference —
// meaning MAD can be near 0, which would make k*MAD hypersensitive to ordinary rounding noise
// in otherwise-clean data. This floor says "don't flag anything smaller than NOISE_FLOOR_M of
// half-breadth noise would produce" — a stand-in for plausible manual-transcription precision,
// converted into 2nd-difference units via the local point spacing.
const NOISE_FLOOR_M = 0.005;

/** Indices (into `values`) whose normalized 2nd difference is more than k*MAD from the median —
 * a robust outlier test that doesn't get fooled by one or two genuinely bad points (unlike a
 * mean+stddev test). Positions are used to normalize for uneven spacing between points. */
function suspectIndices(values: (number | null)[], positions: number[], k: number): number[] {
  const points: { index: number; d2: number; h: number }[] = [];
  for (let i = 1; i < values.length - 1; i++) {
    const a = values[i - 1];
    const b = values[i];
    const c = values[i + 1];
    if (a === null || b === null || c === null) continue;
    const h = (positions[i] - positions[i - 1] + (positions[i + 1] - positions[i])) / 2;
    if (h <= 0) continue;
    points.push({ index: i, d2: (a - 2 * b + c) / (h * h), h });
  }
  if (points.length < 3) return []; // not enough points for a robust statistic

  const sorted = points.map((p) => p.d2).slice().sort((x, y) => x - y);
  const median = sorted[Math.floor(sorted.length / 2)];
  const absDevs = points.map((p) => Math.abs(p.d2 - median)).sort((x, y) => x - y);
  const mad = absDevs[Math.floor(absDevs.length / 2)];
  const avgH = points.reduce((sum, p) => sum + p.h, 0) / points.length;
  const floor = NOISE_FLOOR_M / (avgH * avgH);
  const effectiveMad = Math.max(mad, floor);

  return points.filter((p) => Math.abs(p.d2 - median) > k * effectiveMad).map((p) => p.index);
}

function dedupeWarnings(warnings: FairnessWarning[]): FairnessWarning[] {
  const seen = new Set<string>();
  return warnings.filter((w) => {
    const key = `${w.station}-${w.waterline}-${w.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
