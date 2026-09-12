// Dispatches VesselGeometry.components (+ auto-generated hatch covers/lashing bridges) to the
// right builder and groups the results by material so the whole "everything but the hull"
// static geometry renders in a handful of draw calls (NF budget: <=12 for the ship).
import type { Vessel } from "@/types/domain";
import type { ComponentSpec, VesselGeometry } from "@/types/vessel-geometry";
import type { MeshData } from "@/engine/mesh-data";
import { buildSuperstructureMesh } from "./superstructure-geometry";
import { buildFunnelMesh } from "./funnel-geometry";
import { buildMastMesh, buildLifeboatMesh } from "./deck-fittings-geometry";
import { buildCraneMesh } from "./crane-geometry";
import { buildHatchCoversMesh, buildLashingBridgesMesh } from "./hatch-and-lashing-geometry";
import { mergeMeshData } from "./merge-mesh-data";

/** Material group key -> merged mesh for that group. Rendered as one <mesh> per key. */
export type StaticComponentMeshes = Record<string, MeshData>;

export function buildStaticComponentMeshes(vessel: Vessel, geometry: VesselGeometry): StaticComponentMeshes {
  const byGroup = new Map<string, MeshData[]>();
  const add = (group: string, mesh: MeshData) => {
    const list = byGroup.get(group) ?? [];
    list.push(mesh);
    byGroup.set(group, list);
  };

  for (const component of geometry.components) {
    add(materialGroupFor(component), buildComponentMesh(component, geometry));
  }

  const hatchCovers = buildHatchCoversMesh(vessel, geometry);
  if (hatchCovers.index.length > 0) add("deck-fittings", hatchCovers);
  const lashingBridges = buildLashingBridgesMesh(vessel, geometry);
  if (lashingBridges) add("deck-fittings", lashingBridges);

  const result: StaticComponentMeshes = {};
  for (const [group, meshes] of byGroup) result[group] = mergeMeshData(meshes);
  return result;
}

function buildComponentMesh(component: ComponentSpec, geometry: VesselGeometry): MeshData {
  switch (component.kind) {
    case "superstructure":
      return buildSuperstructureMesh(component, geometry);
    case "funnel":
      return buildFunnelMesh(component, geometry);
    case "mast":
      return buildMastMesh(component, geometry);
    case "lifeboat":
      return buildLifeboatMesh(component, geometry);
    case "crane":
      return buildCraneMesh(component, geometry);
  }
}

function materialGroupFor(component: ComponentSpec): string {
  switch (component.kind) {
    case "superstructure":
      return "superstructure";
    case "crane":
      return "crane";
    case "funnel":
    case "mast":
    case "lifeboat":
      return "deck-fittings"; // share one material group
  }
}
