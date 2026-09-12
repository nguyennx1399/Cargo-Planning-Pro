import { describe, expect, it } from "vitest";
import { parseBookletCsv, exportComputedCsv } from "../hydrostatic-csv-io";
import type { HydrostaticRow } from "../hydrostatic-table-calculator";

describe("parseBookletCsv", () => {
  it("parses a subset of columns, ignoring unknown ones", () => {
    const csv = "draft_m,displacement_t,ship_name\n9.8,26000,MV Test\n8.5,22000,MV Test\n";
    const result = parseBookletCsv(csv);
    if (!("rows" in result)) throw new Error("expected rows");
    expect(result.rows).toEqual([{ draft_m: 9.8, displacement_t: 26000 }, { draft_m: 8.5, displacement_t: 22000 }]);
  });

  it("requires a draft_m column", () => {
    const result = parseBookletCsv("displacement_t\n26000\n");
    expect("errors" in result).toBe(true);
  });

  it("reports a line number for an invalid numeric cell", () => {
    const result = parseBookletCsv("draft_m,displacement_t\n9.8,abc\n");
    if (!("errors" in result)) throw new Error("expected errors");
    expect(result.errors[0].line).toBe(2);
  });
});

describe("exportComputedCsv", () => {
  const row: HydrostaticRow = {
    draft_m: 9.8,
    displacement_volume_m3: 10000,
    displacement_t: 10250,
    kb_m: 4,
    lcb_m: 80,
    waterplane_area_m2: 3000,
    lcf_m: 78,
    tpc_t_per_cm: 30,
    bmt_m: 8,
    kmt_m: 12,
    bml_m: 300,
    mtc_t_m_per_cm: 250,
    cb: 0.68,
    cm: 0.95,
    cwp: 0.85,
  };

  it("writes a header + one data row, draft_m first", () => {
    const csv = exportComputedCsv([row]);
    const lines = csv.trim().split("\n");
    expect(lines[0].startsWith("draft_m,")).toBe(true);
    expect(lines[1].startsWith("9.8,")).toBe(true);
  });

  it("round-trips through parseBookletCsv for the fields parseBookletCsv knows about", () => {
    const csv = exportComputedCsv([row]);
    const result = parseBookletCsv(csv);
    if (!("rows" in result)) throw new Error("expected rows");
    expect(result.rows[0]).toEqual(row);
  });

  it("does not need formula-escaping for legitimate numeric hydrostatic values (sanity check)", () => {
    // all real values here are plain numbers, never starting with = + - @, so nothing should
    // be escaped — this just locks in that normal data isn't mangled by the RT-14 mitigation.
    const csv = exportComputedCsv([row]);
    expect(csv).not.toContain("'");
  });
});
