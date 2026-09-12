import { describe, expect, it } from "vitest";
import { mergeMeshData } from "../merge-mesh-data";
import type { MeshData } from "@/engine/mesh-data";

function triangle(offset: number): MeshData {
  return {
    positions: new Float32Array([offset, 0, 0, offset + 1, 0, 0, offset, 1, 0]),
    normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
    index: new Uint32Array([0, 1, 2]),
  };
}

describe("mergeMeshData", () => {
  it("concatenates positions/normals and offsets indices per part", () => {
    const merged = mergeMeshData([triangle(0), triangle(10)]);
    expect(merged.positions.length).toBe(18); // 6 vertices * 3
    expect(merged.index).toEqual(new Uint32Array([0, 1, 2, 3, 4, 5]));
    expect(Array.from(merged.positions.slice(9, 12))).toEqual([10, 0, 0]); // second triangle's first vertex
  });

  it("returns an empty mesh for an empty input", () => {
    const merged = mergeMeshData([]);
    expect(merged.positions.length).toBe(0);
    expect(merged.index.length).toBe(0);
  });

  it("handles a single part unchanged", () => {
    const single = triangle(5);
    const merged = mergeMeshData([single]);
    expect(merged.positions).toEqual(single.positions);
    expect(merged.index).toEqual(single.index);
  });
});
