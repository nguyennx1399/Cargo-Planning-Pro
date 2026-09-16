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
   * container instead (hoveredId) or over nothing, and cleared whenever a gesture starts (a value
   * from before the gesture could otherwise be committed by a click that only meant to pick it). */
  hoveredSlot: Slot | null;
  /** Container id being dragged from the Unplaced list (E3-04b), or null when not dragging.
   * Mutually exclusive with `pickedId`: the two setters clear each other, so the placeholder set and
   * the ghost are never driven by two sources at once. */
  draggingContainerId: string | null;
  /** Container id PICKED for the WCAG 2.5.7 single-pointer path (Phase C): click the row in the
   * Unplaced list (or focus it and press Enter) — no drag gesture — then click a placeholder in 3D
   * or a bay cell in 2D to place it. Esc clears it. Shares one commit resolver with the drag path. */
  pickedId: string | null;
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
  setPicked: (id: string | null) => void;
  toggleExaggerate: () => void;
  startOrResumePlayback: () => void;
  pausePlayback: () => void;
  resetPlayback: () => void;
  setPlaybackCount: (n: number) => void;
  setPlaybackSpeed: (speed: number) => void;
  advancePlayback: (deltaCount: number, maxCount: number) => void;
  /** Clears every piece of view state keyed to a specific vessel's bays/containers/slots
   * (dynamic-vessel-switching plan) — bay/container ids from the old vessel are meaningless once
   * a different vessel is selected. Includes the drag/pick state (`hoveredSlot`,
   * `draggingContainerId`, `pickedId`), which is a vessel-keyed slot/container id. Leaves
   * colorMode/paletteMode/show* toggles alone, those are vessel-independent viewer preferences. The
   * plan itself lives in usePlanDraftStore, which the caller resets alongside this. */
  resetForVesselChange: () => void;
}

// UI/view state only. The editable plan (and its undo history) lives in usePlanDraftStore.
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
  pickedId: null,
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
  // Starting either gesture ends the other one: one item is being placed at a time, and the
  // placeholder set / ghost must have a single source (Phase C risk table).
  // A drag start also pauses playback (D3): the dragged box's current placement is hidden while
  // dragging, and an advancing playbackCount would keep re-rendering the scene mid-gesture.
  // Releasing the mouse does not resume it — resuming stays an explicit planner action.
  // Both also CLEAR `hoveredSlot` (review H1): the picker mesh remounts when its pickable count
  // changes and R3F drops the unmounted object's hover record WITHOUT firing `onPointerOut`, so a
  // pre-gesture slot would survive into the next gesture and be committed by a click that only meant
  // to pick. A gesture's target must be established under that gesture's pointer.
  setDraggingContainer: (draggingContainerId) =>
    set(
      draggingContainerId === null
        ? { draggingContainerId: null }
        : { draggingContainerId, pickedId: null, hoveredSlot: null, playbackPlaying: false },
    ),
  setPicked: (pickedId) =>
    set(pickedId === null ? { pickedId: null } : { pickedId, draggingContainerId: null, hoveredSlot: null }),
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
      pickedId: null,
      playbackCount: null,
      playbackPlaying: false,
    }),
}));

/** The item the placeholder set and the ghost are driven by: the active drag, else the pick. The two
 * are mutually exclusive in the store, so this is the single source for "what am I placing" — a
 * component that needs it subscribes to this selector (a plain string|null, so no shallow compare).
 * `null` = no gesture in progress. */
export const activeContainerId = (s: {
  draggingContainerId: string | null;
  pickedId: string | null;
}): string | null => s.draggingContainerId ?? s.pickedId;
