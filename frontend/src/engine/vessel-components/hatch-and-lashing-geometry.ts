// Hatch covers and lashing bridges are NOT stored on VesselGeometry.components — they're
// auto-generated from the vessel's own bay layout (one hatch cover per 40' bay), so onboarding
// a new container vessel never means placing dozens of these by hand.
import type { Vessel } from "@/types/domain";
import type { VesselGeometry } from "@/types/vessel-geometry";
import type { MeshData } from "@/engine/mesh-data";
import { boxMeshData } from "./primitive-mesh";
import { mergeMeshData } from "./merge-mesh-data";
import { bayCenterX } from "@/lib/geometry";

const FORTY_FOOT_LENGTH_M = 12.192; // ISO 6346, matches lib/geometry.ts DIM.len40
const HATCH_COVER_HEIGHT_M = 0.6; // matches lib/geometry.ts LAYOUT.hatchHeight
const DECK_FITTING_WIDTH_FRACTION = 0.85; // fraction of beam, leaving coaming margin
const LASHING_BRIDGE_HEIGHT_ABOVE_DECK_M = 8;
const LASHING_BRIDGE_THICKNESS_M = 0.3;
const LASHING_BRIDGE_HEIGHT_M = 1.5;
const LASHING_BRIDGE_EVERY_N_BAYS = 3;

function bayXShipFrame(vessel: Vessel, bay: number, geometry: VesselGeometry): number {
  return bayCenterX(vessel, bay) + geometry.particulars.lbp_m / 2;
}

/** One flat box per 40' bay, at deck level, spanning most of the beam. */
export function buildHatchCoversMesh(vessel: Vessel, geometry: VesselGeometry): MeshData {
  const deckZ = geometry.particulars.depth_m;
  const covers = vessel.bays.map((bay) =>
    boxMeshData(
      { lengthM: FORTY_FOOT_LENGTH_M, widthM: vessel.beam_m * DECK_FITTING_WIDTH_FRACTION, heightM: HATCH_COVER_HEIGHT_M },
      [bayXShipFrame(vessel, bay, geometry), 0, deckZ + HATCH_COVER_HEIGHT_M / 2],
      geometry
    )
  );
  return mergeMeshData(covers);
}

/** Thin full-beam panels above deck every few bays, standing in for lashing bridges — not a
 * structural model, just enough visual detail to read as "on-deck stacks are lashed". */
export function buildLashingBridgesMesh(vessel: Vessel, geometry: VesselGeometry): MeshData | null {
  const deckZ = geometry.particulars.depth_m;
  const bridgeBays = vessel.bays.filter((_, i) => i % LASHING_BRIDGE_EVERY_N_BAYS === 1);
  if (bridgeBays.length === 0) return null;
  const bridges = bridgeBays.map((bay) =>
    boxMeshData(
      { lengthM: LASHING_BRIDGE_THICKNESS_M, widthM: vessel.beam_m * DECK_FITTING_WIDTH_FRACTION, heightM: LASHING_BRIDGE_HEIGHT_M },
      [bayXShipFrame(vessel, bay, geometry), 0, deckZ + LASHING_BRIDGE_HEIGHT_ABOVE_DECK_M],
      geometry
    )
  );
  return mergeMeshData(bridges);
}
