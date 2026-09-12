import { describe, expect, it } from "vitest";
import { buildSuperstructureMesh } from "../superstructure-geometry";
import { buildFunnelMesh } from "../funnel-geometry";
import { buildMastMesh, buildLifeboatMesh } from "../deck-fittings-geometry";
import { buildCraneMesh } from "../crane-geometry";
import type { ComponentSpec, MainParticulars } from "@/types/vessel-geometry";
import type { MeshData } from "@/engine/mesh-data";

const particulars: MainParticulars = {
  loa_m: 172,
  lbp_m: 160,
  aft_overhang_m: 6,
  beam_m: 27.4,
  depth_m: 14,
  design_draft_m: 9.8,
  cb: 0.68,
};
const geometry = { particulars };

function bbox(mesh: MeshData) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < mesh.positions.length; i += 3) {
    const [x, y, z] = [mesh.positions[i], mesh.positions[i + 1], mesh.positions[i + 2]];
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
  }
  return { minX, maxX, minY, maxY, minZ, maxZ };
}

function assertFinite(mesh: MeshData) {
  for (const arr of [mesh.positions, mesh.normals]) {
    for (const v of arr) expect(Number.isFinite(v)).toBe(true);
  }
  expect(mesh.index.length % 3).toBe(0);
  expect(mesh.index.length).toBeGreaterThan(0);
}

describe("buildSuperstructureMesh", () => {
  const spec: Extract<ComponentSpec, { kind: "superstructure" }> = {
    kind: "superstructure",
    x_aft_m: 10,
    x_fwd_m: 20,
    width_m: 20,
    tiers: 3,
    tier_height_m: 3,
  };

  it("produces a valid, finite mesh spanning the expected length/width/height", () => {
    const mesh = buildSuperstructureMesh(spec, geometry);
    assertFinite(mesh);
    const box = bbox(mesh);
    expect(box.maxX - box.minX).toBeCloseTo(spec.x_fwd_m - spec.x_aft_m, 6); // length -> scene x
    expect(box.maxZ - box.minZ).toBeCloseTo(spec.width_m, 6); // ship y (width) -> scene z
    expect(box.maxY - box.minY).toBeCloseTo(spec.tiers * spec.tier_height_m, 6); // ship z -> scene y
  });

  it("sits on the deck (lowest point at scene y = 0, since deck z = depth_m)", () => {
    const mesh = buildSuperstructureMesh(spec, geometry);
    expect(bbox(mesh).minY).toBeCloseTo(0, 6);
  });
});

describe("buildFunnelMesh", () => {
  it("produces a valid mesh of the requested size", () => {
    const spec: Extract<ComponentSpec, { kind: "funnel" }> = {
      kind: "funnel",
      x_m: 5,
      y_m: 0,
      base_z_m: 20,
      height_m: 8,
      length_m: 4,
      width_m: 6,
    };
    const mesh = buildFunnelMesh(spec, geometry);
    assertFinite(mesh);
    const box = bbox(mesh);
    expect(box.maxX - box.minX).toBeCloseTo(spec.length_m, 6);
    expect(box.maxZ - box.minZ).toBeCloseTo(spec.width_m, 6);
    expect(box.maxY - box.minY).toBeCloseTo(spec.height_m, 6);
  });
});

describe("buildMastMesh / buildLifeboatMesh", () => {
  it("mast is a valid finite mesh of the requested height", () => {
    const spec: Extract<ComponentSpec, { kind: "mast" }> = { kind: "mast", x_m: 0, y_m: 0, base_z_m: 20, height_m: 10 };
    const mesh = buildMastMesh(spec, geometry);
    assertFinite(mesh);
    expect(bbox(mesh).maxY - bbox(mesh).minY).toBeCloseTo(10, 3);
  });

  it("lifeboat is a valid finite mesh", () => {
    const spec: Extract<ComponentSpec, { kind: "lifeboat" }> = { kind: "lifeboat", x_m: 5, y_m: 13, z_m: 18, freefall: false };
    assertFinite(buildLifeboatMesh(spec, geometry));
  });
});

describe("buildCraneMesh", () => {
  it("produces a valid finite mesh combining pedestal and jib", () => {
    const spec: Extract<ComponentSpec, { kind: "crane" }> = {
      kind: "crane",
      id: "crane-1",
      pedestal: [80, 10, 14],
      pedestal_height_m: 6,
      jib_length_m: 20,
      swl_t: 36,
      outreach_min_m: 5,
      outreach_max_m: 25,
    };
    const mesh = buildCraneMesh(spec, geometry);
    assertFinite(mesh);
    // jib extends well beyond the pedestal's own footprint
    expect(bbox(mesh).maxZ - bbox(mesh).minZ).toBeGreaterThan(spec.jib_length_m * 0.5);
  });
});
