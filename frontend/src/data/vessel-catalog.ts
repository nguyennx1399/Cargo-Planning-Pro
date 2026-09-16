/** Registry of selectable vessels for the frontend-only demo (mirrors vessel-geometry-catalog.ts's
 * build-and-cache pattern). Adding a vessel to the app is adding an entry here — everything
 * downstream (Sidebar, VesselScene, BayPlanView, stability) already reads `vessel`/`containers`
 * generically. */
import type { Container, Vessel } from "@/types/domain";
import { buildDemoVesselAndCargo } from "./build-demo-plan";
import { DEMO_VESSEL_ID } from "./demo-container-vessel";
import { buildBbcSaoPauloVesselAndCargo, BBC_SAO_PAULO_VESSEL_ID } from "./bbc-sao-paulo-vessel";

export interface VesselCatalogEntry {
  id: string;
  label: string;
  build: () => { vessel: Vessel; containers: Container[] };
}

export const VESSEL_CATALOG: VesselCatalogEntry[] = [
  { id: BBC_SAO_PAULO_VESSEL_ID, label: "BBC SAO PAULO (heavy-lift, project cargo)", build: buildBbcSaoPauloVesselAndCargo },
  { id: DEMO_VESSEL_ID, label: "MV Demo Horizon (demo container ship)", build: buildDemoVesselAndCargo },
];

/** Vessel selected when the app opens. */
export const DEFAULT_VESSEL_ID = BBC_SAO_PAULO_VESSEL_ID;

// Cached by id, same reasoning as vessel-geometry-catalog.ts's builtCache: stable references so
// downstream useMemo hooks don't see a "new" vessel/containers on every re-render.
const builtCache = new Map<string, { vessel: Vessel; containers: Container[] }>();

export function getVesselCatalogEntry(id: string): { vessel: Vessel; containers: Container[] } {
  if (!builtCache.has(id)) {
    const entry = VESSEL_CATALOG.find((e) => e.id === id);
    if (!entry) throw new Error(`Unknown vessel id: ${id}`);
    builtCache.set(id, entry.build());
  }
  return builtCache.get(id)!;
}
