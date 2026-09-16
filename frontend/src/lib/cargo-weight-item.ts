// Converts a placed container into a WeightItem (ship-frame LCG/TCG/KG) for the stability calc,
// from the SAME position functions the 3D viewer already uses (bayCenterX/rowCenterZ/
// tierCenterY) — one source of position for both rendering and physics, no separate lookup.
import type { Container, Slot, Vessel } from "@/types/domain";
import type { VesselGeometry } from "@/types/vessel-geometry";
import type { WeightItem } from "@/engine/stability-indicative";
import { bayCenterX, rowCenterZ, tierCenterY } from "./geometry";

export function cargoWeightItem(vessel: Vessel, geometry: VesselGeometry, container: Container, slot: Slot): WeightItem {
  const sceneX = bayCenterX(vessel, slot.bay, geometry);
  const sceneY = tierCenterY(slot.tier, vessel, slot.bay);
  const sceneZ = rowCenterZ(vessel, slot.row);
  return {
    weight_t: container.weight_t,
    lcg_m: sceneX + geometry.particulars.lbp_m / 2, // inverse of shipToScene: sceneX = shipX - lbp/2
    tcg_m: sceneZ, // shipToScene: sceneZ = shipY directly, no inversion needed
    kg_m: sceneY + geometry.particulars.depth_m, // inverse of shipToScene: sceneY = shipZ - depth
  };
}
