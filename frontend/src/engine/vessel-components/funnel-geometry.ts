// Funnel as a single box (its spec carries length_m/width_m, not a radius — a rectangular
// cross-section, which most container-ship funnels approximate anyway).
import type { ComponentSpec, VesselGeometry } from "@/types/vessel-geometry";
import type { MeshData } from "@/engine/mesh-data";
import { boxMeshData } from "./primitive-mesh";

type FunnelSpec = Extract<ComponentSpec, { kind: "funnel" }>;

export function buildFunnelMesh(spec: FunnelSpec, geometry: Pick<VesselGeometry, "particulars">): MeshData {
  const centerZ = spec.base_z_m + spec.height_m / 2;
  return boxMeshData(
    { lengthM: spec.length_m, widthM: spec.width_m, heightM: spec.height_m },
    [spec.x_m, spec.y_m, centerZ],
    geometry
  );
}
