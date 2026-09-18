/**
 * StageSwapButton.tsx — the controls that swap which view owns the stage (stage-swap plan, phase 01).
 *
 * `StageSwapButton` is placed where the eye is: over the 3D view in the normal layout ("⇅ Bay plan
 * view"), in the bay plan's header in the swapped one ("⛴ 3D view").
 *
 * `MiniViewOverlay` covers the corner 3D view in the swapped layout. The mini-view is for LOOKING: a
 * click on it swaps back instead of orbiting, selecting or dropping into a 320 px canvas (placing still
 * works from the bay plan). It is a real button, so it is reachable and named for keyboards and screen
 * readers too.
 */
import { useStageLayout } from "@/store/stage-layout-store";

export function StageSwapButton({ className = "" }: { className?: string }) {
  const { stageLayout, toggleStageLayout } = useStageLayout();
  const toPlan = stageLayout === "3d";
  return (
    <button
      type="button"
      className={`stage-swap ${className}`}
      onClick={toggleStageLayout}
      title={toPlan ? "Show the bay plan large, with the 3D view in a corner" : "Show the 3D view large"}
    >
      {toPlan ? "⇅ Bay plan view" : "⛴ 3D view"}
    </button>
  );
}

export function MiniViewOverlay() {
  const setStageLayout = useStageLayout((s) => s.setStageLayout);
  return (
    <button
      type="button"
      className="mini-view-overlay"
      onClick={() => setStageLayout("3d")}
      aria-label="Show the 3D view large"
      title="Show the 3D view large"
    >
      <span>3D · click to enlarge</span>
    </button>
  );
}
