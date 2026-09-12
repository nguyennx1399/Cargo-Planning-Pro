// VesselGeometry: the single hull/livery/components document, independent from the
// slot-grid `Vessel` in domain.ts. See plans/260911-1409-vessel-3d-model-pipeline/phase-01.
// schema_version bumps only on a breaking shape change; add a migrator alongside any bump.

export type GeometryDataStatus = "synthetic" | "assumed" | "computed" | "verified";

/** Non-uniform frame (station) spacing. frame 0 = AP (ship-frame x = 0). Segments must be
 * contiguous and ascending: frames[i+1].from_frame === frames[i].to_frame. */
export interface FrameSegment {
  from_frame: number;
  to_frame: number;
  spacing_m: number;
}

export interface MainParticulars {
  loa_m: number;
  lbp_m: number;
  aft_overhang_m: number; // aft-most point of hull -> AP
  beam_m: number;
  depth_m: number;
  design_draft_m: number;
  cb: number;
}

export interface ParametricHullParams {
  bow: "bulbous" | "conventional";
  stern: "transom" | "cruiser";
  parallel_midbody: [number, number]; // fraction of LBP from AP, e.g. [0.30, 0.62]
  bilge_radius_m?: number;
  bulb?: { length_m: number; breadth_m: number; height_m: number };
}

/** stations_x_m and waterlines_z_m are ship-frame coordinates. half_breadths_m[station][waterline];
 * null = outside the hull at that (station, waterline). */
export interface HullOffsets {
  stations_x_m: number[];
  waterlines_z_m: number[];
  half_breadths_m: (number | null)[][];
  knuckles?: { station: number; waterline: number }[];
  stem_profile?: [number, number][]; // (x, z)
  stern_profile?: [number, number][];
  deck_at_side_z_m?: number[]; // per station; default = depth_m
}

export type HullSpec =
  | { source: "parametric"; params: ParametricHullParams; offsets?: HullOffsets }
  | { source: "offsets"; offsets: HullOffsets }
  | { source: "mesh"; mesh_uri: string; offsets?: HullOffsets };

export type ComponentSpec =
  | {
      kind: "superstructure";
      x_aft_m: number;
      x_fwd_m: number;
      width_m: number;
      tiers: number;
      tier_height_m: number;
      y_center_m?: number;
    }
  | { kind: "funnel"; x_m: number; y_m: number; base_z_m: number; height_m: number; length_m: number; width_m: number }
  | {
      kind: "crane";
      id: string;
      pedestal: [number, number, number];
      pedestal_height_m: number;
      jib_length_m: number;
      swl_t: number;
      outreach_min_m: number;
      outreach_max_m: number;
    }
  | { kind: "mast"; x_m: number; y_m: number; base_z_m: number; height_m: number }
  | { kind: "lifeboat"; x_m: number; y_m: number; z_m: number; freefall: boolean };

export interface Livery {
  topside_color: string;
  antifouling_color: string;
  boot_top_color: string;
  boot_top_low_z_m: number; // light-draft edge of the boot-top band
  boot_top_high_z_m: number; // deep-draft edge
  superstructure_color: string;
  funnel_bands?: { color: string; from_z_m: number; to_z_m: number }[];
  logo_uri?: string;
}

export interface VesselGeometry {
  schema_version: 1;
  id: string;
  version: number;
  design_name: string;
  data_status: GeometryDataStatus;
  particulars: MainParticulars;
  frames: FrameSegment[];
  hull: HullSpec;
  components: ComponentSpec[];
  livery: Livery;
  /** Real per-bay LCG from onboarding (phase 5 bay calibration). Absent = no calibrated
   * data yet; consumers fall back to their own tuned layout. */
  bay_lcg_m?: Record<number, number>;
  provenance: { source_docs: string[]; notes?: string };
}
