/**
 * VesselStowageSpec — the REAL stowage particulars of a vessel, as a planner reads them from the
 * vessel's spec sheet / GA drawing / hatch & hold description: cargo spaces (hatch covers,
 * tweendeck pontoons, tank tops) with their dimensions, clear heights and rated loads, fixed
 * obstructions, and cranes with their load chart.
 *
 * This is the source of truth for cargo planning. It is deliberately independent of the 3D model
 * (VesselGeometry / GLB): the 3D model is a visual approximation and must CONSUME this data (see
 * scripts/build-bbc-sao-paulo-glb.mjs), never the other way round. One JSON file per vessel under
 * src/data/vessel-specs/ — adding a vessel is adding a file, no code.
 *
 * Conventions: metres, tonnes. x = distance from AP, +forward (so x < 0 is aft of AP). z = +starboard
 * from centreline. Heights above baseline (keel). `null` = not known from any source yet — the
 * validator reports it and the planner simply doesn't use that value/space until it's filled in.
 */

/** A = stated in the vessel's spec, B = scaled/measured from the official drawing,
 *  C = estimated (photo, analogous ship), D = generic assumption. */
export type Confidence = "A" | "B" | "C" | "D";

export interface Provenance {
  /** id of an entry in VesselStowageSpec.sources */
  source: string;
  confidence: Confidence;
  note?: string;
}

export interface SpecSource {
  id: string;
  title: string;
  url?: string;
}

export type CargoSpaceLevel = "weather_deck" | "tweendeck" | "tank_top";

export interface CargoSpace {
  id: string;
  label: string;
  level: CargoSpaceLevel;
  hold?: string;
  /** Longitudinal extent from AP. */
  x_aft_m: number | null;
  x_fwd_m: number | null;
  /** Clear width of the stowage surface, centred on center_z_m (default 0 = centreline). */
  width_m: number | null;
  center_z_m?: number;
  /** Stated floor area, when the spec gives an area rather than (or as well as) dimensions. */
  area_m2?: number | null;
  /** Height of the surface cargo rests on, above baseline. */
  surface_above_baseline_m: number | null;
  /** Max cargo height above that surface (next deck, hatch covers, stowed crane hooks…). */
  clear_height_m: number | null;
  /** Rated uniformly distributed load. */
  max_load_t_per_m2: number | null;
  provenance: Provenance;
  /** Alternative surface heights for movable decks (e.g. tweendeck pontoon positions). When given,
   * surface_above_baseline_m may be null — the planner picks a level. */
  adjustable_levels?: { id: string; surface_above_baseline_m: number; clear_height_m: number }[];
  /** e.g. "folding", "lift-away", "folding / lift-away", "pontoon". */
  cover_type?: string;
  /** Per-field provenance where it differs from the space's own (e.g. length A, position B). */
  field_provenance?: Partial<Record<"x" | "width" | "area" | "surface" | "clear_height" | "load", Provenance>>;
}

export type ObstructionKind = "crane_pedestal" | "superstructure" | "lifeboat" | "hatch_coaming" | "other";

/** Fixed structure cargo must not overlap, on the given levels. */
export interface Obstruction {
  id: string;
  label: string;
  kind: ObstructionKind;
  x_aft_m: number;
  x_fwd_m: number;
  z_min_m: number;
  z_max_m: number;
  levels: CargoSpaceLevel[];
  provenance: Provenance;
}

export interface LoadChartPoint {
  swl_t: number;
  radius_min_m: number;
  radius_max_m: number;
}

export interface CraneSpec {
  id: string;
  label: string;
  maker?: string;
  side: "port" | "starboard" | "centreline";
  /** Slewing centre. */
  x_m: number | null;
  z_m: number | null;
  swl_t: number;
  tandem_swl_t?: number;
  /** Tandem-lift details, e.g. spreader length and outreach from ship side. */
  tandem?: { spreader_m?: number; outreach_from_side_m?: number };
  load_chart: LoadChartPoint[];
  provenance: Provenance;
}

export interface VesselParticularsSpec {
  loa_m: number;
  lbp_m: number;
  beam_m: number;
  depth_m: number;
  summer_draft_m: number;
  dwt_t?: number;
  gt?: number;
  nt?: number;
  max_height_above_keel_m?: number;
  /** Distance from the aft end of the hull (LOA) forward to AP — fixes where LOA sits on the AP axis. */
  aft_end_to_ap_m?: number;
  /** Top of the side shell / bulwark above keel (may differ from depth_m, which is to the main deck). */
  side_shell_top_above_keel_m?: number;
  open_hatch_draft_m?: number;
  open_hatch_dwt_t?: number;
}

export type StackLevel = "weather_deck" | "tweendeck" | "tank_top";

export interface ContainerSpec {
  nominal_teu: number;
  reefer_plugs?: string;
  /** Max stack weights per 20'/40' stack. */
  stack_weights: { level: StackLevel; t20: number; t40: number }[];
  /** Bay/row/tier layout. Absent = the vessel can't take containers in the app yet. */
  stowage?: ContainerStowageSpec;
}

/** One stack group of a 40' bay: the row ids that exist (ISO numbering: 00 centre, odd = starboard,
 * even = port) and how many tiers high, resting on a cargo space's surface. */
export interface ContainerBayDeck {
  rows: number[];
  tiers: number;
  /** Cargo space the stack rests on — its surface height, clear height and level (for stack weights). */
  space_id: string;
}

export interface ContainerBaySpec {
  /** 40' bay number (even). */
  bay: number;
  /** Bay centre, m from AP. */
  x_center_m: number;
  on_deck?: ContainerBayDeck;
  under_deck?: ContainerBayDeck;
}

export interface ContainerStowageSpec {
  /** Every row id used on deck / under deck, port → starboard (fixes each row's transverse position). */
  rows_on_deck: number[];
  rows_under_deck: number[];
  /** Transverse distance between row centres. */
  row_pitch_m: number;
  bays: ContainerBaySpec[];
  /** 20'-only stacks the drawing shows that no 40' bay covers (not planned yet — the app is 40' only). */
  twenty_foot_only?: { bay: number; deck: "on" | "under"; rows: number; tiers: number; note?: string }[];
  /** Stacks with reefer sockets. */
  reefer?: { bays: number[]; deck: "on" | "under"; tiers: number[] };
  provenance: Provenance;
}

export interface CapacitySpec {
  hold_capacity_m3?: number;
  floor_area_under_deck_m2?: number;
  floor_area_on_deck_m2?: number;
}

export interface VesselStowageSpec {
  schema_version: 1;
  vessel_id: string;
  name: string;
  imo: string | null;
  design?: string;
  vessel_type?: string;
  particulars: VesselParticularsSpec;
  particulars_provenance: Provenance;
  cargo_spaces: CargoSpace[];
  obstructions: Obstruction[];
  cranes: CraneSpec[];
  containers?: ContainerSpec;
  capacity?: CapacitySpec;
  /** Free-text facts that don't fit the structured fields (tandem lift, stowage notes…). */
  notes?: string[];
  sources: SpecSource[];
}
