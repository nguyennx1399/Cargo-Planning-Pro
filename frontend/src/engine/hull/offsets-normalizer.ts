// Turns a RawOffsetsTable (units/station-addressing unresolved) into a proper HullOffsets grid:
// unit conversion, station -> ship-frame x_m, ascending sort on both axes. One numeric unit
// applies to every value in the file (station-as-x_m, waterlines, half-breadths alike) — real
// shipyard exports are consistently mm or consistently m, not mixed.
import type { FrameSegment, HullOffsets } from "@/types/vessel-geometry";
import type { RawOffsetsTable } from "./offsets-csv-parser";
import { frameToX } from "@/lib/ship-frame";

export type StationMode =
  | { kind: "x_m" }
  | { kind: "station_number"; lbp_m: number; stationCount: number } // station 0 = AP, stationCount = FP
  | { kind: "frame"; frames: FrameSegment[] };

export interface OffsetsCsvMeta {
  unit: "mm" | "m";
  station: StationMode;
}

export function normalizeOffsets(raw: RawOffsetsTable, meta: OffsetsCsvMeta): HullOffsets {
  const scale = meta.unit === "mm" ? 0.001 : 1;
  // Station values are never scaled by `unit`: "x_m" mode means the column IS x in meters
  // already (that's what the mode name specifies), and station_number/frame are dimensionless
  // indices resolved straight to meters via LBP or the frame table. `unit` only applies to the
  // waterline and half-breadth columns, which are physical measurements in the file.
  const stationsX = raw.stations.map((s) => stationToX(s, meta.station));
  const waterlinesZ = raw.waterlines.map((z) => z * scale);
  const valuesScaled = raw.values.map((row) => row.map((v) => (v === null ? null : v * scale)));

  const stationOrder = argsort(stationsX);
  const waterlineOrder = argsort(waterlinesZ);

  return {
    stations_x_m: stationOrder.map((i) => stationsX[i]),
    waterlines_z_m: waterlineOrder.map((i) => waterlinesZ[i]),
    half_breadths_m: stationOrder.map((si) => waterlineOrder.map((wi) => valuesScaled[si][wi])),
  };
}

function stationToX(station: number, mode: StationMode): number {
  switch (mode.kind) {
    case "x_m":
      return station;
    case "station_number":
      return (station / mode.stationCount) * mode.lbp_m;
    case "frame":
      return frameToX(mode.frames, station);
  }
}

function argsort(values: number[]): number[] {
  return values.map((_, i) => i).sort((a, b) => values[a] - values[b]);
}
