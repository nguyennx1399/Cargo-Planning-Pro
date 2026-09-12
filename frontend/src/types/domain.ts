// Mirrors backend/app/domain/models.py.
// TODO(phase-2): generate from OpenAPI with `openapi-typescript` instead of hand-writing.
import type { Livery } from "./vessel-geometry";

export type DeckLevel = "under" | "on";

export interface StackSpec {
  bay: number;
  row: number;
  deck: DeckLevel;
  tiers: number[];
  max_weight_t: number;
  max_height_m: number | null;
  reefer_tiers: number[];
}

export interface Vessel {
  id: string;
  name: string;
  imo: string | null;
  length_m: number;
  beam_m: number;
  bays: number[]; // bow -> stern
  rows: number[]; // port -> starboard
  stacks: StackSpec[];
  /** Links to the hull/livery/components document (vessel-3d-model-pipeline). Absent = no
   * geometry yet, viewer falls back to its own simplified hull. */
  geometry_id?: string;
  livery_override?: Partial<Livery>;
}

export type ContainerSize = "20" | "40" | "45";
export type ContainerType = "DRY" | "REEFER" | "OPEN_TOP" | "FLAT_RACK" | "TANK";

export interface Container {
  id: string;
  size: ContainerSize;
  type: ContainerType;
  high_cube: boolean;
  weight_t: number;
  pol: string;
  pod: string;
  imdg_class: string | null;
  oog: boolean;
}

export interface PortCall {
  locode: string;
  name: string;
  sequence: number;
  eta: string | null;
  etd: string | null;
}

export interface Slot {
  bay: number;
  row: number;
  tier: number;
}

export interface Placement {
  container_id: string;
  slot: Slot;
}

/** Project/breakbulk cargo: not container-shaped, doesn't fit the bay/row/tier slot grid.
 * Sits on deck at a free (x, z) footprint instead. See plans/260912-0117-cargo-type-catalog-breakbulk. */
export type BreakbulkCategory = "wind_turbine_blade" | "wind_turbine_nacelle" | "wind_turbine_tower" | "yacht";

export interface BreakbulkCargo {
  id: string;
  category: BreakbulkCategory;
  length_m: number; // ship-frame x extent
  width_m: number; // ship-frame y extent (beam-wise)
  height_m: number; // from its resting base up to its top
  weight_t: number;
  kg_above_base_m: number; // center of gravity above its own resting base — NOT always height_m/2
  pol: string;
  pod: string;
}

/** IMPORTANT — x_m is NOT the AP-referenced ship-frame x that lib/ship-frame.ts's
 * shipToScene/sceneToShip use (that one is anchored to geometry.particulars.lbp_m and requires a
 * VesselGeometry). x_m uses the SAME convention lib/geometry.ts's bayCenterX fallback uses for
 * container rendering: symmetric about vessel.length_m/2 (bow +x), so it works for any vessel
 * without needing VesselGeometry — matching this whole subsystem's deliberate choice (see
 * plan.md) to not require geometry_id. Code that needs TRUE ship-frame (stability's WeightItem)
 * must convert: sceneX = x_m - vessel.length_m/2, then shipFrameX = sceneX + geometry.particulars.lbp_m/2
 * (see lib/breakbulk-weight-item.ts) — do not pass x_m/z_m into shipToScene directly, they use a
 * different origin and this was a real bug once (see phase-03 plan's Deviations). */
export interface BreakbulkPlacement {
  cargo_id: string;
  x_m: number; // vessel.length_m/2-symmetric x of the footprint CENTER, +bow (see comment above)
  z_m: number; // transverse position of the footprint CENTER, +starboard (no LOA/LBP ambiguity here)
  rotation_deg: number; // 0 = length_m runs along x (fore-aft); 90 = swapped
}

export interface StowagePlan {
  id: string;
  vessel_id: string;
  voyage: string;
  ports: PortCall[];
  containers: Container[];
  placements: Placement[];
  unplaced: string[];
  breakbulk_cargo: BreakbulkCargo[];
  breakbulk_placements: BreakbulkPlacement[];
}

export type Severity = "error" | "warning";

export interface Violation {
  rule: string;
  severity: Severity;
  message: string;
  container_ids: string[];
  slots: string[];
}

export interface ValidationReport {
  ok: boolean;
  violations: Violation[];
  kpis: Record<string, number>;
}
