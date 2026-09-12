import type { BreakbulkCategory, BreakbulkCargo } from "@/types/domain";

/** DEMO reference dimensions/weights — approximate figures typical of current offshore wind
 * turbine components and mid-size yachts, NOT a real manufacturer's catalogue. `kg_above_base_m`
 * is NOT always height_m/2: a nacelle's machinery sits low and dense, so its own center of
 * gravity is below its geometric mid-height; a blade is closer to uniform. */
type CatalogEntry = Omit<BreakbulkCargo, "id" | "pol" | "pod">;

export const BREAKBULK_CATALOG: Record<BreakbulkCategory, CatalogEntry[]> = {
  wind_turbine_blade: [
    { category: "wind_turbine_blade", length_m: 62, width_m: 4.5, height_m: 3.5, weight_t: 22, kg_above_base_m: 1.7 },
    { category: "wind_turbine_blade", length_m: 85, width_m: 5, height_m: 4, weight_t: 33, kg_above_base_m: 2.0 },
  ],
  wind_turbine_nacelle: [
    { category: "wind_turbine_nacelle", length_m: 12, width_m: 4, height_m: 4.5, weight_t: 95, kg_above_base_m: 1.6 },
  ],
  wind_turbine_tower: [
    { category: "wind_turbine_tower", length_m: 24, width_m: 5.5, height_m: 5.5, weight_t: 110, kg_above_base_m: 2.75 },
    { category: "wind_turbine_tower", length_m: 28, width_m: 5, height_m: 5, weight_t: 130, kg_above_base_m: 2.5 },
  ],
  yacht: [
    { category: "yacht", length_m: 18, width_m: 5, height_m: 5, weight_t: 28, kg_above_base_m: 2.3 },
    { category: "yacht", length_m: 30, width_m: 6.5, height_m: 7, weight_t: 95, kg_above_base_m: 3.2 },
  ],
};
