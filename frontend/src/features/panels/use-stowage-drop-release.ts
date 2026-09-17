/**
 * use-stowage-drop-release.ts — the ONE window-level release for a drop gesture (Phase C, extended to
 * both kinds of cargo by Phase 03). Mount it once, in the panel tree that is always on screen:
 *
 *     useStowageDropRelease();
 *
 * Extracted from Sidebar.tsx (200-LOC rule) with the container path unchanged, and extended — not
 * duplicated — for the pose path: a project-cargo drag is committed by the same release, through the
 * other door of the same resolver (`commitBreakbulkPlacement`), so a second listener can never commit
 * a drop the first would have refused.
 *
 * Mounted only while a DRAG is in flight (a pick has no pointer held down: it is committed by the
 * click on its target, and cancelling here would kill it before that click arrives). A window listener
 * rather than an onMouseUp on the item's own element, since the button is usually released over the
 * 3D canvas, not back over the list it started in.
 */
import { useEffect } from "react";
import { cancelPlacement, commitBreakbulkPlacement, commitPlacement } from "@/store/commit-placement";
import { dragInFlight, usePlanStore } from "@/store/usePlanStore";

export function useStowageDropRelease(): void {
  const dragging = usePlanStore(dragInFlight);

  useEffect(() => {
    if (!dragging) return;
    const onMouseUp = (e: MouseEvent) => {
      // PRIMARY BUTTON ONLY (P1/Low): a right/middle release is not the button that armed the drag.
      if (e.button !== 0) return;
      // Only a release OVER THE CANVAS may commit. `hoveredSlot`/`hoveredPose` are raycast results, and
      // the pick meshes remount (R3F drops an unmounted object's hover record without firing
      // `onPointerOut`) whenever their pickable count changes — so without this gate a release over the
      // sidebar or the bay plan could place the item on a target the pointer is not over. Releasing
      // elsewhere cancels, which is the same outcome the listener exists to produce for an off-canvas
      // release.
      const overCanvas = e.target instanceof Element && e.target.closest("canvas") !== null;
      // `getState()`, not the closure: the listener must not be re-registered per pointer move.
      const view = usePlanStore.getState();
      const hand = view.inHand;
      const result =
        !overCanvas || !hand ? null
          : hand.kind === "container" ? commitPlacement(view.hoveredSlot, "scene")
            : commitBreakbulkPlacement(view.hoveredPose, "scene");
      // `null` = nothing to commit (no target under the pointer), and the resolver deliberately leaves
      // the drag open in that case — so the cancel below is what stops a release outside the canvas
      // from leaving the gesture stuck.
      if (!result) cancelPlacement();
      // A real commit's outcome is no longer handled here: the resolver records it in the store and the
      // chip / ContainerInspector / bay plan read it from there (P1/D5, review M3).
    };
    // A button released OUTSIDE the browser window (or a pointer the OS cancels) never reaches the
    // `mouseup` above, so the gesture would stay armed until the next click or Esc.
    const onCancel = () => cancelPlacement();
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("pointercancel", onCancel);
    window.addEventListener("blur", onCancel);
    return () => {
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("blur", onCancel);
    };
  }, [dragging]);
}
