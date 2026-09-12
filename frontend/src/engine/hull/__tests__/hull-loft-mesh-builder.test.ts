import { describe, expect, it } from "vitest";
import { buildHullLoftMesh } from "../hull-loft-mesh-builder";
import { generateParametricOffsets } from "../parametric-hull-generator";
import { displacedVolume } from "../section-integrals";
import type { MainParticulars, ParametricHullParams } from "@/types/vessel-geometry";

const particulars: MainParticulars = {
  loa_m: 172,
  lbp_m: 160,
  aft_overhang_m: 6,
  beam_m: 27.4,
  depth_m: 14,
  design_draft_m: 9.8,
  cb: 0.68,
};
const params: ParametricHullParams = {
  bow: "bulbous",
  stern: "cruiser",
  parallel_midbody: [0.3, 0.62],
  bulb: { length_m: 3, breadth_m: 3, height_m: 2.5 },
};

/** Signed volume enclosed by a triangle mesh via the divergence theorem — valid for any
 * closed (possibly non-convex) mesh, regardless of where the origin sits. */
function signedVolume(positions: Float32Array, index: Uint32Array): number {
  let vol = 0;
  for (let i = 0; i < index.length; i += 3) {
    const ia = index[i] * 3;
    const ib = index[i + 1] * 3;
    const ic = index[i + 2] * 3;
    const ax = positions[ia], ay = positions[ia + 1], az = positions[ia + 2];
    const bx = positions[ib], by = positions[ib + 1], bz = positions[ib + 2];
    const cx = positions[ic], cy = positions[ic + 1], cz = positions[ic + 2];
    vol += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;
  }
  return vol;
}

function edgeKey(a: number, b: number): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

describe("buildHullLoftMesh", () => {
  const offsets = generateParametricOffsets(particulars, params);
  const mesh = buildHullLoftMesh(offsets, particulars);

  it("is a closed manifold: every undirected edge belongs to exactly 2 triangles", () => {
    const counts = new Map<string, number>();
    for (let i = 0; i < mesh.index.length; i += 3) {
      const [a, b, c] = [mesh.index[i], mesh.index[i + 1], mesh.index[i + 2]];
      for (const [u, v] of [[a, b], [b, c], [c, a]] as const) {
        const key = edgeKey(u, v);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
    const badEdges = [...counts.entries()].filter(([, n]) => n !== 2);
    expect(badEdges).toEqual([]);
  });

  it("has outward-facing normals (positive enclosed volume)", () => {
    expect(signedVolume(mesh.positions, mesh.index)).toBeGreaterThan(0);
  });

  it("encloses a volume matching the offsets' own integral up to the deck, within 1%", () => {
    const expectedVolume = displacedVolume(offsets, particulars.depth_m);
    const meshVolume = Math.abs(signedVolume(mesh.positions, mesh.index));
    const relError = Math.abs(meshVolume - expectedVolume) / expectedVolume;
    expect(relError).toBeLessThan(0.01);
  });

  it("produces no NaN/Infinity in positions or normals", () => {
    for (const arr of [mesh.positions, mesh.normals]) {
      for (const v of arr) {
        expect(Number.isFinite(v)).toBe(true);
      }
    }
  });

  it("stays within a sane triangle budget (LOD0)", () => {
    expect(mesh.index.length / 3).toBeLessThan(60000);
  });
});
