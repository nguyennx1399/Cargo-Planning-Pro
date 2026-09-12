import { describe, expect, it } from "vitest";
import { buildBreakbulkMesh } from "../breakbulk-mesh-builder";
import { buildDemoVessel } from "@/data/demo-container-vessel";
import { LAYOUT } from "@/lib/geometry";
import type { BreakbulkCargo, BreakbulkPlacement } from "@/types/domain";

const vessel = buildDemoVessel();

function item(patch: Partial<BreakbulkCargo> = {}): BreakbulkCargo {
  return { id: "b1", category: "yacht", length_m: 20, width_m: 6, height_m: 5, weight_t: 30, kg_above_base_m: 2.5, pol: "A", pod: "B", ...patch };
}

function placement(patch: Partial<BreakbulkPlacement> = {}): BreakbulkPlacement {
  return { cargo_id: "b1", x_m: 100, z_m: 0, rotation_deg: 0, ...patch };
}

function centroid(mesh: { positions: Float32Array }): [number, number, number] {
  let sx = 0, sy = 0, sz = 0;
  const n = mesh.positions.length / 3;
  for (let i = 0; i < n; i++) {
    sx += mesh.positions[i * 3];
    sy += mesh.positions[i * 3 + 1];
    sz += mesh.positions[i * 3 + 2];
  }
  return [sx / n, sy / n, sz / n];
}

function xExtent(mesh: { positions: Float32Array }): number {
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < mesh.positions.length; i += 3) {
    min = Math.min(min, mesh.positions[i]);
    max = Math.max(max, mesh.positions[i]);
  }
  return max - min;
}

describe("buildBreakbulkMesh", () => {
  it("produces a valid MeshData (positions/normals/index, non-empty) for a box category", () => {
    const mesh = buildBreakbulkMesh(item({ category: "yacht" }), placement(), vessel);
    expect(mesh.positions.length).toBeGreaterThan(0);
    expect(mesh.normals.length).toBe(mesh.positions.length);
    expect(mesh.index.length).toBeGreaterThan(0);
  });

  it("produces a valid MeshData for the tower category (cylinder)", () => {
    const mesh = buildBreakbulkMesh(item({ category: "wind_turbine_tower", length_m: 24, width_m: 5.5, height_m: 5.5 }), placement(), vessel);
    expect(mesh.positions.length).toBeGreaterThan(0);
    expect(mesh.index.length).toBeGreaterThan(0);
  });

  it("produces a valid MeshData for nacelle and blade categories", () => {
    for (const category of ["wind_turbine_nacelle", "wind_turbine_blade"] as const) {
      const mesh = buildBreakbulkMesh(item({ category }), placement(), vessel);
      expect(mesh.positions.length).toBeGreaterThan(0);
    }
  });

  it("centers a box item's scene position at x_m - length_m/2 (SAME convention ContainerInstances uses, not shipToScene)", () => {
    const it1 = item({ category: "yacht", length_m: 20, width_m: 6, height_m: 5 });
    const p = placement({ x_m: 100, z_m: 3 });
    const mesh = buildBreakbulkMesh(it1, p, vessel);
    const [cx, cy, cz] = centroid(mesh);
    expect(cx).toBeCloseTo(p.x_m - vessel.length_m / 2, 4);
    expect(cy).toBeCloseTo(LAYOUT.hatchHeight + it1.height_m / 2, 4);
    expect(cz).toBeCloseTo(p.z_m, 4);
  });

  it("a breakbulk item placed just clear of an on-deck bay's x-zone does not render inside that bay's actual scene x range", () => {
    // Cross-system check per the code-reviewer's Critical #1 recommendation: reproduce the exact
    // bug (breakbulk rendered via shipToScene+lbp_m while forbidden-zones/placement used
    // vessel.length_m) by confirming the mesh's scene x sits OUTSIDE the container bay's real
    // rendered scene x range, using the SAME bayCenterX the containers actually render with.
    const bay = vessel.bays[0];
    const i = vessel.bays.indexOf(bay);
    const pitch = 12.192 + 1.2; // DIM.len40 + LAYOUT.bayGap, matching lib/geometry.ts
    const bayCenterSceneX = vessel.length_m / 2 - LAYOUT.bowMargin - (i + 0.5) * pitch; // bayCenterX's own fallback formula
    const bayHalfWidth = 12.192 / 2;

    // Place breakbulk just past the bay's forbidden zone in the SAME (length_m-symmetric) x_m
    // convention onDeckBayZones uses: bay center in that convention is bayCenterSceneX + length_m/2.
    const bayCenterXM = bayCenterSceneX + vessel.length_m / 2;
    const clearance = 5; // meters clear of the bay's forbidden zone
    const itemLength = 10;
    const placedXM = bayCenterXM + bayHalfWidth + clearance + itemLength / 2;

    const mesh = buildBreakbulkMesh(item({ length_m: itemLength, width_m: 4 }), placement({ x_m: placedXM }), vessel);
    const [cx] = centroid(mesh);
    const meshSceneXMin = cx - itemLength / 2;
    // The mesh's rendered footprint must NOT dip back into the bay's real scene x range.
    expect(meshSceneXMin).toBeGreaterThan(bayCenterSceneX + bayHalfWidth);
  });

  it("a breakbulk item placed just clear of a bay on its AFT side does not render inside that bay's scene x range either", () => {
    // The previous test alone does NOT discriminate old-vs-new code: it clears the bay on the
    // BOW side, which is exactly the direction the old shipToScene-based bug's uniform
    // +(length_m-lbp_m)/2 = +6m shift moves an item AWAY from — so that test would pass even
    // under the old buggy code (code-reviewer finding). This case clears the bay on the AFT
    // side instead with a clearance (3m) SMALLER than the old bug's 6m shift, so the old bug
    // would have pushed the item's rendered position across the bay's boundary and INTO its
    // zone — a genuine regression guard, not just a self-consistency check.
    const bay = vessel.bays[0];
    const i = vessel.bays.indexOf(bay);
    const pitch = 12.192 + 1.2;
    const bayCenterSceneX = vessel.length_m / 2 - LAYOUT.bowMargin - (i + 0.5) * pitch;
    const bayHalfWidth = 12.192 / 2;
    const bayCenterXM = bayCenterSceneX + vessel.length_m / 2;

    const clearance = 3; // meters — smaller than the old bug's 6m shift, so it would have crossed
    const itemLength = 10;
    const placedXM = bayCenterXM - bayHalfWidth - clearance - itemLength / 2; // AFT of the bay

    const mesh = buildBreakbulkMesh(item({ length_m: itemLength, width_m: 4 }), placement({ x_m: placedXM }), vessel);
    const [cx] = centroid(mesh);
    const meshSceneXMax = cx + itemLength / 2;
    expect(meshSceneXMax).toBeLessThan(bayCenterSceneX - bayHalfWidth);
  });

  it("swaps length/width for a box item when rotation_deg is 90 (different bounding extent)", () => {
    const it1 = item({ category: "yacht", length_m: 20, width_m: 6, height_m: 5 });
    const meshFlat = buildBreakbulkMesh(it1, placement({ rotation_deg: 0 }), vessel);
    const meshRotated = buildBreakbulkMesh(it1, placement({ rotation_deg: 90 }), vessel);
    expect(xExtent(meshFlat)).toBeCloseTo(20, 4);
    expect(xExtent(meshRotated)).toBeCloseTo(6, 4);
  });
});
