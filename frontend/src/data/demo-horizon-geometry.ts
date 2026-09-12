/**
 * VesselGeometry for "MV Demo Horizon" — SYNTHETIC data, no real ship.
 * Hull is `source: "parametric"`; offsets are generated once here and cached on the document
 * (phase 2's `generateParametricOffsets`, fitted to `particulars.cb`).
 */
import type { ComponentSpec, MainParticulars, ParametricHullParams, VesselGeometry } from "@/types/vessel-geometry";
import { generateParametricOffsets } from "@/engine/hull/parametric-hull-generator";

export const DEMO_HORIZON_GEOMETRY_ID = "demo-horizon-v1";

const PARTICULARS: MainParticulars = {
  loa_m: 172,
  lbp_m: 160,
  aft_overhang_m: 6,
  beam_m: 27.4,
  depth_m: 14,
  design_draft_m: 9.8,
  // KNOWN ISSUE (found while building ship-attitude stability calc): with the wide parallel
  // midbody below ([0.1, 0.9], needed so bays 2/38 don't poke through the hull), the Cb-fit
  // bisection saturates around 0.86 no matter the target — 80% of the length is already at
  // full beam by construction, so no taper power can bring Cb down to a realistic ~0.68.
  // This value reflects what the generator ACTUALLY produces (verified: blockCoefficient at
  // design draft = 0.8646), not a target — a stated-but-false 0.68 would be worse than an
  // honest 0.86. Real fix: narrow parallel_midbody back down and drop the outermost under-deck
  // row at bays 2/38 instead (the plan's original fallback option), which needs touching
  // demo-container-vessel.ts (P1-demo's file) — out of scope for the plan that found this.
  cb: 0.86,
};

const HULL_PARAMS: ParametricHullParams = {
  bow: "bulbous",
  stern: "cruiser",
  // Wide parallel midbody: the demo vessel's outermost under-deck rows sit only ~17-23 m from
  // the bow/stern (bays 2 and 38), so the hull needs to carry most of its beam out that far —
  // see slots-inside-hull-check.test.ts, which locks this in against the demo's own layout.
  parallel_midbody: [0.1, 0.9],
  bulb: { length_m: 3, breadth_m: 3, height_m: 2.5 },
};

// Accommodation block near the stern (typical feeder layout), funnel and a mast on its roof,
// a bow mast, and two lifeboats. No crane — a pure container feeder doesn't carry one; the
// crane builder still exists (crane-geometry.ts) for the MPP vessel demo later.
const DECKHOUSE_TIERS = 4;
const DECKHOUSE_TIER_HEIGHT_M = 3;
const DECKHOUSE_ROOF_Z_M = PARTICULARS.depth_m + DECKHOUSE_TIERS * DECKHOUSE_TIER_HEIGHT_M;
const FUNNEL_HEIGHT_M = 6;

const COMPONENTS: ComponentSpec[] = [
  { kind: "superstructure", x_aft_m: 8, x_fwd_m: 20, width_m: 22, tiers: DECKHOUSE_TIERS, tier_height_m: DECKHOUSE_TIER_HEIGHT_M },
  { kind: "funnel", x_m: 14, y_m: 0, base_z_m: DECKHOUSE_ROOF_Z_M, height_m: FUNNEL_HEIGHT_M, length_m: 4, width_m: 6 },
  { kind: "mast", x_m: 14, y_m: 0, base_z_m: DECKHOUSE_ROOF_Z_M + FUNNEL_HEIGHT_M, height_m: 8 },
  { kind: "mast", x_m: 150, y_m: 0, base_z_m: PARTICULARS.depth_m, height_m: 12 },
  { kind: "lifeboat", x_m: 16, y_m: 12, z_m: DECKHOUSE_ROOF_Z_M, freefall: false },
  { kind: "lifeboat", x_m: 16, y_m: -12, z_m: DECKHOUSE_ROOF_Z_M, freefall: false },
];

export function buildDemoHorizonGeometry(): VesselGeometry {
  return {
    schema_version: 1,
    id: DEMO_HORIZON_GEOMETRY_ID,
    version: 1,
    design_name: "MV Demo Horizon",
    data_status: "synthetic",
    particulars: PARTICULARS,
    // Single 0.8 m segment over the full LBP (200 frames). TODO(phase-2): real, non-uniform
    // spacing once a reference vessel's frame table is available.
    frames: [{ from_frame: 0, to_frame: 200, spacing_m: 0.8 }],
    hull: {
      source: "parametric",
      params: HULL_PARAMS,
      offsets: generateParametricOffsets(PARTICULARS, HULL_PARAMS),
    },
    components: COMPONENTS,
    livery: {
      topside_color: "#2B4C6F",
      antifouling_color: "#8B1A1A",
      boot_top_color: "#1A1A1A",
      boot_top_low_z_m: 9.5, // ~0.3 m below design draft
      boot_top_high_z_m: 10.3, // ~0.5 m above design draft
      superstructure_color: "#E8ECEF",
    },
    provenance: { source_docs: ["synthetic-demo"], notes: "Frontend-only demo vessel, not a real ship." },
  };
}
