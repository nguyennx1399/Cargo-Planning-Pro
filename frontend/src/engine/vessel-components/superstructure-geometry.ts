// Deckhouse as a stack of equal-height tiers (no window bands / wings — a plain block per
// tier is enough to read as "the bridge" at demo scale; L2/L3 hull sources can carry a real
// GLB model instead of this builder).
import type { ComponentSpec, VesselGeometry } from "@/types/vessel-geometry";
import type { MeshData } from "@/engine/mesh-data";
import { boxMeshData } from "./primitive-mesh";
import { mergeMeshData } from "./merge-mesh-data";

type SuperstructureSpec = Extract<ComponentSpec, { kind: "superstructure" }>;

export function buildSuperstructureMesh(spec: SuperstructureSpec, geometry: Pick<VesselGeometry, "particulars">): MeshData {
  const centerX = (spec.x_aft_m + spec.x_fwd_m) / 2;
  const lengthM = spec.x_fwd_m - spec.x_aft_m;
  const yCenter = spec.y_center_m ?? 0;
  const baseZ = geometry.particulars.depth_m; // sits on deck

  const tiers: MeshData[] = [];
  for (let t = 0; t < spec.tiers; t++) {
    const tierCenterZ = baseZ + spec.tier_height_m * (t + 0.5);
    tiers.push(
      boxMeshData({ lengthM, widthM: spec.width_m, heightM: spec.tier_height_m }, [centerX, yCenter, tierCenterZ], geometry)
    );
  }
  return mergeMeshData(tiers);
}
