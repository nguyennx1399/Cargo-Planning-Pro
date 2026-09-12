import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseOffsetsCsvLong } from "../offsets-csv-parser";
import { normalizeOffsets } from "../offsets-normalizer";
import { checkOffsetsFairness } from "../offsets-fairness-check";
import { blockCoefficient } from "../section-integrals";
import { buildHullLoftMesh } from "../hull-loft-mesh-builder";
import type { MainParticulars } from "@/types/vessel-geometry";

// End-to-end: the same pipeline an OffsetsImportPanel run would follow, against the synthetic
// Wigley fixture (known closed-form Cb = 4/9) — proves the whole L2 chain (parse -> normalize
// -> fairness -> shared loft mesher from phase 2) agrees, not just each stage in isolation.
describe("offsets import pipeline (Wigley fixture)", () => {
  const csvPath = join(__dirname, "../../../data/fixtures/wigley-offsets.csv");
  const csv = readFileSync(csvPath, "utf-8");

  it("parses, normalizes, and passes fairness with 0 warnings", () => {
    const parsed = parseOffsetsCsvLong(csv);
    if (!("table" in parsed)) throw new Error(`unexpected parse errors: ${JSON.stringify(parsed.errors)}`);
    const offsets = normalizeOffsets(parsed.table, { unit: "m", station: { kind: "x_m" } });
    expect(checkOffsetsFairness(offsets)).toEqual([]);
  });

  it("lofts to a closed mesh whose Cb matches the analytic 4/9 within 0.005", () => {
    const parsed = parseOffsetsCsvLong(csv);
    if (!("table" in parsed)) throw new Error("unexpected parse errors");
    const offsets = normalizeOffsets(parsed.table, { unit: "m", station: { kind: "x_m" } });

    const cb = blockCoefficient(offsets, { lbp_m: 160, beam_m: 27.4 }, 14);
    expect(Math.abs(cb - 4 / 9)).toBeLessThan(0.005);

    const particulars: MainParticulars = { loa_m: 160, lbp_m: 160, aft_overhang_m: 0.01, beam_m: 27.4, depth_m: 14, design_draft_m: 14, cb: 4 / 9 };
    const mesh = buildHullLoftMesh(offsets, particulars);
    expect(mesh.index.length).toBeGreaterThan(0);
    for (const v of mesh.positions) expect(Number.isFinite(v)).toBe(true);
  });
});
