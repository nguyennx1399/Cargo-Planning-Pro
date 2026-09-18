/**
 * with-custom-cargo.ts — merges the planner's own project-cargo items into a freshly built plan.
 *
 * WHY THIS EXISTS: `App.tsx` REBUILDS the demo plan whenever the vessel or the cargo toggles change
 * (`loadPlan(vessel, buildDemoPlan(...))`). Anything written straight into `plan.breakbulk_cargo` is
 * therefore destroyed the next time someone presses "Clear project cargo" — which is exactly the sort of
 * silent data loss that reads as a bug. Custom items live in the view store instead and are merged back
 * in here, on every rebuild, so they survive the toggles.
 *
 * CARGO ONLY, NEVER PLACEMENTS. A rebuild produces a new plan by definition; carrying placements across
 * it would resurrect positions the validator never checked against the new plan. A custom item comes
 * back as UNPLACED, which is honest and puts it straight into the unplaced list where it can be picked
 * up again.
 *
 * Idempotent: an id already present in the plan is left alone, so calling it twice cannot duplicate a
 * row (and a demo item that happens to share an id always wins — the demo data is the ground truth of
 * what is actually on board).
 */
import type { BreakbulkCargo, StowagePlan } from "@/types/domain";

export function withCustomCargo(plan: StowagePlan, custom: readonly BreakbulkCargo[]): StowagePlan {
  if (custom.length === 0) return plan; // identity preserved: no custom cargo changes nothing
  const known = new Set(plan.breakbulk_cargo.map((c) => c.id));
  const additions = custom.filter((c) => !known.has(c.id));
  if (additions.length === 0) return plan;
  return { ...plan, breakbulk_cargo: [...plan.breakbulk_cargo, ...additions] };
}
