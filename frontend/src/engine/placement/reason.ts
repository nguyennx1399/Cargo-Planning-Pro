/**
 * Placement-check vocabulary shared by the drag-and-drop UI and the validator (spec §4.5, decision D1).
 *
 * A `Reason` is a `Violation` without the plan-level baggage (`container_ids`/`slots` refer to what is
 * already placed, which a not-yet-placed candidate has none of). Rule ids are deliberately the SAME
 * ids `engine/validation-rules.ts` and `engine/breakbulk-validation-rules.ts` emit, so a tooltip and
 * the violation list name the same thing with the same words.
 *
 * D1 severity — configurable per rule, plain data (no UI settings surface: YAGNI):
 *  - `error`   = hard/physical, the candidate cannot be committed (outside the area, overlap,
 *                keep-out, slot size, missing support, plugs, clearance, stack limit).
 *  - `warning` = an overridable limit: the candidate may be committed and the reason is recorded.
 *                The plan-wide rules still REPORT these (see the note below), so the record is the
 *                bridge between "the drop was allowed" and "the report flags it".
 *
 * NOTE on the warning set: `breakbulkOverweight`/`breakbulkOverPressure` stay severity `error` in the
 * plan-wide report (their `violation()` helper hardcodes it) while the per-slot check treats them as
 * overridable limits per D1. That asymmetry is deliberate and stated in the phase file's D1 line;
 * `stack_weight` is NOT in the warning set because the report flags it as an error and the ghost must
 * not promise a green slot the report then blocks. `overstow` is a warning in both places.
 * `twenty_on_forty` is a blocking `error` in both places too, and lives here rather than in the
 * report-only vocabulary because a 20' half-slot is a real drop position.
 *
 * `breakbulk_approximate_area` (Phase D / D4) is the odd one out and deliberately so: it says nothing
 * about the CANDIDATE, only about the DATA — the area is a fraction-of-LOA guess, not a GA layout.
 * D1 puts it with the overridable limits ("warn and are recorded"), so a drop there is allowed; but
 * its plan-wide counterpart reports it at this table's own severity (see
 * `breakbulk-validation-rules.ts`), because a caveat about the vessel's data must never make
 * `report.ok` false on a vessel that has no GA to load — which is every vessel without a stowage
 * spec, i.e. the whole demo fleet.
 */
import type { Severity } from "@/types/domain";

/** Every rule id a placement check can emit. `severityOf` is total over this list. */
export const PLACEMENT_RULES = [
  // container candidates (per-slot checks, spec §4.5)
  "slot_exists",
  "size_fits_bay",
  "cell_conflict",
  "twenty_on_forty",
  "no_floating",
  "reefer_plug",
  "stack_weight",
  "max_height",
  "breakbulk_overlaps_container",
  "overstow",
  // breakbulk candidates — the existing 7 breakbulk rules, lifted to one item
  "breakbulk_out_of_deck_area",
  "breakbulk_overlap",
  "breakbulk_in_keep_out",
  "breakbulk_too_tall",
  "breakbulk_overweight",
  "breakbulk_over_pressure",
  // D4: the area itself is an approximation, not the candidate — a caveat, never a refusal.
  "breakbulk_approximate_area",
  // stacking (project-cargo stacking plan): an item resting on another item's top
  "breakbulk_unsupported",
  "breakbulk_support_invalid",
  "breakbulk_support_overloaded",
  // store-level guards (not validation rules): the requested id is not actionable
  "unknown_container",
  "unknown_breakbulk_cargo",
  "no_plan",
] as const;

export type PlacementRule = (typeof PLACEMENT_RULES)[number];

export interface Reason {
  rule: PlacementRule;
  message: string;
  severity: Severity;
}

/** What both predicates return. `ok` is false only for blocking (`error`) reasons. */
export interface PlacementResult {
  ok: boolean;
  reasons: Reason[];
}

/** D1's per-rule severity table — the single place a rule's blocking behaviour is decided. */
export const RULE_SEVERITY: Readonly<Record<PlacementRule, Severity>> = {
  slot_exists: "error",
  size_fits_bay: "error",
  cell_conflict: "error",
  twenty_on_forty: "error",
  no_floating: "error",
  reefer_plug: "error",
  stack_weight: "error",
  max_height: "error",
  breakbulk_overlaps_container: "error",
  overstow: "warning",
  breakbulk_out_of_deck_area: "error",
  breakbulk_overlap: "error",
  breakbulk_in_keep_out: "error",
  breakbulk_too_tall: "error",
  breakbulk_overweight: "warning",
  breakbulk_over_pressure: "warning",
  breakbulk_approximate_area: "warning",
  breakbulk_unsupported: "error",
  breakbulk_support_invalid: "error",
  breakbulk_support_overloaded: "error",
  unknown_container: "error",
  unknown_breakbulk_cargo: "error",
  no_plan: "error",
};

export const severityOf = (rule: PlacementRule): Severity => RULE_SEVERITY[rule];

/** True when a reason blocks the placement (D1). */
export const blocks = (reason: Reason): boolean => reason.severity === "error";

/** Fold a reason list into a result: `ok` unless something blocks. */
export function resultOf(reasons: Reason[]): PlacementResult {
  return { ok: !reasons.some(blocks), reasons };
}
