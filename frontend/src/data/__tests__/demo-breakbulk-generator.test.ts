import { describe, expect, it } from "vitest";
import { generateDemoBreakbulkCargo } from "../demo-breakbulk-generator";

describe("generateDemoBreakbulkCargo", () => {
  it("returns a non-empty list with unique ids", () => {
    const items = generateDemoBreakbulkCargo();
    expect(items.length).toBeGreaterThan(0);
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
  });

  it("includes every breakbulk category at least once", () => {
    const categories = new Set(generateDemoBreakbulkCargo().map((i) => i.category));
    expect(categories).toEqual(new Set(["wind_turbine_blade", "wind_turbine_nacelle", "wind_turbine_tower", "yacht"]));
  });

  it("total weight is in a plausible demo range (not near-zero, not absurd)", () => {
    const total = generateDemoBreakbulkCargo().reduce((sum, i) => sum + i.weight_t, 0);
    expect(total).toBeGreaterThan(500);
    expect(total).toBeLessThan(5000);
  });

  it("is deterministic across calls", () => {
    expect(generateDemoBreakbulkCargo()).toEqual(generateDemoBreakbulkCargo());
  });
});
