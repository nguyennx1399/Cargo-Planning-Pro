import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { Container, Placement, Vessel } from "@/types/domain";
import { generateDemoCargo } from "@/data/demo-cargo-generator";
import { buildDemoVessel } from "@/data/demo-container-vessel";
import { validatePlan } from "../validate-plan";
import { at, box, makePlan, makeTestVessel } from "./test-vessel-fixture";

describe("validatePlan", () => {
  const vessel = makeTestVessel();

  it("computes KPIs from placements", () => {
    const boxes = [box("A"), box("B", { size: "20" }), box("C")];
    const report = validatePlan(vessel, makePlan(boxes, [at("A", 2, 2, 2), at("B", 5, 2, 2)]));
    expect(report.ok).toBe(true);
    expect(report.kpis).toMatchObject({
      placed: 2, unplaced: 1, teu_placed: 3, teu_capacity: 32, utilisation_pct: 9.4, errors: 0, warnings: 0,
    });
  });

  it("flags placements of unknown containers", () => {
    const report = validatePlan(vessel, makePlan([], [at("GHOST", 2, 2, 2)]));
    expect(report.ok).toBe(false);
    expect(report.violations[0].rule).toBe("unknown_container");
  });

  it("lists errors before warnings", () => {
    const boxes = [box("L", { pod: "SGSIN" }), box("U", { pod: "MYPKG" }), box("X")];
    const report = validatePlan(vessel, makePlan(boxes, [at("L", 2, 2, 2), at("U", 2, 2, 4), at("X", 1, 1, 2)]));
    expect(report.violations.map((v) => v.severity)).toEqual(["error", "warning"]);
    expect(report.kpis.overstows).toBe(1);
  });
});

/** Fill stacks bottom-up ignoring most rules: 40' boxes first, then 20' pairs. Only used for timing. */
function naiveFill(vessel: Vessel, containers: Container[]): Placement[] {
  const forties = containers.filter((c) => c.size !== "20");
  const twenties = containers.filter((c) => c.size === "20");
  const out: Placement[] = [];
  for (const s of vessel.stacks) {
    for (const tier of s.tiers) {
      if (forties.length) out.push(at(forties.pop()!.id, s.bay, s.row, tier));
      else if (twenties.length >= 2) out.push(at(twenties.pop()!.id, s.bay - 1, s.row, tier), at(twenties.pop()!.id, s.bay + 1, s.row, tier));
    }
  }
  return out;
}

describe("validatePlan on the full demo ship", () => {
  it("validates ~870 boxes quickly with no structural errors", () => {
    const vessel = buildDemoVessel();
    const cargo = generateDemoCargo(42);
    const plan = makePlan(cargo, naiveFill(vessel, cargo));

    validatePlan(vessel, plan); // warm-up (JIT)
    const t0 = performance.now();
    const report = validatePlan(vessel, plan);
    const ms = performance.now() - t0;
    console.info(`validatePlan: ${plan.placements.length} placements in ${ms.toFixed(2)} ms`);

    expect(report.kpis.placed).toBe(cargo.length);
    const structural = report.violations.filter((v) => ["slot_exists", "size_fits_bay", "cell_conflict", "no_floating"].includes(v.rule));
    expect(structural).toEqual([]);
    expect(ms).toBeLessThan(50); // target is ~5 ms; loose bound keeps CI stable
  });
});

describe("engine purity (RT-8)", () => {
  it("imports no UI framework modules", () => {
    const dir = fileURLToPath(new URL("..", import.meta.url));
    const sources = readdirSync(dir).filter((f) => f.endsWith(".ts"));
    expect(sources.length).toBeGreaterThan(0);
    for (const file of sources) {
      const text = readFileSync(`${dir}/${file}`, "utf8");
      expect(text, file).not.toMatch(/from\s+["'](react|react-dom|three|zustand|@react-three\/[^"']+|@tanstack\/[^"']+)["']/);
    }
  });
});

describe("edge case: empty plan", () => {
  it("handles empty plan without division by zero", () => {
    const report = validatePlan(makeTestVessel(), makePlan([], []));
    expect(report.ok).toBe(true);
    expect(report.kpis.placed).toBe(0);
    expect(report.kpis.unplaced).toBe(0);
    expect(report.kpis.teu_placed).toBe(0);
    expect(report.kpis.teu_capacity).toBeGreaterThan(0);
    expect(report.kpis.utilisation_pct).toBe(0);
    expect(report.kpis.errors).toBe(0);
    expect(report.kpis.warnings).toBe(0);
  });

  it("handles single unplaced container", () => {
    const boxes = [box("A")];
    const report = validatePlan(makeTestVessel(), makePlan(boxes, []));
    expect(report.kpis.placed).toBe(0);
    expect(report.kpis.unplaced).toBe(1);
  });
});

describe("edge case: unknown container handling", () => {
  it("reports unknown container in placement list", () => {
    const report = validatePlan(makeTestVessel(), makePlan([], [at("NONEXISTENT", 2, 2, 2)]));
    expect(report.ok).toBe(false);
    const violation = report.violations.find((v) => v.rule === "unknown_container");
    expect(violation).toBeDefined();
    expect(violation?.severity).toBe("error");
  });

  it("lists unknown container errors before other violations", () => {
    const boxes = [box("A")];
    const report = validatePlan(makeTestVessel(), makePlan(boxes, [at("GHOST", 2, 2, 2)]));
    expect(report.violations[0].rule).toBe("unknown_container");
  });
});

describe("edge case: mixed deck levels in single stack", () => {
  it("allows boxes on both under-deck and on-deck in the same bay/row", () => {
    const boxes = [box("U"), box("O")];
    const placements = [at("U", 2, 2, 2), at("O", 2, 2, 82)];
    const report = validatePlan(makeTestVessel(), makePlan(boxes, placements));
    // Should be valid unless there's a floating rule between decks
    expect(report.ok).toBe(true);
  });
});

describe("edge case: KPI calculations with mixed sizes", () => {
  it("calculates teu correctly for mixed 40' and 20'", () => {
    const boxes = [box("A"), box("B", { size: "20" }), box("C", { size: "20" })];
    const placements = [at("A", 2, 2, 2), at("B", 1, 2, 2), at("C", 3, 2, 2)];
    const report = validatePlan(makeTestVessel(), makePlan(boxes, placements));
    expect(report.kpis.teu_placed).toBe(4); // 40' = 2 TEU, 20' = 1 TEU each
  });
});

describe("edge case: deterministic violation reporting", () => {
  it("always reports violations in the same order", () => {
    const boxes = [box("A"), box("B"), box("C")];
    const placements = [at("A", 1, 1, 82), at("B", 2, 2, 2), at("C", 10, 2, 2)];
    const report1 = validatePlan(makeTestVessel(), makePlan(boxes, placements));
    const report2 = validatePlan(makeTestVessel(), makePlan(boxes, placements));
    expect(report1.violations.map((v) => v.rule)).toEqual(report2.violations.map((v) => v.rule));
  });
});
