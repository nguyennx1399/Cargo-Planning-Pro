import { describe, expect, it } from "vitest";
import type { CargoSpace, VesselStowageSpec } from "@/types/vessel-stowage-spec";
import { validateStowageSpec } from "../validate-stowage-spec";
import { apXToPlacementX, deckLayoutFromSpec, holdAreasFromSpec } from "../deck-layout-from-spec";
import { buildVesselFromSpec } from "@/data/vessel-from-spec";
import { listVesselSpecs } from "@/data/vessel-specs";
import { generateDemoBreakbulkCargo } from "@/data/demo-breakbulk-generator";
import { naiveFillBreakbulk } from "@/engine/naive-fill-breakbulk";
import { breakbulkInKeepOut, breakbulkOutOfDeckArea, breakbulkOverlap, breakbulkTooTall } from "@/engine/breakbulk-validation-rules";

const PROV = { source: "s", confidence: "A" as const };

function space(id: string, patch: Partial<CargoSpace> = {}): CargoSpace {
  return {
    id, label: id, level: "weather_deck", x_aft_m: 0, x_fwd_m: 20, width_m: 16,
    surface_above_baseline_m: 12, clear_height_m: 8, max_load_t_per_m2: 3, provenance: PROV, ...patch,
  };
}

/** A small, fictional 100 m ship — proves the pipeline is generic, not BBC-specific. */
function fixture(patch: Partial<VesselStowageSpec> = {}): VesselStowageSpec {
  return {
    schema_version: 1, vessel_id: "test-mpp", name: "TEST MPP", imo: null,
    particulars: { loa_m: 100, lbp_m: 94, beam_m: 18, depth_m: 11, summer_draft_m: 6.5 },
    particulars_provenance: PROV,
    cargo_spaces: [space("h1", { x_aft_m: 5, x_fwd_m: 35 }), space("h2", { x_aft_m: 35, x_fwd_m: 70 }), space("h3", { x_aft_m: 70, x_fwd_m: 80, width_m: 6 })],
    obstructions: [{ id: "ped", label: "crane pedestal", kind: "crane_pedestal", x_aft_m: 40, x_fwd_m: 44, z_min_m: -10, z_max_m: -6, levels: ["weather_deck"], provenance: PROV }],
    cranes: [],
    sources: [{ id: "s", title: "spec sheet" }],
    ...patch,
  };
}

describe("validateStowageSpec", () => {
  it("accepts a consistent spec with no errors", () => {
    expect(validateStowageSpec(fixture()).filter((i) => i.severity === "error")).toEqual([]);
  });

  it("rejects physically impossible data", () => {
    const bad = fixture({
      particulars: { loa_m: 100, lbp_m: 120, beam_m: 18, depth_m: 11, summer_draft_m: 6.5 },
      cargo_spaces: [space("wide", { width_m: 30 }), space("backwards", { x_aft_m: 50, x_fwd_m: 40 }), space("wide", { level: "tank_top" })],
    });
    const msgs = validateStowageSpec(bad).filter((i) => i.severity === "error").map((i) => i.message);
    expect(msgs).toEqual(expect.arrayContaining([
      "LBP cannot exceed LOA",
      "extends past the 18 m beam",
      "x_fwd_m must be forward of x_aft_m",
      'duplicate id "wide"',
    ]));
  });

  it("rejects a provenance pointing at an undeclared source", () => {
    const bad = fixture({ cargo_spaces: [space("h1", { provenance: { source: "nope", confidence: "A" } })] });
    expect(validateStowageSpec(bad).some((i) => i.severity === "error" && i.message.includes('unknown source "nope"'))).toBe(true);
  });

  it("incomplete spaces are warnings, not errors — the planner just skips them", () => {
    const spec = fixture({ cargo_spaces: [space("h1"), space("td", { level: "tweendeck", x_aft_m: null, x_fwd_m: null, surface_above_baseline_m: null })] });
    const issues = validateStowageSpec(spec);
    expect(issues.filter((i) => i.severity === "error")).toEqual([]);
    expect(issues.some((i) => i.severity === "warning" && i.path.includes("td") && i.message.includes("missing"))).toBe(true);
  });
});

describe("deckLayoutFromSpec", () => {
  it("picks the contiguous run with the largest common-width envelope, reporting what it skipped", () => {
    const { layout, used_space_ids, skipped } = deckLayoutFromSpec(fixture());
    // h1+h2: 65 m × 16 m = 1040 m²  vs  h1+h2+h3: 75 m × 6 m = 450 m²
    expect(used_space_ids).toEqual(["h1", "h2"]);
    expect(skipped.map((s) => s.id)).toEqual(["h3"]);
    expect(layout!.area.xMin).toBeCloseTo(apXToPlacementX(fixture(), 5), 9);
    expect(layout!.area.xMax).toBeCloseTo(apXToPlacementX(fixture(), 70), 9);
    expect(layout!.area.zMax).toBe(8);
  });

  it("converts AP-referenced x with the spec's own LOA/LBP (x_m = x - LBP/2 + LOA/2)", () => {
    expect(apXToPlacementX(fixture(), 0)).toBeCloseTo(3, 9); // (100 - 94) / 2
  });

  it("derives resting height, clearance and load rating from the spec, conservatively", () => {
    const spec = fixture({
      cargo_spaces: [space("a", { x_aft_m: 0, x_fwd_m: 30, surface_above_baseline_m: 12, clear_height_m: 9, max_load_t_per_m2: 5 }),
        space("b", { x_aft_m: 30, x_fwd_m: 60, surface_above_baseline_m: 12.5, clear_height_m: 8, max_load_t_per_m2: 3 })],
    });
    const { layout } = deckLayoutFromSpec(spec);
    expect(layout!.cargo_base_height_m).toBeCloseTo(12.5 - 11, 9); // highest surface, above main deck
    expect(layout!.max_cargo_height_m).toBeCloseTo(Math.min(12 + 9, 12.5 + 8) - 12.5, 9); // lowest ceiling
    expect(layout!.deck_load_t_per_m2).toBe(3);
  });

  it("only weather-deck obstructions become keep-outs", () => {
    const spec = fixture({
      obstructions: [
        { id: "ped", label: "pedestal", kind: "crane_pedestal", x_aft_m: 40, x_fwd_m: 44, z_min_m: -10, z_max_m: -6, levels: ["weather_deck"], provenance: PROV },
        { id: "pillar", label: "hold pillar", kind: "other", x_aft_m: 20, x_fwd_m: 21, z_min_m: -1, z_max_m: 1, levels: ["tank_top"], provenance: PROV },
      ],
    });
    expect(deckLayoutFromSpec(spec).layout!.keep_out.map((k) => k.id)).toEqual(["ped"]);
  });

  it("no complete weather-deck space -> no layout (vessel falls back to the generic deck area)", () => {
    const spec = fixture({ cargo_spaces: [space("h1", { width_m: null })] });
    expect(deckLayoutFromSpec(spec).layout).toBeNull();
    expect(buildVesselFromSpec(spec).breakbulk_deck).toBeUndefined();
  });

  it("a brand-new vessel spec gets cargo placed with no vessel-specific code", () => {
    const vessel = buildVesselFromSpec(fixture());
    const cargo = generateDemoBreakbulkCargo().filter((c) => c.length_m <= 65 && c.width_m <= 16 && c.height_m <= 8);
    const { placements } = naiveFillBreakbulk(vessel, cargo, []);
    expect(placements.length).toBeGreaterThan(0);
    expect(breakbulkOutOfDeckArea(vessel, cargo, placements)).toEqual([]);
    expect(breakbulkOverlap(cargo, placements)).toEqual([]);
    expect(breakbulkInKeepOut(vessel, cargo, placements)).toEqual([]);
    expect(breakbulkTooTall(vessel, cargo, placements)).toEqual([]);
  });
});

describe("bundled vessel specs", () => {
  for (const { spec, issues } of listVesselSpecs()) {
    it(`${spec.vessel_id}: loads with zero errors and yields a weather-deck layout`, () => {
      expect(issues.filter((i) => i.severity === "error")).toEqual([]);
      expect(deckLayoutFromSpec(spec).layout).not.toBeNull();
    });
  }
});

describe("holdAreasFromSpec", () => {
  const holdSpec = () =>
    fixture({
      cargo_spaces: [
        space("h1", { x_aft_m: 5, x_fwd_m: 80 }),
        space("tt_a", { level: "tank_top", hold: "1", x_aft_m: 10, x_fwd_m: 40, width_m: 14, surface_above_baseline_m: 1.5, clear_height_m: 9, max_load_t_per_m2: 15 }),
        space("tt_b", { level: "tank_top", hold: "1", x_aft_m: 40, x_fwd_m: 70, width_m: 14, surface_above_baseline_m: 1.5, clear_height_m: 9, max_load_t_per_m2: 12 }),
        space("pontoons", { level: "tweendeck", hold: "1", x_aft_m: 10, x_fwd_m: 70, surface_above_baseline_m: null, adjustable_levels: [{ id: "l1", surface_above_baseline_m: 5, clear_height_m: 5 }] }),
      ],
      obstructions: [{ id: "pillar", label: "hold pillar", kind: "other", x_aft_m: 30, x_fwd_m: 31, z_min_m: -1, z_max_m: 1, levels: ["tank_top"], provenance: PROV }],
    });

  it("merges a hold's contiguous tank-top zones into one area with conservative limits", () => {
    const { areas } = holdAreasFromSpec(holdSpec());
    expect(areas).toHaveLength(1);
    expect(areas[0]).toMatchObject({ id: "tank_top_hold1", label: "Hold 1 tank top", level: "tank_top", deck_load_t_per_m2: 12, max_cargo_height_m: 9 });
    expect(areas[0].cargo_base_height_m).toBeCloseTo(1.5 - 11, 9); // below the 11 m main deck
    expect(areas[0].keep_out.map((k) => k.id)).toEqual(["pillar"]);
  });

  it("reports adjustable pontoons as not planned yet instead of dropping them silently", () => {
    const { skipped } = holdAreasFromSpec(holdSpec());
    expect(skipped.find((s) => s.id === "pontoons")?.reason).toMatch(/pontoon/);
  });

  it("a vessel built from the spec gets breakbulk_holds", () => {
    expect(buildVesselFromSpec(holdSpec()).breakbulk_holds?.map((h) => h.id)).toEqual(["tank_top_hold1"]);
  });
});
