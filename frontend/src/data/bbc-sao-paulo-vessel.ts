/**
 * BBC SAO PAULO — a real multipurpose heavy-lift project-cargo carrier. Everything that affects
 * cargo planning (particulars, hatch covers, clear heights, rated loads, crane pedestals, cranes,
 * container bays/rows/tiers)
 * comes from its stowage spec, `vessel-specs/bbc-sao-paulo.stowage.json`, built generically by
 * buildVesselFromSpec — NOT from the 3D model. The GLB (geometry_id) is only the visual, and its
 * generator reads the same JSON so the picture follows the data.
 */
import type { Container, Vessel } from "@/types/domain";
import { BBC_SAO_PAULO_GEOMETRY_ID } from "./bbc-sao-paulo-geometry";
import { getVesselSpec } from "./vessel-specs";
import { buildVesselFromSpec } from "./vessel-from-spec";
import { generateDemoCargo } from "./demo-cargo-generator";

export const BBC_SAO_PAULO_VESSEL_ID = "bbc-sao-paulo";

export function buildBbcSaoPauloVessel(): Vessel {
  const loaded = getVesselSpec(BBC_SAO_PAULO_VESSEL_ID);
  if (!loaded) throw new Error(`No stowage spec registered for ${BBC_SAO_PAULO_VESSEL_ID}`);
  return buildVesselFromSpec(loaded.spec, { geometry_id: BBC_SAO_PAULO_GEOMETRY_ID });
}

/** A part container load (demo data): ~110 FEU fills the aft bays and leaves the forward hatch
 * covers and holds for project cargo; the 20' boxes stay unplaced because the app only plans 40'
 * bays so far (BBC SAO PAULO's 20'-only stacks are listed in its spec). */
export function buildBbcSaoPauloVesselAndCargo(): { vessel: Vessel; containers: Container[] } {
  return { vessel: buildBbcSaoPauloVessel(), containers: generateDemoCargo(7, { forties: 110, twenties: 20 }) };
}
