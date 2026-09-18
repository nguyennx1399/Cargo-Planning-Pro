import { create } from "zustand";
import type { BreakbulkCargo, Slot } from "@/types/domain";
import type { DropOutcome } from "@/lib/drop-feedback";
import { slotTarget } from "@/lib/drop-feedback";
import { staleOutcome } from "@/lib/drop-target";
import {
  HAND_DEFAULTS, createHandActions, endHand, type HandActions, type HandFields,
} from "./hand-slice";

// The hand (what is in the planner's hand, its rotation and the pose under the cursor) lives in
// `store/hand-slice.ts` — split out for the 200-LOC rule, and because the hand's rules are now the
// rules of BOTH kinds of cargo. Re-exported here so every existing importer is unchanged.
export { activeBreakbulkId, activeContainerId, dragInFlight, handInUse } from "./hand-slice";
export type { Hand, HandKind, HandMode, HandRotation } from "./hand-slice";

export type ColorMode = "pod" | "weight" | "type";
export type PaletteMode = "default" | "colorblind";

interface ViewState extends HandFields, HandActions {
  colorMode: ColorMode;
  paletteMode: PaletteMode;
  showHull: boolean;
  showOnDeck: boolean;
  showUnderDeck: boolean;
  bayFilter: number | null; // null = all bays
  hoveredId: string | null;
  selectedId: string | null;
  /** The outcome of the LAST committed drop — refused, or accepted with a reason the plan-wide checks
   * will list — kept after the gesture it ended, because a refused DRAG is cleared by the resolver and
   * there would be nothing left to attach the message to (P1/D5; review M2/M3/M6). Written by
   * `store/commit-placement.ts` only; the full lifetime table lives in its header. In short: a new
   * gesture clears it, hovering a DIFFERENT target of the same kind clears it, and everything else
   * leaves it alone. */
  dropOutcome: DropOutcome | null;
  exaggerate: number; // multiplier on list/trim angle, for visibility — real angles are tiny
  playbackCount: number | null; // null = show everything immediately; a number = playback in progress
  playbackPlaying: boolean;
  playbackSpeed: number; // containers per second
  /** Bumped by `resetView()`. The camera lives inside the Canvas and the button that re-frames it lives
   * in the sidebar, so the two talk through a nonce — the same shape `playbackCount`/`exaggerate` use,
   * rather than smuggling the controls instance out through a module-level ref. Starts at 0, which the
   * in-canvas listener treats as "never pressed" so a fresh session keeps its initial camera. */
  viewResetCount: number;
  /** A keyboard pan request: `seq` bumps per press so two presses in the same direction are two
   * events, and `dx` carries the direction (-1 left, +1 right). Same "sidebar asks, canvas acts"
   * pattern as `viewResetCount` — the key handler lives outside the Canvas and cannot touch the
   * camera. */
  viewPan: { seq: number; dx: -1 | 1 };
  /** Project cargo the planner defined by hand. Held HERE rather than in the plan because `App.tsx`
   * rebuilds the plan on every vessel/toggle change and would destroy them; they are merged back into
   * each freshly built plan by `withCustomCargo`. Session-scoped: a page reload clears them. */
  customCargo: BreakbulkCargo[];
  /** The "Free space" view: draws every empty container cell and shades the ground already taken, with
   * nothing in hand. Off by default — it is an answer to a question the planner asks, not a default
   * overlay. */
  showFreeSpace: boolean;
  /** The "Stowage box" view: a wireframe per deck level around the volume cargo can occupy. Unlike the
   * free-space overlay it stays on during a gesture — thin edges do not compete with the drop layers. */
  showStowageBox: boolean;
  /** The sidebar tab (sidebar reorganisation plan). Held here rather than in component state because the
   * Sidebar may remount on a vessel switch, and losing the planner's tab every time would be irritating.
   * Session-scoped. Deliberately NEVER switched automatically by a gesture: a tab changing under the
   * planner is disorienting, and the drop verdict is already at the cursor. */
  sidebarTab: SidebarTab;
  setColorMode: (m: ColorMode) => void;
  setPaletteMode: (m: PaletteMode) => void;
  toggleHull: () => void;
  toggleOnDeck: () => void;
  toggleUnderDeck: () => void;
  setBayFilter: (bay: number | null) => void;
  setHovered: (id: string | null) => void;
  setSelected: (id: string | null) => void;
  setHoveredSlot: (slot: Slot | null) => void;
  setDropOutcome: (outcome: DropOutcome | null) => void;
  toggleExaggerate: () => void;
  startOrResumePlayback: () => void;
  pausePlayback: () => void;
  resetPlayback: () => void;
  setPlaybackCount: (n: number) => void;
  setPlaybackSpeed: (speed: number) => void;
  advancePlayback: (deltaCount: number, maxCount: number) => void;
  /** Clears every piece of view state keyed to a specific vessel's bays/containers/slots/areas
   * (dynamic-vessel-switching plan) — ids from the old vessel are meaningless once a different vessel
   * is selected. Includes the whole hand (`inHand`/`handMode`/`handRotation`/`hoveredSlot`/
   * `hoveredPose`), which is a vessel-keyed id plus a vessel-keyed target. Leaves
   * colorMode/paletteMode/show* toggles alone, those are vessel-independent viewer preferences. The
   * plan itself lives in usePlanDraftStore, which the caller resets alongside this. */
  resetForVesselChange: () => void;
  /** Put the camera and the orbit target back on the ship — the recovery for `zoomToCursor`, which
   * moves the orbit target as it zooms. Touches nothing but the camera. */
  resetView: () => void;
  /** Slide the 3D view horizontally by one step. Bound to the arrow keys. */
  panView: (dx: -1 | 1) => void;
  toggleFreeSpace: () => void;
  toggleStowageBox: () => void;
  setSidebarTab: (tab: SidebarTab) => void;
  addCustomCargo: (item: BreakbulkCargo) => void;
  removeCustomCargo: (id: string) => void;
}

/** The sidebar's three task tabs: placing cargo, adjusting the view, reviewing the result. */
export type SidebarTab = "load" | "view" | "check";

// UI/view state only. The editable plan (and its undo history) lives in usePlanDraftStore.
export const usePlanStore = create<ViewState>((set) => ({
  ...HAND_DEFAULTS,
  ...createHandActions(set),
  colorMode: "pod",
  paletteMode: "default",
  viewResetCount: 0,
  viewPan: { seq: 0, dx: 1 },
  customCargo: [],
  showFreeSpace: false,
  showStowageBox: false,
  sidebarTab: "load",
  showHull: true,
  showOnDeck: true,
  showUnderDeck: true,
  bayFilter: null,
  hoveredId: null,
  selectedId: null,
  hoveredSlot: null,
  dropOutcome: null,
  exaggerate: 1,
  playbackCount: null,
  playbackPlaying: false,
  playbackSpeed: 30,
  setColorMode: (colorMode) => set({ colorMode }),
  setPaletteMode: (paletteMode) => set({ paletteMode }),
  toggleHull: () => set((s) => ({ showHull: !s.showHull })),
  toggleOnDeck: () => set((s) => ({ showOnDeck: !s.showOnDeck })),
  toggleUnderDeck: () => set((s) => ({ showUnderDeck: !s.showUnderDeck })),
  setBayFilter: (bayFilter) => set({ bayFilter }),
  setHovered: (hoveredId) => set({ hoveredId }),
  setSelected: (selectedId) => set({ selectedId }),
  // Hovering a DIFFERENT slot also retires the last drop outcome (review M6: no stale "Not placed —
  // …" sitting there while the planner inspects something else), and only a SLOT-shaped one: a pose is
  // a different question (`lib/drop-target.ts`). `setHoveredSlot(null)` deliberately does NOT clear:
  // leaving the canvas must not wipe the message before it has been read.
  setHoveredSlot: (hoveredSlot) =>
    set((s) => ({
      hoveredSlot,
      dropOutcome: staleOutcome(s.dropOutcome, hoveredSlot && slotTarget(hoveredSlot)) ? null : s.dropOutcome,
    })),
  setDropOutcome: (dropOutcome) => set({ dropOutcome }),
  toggleExaggerate: () => set((s) => ({ exaggerate: s.exaggerate === 1 ? 5 : 1 })),
  startOrResumePlayback: () =>
    set((s) => ({
      playbackCount: s.playbackCount ?? 0,
      playbackPlaying: true,
    })),
  pausePlayback: () => set({ playbackPlaying: false }),
  resetPlayback: () => set({ playbackCount: null, playbackPlaying: false }),
  setPlaybackCount: (n) => set({ playbackCount: n, playbackPlaying: false }),
  setPlaybackSpeed: (playbackSpeed) => set({ playbackSpeed }),
  advancePlayback: (deltaCount, maxCount) =>
    set((s) => {
      if (s.playbackCount === null) return {};
      const next = Math.min(s.playbackCount + deltaCount, maxCount);
      return { playbackCount: next, playbackPlaying: next < maxCount };
    }),
  // The hand is cleared through the SAME end-of-hand patch every other transition uses, so an id, a
  // rotation or a target from the old vessel cannot survive into the next one. `hoveredSlot` and
  // `dropOutcome` are listed explicitly here because `endHand()` deliberately leaves them alone for
  // the Esc/cancel path, and a vessel change must not.
  resetView: () => set((state) => ({ viewResetCount: state.viewResetCount + 1 })),
  panView: (dx) => set((state) => ({ viewPan: { seq: state.viewPan.seq + 1, dx } })),
  toggleFreeSpace: () => set((state) => ({ showFreeSpace: !state.showFreeSpace })),
  toggleStowageBox: () => set((state) => ({ showStowageBox: !state.showStowageBox })),
  setSidebarTab: (sidebarTab) => set({ sidebarTab }),
  addCustomCargo: (item) => set((state) => ({ customCargo: [...state.customCargo, item] })),
  removeCustomCargo: (id) => set((state) => ({ customCargo: state.customCargo.filter((c) => c.id !== id) })),
  resetForVesselChange: () =>
    set({
      ...endHand(),
      hoveredSlot: null,
      dropOutcome: null,
      bayFilter: null,
      hoveredId: null,
      selectedId: null,
      playbackCount: null,
      playbackPlaying: false,
    }),
}));
