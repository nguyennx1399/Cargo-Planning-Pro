/**
 * group-violations.ts — the plan-wide report's violations, one group per rule (sidebar reorganisation,
 * phase 02).
 *
 * WHY: the Checks panel used to render `report.violations.slice(0, 50)` — on the demo plan that is 50 of
 * 199 overstows, so 149 were never shown AND nothing said so. It was also 46% of the sidebar's height.
 * Grouping fixes both structurally: every group carries its complete `count`, so the summary can never
 * silently drop data, and a handful of rows replaces a 2 000 px wall.
 *
 * Truncation is a VIEW decision, not a data one: `items` holds every violation of the rule, and the panel
 * decides how many to show — and must say how many it did not.
 *
 * ORDER: errors, then warnings; within a severity, the largest group first. The row that
 * blocks the plan is therefore always the first row.
 */
import type { Severity, Violation } from "@/types/domain";

export interface ViolationGroup {
  rule: string;
  /** The worst severity found in the group. */
  severity: Severity;
  count: number;
  /** All of them, in report order. */
  items: Violation[];
}

const SEVERITY_RANK: Record<Severity, number> = { error: 0, warning: 1 };

/** Readable names for the rule ids the engine emits. Anything unmapped falls back to its raw id, so a
 * rule added later never renders as a blank row. */
const RULE_LABELS: Record<string, string> = {
  overstow: "Overstow",
  no_floating: "No container below",
  cell_conflict: "Two boxes in one cell",
  twenty_on_forty: "20' on a 40'",
  stack_weight: "Stack weight over limit",
  reefer_plug: "Reefer without a plug",
  slot_exists: "Slot does not exist",
  size_fits_bay: "Wrong bay for the size",
  max_height: "Over the clear height",
  breakbulk_overlaps_container: "Project cargo over a stack",
  breakbulk_out_of_deck_area: "Project cargo outside its area",
  breakbulk_overlap: "Project cargo overlaps",
  breakbulk_in_keep_out: "Project cargo in a keep-out",
  breakbulk_too_tall: "Project cargo too tall",
  breakbulk_overweight: "Deck rating exceeded",
  breakbulk_over_pressure: "Deck pressure exceeded",
  breakbulk_approximate_area: "Approximate area",
  breakbulk_unsupported: "Project cargo overhangs its support",
  breakbulk_support_invalid: "Invalid stacking support",
  breakbulk_support_overloaded: "Support top load exceeded",
};

export const ruleLabel = (rule: string): string => RULE_LABELS[rule] ?? rule;

export function groupViolations(violations: readonly Violation[]): ViolationGroup[] {
  const byRule = new Map<string, ViolationGroup>();
  for (const v of violations) {
    const group = byRule.get(v.rule);
    if (!group) {
      byRule.set(v.rule, { rule: v.rule, severity: v.severity, count: 1, items: [v] });
      continue;
    }
    group.count++;
    group.items.push(v);
    if (SEVERITY_RANK[v.severity] < SEVERITY_RANK[group.severity]) group.severity = v.severity;
  }
  return [...byRule.values()].sort(
    (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || b.count - a.count,
  );
}

/** Totals by severity — the status strip's one line, and the numbers it must never get wrong. */
export function severityTotals(violations: readonly Violation[]): Record<Severity, number> {
  const totals: Record<Severity, number> = { error: 0, warning: 0 };
  for (const v of violations) totals[v.severity]++;
  return totals;
}
