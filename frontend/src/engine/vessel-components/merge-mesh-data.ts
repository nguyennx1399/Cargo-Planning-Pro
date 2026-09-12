// Concatenates multiple MeshData pieces into one (index offsets adjusted), so a whole family
// of deck fittings can share a single draw call — needed to hit the phase-2 draw-call budget.
import type { MeshData } from "@/engine/mesh-data";

export function mergeMeshData(parts: MeshData[]): MeshData {
  let vertexCount = 0;
  let indexCount = 0;
  for (const part of parts) {
    vertexCount += part.positions.length / 3;
    indexCount += part.index.length;
  }

  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const index = new Uint32Array(indexCount);

  let vertexOffset = 0;
  let posCursor = 0;
  let idxCursor = 0;
  for (const part of parts) {
    positions.set(part.positions, posCursor);
    normals.set(part.normals, posCursor);
    for (let i = 0; i < part.index.length; i++) index[idxCursor + i] = part.index[i] + vertexOffset;
    posCursor += part.positions.length;
    idxCursor += part.index.length;
    vertexOffset += part.positions.length / 3;
  }

  return { positions, normals, index };
}
