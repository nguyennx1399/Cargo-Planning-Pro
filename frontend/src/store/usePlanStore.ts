import { create } from "zustand";
import type { Slot } from "@/types/domain";

export type ColorMode = "pod" | "weight" | "type";
export type PaletteMode = "default" | "colorblind";

interface ViewState {
  colorMode: ColorMode;
  paletteMode: PaletteMode;
  showHull: boolean;
  showOnDeck: boolean;
  showUnderDeck: boolean;
  bayFilter: number | null; // null = all bays
  hoveredId: string | null;
  selectedId: string | null;
  /** Raycast-resolved empty slot under the cursor (E3-04a) — null whenever the cursor is over a
   * container instead (hoveredId) or over nothing. Editor-only; not used by the read-only views. */
  hoveredSlot: Slot | null;
  /** Container id being dragged from the Unplaced list (E3-04b), or null when not dragging.
   * Combined with hoveredSlot, drives the ghost preview — snap-to-slot and committing the
   * placement are E3-04c/d, not implemented yet. */
  draggingContainerId: string | null;
  exaggerate: number; // multiplier on list/trim angle, for visibility — real angles are tiny
  playbackCount: number | null; // null = show everything immediately; a number = playback in progress
  playbackPlaying: boolean;
  playbackSpeed: number; // containers per second
  setColorMode: (m: ColorMode) => void;
  setPaletteMode: (m: PaletteMode) => void;
  toggleHull: () => void;
  toggleOnDeck: () => void;
  toggleUnderDeck: () => void;
  setBayFilter: (bay: number | null) => void;
  setHovered: (id: string | null) => void;
  setSelected: (id: string | null) => void;
  setHoveredSlot: (slot: Slot | null) => void;
  setDraggingContainer: (id: string | null) => void;
  toggleExaggerate: () => void;
  startOrResumePlayback: () => void;
  pausePlayback: () => void;
  resetPlayback: () => void;
  setPlaybackCount: (n: number) => void;
  setPlaybackSpeed: (speed: number) => void;
  advancePlayback: (deltaCount: number, maxCount: number) => void;
  /** Clears every piece of view state keyed to a specific vessel's bays/containers/slots
   * (dynamic-vessel-switching plan) — bay/container ids from the old vessel are meaningless once
   * a different vessel is selected. Leaves colorMode/paletteMode/show* toggles alone, those are
   * vessel-independent viewer preferences. */
  resetForVesselChange: () => void;
}

// UI/view state only. Plan data lives in React Query cache.
// TODO(phase-2): editable plan draft + undo/redo stack (zundo or custom history)
export const usePlanStore = create<ViewState>((set) => ({
  colorMode: "pod",
  paletteMode: "default",
  showHull: true,
  showOnDeck: true,
  showUnderDeck: true,
  bayFilter: null,
  hoveredId: null,
  selectedId: null,
  hoveredSlot: null,
  draggingContainerId: null,
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
  setHoveredSlot: (hoveredSlot) => set({ hoveredSlot }),
  setDraggingContainer: (draggingContainerId) => set({ draggingContainerId }),
  toggleExaggerate: () =>
    set((s) => ({ exaggerate: s.exaggerate === 1 ? 5 : 1 })),
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
  resetForVesselChange: () =>
    set({
      bayFilter: null,
      hoveredId: null,
      selectedId: null,
      hoveredSlot: null,
      draggingContainerId: null,
      playbackCount: null,
      playbackPlaying: false,
    }),
}));
