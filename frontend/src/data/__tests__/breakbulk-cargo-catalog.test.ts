import { describe, expect, it } from "vitest";
import { BREAKBULK_CATALOG } from "../breakbulk-cargo-catalog";

describe("BREAKBULK_CATALOG", () => {
  it("has at least 2 variants for every category except nacelle (1 is enough)", () => {
    expect(BREAKBULK_CATALOG.wind_turbine_blade.length).toBeGreaterThanOrEqual(2);
    expect(BREAKBULK_CATALOG.wind_turbine_tower.length).toBeGreaterThanOrEqual(2);
    expect(BREAKBULK_CATALOG.yacht.length).toBeGreaterThanOrEqual(2);
    expect(BREAKBULK_CATALOG.wind_turbine_nacelle.length).toBeGreaterThanOrEqual(1);
  });

  it("every entry's category field matches its own catalog key", () => {
    for (const [category, entries] of Object.entries(BREAKBULK_CATALOG)) {
      for (const entry of entries) expect(entry.category).toBe(category);
    }
  });

  it("every entry has positive dimensions/weight and a sane kg_above_base_m", () => {
    for (const entries of Object.values(BREAKBULK_CATALOG)) {
      for (const entry of entries) {
        expect(entry.length_m).toBeGreaterThan(0);
        expect(entry.width_m).toBeGreaterThan(0);
        expect(entry.height_m).toBeGreaterThan(0);
        expect(entry.weight_t).toBeGreaterThan(0);
        expect(entry.kg_above_base_m).toBeGreaterThan(0);
        expect(entry.kg_above_base_m).toBeLessThanOrEqual(entry.height_m);
      }
    }
  });

  it("nacelle's KG sits below its geometric mid-height (dense machinery low in the housing)", () => {
    const nacelle = BREAKBULK_CATALOG.wind_turbine_nacelle[0];
    expect(nacelle.kg_above_base_m).toBeLessThan(nacelle.height_m / 2);
  });
});
