/** Bundled VesselGeometry catalog for the frontend-only demo. TODO(phase-5): replace with a
 * fetched/tenant-scoped catalog once geometries are persisted server-side. */
import type { VesselGeometry } from "@/types/vessel-geometry";
import { buildDemoHorizonGeometry, DEMO_HORIZON_GEOMETRY_ID } from "./demo-horizon-geometry";

const CATALOG: Record<string, () => VesselGeometry> = {
  [DEMO_HORIZON_GEOMETRY_ID]: buildDemoHorizonGeometry,
};

// Built geometries are cached by id so callers get the SAME object reference on every call —
// buildDemoHorizonGeometry() reruns a 40-iteration Cb-fit bisection, and downstream useMemo
// hooks (e.g. use-indicative-stability.ts) key off this reference to skip recomputing the
// hydrostatic table on every render.
const builtCache = new Map<string, VesselGeometry>();

export function getVesselGeometry(id: string): VesselGeometry | undefined {
  if (!builtCache.has(id)) {
    const build = CATALOG[id];
    if (!build) return undefined;
    builtCache.set(id, build());
  }
  return builtCache.get(id);
}
