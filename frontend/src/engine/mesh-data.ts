// Shared plain-data mesh shape, used across engine/hull and engine/vessel-components so
// pieces built by different modules can be merged with one utility (plan G2's "one mesher"
// spirit extended to non-hull geometry). Structurally identical to hull-loft-mesh-builder's
// own HullMeshData — kept separate to avoid coupling engine/hull to engine/vessel-components.
export interface MeshData {
  positions: Float32Array;
  normals: Float32Array;
  index: Uint32Array;
}
