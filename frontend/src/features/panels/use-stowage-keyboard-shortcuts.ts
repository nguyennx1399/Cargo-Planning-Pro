/**
 * use-stowage-keyboard-shortcuts.ts — the global editing keys in ONE place (Phase C step 12):
 * `Ctrl/Cmd+Z` undo, `Shift+Ctrl/Cmd+Z` (and Windows-style `Ctrl+Y`) redo, `Esc` cancel, plus the
 * project-cargo keys Phase 03 added: `R` rotate 0↔90, `Delete`/`Backspace` unplace the selected item.
 *
 * Mount it once (Sidebar is where the existing global key handler lives):
 *
 *     useStowageKeyboardShortcuts();
 *
 * ARROWS AND BRACKETS (arrow-key pan plan): this hook now owns them. The arrows PAN the 3D view and
 * `[` / `]` step the bay filter — the reverse of the original binding, which had the arrows stepping
 * bays from a second global handler in `Sidebar.tsx`. That handler was deleted in the same change, as
 * its own comment required: two global handlers acting on one press is the bug this file exists to
 * avoid. `ViewOptionsPanel`'s chevron buttons remain the discoverable path for bays.
 *
 * Handlers are read once via `getState()` inside the listener rather than subscribed, so the effect
 * has no dependencies and can never go stale or re-register mid-gesture.
 */
import { useEffect } from "react";
import { cancelPlacement } from "@/store/commit-placement";
import type { Vessel } from "@/types/domain";
import { usePlanDraftStore } from "@/store/usePlanDraftStore";
import { usePlanStore } from "@/store/usePlanStore";
import { canBeginBreakbulkMove } from "@/store/begin-breakbulk-move";

/** The same guard Sidebar's bay-nav handler uses: never hijack keystrokes aimed at a text field.
 * The Unplaced search box (P2) is that text field, and it is why the guard is now load-bearing rather
 * than defensive — Esc in the box must not cancel an armed pick, and Ctrl+Z in the box must stay the
 * field's own undo, not the plan's. */
const isTypingTarget = (target: EventTarget | null): boolean => {
  const tag = (target as HTMLElement | null)?.tagName;
  return tag === "INPUT" || tag === "TEXTAREA";
};

/** Widgets that already use the arrow keys for themselves (sidebar reorganisation plan). A focused
 * tablist moves between tabs on ArrowLeft/Right — the accessible pattern base-ui implements — and since
 * the arrow-key-pan work those keys ALSO pan the camera globally. Without this, one press would switch
 * tab AND slide the ship. Same for listboxes, sliders and the select's combobox. Exported for its test. */
export const ownsArrowKeys = (target: EventTarget | null): boolean =>
  target instanceof Element &&
  target.closest('[role="tablist"], [role="listbox"], [role="slider"], [role="combobox"], [role="menu"]') !== null;

/**
 * Delete/Backspace unplaces the SELECTED project-cargo item — and nothing else. Only an id that
 * resolves in `plan.breakbulk_cargo` is acted on (the phase's risk table: "Delete unplaces the wrong
 * thing"): a selected container id, or a selection that is not cargo at all, is left alone, and the
 * containers' own unplace path (clearing the cargo) stays the only way a box leaves the plan.
 */
function unplaceSelectedCargo(): void {
  const { selectedId } = usePlanStore.getState();
  const draft = usePlanDraftStore.getState();
  if (!selectedId || !draft.plan?.breakbulk_cargo.some((c) => c.id === selectedId)) return;
  // An item others rest on stays put, and the reason is shown (stacking plan): the store refuses too.
  if (!canBeginBreakbulkMove(draft.plan, selectedId)) return;
  draft.unplaceBreakbulk(selectedId);
}

/** Step the bay filter by `delta`, wrapping at neither end — the keyboard twin of ViewOptionsPanel's
 * chevron buttons. Lives here because the keys do; the panel keeps its own copy for its buttons. */
function stepBay(vessel: Vessel, delta: number): void {
  const { bayFilter, setBayFilter } = usePlanStore.getState();
  const index = bayFilter === null ? -1 : vessel.bays.indexOf(bayFilter);
  const next = index === -1 ? (delta > 0 ? 0 : vessel.bays.length - 1) : index + delta;
  if (next >= 0 && next < vessel.bays.length) setBayFilter(vessel.bays[next]);
}

export function useStowageKeyboardShortcuts(vessel: Vessel): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (isTypingTarget(e.target)) return;
      const key = e.key.toLowerCase();

      if ((e.ctrlKey || e.metaKey) && !e.altKey) {
        if (key === "z") {
          e.preventDefault(); // the editor owns undo/redo, not the browser's field history
          if (e.shiftKey) usePlanDraftStore.getState().redo();
          else usePlanDraftStore.getState().undo();
        } else if (key === "y") {
          e.preventDefault();
          usePlanDraftStore.getState().redo();
        }
        return; // a modified key is never an editing chord (Ctrl+R must stay the browser's reload)
      }
      if (e.altKey) return;

      // ARROWS PAN THE 3D VIEW (they used to step the bay filter — that moved to `[` / `]` below).
      // Left/right only: Up/Down are the browser's own scroll keys for the sidebar column, and hijacking
      // them globally would break scrolling in a panel-heavy UI.
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        if (ownsArrowKeys(e.target)) return; // the focused widget's own arrow keys, not the camera's
        return usePlanStore.getState().panView(e.key === "ArrowLeft" ? -1 : 1);
      }
      if (e.key === "[") return stepBay(vessel, -1);
      if (e.key === "]") return stepBay(vessel, 1);

      if (key === "r") usePlanStore.getState().rotateHand(); // a no-op unless cargo is in hand
      // Esc ends a drag AND a pick, without committing either (Phase C requirement).
      else if (key === "escape") cancelPlacement();
      else if (key === "delete" || key === "backspace") unplaceSelectedCargo();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [vessel]);
}
