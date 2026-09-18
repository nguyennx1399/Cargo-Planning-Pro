/**
 * Validation entry point: runs every rule on a plan and computes the KPI summary.
 * Pure and framework-free (no React / three / zustand) so it can later run server-side or be shared (RT-8).
 */
import type {
  StowagePlan,
  ValidationReport,
  Vessel,
  Violation,
} from "@/types/domain";
import { teuOf } from "./placement-checks";
import { slotCode } from "./slot-helpers";
import { buildValidationContext } from "./validation-context";
import { ALL_RULES } from "./validation-rules";
import { breakbulkApproximateArea, breakbulkInKeepOut, breakbulkOutOfDeckArea, breakbulkOverlap, breakbulkOverlapsContainer, breakbulkOverPressure, breakbulkOverweight, breakbulkSupportInvalid, breakbulkSupportOverloaded, breakbulkTooTall, breakbulkUnsupported } from "./breakbulk-validation-rules";

const round1 = (n: number): number => Math.round(n * 10) / 10;

export function validatePlan(
  vessel: Vessel,
  plan: StowagePlan,
): ValidationReport {
  const ctx = buildValidationContext(vessel, plan);

  const orphanViolations: Violation[] = ctx.orphans.map((p) => ({
    rule: "unknown_container",
    severity: "error",
    message: `${p.container_id}: placed but not in the cargo list`,
    container_ids: [p.container_id],
    slots: [slotCode(p.slot)],
  }));
  const violations = [
    ...orphanViolations,
    ...ALL_RULES.flatMap((rule) => rule(ctx)),
    ...breakbulkOutOfDeckArea(vessel, plan.breakbulk_cargo, plan.breakbulk_placements),
    ...breakbulkOverlap(plan.breakbulk_cargo, plan.breakbulk_placements),
    ...breakbulkOverlapsContainer(vessel, plan.breakbulk_cargo, plan.breakbulk_placements, plan.placements),
    ...breakbulkOverweight(vessel, plan.breakbulk_cargo, plan.breakbulk_placements),
    ...breakbulkInKeepOut(vessel, plan.breakbulk_cargo, plan.breakbulk_placements),
    ...breakbulkTooTall(vessel, plan.breakbulk_cargo, plan.breakbulk_placements),
    ...breakbulkOverPressure(vessel, plan.breakbulk_cargo, plan.breakbulk_placements),
    ...breakbulkSupportInvalid(vessel, plan.breakbulk_cargo, plan.breakbulk_placements),
    ...breakbulkUnsupported(vessel, plan.breakbulk_cargo, plan.breakbulk_placements),
    ...breakbulkSupportOverloaded(vessel, plan.breakbulk_cargo, plan.breakbulk_placements),
    // D4: the area-provenance caveat, so a drop the engine allowed as a warning really is listed
    // ("Recorded, not blocked — the checks below will list it: …"). Warning severity: see the wrapper.
    ...breakbulkApproximateArea(vessel, plan.breakbulk_cargo, plan.breakbulk_placements),
  ];
  // errors first; Array.prototype.sort is stable, so rule order is kept within a severity
  violations.sort(
    (a, b) =>
      Number(a.severity === "warning") - Number(b.severity === "warning"),
  );

  const placedIds = new Set(plan.placements.map((p) => p.container_id));
  const placedBoxes = plan.containers.filter((c) => placedIds.has(c.id));
  const teuPlaced = placedBoxes.reduce((sum, c) => sum + teuOf(c), 0);
  const teuCapacity = vessel.stacks.reduce(
    (sum, s) => sum + s.tiers.length * 2,
    0,
  ); // one 40' cell = 2 TEU
  const errors = violations.filter((v) => v.severity === "error").length;

  return {
    ok: errors === 0,
    violations,
    kpis: {
      placed: placedBoxes.length,
      unplaced: plan.containers.length - placedBoxes.length,
      teu_placed: teuPlaced,
      teu_capacity: teuCapacity,
      utilisation_pct: teuCapacity
        ? round1((100 * teuPlaced) / teuCapacity)
        : 0,
      errors,
      warnings: violations.length - errors,
      overstows: violations.filter((v) => v.rule === "overstow").length,
    },
  };
}
