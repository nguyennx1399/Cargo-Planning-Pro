/**
 * use-stowage-keyboard-shortcuts.ts — the global editing keys in ONE place (Phase C step 12):
 * `Ctrl/Cmd+Z` undo, `Shift+Ctrl/Cmd+Z` (and Windows-style `Ctrl+Y`) redo, `Esc` cancel.
 *
 * Mount it once (Sidebar is where the existing global key handler lives):
 *
 *     useStowageKeyboardShortcuts();
 *
 * Reconciliation with the `ArrowLeft`/`ArrowRight` bay navigation in `Sidebar.tsx:62-72`: this hook
 * deliberately does NOT handle arrows, and Sidebar's handler already returns early on
 * ctrl/meta/alt. The two handler sets are therefore disjoint, so no keypress can be acted on twice
 * (two global handlers both advancing the bay filter on one arrow press is the bug this avoids). If
 * the arrow navigation is ever moved here, delete that effect in the same change.
 *
 * Handlers are read once via `getState()` inside the listener rather than subscribed, so the effect
 * has no dependencies and can never go stale or re-register mid-gesture.
 */
import { useEffect } from "react";
import { cancelPlacement } from "@/store/commit-placement";
import { usePlanDraftStore } from "@/store/usePlanDraftStore";

/** The same guard Sidebar's bay-nav handler uses: never hijack keystrokes aimed at a text field
 * (undo/redo in particular must stay the input's own if one is ever added). */
const isTypingTarget = (target: EventTarget | null): boolean => {
  const tag = (target as HTMLElement | null)?.tagName;
  return tag === "INPUT" || tag === "TEXTAREA";
};

export function useStowageKeyboardShortcuts(): void {
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
        return;
      }

      // Esc ends a drag AND a pick, without committing either (Phase C requirement).
      if (key === "escape") cancelPlacement();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
