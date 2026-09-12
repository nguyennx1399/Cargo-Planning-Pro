import { describe, expect, it } from "vitest";
import { normalizeOffsets } from "../offsets-normalizer";
import type { RawOffsetsTable } from "../offsets-csv-parser";
import type { FrameSegment } from "@/types/vessel-geometry";

const raw: RawOffsetsTable = {
  stations: [10, 0], // deliberately out of order
  waterlines: [5000, 0], // deliberately out of order, in mm
  values: [
    [8000, 4000], // station 10: [wl 5000, wl 0]
    [3000, 1000], // station 0: [wl 5000, wl 0]
  ],
};

describe("normalizeOffsets", () => {
  it("converts mm to m for waterlines/breadths, sorts both axes ascending, keeps values aligned", () => {
    // "x_m" mode: station values ARE x in meters already (the mode name says so) — NOT scaled
    // by `unit`, unlike waterline_z and half_breadth which are physical measurements in the file.
    const offsets = normalizeOffsets(raw, { unit: "mm", station: { kind: "x_m" } });
    expect(offsets.stations_x_m).toEqual([0, 10]);
    expect(offsets.waterlines_z_m).toEqual([0, 5]);
    // station 0 (was index 1 in raw), waterline 0 (was index 1 in raw) -> value 1000mm = 1m
    expect(offsets.half_breadths_m[0]).toEqual([1, 3]);
    expect(offsets.half_breadths_m[1]).toEqual([4, 8]);
  });

  it("does not scale x_m station values even when unit is mm (only breadth/waterline columns)", () => {
    const offsets = normalizeOffsets(raw, { unit: "mm", station: { kind: "x_m" } });
    expect(offsets.stations_x_m).toEqual(raw.stations.slice().sort((a, b) => a - b));
  });

  it("passes meters through unscaled", () => {
    const offsets = normalizeOffsets(raw, { unit: "m", station: { kind: "x_m" } });
    expect(offsets.stations_x_m).toEqual([0, 10]);
    expect(offsets.half_breadths_m[0]).toEqual([1000, 3000]);
  });

  it("preserves null values through unit conversion", () => {
    const withNull: RawOffsetsTable = { stations: [0], waterlines: [0, 5], values: [[null, 2000]] };
    const offsets = normalizeOffsets(withNull, { unit: "mm", station: { kind: "x_m" } });
    expect(offsets.half_breadths_m[0]).toEqual([null, 2]);
  });

  it("converts station_number to x_m via LBP, independent of the unit setting", () => {
    const table: RawOffsetsTable = { stations: [0, 10, 20], waterlines: [0], values: [[0], [0], [0]] };
    const offsets = normalizeOffsets(table, { unit: "mm", station: { kind: "station_number", lbp_m: 160, stationCount: 20 } });
    expect(offsets.stations_x_m).toEqual([0, 80, 160]); // station 0->AP, 10->midship, 20->FP
  });

  it("converts frame numbers to x_m via frameToX, independent of the unit setting", () => {
    const frames: FrameSegment[] = [{ from_frame: 0, to_frame: 200, spacing_m: 0.8 }];
    const table: RawOffsetsTable = { stations: [0, 100, 200], waterlines: [0], values: [[0], [0], [0]] };
    const offsets = normalizeOffsets(table, { unit: "mm", station: { kind: "frame", frames } });
    expect(offsets.stations_x_m).toEqual([0, 80, 160]);
  });
});
