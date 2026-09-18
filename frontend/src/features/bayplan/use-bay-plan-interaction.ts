/**
 * use-bay-plan-interaction.ts — everything a bay-sheet cell needs to act, shared by the single-bay view
 * and the all-bay overview (all-bay overview plan, phase 02), so the two cannot behave differently.
 *
 * Lifted out of `BayPlanView` unchanged in substance:
 *  - the valid positions are the engine's own set (`validSlotsFor`), projected by gravity
 *    (`landingSlotsOnly`) exactly as the 3D placeholder layer projects them;
 *  - a click with cargo in hand is the 2D trigger of the ONE commit resolver
 *    (`commitPlacement(landingSlotFor(...) ?? slot, "bayplan")`), so this path can never commit what the
 *    3D paths would refuse; with nothing in hand it selects;
 *  - the drop-outcome notice is the store's record, shown only for a bay-plan SLOT outcome.
 * What is new is only the odd-section mapping, which lives in the pure `bay-cell-target.ts`.
 */
import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import type { Container, StowagePlan, Vessel } from "@/types/domain";
import { activeContainerId, usePlanStore, type ColorMode } from "@/store/usePlanStore";
import { commitPlacement } from "@/store/commit-placement";
import { landingSlotFor, landingSlotsOnly } from "@/engine/placement/landing-slot";
import { validSlotsFor } from "@/engine/placement/placeholders";
import { bayPosition } from "@/engine/slot-helpers";
import { dropOutcomeText } from "@/lib/drop-feedback";
import { podColorMap } from "@/lib/colors";
import { cellTargetSlot, isValidCell, type SectionSide } from "@/lib/bay-sheet/bay-cell-target";
import type { SheetCell } from "@/lib/bay-sheet/bay-pairs";

export interface BayPlanInteraction {
  activeContainer: Container | undefined;
  colorMode: ColorMode;
  pods: Record<string, string>;
  /** Hover/selection are deliberately NOT here: `SheetHighlight` paints them with one CSS rule, so a
   * hover never re-renders a cell. Only the setter, which is stable. */
  setHovered: (id: string | null) => void;
  /** Is (side, row, tier) of 40' bay `fortyBay` a valid position for the box in hand? */
  isValid: (fortyBay: number, side: SectionSide, row: number, tier: number) => boolean;
  onCellClick: (fortyBay: number, side: SectionSide, row: number, tier: number, cell: SheetCell | undefined) => void;
  /** The last bay-plan drop outcome, if it concerns `fortyBay` (any bay when null). */
  noticeFor: (fortyBay: number | null) => ReturnType<typeof dropOutcomeText> | null;
}

export function useBayPlanInteraction(vessel: Vessel, plan: StowagePlan): BayPlanInteraction {
  const s = usePlanStore(
    useShallow((state) => ({
      colorMode: state.colorMode,
      paletteMode: state.paletteMode,
      dropOutcome: state.dropOutcome,
      setHovered: state.setHovered,
      setSelected: state.setSelected,
    })),
  );
  const activeId = usePlanStore(activeContainerId);
  const pods = useMemo(() => podColorMap(plan.ports, s.paletteMode), [plan.ports, s.paletteMode]);
  const activeContainer = activeId ? plan.containers.find((c) => c.id === activeId) : undefined;

  // GRAVITY: only the slots a box would actually come to rest in, so the sheet promises exactly what a
  // click delivers — the same projection the 3D placeholder layer applies to the same set.
  const validKeys = useMemo(
    () =>
      activeContainer
        ? new Set(landingSlotsOnly(vessel, plan, validSlotsFor(vessel, plan, activeContainer)).map((slot) => slot.key))
        : null,
    [vessel, plan, activeContainer],
  );

  const outcome = s.dropOutcome;
  // ONE object per real change, so memoised cards skip re-rendering when nothing they draw has changed.
  return useMemo<BayPlanInteraction>(() => ({
    activeContainer,
    colorMode: s.colorMode,
    pods,
    setHovered: s.setHovered,
    isValid: (fortyBay, side, row, tier) =>
      !!activeContainer && !!validKeys && isValidCell(validKeys, fortyBay, side, row, tier, activeContainer.size),
    onCellClick: (fortyBay, side, row, tier, cell) => {
      if (!activeContainer) {
        s.setSelected(cell ? cell.box.id : null);
        return;
      }
      const slot = cellTargetSlot(fortyBay, side, row, tier, activeContainer.size);
      commitPlacement(landingSlotFor(vessel, plan, slot) ?? slot, "bayplan");
    },
    noticeFor: (fortyBay) => {
      const target = outcome?.target;
      if (!outcome || outcome.origin !== "bayplan" || target?.kind !== "slot") return null;
      if (fortyBay !== null && bayPosition(target.slot.bay, vessel.bays)?.fortyBay !== fortyBay) return null;
      return dropOutcomeText(outcome);
    },
  }), [vessel, plan, activeContainer, validKeys, s.colorMode, pods, s.setHovered, s.setSelected, outcome]);
}
