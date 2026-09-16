// Builds a placeholder mesh for one breakbulk cargo item, positioned in SCENE coordinates
// directly — like ContainerInstances.tsx's slotToPosition, NOT via lib/ship-frame.ts's
// shipToScene. This is deliberate: BreakbulkPlacement.x_m/z_m use the SAME vessel.length_m/2-
// symmetric convention lib/geometry.ts's bayCenterX fallback uses (see the comment on
// BreakbulkPlacement in types/domain.ts), not the AP/LBP-referenced true ship-frame shipToScene
// expects. Passing x_m/z_m into shipToScene was a real bug (see phase-03 plan's Deviations) — it
// rendered breakbulk items up to (vessel.length_m - geometry.particulars.lbp_m)/2 off from where
// naiveFillBreakbulk/onDeckBayZones validated them, risking real visual overlap with containers.
// Kept geometry-free like the rest of the breakbulk subsystem: works for any vessel, no
// VesselGeometry required — placeholder SHAPES for a demo, not accurate models.
import * as THREE from "three";
import type { BreakbulkCargo, BreakbulkPlacement, Vessel } from "@/types/domain";
import type { MeshData } from "@/engine/mesh-data";
import { cargoBaseHeight } from "@/engine/breakbulk-deck-area";

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

function sceneX(vessel: Vessel, xM: number): number {
  return xM - vessel.length_m / 2;
}

/** A cylinder LYING ON ITS SIDE, axis along scene x (fore-aft) — for a tower section transported
 * horizontally. three.js's CylinderGeometry always starts axis-along-local-Y, so this rotates it.
 * KNOWN LIMITATION: only correct for rotation_deg=0 (axis along x). naiveFillBreakbulk (phase 02)
 * never produces rotation_deg=90 today, so this is untested/unsupported for that case — would
 * need a second rotation (about x instead of z) to lay the axis along scene z (beam-wise) instead. */
function towerMeshData(item: BreakbulkCargo, placement: BreakbulkPlacement, vessel: Vessel, deckY: number): MeshData {
  const radius = item.height_m / 2; // catalog stores tower diameter in height_m (see phase-01)
  const cylinder = new THREE.CylinderGeometry(radius * 0.85, radius, item.length_m, 16); // slight taper, top narrower
  cylinder.rotateZ(Math.PI / 2); // swing axis from local Y to local X (scene x)
  cylinder.translate(sceneX(vessel, placement.x_m), deckY + radius, placement.z_m);
  return toMeshData(cylinder);
}

function boxSceneMeshData(lengthM: number, widthM: number, heightM: number, centerScene: [number, number, number]): MeshData {
  const box = new THREE.BoxGeometry(lengthM, heightM, widthM);
  box.translate(...centerScene);
  return toMeshData(box);
}

export function buildBreakbulkMesh(item: BreakbulkCargo, placement: BreakbulkPlacement, vessel: Vessel): MeshData {
  // LAYOUT.hatchHeight (same scene-y deck reference on-deck containers use) unless the vessel
  // declares its real resting surface, e.g. BBC SAO PAULO's 1.55m-high hatch covers.
  // The placement's own stowage area: a hold's tank top is below the main-deck reference (negative).
  const deckY = cargoBaseHeight(vessel, placement.area_id);
  const rotated = placement.rotation_deg === 90;
  const lengthM = rotated ? item.width_m : item.length_m;
  const widthM = rotated ? item.length_m : item.width_m;

  if (item.category === "wind_turbine_tower") return towerMeshData(item, placement, vessel, deckY);

  return boxSceneMeshData(lengthM, widthM, item.height_m, [sceneX(vessel, placement.x_m), deckY + item.height_m / 2, placement.z_m]);
}
