import { describe, expect, it } from "vitest";
import { parseOffsetsCsvLong, parseOffsetsCsvWide } from "../offsets-csv-parser";

describe("parseOffsetsCsvLong", () => {
  it("parses a simple grid and pads missing combinations with null", () => {
    const csv = "station,waterline_z,half_breadth\n0,0,0\n0,5,3\n10,0,4\n10,5,8\n";
    const result = parseOffsetsCsvLong(csv);
    expect("table" in result).toBe(true);
    if (!("table" in result)) throw new Error("expected table");
    expect(result.table.stations).toEqual([0, 10]);
    expect(result.table.waterlines).toEqual([0, 5]);
    expect(result.table.values).toEqual([[0, 3], [4, 8]]);
  });

  it("treats blank/-/em-dash as null", () => {
    const csv = "station,waterline_z,half_breadth\n0,0,\n0,5,-\n0,10,—\n";
    const result = parseOffsetsCsvLong(csv);
    if (!("table" in result)) throw new Error("expected table");
    expect(result.table.values[0]).toEqual([null, null, null]);
  });

  it("reports a line number for an unparseable value, without crashing", () => {
    const csv = "station,waterline_z,half_breadth\n0,0,1\nabc,5,3\n";
    const result = parseOffsetsCsvLong(csv);
    expect("errors" in result).toBe(true);
    if (!("errors" in result)) throw new Error("expected errors");
    expect(result.errors[0].line).toBe(3);
  });

  it("rejects a file with only a header", () => {
    const result = parseOffsetsCsvLong("station,waterline_z,half_breadth\n");
    expect("errors" in result).toBe(true);
  });
});

describe("parseOffsetsCsvWide", () => {
  it("parses header waterlines and aligned rows", () => {
    const csv = "station,0,5,10\n0,0,3,6\n10,1,4,7\n";
    const result = parseOffsetsCsvWide(csv);
    if (!("table" in result)) throw new Error("expected table");
    expect(result.table.waterlines).toEqual([0, 5, 10]);
    expect(result.table.stations).toEqual([0, 10]);
    expect(result.table.values).toEqual([[0, 3, 6], [1, 4, 7]]);
  });

  it("treats blank/-/em-dash as null in data cells", () => {
    const csv = "station,0,5\n0,-,—\n";
    const result = parseOffsetsCsvWide(csv);
    if (!("table" in result)) throw new Error("expected table");
    expect(result.table.values[0]).toEqual([null, null]);
  });

  it("reports a line number for a row with the wrong column count", () => {
    const csv = "station,0,5,10\n0,1,2\n";
    const result = parseOffsetsCsvWide(csv);
    if (!("errors" in result)) throw new Error("expected errors");
    expect(result.errors[0].line).toBe(2);
  });

  it("rejects an invalid waterline header", () => {
    const result = parseOffsetsCsvWide("station,0,abc\n0,1,2\n");
    expect("errors" in result).toBe(true);
  });
});

describe("long vs wide agreement", () => {
  it("produce the same table for equivalent data", () => {
    const long = parseOffsetsCsvLong("station,waterline_z,half_breadth\n0,0,1\n0,5,2\n10,0,3\n10,5,4\n");
    const wide = parseOffsetsCsvWide("station,0,5\n0,1,2\n10,3,4\n");
    if (!("table" in long) || !("table" in wide)) throw new Error("expected tables");
    expect(long.table).toEqual(wide.table);
  });
});
