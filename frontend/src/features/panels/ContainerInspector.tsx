import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import type { StowagePlan, Vessel } from "@/types/domain";
import type { Reason } from "@/engine/placement/reason";
import { slotCode } from "@/engine/slot-helpers";
import { activeContainerId, usePlanStore } from "@/store/usePlanStore";
import { verdictForSlot } from "@/lib/drop-verdict";

/**
 * The sidebar's "Container" section: the selected/hovered box, or — while a container is being
 * dragged or picked — what a drop on the slot under the cursor would do, plus the outcome of the
 * release that just happened (`releaseNotice`). Split out of Sidebar.tsx to keep that file under the
 * 200-LOC rule.
 *
 * This is the wording half of the three-state drop feedback the canvas cannot carry (a WebGL mesh
 * has nowhere to put text): the ghost and the placeholders show the TINT, this shows the REASON.
 * "Recorded, not blocked" is deliberate for a warning — the drop lands and the plan-wide report
 * lists it (D1) — so that line must not read like the refusal above it. Both read the same
 * `verdictForSlot`, i.e. the same `canPlaceContainer` gate the commit runs.
 */
export function ContainerInspector({
  vessel, plan, releaseNotice,
}: {
  vessel: Vessel;
  plan: StowagePlan;
  /** The outcome of a release, kept by Sidebar after the gesture it ended: `rejected` for a D1 hard
   * block, `rejected: false` for an overridable limit that WAS applied and recorded. */
  releaseNotice: { reason: Reason; rejected: boolean } | null;
}) {
  const { hoveredSlot, selectedId, hoveredId } = usePlanStore(
    useShallow((s) => ({ hoveredSlot: s.hoveredSlot, selectedId: s.selectedId, hoveredId: s.hoveredId }))
  );
  const activeId = usePlanStore(activeContainerId);
  const activeContainer = activeId ? plan.containers.find((c) => c.id === activeId) : undefined;

  const dropVerdict = useMemo(
    () => (activeContainer && hoveredSlot ? verdictForSlot(vessel, plan, activeContainer, hoveredSlot) : null),
    [vessel, plan, activeContainer, hoveredSlot]
  );

  const focusId = selectedId ?? hoveredId;
  const focus = focusId ? plan.containers.find((c) => c.id === focusId) : undefined;
  const focusSlot = focusId ? plan.placements.find((p) => p.container_id === focusId)?.slot : undefined;

  return (
    <section>
      <h2>Container</h2>
      {activeContainer && hoveredSlot ? (
        <div className="grid gap-1">
          <p className="muted">Slot {slotCode(hoveredSlot)} — placing {activeContainer.id}</p>
          {dropVerdict?.reason ? (
            <p className={`small ${dropVerdict.verdict === "warning" ? "warn" : "error"}`}>
              {dropVerdict.verdict === "warning"
                ? `Recorded, not refused — the checks below will list it: ${dropVerdict.reason.message}`
                : `Refused: ${dropVerdict.reason.message}`}
            </p>
          ) : dropVerdict ? (
            <p className="small ok">Clean drop — no rule is triggered.</p>
          ) : null}
        </div>
      ) : activeContainer ? (
        <p className="muted">
          In hand: {activeContainer.id} — click a highlighted slot in 3D or the bay plan, or drop it there. Esc cancels.
        </p>
      ) : focus ? (
        <dl className="kv">
          <dt>ID</dt><dd>{focus.id}</dd>
          <dt>Slot</dt><dd>{focusSlot ? slotCode(focusSlot) : "—"}</dd>
          <dt>Size</dt><dd>{focus.size}'{focus.high_cube ? " HC" : ""} {focus.type}</dd>
          <dt>Weight</dt><dd>{focus.weight_t} t</dd>
          <dt>Route</dt><dd>{focus.pol} to {focus.pod}</dd>
        </dl>
      ) : hoveredSlot ? (
        <p className="muted">Empty slot {slotCode(hoveredSlot)}</p>
      ) : (
        <p className="muted">Hover or click a container — or an empty slot — to inspect it.</p>
      )}
      {!activeContainer && releaseNotice && (
        <p className={`small ${releaseNotice.rejected ? "error" : "warn"}`}>
          {releaseNotice.rejected
            ? `Not placed — ${releaseNotice.reason.message}`
            : `Placed. Recorded, not blocked — the checks below will list it: ${releaseNotice.reason.message}`}
        </p>
      )}
    </section>
  );
}
