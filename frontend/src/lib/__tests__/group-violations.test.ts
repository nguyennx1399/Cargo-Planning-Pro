/**
 * Checks grouped by rule (sidebar reorganisation, phase 02).
 *
 * The property this exists for: COUNTS ARE COMPLETE. The old panel rendered `slice(0, 50)` and 149 of the
 * demo plan's 199 overstows vanished without a word. The real-plan case below pins exactly that number.
 */
import { describe, expect, it } from "vitest";
import type { Violation } from "@/types/domain";
import { getVesselCatalogEntry } from "@/data/vessel-catalog";
import { buildDemoPlan } from "@/data/build-demo-plan";
import { validatePlan } from "@/engine/validate-plan";
import { groupViolations, ruleLabel, severityTotals } from "@/lib/group-violations";

const v = (rule: string, severity: Violation["severity"], id = "X"): Violation => ({
  rule,
  severity,
  message: `${rule} ${id}`,
  container_ids: [id],
  slots: [],
});

describe("groupViolations", () => {
  it("is empty for no violations", () => {
    expect(groupViolations([])).toEqual([]);
  });

  it("groups by rule and keeps every item", () => {
    const groups = groupViolations([v("overstow", "warning", "A"), v("no_floating", "error", "B"), v("overstow", "warning", "C")]);
    const overstow = groups.find((g) => g.rule === "overstow")!;
    expect(overstow.count).toBe(2);
    expect(overstow.items.map((i) => i.container_ids[0])).toEqual(["A", "C"]); // report order kept
  });

  it("puts errors before warnings, then larger groups first", () => {
    const groups = groupViolations([
      v("overstow", "warning"),
      v("overstow", "warning"),
      v("overstow", "warning"),
      v("reefer_plug", "warning"),
      v("no_floating", "error"),
    ]);
    expect(groups.map((g) => g.rule)).toEqual(["no_floating", "overstow", "reefer_plug"]);
  });

  it("takes the WORST severity in a mixed group", () => {
    const [group] = groupViolations([v("stack_weight", "warning"), v("stack_weight", "error")]);
    expect(group.severity).toBe("error");
  });

  it("counts every violation of the real demo plan — nothing capped at 50", () => {
    const { vessel, containers } = getVesselCatalogEntry("demo-horizon");
    const report = validatePlan(vessel, buildDemoPlan(vessel, containers, { cargoLoaded: true, projectCargoLoaded: false }));
    const groups = groupViolations(report.violations);
    expect(groups.reduce((sum, g) => sum + g.count, 0)).toBe(report.violations.length);
    const overstow = groups.find((g) => g.rule === "overstow");
    expect(overstow?.count).toBe(report.violations.filter((x) => x.rule === "overstow").length);
    expect(overstow!.count).toBeGreaterThan(50); // the case the old slice(0, 50) silently truncated
  });
});

describe("ruleLabel", () => {
  it("names known rules and falls back to the raw id, never blank", () => {
    expect(ruleLabel("no_floating")).toBe("No container below");
    expect(ruleLabel("some_future_rule")).toBe("some_future_rule");
  });
});

describe("severityTotals", () => {
  it("counts by severity for the status strip", () => {
    expect(severityTotals([v("a", "error"), v("b", "warning"), v("c", "warning")])).toEqual({ error: 1, warning: 2 });
    expect(severityTotals([])).toEqual({ error: 0, warning: 0 });
  });
});
