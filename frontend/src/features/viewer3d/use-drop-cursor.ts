import { useShallow } from "zustand/react/shallow";
import type { StowagePlan, Vessel } from "@/types/domain";
import { dropCursorClass } from "@/lib/drop-cursor";
import { verdictForSlot } from "@/lib/drop-verdict";
import { verdictForPose } from "@/lib/pose-verdict";
import { dragInFlight, usePlanStore } from "@/store/usePlanStore";

/**
 * The viewport's cursor class (P1, requirement 6): what the next release would do, shown before it
 * happens. The row in the Unplaced list already says `grab`; the canvas said nothing, so the only way
 * to learn that a press-and-drag moves a box was to try it.
 *
 * Returns the WHOLE class list for the `.viewport` wrapper — `cursor` is an inherited CSS property, so
 * the canvas and its container pick it up without either of them setting one (three-stdlib's
 * OrbitControls sets no cursor of its own). The armed ring rides the same string: a pick and a drag are
 * both "an item is in hand", and the ring is what says so while the pointer is off the grid
 * (`.viewport-armed` in styles.css).
 *
 * BOTH KINDS OF CARGO (Phase 03): the hand is one field, so a project-cargo drag closes the hand
 * exactly as a container drag does, and a hovered POSE answers the verdict branch through
 * `verdictForPose` — the same predicate the commit will run. A container hand still reads
 * `verdictForSlot` with the same arguments as the ghost, the chip and the Sidebar readout, so the
 * one-entry memos in `drop-verdict.ts`/`pose-verdict.ts` still collapse every reader into ONE
 * predicate call per pointer move (review M4).
 */
export function useDropCursor(vessel: Vessel, plan: StowagePlan): string {
  const { dragging, hand, hoveredSlot, hoveredPose, hoveredId } = usePlanStore(
    useShallow((s) => ({
      dragging: dragInFlight(s),
      hand: s.inHand,
      hoveredSlot: s.hoveredSlot,
      hoveredPose: s.hoveredPose,
      hoveredId: s.hoveredId,
    })),
  );

  const container = hand?.kind === "container" ? plan.containers.find((c) => c.id === hand.id) : undefined;
  const cargo = hand?.kind === "breakbulk" ? plan.breakbulk_cargo.find((c) => c.id === hand.id) : undefined;
  // At most one of the two can have a target: the hand's kind decides which pick layer is mounted.
  const verdict =
    container && hoveredSlot ? verdictForSlot(vessel, plan, container, hoveredSlot)
      : cargo && hoveredPose ? verdictForPose(vessel, plan, cargo, hoveredPose)
        : null;

  const cursor = dropCursorClass({
    dragging,
    active: hand !== null,
    verdict: verdict?.verdict ?? null,
    overContainer: hoveredId !== null,
  });

  return [cursor, hand !== null ? "viewport-armed" : ""].filter(Boolean).join(" ");
}
