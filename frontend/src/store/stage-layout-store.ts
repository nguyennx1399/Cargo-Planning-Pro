/**
 * stage-layout-store.ts — which view owns the stage (stage-swap plan, phase 01).
 *
 *  - "3d": the 3D view is big, the bay plan sits below it (the original layout);
 *  - "plan": the bay plan fills the stage (overview + bay detail) and the 3D view is a corner mini-view.
 *
 * Its own tiny store rather than a field of `usePlanStore` (already near the 200-line limit): nothing
 * else reads it with the plan state, and it is remembered across reloads, which nothing there is. It is
 * deliberately NOT reset on a vessel change — it is how the planner likes to work, not part of the ship.
 */
import { create } from "zustand";
import { readPref, writePref } from "./view-prefs-storage";

export type StageLayout = "3d" | "plan";

const KEY = "stageLayout";
const LAYOUTS: readonly StageLayout[] = ["3d", "plan"];

interface StageLayoutState {
  stageLayout: StageLayout;
  setStageLayout: (layout: StageLayout) => void;
  toggleStageLayout: () => void;
}

export const useStageLayout = create<StageLayoutState>((set, get) => ({
  stageLayout: readPref(KEY, LAYOUTS, "3d"),
  setStageLayout: (stageLayout) => {
    writePref(KEY, stageLayout);
    set({ stageLayout });
  },
  toggleStageLayout: () => get().setStageLayout(get().stageLayout === "3d" ? "plan" : "3d"),
}));
