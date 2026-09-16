/**
 * VesselGeometry for BBC SAO PAULO — a real multipurpose heavy-lift vessel. Hull is
 * `source: "mesh"`: unlike the demo vessel's `source: "parametric"` hull, this ship's exterior
 * comes from a pre-baked GLB (per the "BBC SAO PAULO — 3D Model Production Plan" Confluence page),
 * not numeric offsets — so there is no `offsets` field and no computed hydrostatic table
 * (use-indicative-stability.ts's `!geometry?.hull.offsets` check makes the stability panel go
 * inert for this vessel, matching that plan's own "not for stability/cargo-planning use" scope
 * statement).
 *
 * `mesh_uri` points at a procedurally generated GLB — `scripts/build-bbc-sao-paulo-glb.mjs`
 * (`npm run build:bbc-glb`), dependency-free and reproducible. Particulars, hatch covers and
 * cranes are read from the stowage spec `vessel-specs/bbc-sao-paulo.stowage.json` (Confluence
 * Section 0: LOA/LBP/beam/depth/draft/max height, 2× Liebherr cranes on the port side at 36.1 m
 * spacing, six hatch sections 30.1/15.8/26.1/15.8/30.2/6.9 m); shapes no spec gives
 * are matched to a photo of the real ship (confidence C/D, tagged per node in glTF `extras`):
 * lofted hull with raked stem + small bulb and transom stern, raised forecastle with the white
 * accommodation/bridge and full-beam bridge wings at the BOW, lattice mast topping out at 42.2 m,
 * rigged cranes (crane_0N_rotating_house / _boom pivots, stowed aft), starboard lifeboat, two rows of
 * hull side openings, blue hull over red antifouling. Node tree follows Phase 8 of that plan.
 * Authoring frame is unchanged (x: AP=0->FP=lbp_m, y: keel=0 up, z: +starboard, transom at
 * lbp_m - loa_m), which is what `GltfHull` (viewer3d/Hull.tsx) offsets for. Still a visual
 * approximation, not the Blender asset of Phases 1-21 — dropping that in at the same path needs
 * no code change.
 */
import type { ComponentSpec, MainParticulars, VesselGeometry } from "@/types/vessel-geometry";
import { getVesselSpec } from "./vessel-specs";

export const BBC_SAO_PAULO_GEOMETRY_ID = "bbc-sao-paulo-v1";

// Principal dimensions come from the vessel's stowage spec (the planning source of truth, Section 0
// of the Confluence page, confidence A) — the 3D geometry reads them, it doesn't define them.
const SPEC = getVesselSpec("bbc-sao-paulo")!.spec.particulars;
const PARTICULARS: MainParticulars = {
  loa_m: SPEC.loa_m,
  lbp_m: SPEC.lbp_m,
  aft_overhang_m: SPEC.loa_m - SPEC.lbp_m, // LOA - LBP as a placeholder split; not a cited value (confidence D)
  beam_m: SPEC.beam_m,
  depth_m: SPEC.depth_m,
  design_draft_m: SPEC.summer_draft_m,
  // Not stated in any source (no lines plan exists for this vessel) — generic full-form estimate
  // for a heavy-lift MPP hull. Confidence D: no computed hydrostatics rely on this (hull.offsets
  // is absent), so it's cosmetically inert today.
  cb: 0.75,
};

// No ComponentSpec entries: a mesh-sourced hull's superstructure/cranes/etc. are baked into the
// GLB itself (merge-static-components.ts's procedural component builders are LoftedHull-only).
const COMPONENTS: ComponentSpec[] = [];

export function buildBbcSaoPauloGeometry(): VesselGeometry {
  return {
    schema_version: 1,
    id: BBC_SAO_PAULO_GEOMETRY_ID,
    version: 1,
    design_name: "BBC SAO PAULO",
    data_status: "assumed",
    particulars: PARTICULARS,
    frames: [{ from_frame: 0, to_frame: 200, spacing_m: PARTICULARS.lbp_m / 200 }],
    hull: { source: "mesh", mesh_uri: "/vessels/bbc-sao-paulo/bbc_sao_paulo_lod0.glb" },
    components: COMPONENTS,
    livery: {
      // Stated colors (confidence A/C — see source page); a real GLB carries its own baked
      // materials, so this is mostly inert until/unless a livery_override ever needs a fallback.
      topside_color: "#2C6FD4",
      antifouling_color: "#9A2F26",
      boot_top_color: "#1A1A1A",
      boot_top_low_z_m: PARTICULARS.design_draft_m - 0.3,
      boot_top_high_z_m: PARTICULARS.design_draft_m + 0.5,
      superstructure_color: "#F5F7F9",
    },
    provenance: {
      source_docs: ["confluence:BBC SAO PAULO — 3D Model Production Plan (Three.js Visual Digital Twin)"],
      notes:
        "Visual exterior approximation only, per the source plan's own scope statement — not for " +
        "construction, stability analysis, cargo planning, navigation, class approval, or fabrication.",
    },
  };
}
