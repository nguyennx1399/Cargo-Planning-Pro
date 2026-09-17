import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import type { StowagePlan, Vessel } from "@/types/domain";
import { slotCode } from "@/engine/slot-helpers";
import { activeContainerId, usePlanStore } from "@/store/usePlanStore";
import { dropOutcomeText, dropVerdictText } from "@/lib/drop-feedback";
import { verdictForSlot } from "@/lib/drop-verdict";

/**
 * The sidebar's "Container" section: the selected/hovered box, or — while a container is being
 * dragged or picked — what a drop on the slot under the cursor would do, plus the outcome of the last
 * committed drop. Split out of Sidebar.tsx to keep that file under the 200-LOC rule.
 *
 * This is the ACCESSIBLE half of the drop feedback (P1/D4). Two surfaces carry it: the at-cursor chip
 * (pointer users, `aria-hidden`, positioned at the point of action) and this one, which stays the
 * screen-reader source and the persistent readout — a WebGL mesh carries no text at all.
 *
 * Both render `drop-feedback.ts`, so they cannot word one drop differently: `dropVerdictText` for what
 * a drop WOULD do (green clean / amber recorded, not fatal / red refused), `dropOutcomeText` for what
 * the last one DID. The outcome lives in the store rather than here because a refused DRAG is cleared
 * by the commit resolver — there would be no gesture left to hang the message on, and a rejected PICK
 * must keep its reason after the click (review M2). Both read the same `verdictForSlot`, i.e. the same
 * `canPlaceContainer` gate the commit runs.
 */
export function ContainerInspector({ vessel, plan }: { vessel: Vessel; plan: StowagePlan }) {
  const { hoveredSlot, selectedId, hoveredId, dropOutcome } = usePlanStore(
    useShallow((s) => ({
      hoveredSlot: s.hoveredSlot,
      selectedId: s.selectedId,
      hoveredId: s.hoveredId,
      dropOutcome: s.dropOutcome,
    }))
  );
  const activeId = usePlanStore(activeContainerId);
  const activeContainer = activeId ? plan.containers.find((c) => c.id === activeId) : undefined;

  const verdict = useMemo(
    () => (activeContainer && hoveredSlot ? verdictForSlot(vessel, plan, activeContainer, hoveredSlot) : null),
    [vessel, plan, activeContainer, hoveredSlot]
  );
  const hover = activeContainer && hoveredSlot && verdict
    ? dropVerdictText(hoveredSlot, verdict, activeContainer.id)
    : null;
  const outcome = dropOutcome ? dropOutcomeText(dropOutcome) : null;

  const focusId = selectedId ?? hoveredId;
  const focus = focusId ? plan.containers.find((c) => c.id === focusId) : undefined;
  const focusSlot = focusId ? plan.placements.find((p) => p.container_id === focusId)?.slot : undefined;

  return (
    <section>
      <h2>Container</h2>
      {hover ? (
        <div className="grid gap-1">
          <p className="muted">{hover.headline}</p>
          <p className={`small ${hover.tone}`}>{hover.detail}</p>
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
      {/* Shown even while a box is in hand: that is exactly the rejected-pick case (review M2). */}
      {outcome && <p className={`small ${outcome.tone}`}>{outcome.detail}</p>}
    </section>
  );
}
