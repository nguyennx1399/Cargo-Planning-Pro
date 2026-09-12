// Converts a placed breakbulk item into a WeightItem for the stability calc. BreakbulkPlacement.
// x_m/z_m use the SAME vessel.length_m/2-symmetric convention as lib/geometry.ts's bayCenterX
// fallback (see the doc comment on BreakbulkPlacement in types/domain.ts) — NOT the AP/LBP-
// referenced true ship-frame lib/ship-frame.ts's shipToScene uses, which is what WeightItem's
// lcg_m/tcg_m actually need (to combine correctly with row.lcb_m/mtc_t_m_per_cm from the real
// hydrostatic table). So this does the SAME two-step conversion cargoWeightItem does for
// containers: placement -> scene -> true ship-frame. Do NOT skip the vessel.length_m step and
// treat x_m as already ship-frame — that was a real bug (see phase-03/04 plan Deviations).
import type { BreakbulkCargo, BreakbulkPlacement, Vessel } from "@/types/domain";
import type { VesselGeometry } from "@/types/vessel-geometry";
import type { WeightItem } from "@/engine/stability-indicative";
import { LAYOUT } from "./geometry";

export function breakbulkWeightItem(vessel: Vessel, geometry: VesselGeometry, item: BreakbulkCargo, placement: BreakbulkPlacement): WeightItem {
  const sceneX = placement.x_m - vessel.length_m / 2;
  return {
    weight_t: item.weight_t,
    lcg_m: sceneX + geometry.particulars.lbp_m / 2, // scene -> true ship-frame, same inversion cargoWeightItem uses
    tcg_m: placement.z_m, // no LOA/LBP ambiguity on the transverse axis
    // deck level (depth_m) + LAYOUT.hatchHeight (same on-deck base reference tierCenterY/
    // breakbulk-mesh-builder.ts's deckY use for containers/breakbulk resting surfaces) + the
    // item's own CG above that resting surface. Omitting hatchHeight would understate kg_m by
    // 0.6m relative to what's actually rendered — a smaller instance of the same "dropped
    // reference-frame offset" bug class the x_m/z_m fix above addresses (code-reviewer finding).
    kg_m: geometry.particulars.depth_m + LAYOUT.hatchHeight + item.kg_above_base_m,
  };
}
