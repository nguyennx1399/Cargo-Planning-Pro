/**
 * SheetHighlight.tsx — hover/selection highlight for EVERY bay-sheet cell through one CSS rule, instead of
 * re-rendering cells (all-bay overview plan, phase 03).
 *
 * WHY: measured in the browser on MV Demo Horizon (1 800 cells), a hover that re-rendered the overview
 * took p90 ≈ 70 ms from store update to DOM, against ≈ 16 ms for the single-bay view. Cells now carry
 * `data-box` and never read hover/selection; this component alone subscribes to them and writes a rule
 * that overrides the cell colour variable (`--c`) for the matching box — every cell of it, its × too.
 * Selection is written last, so it wins over hover on the same box, as it did before.
 */
import { useShallow } from "zustand/react/shallow";
import { HIGHLIGHT } from "@/lib/colors";
import { INK_DARK } from "@/lib/bay-sheet/cell-text";
import { usePlanStore } from "@/store/usePlanStore";

const rule = (id: string | null, color: string): string =>
  // The highlight colours are light, so the big cells' text switches to dark ink with them.
  id ? `.sheet-cell[data-box="${CSS.escape(id)}"]{--c:${color} !important;--t:${INK_DARK} !important;}` : "";

export function SheetHighlight() {
  const { hoveredId, selectedId } = usePlanStore(useShallow((s) => ({ hoveredId: s.hoveredId, selectedId: s.selectedId })));
  return <style>{rule(hoveredId, HIGHLIGHT.hover) + rule(selectedId, HIGHLIGHT.selected)}</style>;
}
