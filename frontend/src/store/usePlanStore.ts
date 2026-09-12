import { create } from "zustand";

export type ColorMode = "pod" | "weight" | "type";

interface ViewState {
  colorMode: ColorMode;
  showHull: boolean;
  showOnDeck: boolean;
  showUnderDeck: boolean;
  bayFilter: number | null; // null = all bays
  hoveredId: string | null;
  selectedId: string | null;
  exaggerate: number; // multiplier on list/trim angle, for visibility — real angles are tiny
  playbackCount: number | null; // null = show everything immediately; a number = playback in progress
  playbackPlaying: boolean;
  playbackSpeed: number; // containers per second
  setColorMode: (m: ColorMode) => void;
  toggleHull: () => void;
  toggleOnDeck: () => void;
  toggleUnderDeck: () => void;
  setBayFilter: (bay: number | null) => void;
  setHovered: (id: string | null) => void;
  setSelected: (id: string | null) => void;
  toggleExaggerate: () => void;
  startOrResumePlayback: () => void;
  pausePlayback: () => void;
  resetPlayback: () => void;
  setPlaybackCount: (n: number) => void;
  setPlaybackSpeed: (speed: number) => void;
  advancePlayback: (deltaCount: number, maxCount: number) => void;
}

// UI/view state only. Plan data lives in React Query cache.
// TODO(phase-2): editable plan draft + undo/redo stack (zundo or custom history)
export const usePlanStore = create<ViewState>((set) => ({
  colorMode: "pod",
  showHull: true,
  showOnDeck: true,
  showUnderDeck: true,
  bayFilter: null,
  hoveredId: null,
  selectedId: null,
  exaggerate: 1,
  playbackCount: null,
  playbackPlaying: false,
  playbackSpeed: 30,
  setColorMode: (colorMode) => set({ colorMode }),
  toggleHull: () => set((s) => ({ showHull: !s.showHull })),
  toggleOnDeck: () => set((s) => ({ showOnDeck: !s.showOnDeck })),
  toggleUnderDeck: () => set((s) => ({ showUnderDeck: !s.showUnderDeck })),
  setBayFilter: (bayFilter) => set({ bayFilter }),
  setHovered: (hoveredId) => set({ hoveredId }),
  setSelected: (selectedId) => set({ selectedId }),
  toggleExaggerate: () => set((s) => ({ exaggerate: s.exaggerate === 1 ? 5 : 1 })),
  startOrResumePlayback: () => set((s) => ({ playbackCount: s.playbackCount ?? 0, playbackPlaying: true })),
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
}));
