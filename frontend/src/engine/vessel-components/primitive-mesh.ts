// Box/cylinder mesh data builders, placed by ship-frame position through shipToScene. Used to
// assemble every deck fitting (superstructure, funnel, mast, lifeboat, crane, hatch covers) —
// three.js's own BoxGeometry/CylinderGeometry supply correct flat-shaded normals, we just place
// and extract the arrays (same "use three as a data generator" pattern as engine/hull).
import * as THREE from "three";
import type { VesselGeometry } from "@/types/vessel-geometry";
import type { MeshData } from "@/engine/mesh-data";
import { shipToScene } from "@/lib/ship-frame";

type ParticularsSource = Pick<VesselGeometry, "particulars">;

/** A box of ship-frame extents (lengthM along x, widthM along y, heightM along z), centered
 * at shipCenter (ship-frame x,y,z). */
export function boxMeshData(
  sizeM: { lengthM: number; widthM: number; heightM: number },
  shipCenter: [number, number, number],
  geometry: ParticularsSource
): MeshData {
  const [sx, sy, sz] = shipToScene(geometry, shipCenter);
  // three.js box local axes (width,height,depth) already match scene axes (x,y,z) directly —
  // shipToScene only permutes ship y/z into scene z/y and translates, it never scales.
  const box = new THREE.BoxGeometry(sizeM.lengthM, sizeM.heightM, sizeM.widthM);
  box.translate(sx, sy, sz);
  return toMeshData(box);
}

/** A vertical cylinder, axis along ship z (up) — which is scene Y (also up), so no rotation is
 * needed. `shipBaseCenter` is the ship-frame (x, y, z) of the cylinder's BASE (bottom), not its
 * center, since fittings are more naturally specified by where they stand on deck. */
export function cylinderMeshData(
  params: { radiusTopM: number; radiusBottomM: number; heightM: number; radialSegments?: number },
  shipBaseCenter: [number, number, number],
  geometry: ParticularsSource
): MeshData {
  const cylinder = new THREE.CylinderGeometry(
    params.radiusTopM,
    params.radiusBottomM,
    params.heightM,
    params.radialSegments ?? 12
  );
  cylinder.translate(0, params.heightM / 2, 0); // local origin -> base, not center
  const [sx, sy, sz] = shipToScene(geometry, shipBaseCenter);
  cylinder.translate(sx, sy, sz);
  return toMeshData(cylinder);
}

function toMeshData(geometry: THREE.BufferGeometry): MeshData {
  const indexAttr = geometry.getIndex();
  if (!indexAttr) throw new Error("toMeshData: geometry has no index");
  const index = indexAttr.array instanceof Uint32Array ? indexAttr.array : Uint32Array.from(indexAttr.array);
  return {
    positions: geometry.getAttribute("position").array as Float32Array,
    normals: geometry.getAttribute("normal").array as Float32Array,
    index,
  };
}
