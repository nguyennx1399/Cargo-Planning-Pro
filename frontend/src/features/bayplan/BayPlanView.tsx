import type { StowagePlan, Vessel } from "@/types/domain";
import { usePlanStore } from "@/store/usePlanStore";

/**
 * 2D bay plan (cross-section of one bay, rows across, tiers up) — the planner's main working view.
 * TODO(phase-1): SVG grid per bay: on-deck block above hatch line, under-deck block below,
 *   cells colored like 3D, synced hover/selection via usePlanStore.
 * TODO(phase-2): drag & drop to move/swap containers -> POST /api/validate.
 */
export function BayPlanView({ vessel, plan }: { vessel: Vessel; plan: StowagePlan }) {
  const bay = usePlanStore((s) => s.bayFilter);
  const count = plan.placements.filter((p) => bay === null || p.slot.bay === bay).length;

  return (
    <div className="bayplan-placeholder">
      <strong>{bay === null ? "Bay plan" : `Bay ${String(bay).padStart(2, "0")}`}</strong>
      <span>
        {bay === null
          ? `Pick a bay to see its cross-section. ${vessel.bays.length} bays on this vessel.`
          : `${count} containers in this bay. 2D grid arrives in phase 1.`}
      </span>
    </div>
  );
}
