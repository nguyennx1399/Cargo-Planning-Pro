import { useShallow } from "zustand/react/shallow";
import type { StowagePlan, Vessel } from "@/types/domain";
import { dropCursorClass } from "@/lib/drop-feedback";
import { verdictForSlot } from "@/lib/drop-verdict";
import { activeContainerId, usePlanStore } from "@/store/usePlanStore";

/**
 * The viewport's cursor class (P1, requirement 6): what the next release would do, shown before it
 * happens. The row in the Unplaced list already says `grab`; the canvas said nothing, so the only way
 * to learn that a press-and-drag moves a box was to try it.
 *
 * Returns the WHOLE class list for the `.viewport` wrapper — `cursor` is an inherited CSS property, so
 * the canvas and its container pick it up without either of them setting one (three-stdlib's
 * OrbitControls sets no cursor of its own). The armed ring rides the same string: a pick and a drag are
 * both "a box is in hand", and the ring is what says so while the pointer is off the grid
 * (`.viewport-armed` in styles.css).
 *
 * It reads `verdictForSlot` with the same arguments as the ghost, the chip and the Sidebar readout, so
 * the one-entry memo in `drop-verdict.ts` still collapses every reader into ONE predicate call per
 * pointer move (review M4).
 */
export function useDropCursor(vessel: Vessel, plan: StowagePlan): string {
  const { dragging, activeId, hoveredSlot, hoveredId } = usePlanStore(
    useShallow((s) => ({
      dragging: s.draggingContainerId !== null,
      activeId: activeContainerId(s),
      hoveredSlot: s.hoveredSlot,
      hoveredId: s.hoveredId,
    })),
  );

  const container = activeId ? plan.containers.find((c) => c.id === activeId) : undefined;
  const verdict = container && hoveredSlot ? verdictForSlot(vessel, plan, container, hoveredSlot) : null;

  const cursor = dropCursorClass({
    dragging,
    active: activeId !== null,
    verdict: verdict?.verdict ?? null,
    overContainer: hoveredId !== null,
  });

  return [cursor, activeId !== null ? "viewport-armed" : ""].filter(Boolean).join(" ");
}
