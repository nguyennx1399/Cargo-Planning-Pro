// Crane as a static pedestal + jib (no slew/luff articulation — the spec has no "current
// angle" field, and crane animation is explicitly deferred to a later phase per plan Next
// Steps). Jib points along +y (outboard to starboard) at the pedestal top; good enough for a
// static MPP-vessel render, not for simulating an actual lift.
import type { ComponentSpec, VesselGeometry } from "@/types/vessel-geometry";
import type { MeshData } from "@/engine/mesh-data";
import { boxMeshData, cylinderMeshData } from "./primitive-mesh";
import { mergeMeshData } from "./merge-mesh-data";

type CraneSpec = Extract<ComponentSpec, { kind: "crane" }>;

const PEDESTAL_RADIUS_M = 1.2;
const JIB_CROSS_SECTION_M = 0.8;

export function buildCraneMesh(spec: CraneSpec, geometry: Pick<VesselGeometry, "particulars">): MeshData {
  const [x, y, z] = spec.pedestal;
  const pedestal = cylinderMeshData(
    { radiusTopM: PEDESTAL_RADIUS_M, radiusBottomM: PEDESTAL_RADIUS_M * 1.3, heightM: spec.pedestal_height_m },
    [x, y, z],
    geometry
  );
  const jibTopZ = z + spec.pedestal_height_m;
  const jibCenterY = y + spec.jib_length_m / 2;
  const jib = boxMeshData(
    { lengthM: JIB_CROSS_SECTION_M, widthM: spec.jib_length_m, heightM: JIB_CROSS_SECTION_M },
    [x, jibCenterY, jibTopZ],
    geometry
  );
  return mergeMeshData([pedestal, jib]);
}
