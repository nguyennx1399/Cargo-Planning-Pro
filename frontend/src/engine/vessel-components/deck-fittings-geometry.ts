// Mast (thin pole) and lifeboat (small block) — the spec carries only a position for each, no
// size, so fixed reasonable dimensions are used (real per-vessel sizing is an L2/L3 concern).
import type { ComponentSpec, VesselGeometry } from "@/types/vessel-geometry";
import type { MeshData } from "@/engine/mesh-data";
import { boxMeshData, cylinderMeshData } from "./primitive-mesh";

type MastSpec = Extract<ComponentSpec, { kind: "mast" }>;
type LifeboatSpec = Extract<ComponentSpec, { kind: "lifeboat" }>;

const MAST_RADIUS_M = 0.15;
const LIFEBOAT_SIZE_M = { lengthM: 6, widthM: 2.5, heightM: 2.5 };

export function buildMastMesh(spec: MastSpec, geometry: Pick<VesselGeometry, "particulars">): MeshData {
  return cylinderMeshData(
    { radiusTopM: MAST_RADIUS_M, radiusBottomM: MAST_RADIUS_M, heightM: spec.height_m },
    [spec.x_m, spec.y_m, spec.base_z_m],
    geometry
  );
}

export function buildLifeboatMesh(spec: LifeboatSpec, geometry: Pick<VesselGeometry, "particulars">): MeshData {
  return boxMeshData(LIFEBOAT_SIZE_M, [spec.x_m, spec.y_m, spec.z_m], geometry);
}
