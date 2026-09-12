import { describe, expect, it } from "vitest";
import { validateVesselGeometry } from "../validate-vessel-geometry";
import type { VesselGeometry } from "@/types/vessel-geometry";

function baseGeometry(): VesselGeometry {
  return {
    schema_version: 1,
    id: "test-vessel",
    version: 1,
    design_name: "Test Vessel",
    data_status: "synthetic",
    particulars: { loa_m: 172, lbp_m: 160, aft_overhang_m: 6, beam_m: 27.4, depth_m: 14, design_draft_m: 9.8, cb: 0.68 },
    frames: [{ from_frame: 0, to_frame: 200, spacing_m: 0.8 }],
    hull: { source: "parametric", params: { bow: "bulbous", stern: "cruiser", parallel_midbody: [0.3, 0.62] } },
    components: [{ kind: "mast", x_m: 150, y_m: 0, base_z_m: 20, height_m: 10 }],
    livery: {
      topside_color: "#2B4C6F",
      antifouling_color: "#8B1A1A",
      boot_top_color: "#1A1A1A",
      boot_top_low_z_m: 9.5,
      boot_top_high_z_m: 10.3,
      superstructure_color: "#E8ECEF",
    },
    provenance: { source_docs: ["synthetic-demo"] },
  };
}

describe("validateVesselGeometry", () => {
  it("has no issues for a valid geometry", () => {
    expect(validateVesselGeometry(baseGeometry())).toEqual([]);
  });

  it("flags LBP >= LOA", () => {
    const g = baseGeometry();
    g.particulars.lbp_m = 180;
    expect(validateVesselGeometry(g)).toContainEqual(expect.objectContaining({ path: "particulars.lbp_m" }));
  });

  it("flags aft_overhang_m + lbp_m exceeding loa_m", () => {
    const g = baseGeometry();
    g.particulars.aft_overhang_m = 20;
    expect(validateVesselGeometry(g)).toContainEqual(expect.objectContaining({ path: "particulars.aft_overhang_m" }));
  });

  it("flags design draft >= depth", () => {
    const g = baseGeometry();
    g.particulars.design_draft_m = 14;
    expect(validateVesselGeometry(g)).toContainEqual(expect.objectContaining({ path: "particulars.design_draft_m" }));
  });

  it("flags Cb outside [0.35, 0.90]", () => {
    const g = baseGeometry();
    g.particulars.cb = 0.2;
    expect(validateVesselGeometry(g)).toContainEqual(expect.objectContaining({ path: "particulars.cb" }));
  });

  it("flags non-contiguous frame segments", () => {
    const g = baseGeometry();
    g.frames = [
      { from_frame: 0, to_frame: 100, spacing_m: 0.8 },
      { from_frame: 105, to_frame: 200, spacing_m: 0.8 },
    ];
    expect(validateVesselGeometry(g)).toContainEqual(expect.objectContaining({ path: "frames[1].from_frame" }));
  });

  it("flags non-positive spacing", () => {
    const g = baseGeometry();
    g.frames = [{ from_frame: 0, to_frame: 200, spacing_m: 0 }];
    expect(validateVesselGeometry(g)).toContainEqual(expect.objectContaining({ path: "frames[0].spacing_m" }));
  });

  it("flags frame 0 not anchored at the AP (x=0) as an error", () => {
    const g = baseGeometry();
    g.frames = [{ from_frame: 5, to_frame: 200, spacing_m: 0.8 }];
    expect(validateVesselGeometry(g)).toContainEqual(
      expect.objectContaining({ path: "frames[0].from_frame", severity: "error" })
    );
  });

  it("flags offsets grid size mismatch", () => {
    const g = baseGeometry();
    g.hull = {
      source: "offsets",
      offsets: { stations_x_m: [0, 10, 20], waterlines_z_m: [0, 5, 10], half_breadths_m: [[0, 5, 5], [1, 6]] },
    };
    const issues = validateVesselGeometry(g);
    expect(issues).toContainEqual(expect.objectContaining({ path: "hull.offsets.half_breadths_m" }));
    expect(issues).toContainEqual(expect.objectContaining({ path: "hull.offsets.half_breadths_m[1]" }));
  });

  it("flags a half-breadth outside [0, beam/2]", () => {
    const g = baseGeometry();
    g.hull = {
      source: "offsets",
      offsets: { stations_x_m: [0, 80, 160], waterlines_z_m: [0, 14], half_breadths_m: [[0, 0], [0, 20], [0, 0]] },
    };
    expect(validateVesselGeometry(g)).toContainEqual(expect.objectContaining({ path: "hull.offsets.half_breadths_m[1][1]" }));
  });

  it("accepts strictly ascending offsets with no size/range issues", () => {
    const g = baseGeometry();
    g.hull = {
      source: "offsets",
      offsets: { stations_x_m: [0, 80, 160], waterlines_z_m: [0, 14], half_breadths_m: [[0, 0], [0, 13.7], [0, 0]] },
    };
    expect(validateVesselGeometry(g)).toEqual([]);
  });

  it("flags a component placed outside the hull's longitudinal extent", () => {
    const g = baseGeometry();
    g.components = [{ kind: "mast", x_m: 300, y_m: 0, base_z_m: 20, height_m: 10 }];
    expect(validateVesselGeometry(g)).toContainEqual(expect.objectContaining({ path: "components[0]" }));
  });

  it("flags a component placed outside the hull beam", () => {
    const g = baseGeometry();
    g.components = [{ kind: "mast", x_m: 150, y_m: 20, base_z_m: 20, height_m: 10 }]; // beam is 27.4, half=13.7
    expect(validateVesselGeometry(g)).toContainEqual(expect.objectContaining({ path: "components[0]" }));
  });

  it("flags a superstructure whose outboard edge exceeds the beam", () => {
    const g = baseGeometry();
    g.components = [{ kind: "superstructure", x_aft_m: 10, x_fwd_m: 30, width_m: 40, tiers: 3, tier_height_m: 3 }];
    expect(validateVesselGeometry(g)).toContainEqual(expect.objectContaining({ path: "components[0]" }));
  });

  it("flags boot_top_low_z_m >= boot_top_high_z_m", () => {
    const g = baseGeometry();
    g.livery.boot_top_low_z_m = 11;
    expect(validateVesselGeometry(g)).toContainEqual(expect.objectContaining({ path: "livery.boot_top_low_z_m" }));
  });

  it("flags boot_top_high_z_m exceeding depth", () => {
    const g = baseGeometry();
    g.livery.boot_top_high_z_m = 20;
    expect(validateVesselGeometry(g)).toContainEqual(expect.objectContaining({ path: "livery.boot_top_high_z_m" }));
  });
});
