import { describe, expect, it } from "vitest";
import { buildStaticComponentMeshes } from "../merge-static-components";
import { buildDemoVessel } from "@/data/demo-container-vessel";
import { buildDemoHorizonGeometry } from "@/data/demo-horizon-geometry";
import type { VesselGeometry } from "@/types/vessel-geometry";

describe("buildStaticComponentMeshes", () => {
  const vessel = buildDemoVessel();

  it("groups by material into a small number of draw calls (<=5 groups)", () => {
    const geometry: VesselGeometry = {
      ...buildDemoHorizonGeometry(),
      components: [
        { kind: "superstructure", x_aft_m: 10, x_fwd_m: 20, width_m: 20, tiers: 3, tier_height_m: 3 },
        { kind: "funnel", x_m: 5, y_m: 0, base_z_m: 20, height_m: 8, length_m: 4, width_m: 6 },
        { kind: "mast", x_m: 0, y_m: 0, base_z_m: 20, height_m: 10 },
        { kind: "mast", x_m: 140, y_m: 0, base_z_m: 14, height_m: 15 },
        { kind: "lifeboat", x_m: 5, y_m: 13, z_m: 18, freefall: false },
        { kind: "lifeboat", x_m: 5, y_m: -13, z_m: 18, freefall: false },
      ],
    };
    const grouped = buildStaticComponentMeshes(vessel, geometry);
    const groupNames = Object.keys(grouped);
    expect(groupNames.length).toBeLessThanOrEqual(5);
    expect(groupNames).toContain("superstructure");
    expect(groupNames).toContain("deck-fittings"); // funnel + masts + lifeboats + hatch covers merged together
    for (const mesh of Object.values(grouped)) {
      expect(mesh.index.length).toBeGreaterThan(0);
      for (const v of mesh.positions) expect(Number.isFinite(v)).toBe(true);
    }
  });

  it("still produces a deck-fittings group (hatch covers) with an empty components list", () => {
    const geometry: VesselGeometry = { ...buildDemoHorizonGeometry(), components: [] };
    const grouped = buildStaticComponentMeshes(vessel, geometry);
    expect(grouped["deck-fittings"]).toBeDefined();
    expect(grouped["superstructure"]).toBeUndefined();
    expect(grouped["crane"]).toBeUndefined();
  });
});
