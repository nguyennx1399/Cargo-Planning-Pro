/**
 * hand-slice.ts — "what is in the planner's hand" (Phase D, requirement 1): the ONE field every
 * placement gesture is driven by, plus the rotation and the target under the cursor.
 *
 * `draggingContainerId` and `pickedId` were two fields for containers only. Project cargo needs more,
 * and fields that can each be set independently is exactly how two ghosts end up armed at once (Phase
 * C risk table). So the hand is ONE field, `inHand: {kind, id} | null`, and the kind decides which pick
 * layer mounts (`AreaDropPlane` vs `EmptySlotPicker`) and which ghost is drawn. `handMode` says HOW it
 * was picked up (a held drag, or a WCAG 2.5.7 single-pointer pick) — the only difference left between
 * the two, and it changes no check, only the post-commit rule (a refused drag is cleared, a refused
 * pick stays armed).
 *
 * The two container fields survive as a READ-ONLY projection of `inHand`, written only by `handState`
 * below: the container path (and its test suite) reads them exactly as it always did, so Phase C needs
 * no rewrite and cannot drift — and nothing else may write them, so they cannot disagree with `inHand`.
 *
 * `handRotation` and `hoveredPose` are cleared exactly where `hoveredSlot` is (gesture start, gesture
 * end, vessel change): a target from before a gesture is the same hazard whatever its shape — R3F
 * delivers no `onPointerOut` for an object that unmounts, so a pre-gesture target could otherwise
 * survive into the next gesture and be committed by a click that only meant to pick.
 */
import type { Slot } from "@/types/domain";
import { rotationNext, samePose } from "@/engine/placement/breakbulk-pose";
import type { BreakbulkPose } from "@/engine/placement/can-place-breakbulk";
import { poseTarget, type DropOutcome } from "@/lib/drop-feedback";
import { staleOutcome } from "@/lib/drop-target";

export type HandKind = "container" | "breakbulk";
/** drag = the button is held (a list drag, or a 3D press past the 4 px threshold); pick = a single
 * pointer click, no drag gesture anywhere. */
export type HandMode = "drag" | "pick";

/** The item in hand: which KIND of cargo, and its id. Holding the ID rather than the object is what
 * makes a vessel switch safe — an id that no longer resolves simply means no hand. */
export interface Hand {
  kind: HandKind;
  id: string;
}

/**
 * The rotation cycle the R key walks (D-P3). Literal, not `number`: `footprintRect` swaps on exactly
 * 90, and a hand that could hold 37° would silently render as an unrotated footprint.
 */
export type HandRotation = 0 | 90;

/** The state this slice reads and writes, declared structurally so the module needs no import of the
 * store that composes it. Everything here is written through `handState`/`endHand` below, which is why
 * the slice takes only `set` and never `get` — plus the view fields the hand is responsible for
 * clearing, which is why they are part of the contract rather than left implicit. */
export interface HandFields {
  inHand: Hand | null;
  handMode: HandMode;
  handRotation: HandRotation;
  /** The pose under the pointer, owned by `AreaDropPlane` (the only writer) and read by the ghost, the
   * chip and the cursor hook — the pose-shaped sibling of `hoveredSlot`. */
  hoveredPose: BreakbulkPose | null;
  hoveredSlot: Slot | null;
  dropOutcome: DropOutcome | null;
  playbackPlaying: boolean;
  /** See the header: a projection of `inHand`, never an independent field. */
  draggingContainerId: string | null;
  pickedId: string | null;
}

/** The hand's own defaults, spread by `usePlanStore` so a field can never be missing from the store. */
export const HAND_DEFAULTS: Pick<HandFields, "inHand" | "handMode" | "handRotation" | "hoveredPose" | "draggingContainerId" | "pickedId"> = {
  inHand: null,
  handMode: "pick", // no hand: read by nothing, and `dragInFlight` requires a non-null hand anyway
  handRotation: 0,
  hoveredPose: null,
  draggingContainerId: null,
  pickedId: null,
};

/**
 * The ONE writer of the hand. Every row is a rule Phase C established, kept verbatim so the container
 * gesture is bit-for-bit what it was:
 *  - `inHand`/`handMode` replace the two container fields, and the pair is mutually exclusive BY
 *    CONSTRUCTION — there is no way to arm a second hand;
 *  - both `hoveredSlot` and `hoveredPose` are cleared (review H1): the target of a gesture must be
 *    established under that gesture's pointer;
 *  - the previous drop outcome is retired (P1 lifetime table): it belonged to the gesture that just
 *    ended;
 *  - the rotation restarts at 0 — a newly lifted item is not the one that was rotated a moment ago;
 *  - a DRAG pauses playback (D3): the dragged item's own placement is hidden while dragging, and an
 *    advancing `playbackCount` would keep re-rendering the scene mid-gesture. A PICK does not pause
 *    it: no pointer is held down, and rotating the ship to find a target is what that flow is for.
 */
export function handState(hand: Hand, mode: HandMode): Partial<HandFields> {
  const containerId = hand.kind === "container" ? hand.id : null;
  return {
    ...endHand(), // hoveredPose/handRotation to their start values, projections to null
    inHand: hand,
    handMode: mode,
    draggingContainerId: mode === "drag" ? containerId : null,
    pickedId: mode === "pick" ? containerId : null,
    hoveredSlot: null,
    dropOutcome: null,
    ...(mode === "drag" ? { playbackPlaying: false } : {}),
  };
}

/**
 * Let go of the hand itself and NOTHING else — deliberately narrower than `handState`:
 *  - `hoveredSlot` survives (hover-to-inspect must outlive an Esc, the documented rule of
 *    `cancelPlacement`);
 *  - the `dropOutcome` survives too: a refused PICK records its reason and then stays armed, and the
 *    planner must still be reading it when the next gesture starts;
 *  - `playbackPlaying` is untouched: releasing a drag never resumes playback.
 * `hoveredPose`/`handRotation` DO go: the drop plane unmounts with the hand, so a pose kept past it
 * would be a target no gesture established, and the next gesture starts unrotated anyway.
 */
export function endHand(): Partial<HandFields> {
  return {
    inHand: null,
    handMode: "pick", // no hand: nothing reads it, and `dragInFlight` requires a non-null hand
    handRotation: 0,
    hoveredPose: null,
    draggingContainerId: null,
    pickedId: null,
  };
}

export interface HandActions {
  /** Start (or replace) a gesture. The ONE entry point both kinds and both modes go through. */
  setHand: (hand: Hand, mode: HandMode) => void;
  /** The container path's entry points, kept API-identical for Phase C: `null` ends the gesture it
   * names and, deliberately, leaves the OTHER one alone. */
  setDraggingContainer: (id: string | null) => void;
  setPicked: (id: string | null) => void;
  /** End a held drag, whichever kind it is carrying — the refused-drag row of the outcome table. */
  endDrag: () => void;
  /** End whatever is in hand (Esc, a release off the canvas, a completed commit, a vessel change). */
  cancelHand: () => void;
  /** The pose under the pointer. `AreaDropPlane` is the only caller. */
  setHoveredPose: (pose: BreakbulkPose | null) => void;
  /** A leave only clears the pose its OWN area owns: crossing from one area onto another can deliver
   * the leave before the next area's move, and clearing unconditionally would blink the ghost off. */
  clearHoveredPose: (areaId: string) => void;
  /** R: the next rotation in the 0↔90 cycle. The caller re-clamps afterwards — see `AreaDropPlane`. */
  rotateHand: () => void;
}

/** The slice of zustand's `set` this module needs. Deliberately narrower than the store's own: the
 * hand must not be able to write state that is not its own. */
export type HandSet = (partial: Partial<HandFields> | ((state: HandFields) => Partial<HandFields>)) => void;

export function createHandActions(set: HandSet): HandActions {
  /** The end rules: `mode === null` lets go of whatever is in hand, a mode lets go only of its own
   * kind of gesture (which is what makes `setPicked(null)` a no-op during a drag). */
  const clear = (mode: HandMode | null) => (s: HandFields): Partial<HandFields> =>
    mode === null || (s.handMode === mode && s.inHand !== null) ? endHand() : s;

  return {
    setHand: (hand, mode) => set(handState(hand, mode)),
    setDraggingContainer: (id) =>
      set(id === null ? clear("drag") : handState({ kind: "container", id }, "drag")),
    setPicked: (id) =>
      set(id === null ? clear("pick") : handState({ kind: "container", id }, "pick")),
    endDrag: () => set(clear("drag")),
    cancelHand: () => set(clear(null)),
    setHoveredPose: (hoveredPose) =>
      set((s) => {
        // The drop plane builds a fresh pose object per pointer move, so identity is not the question:
        // a move that snaps back onto the cell it was already on is the SAME pose, and returning the
        // state object unchanged is zustand's no-op — no listener is even notified.
        if (hoveredPose && s.hoveredPose && samePose(s.hoveredPose, hoveredPose)) return s;
        const target = hoveredPose ? poseTarget(hoveredPose) : null;
        return {
          hoveredPose,
          dropOutcome: staleOutcome(s.dropOutcome, target) ? null : s.dropOutcome,
        };
      }),
    clearHoveredPose: (areaId) =>
      set((s) => (s.hoveredPose?.areaId === areaId ? { hoveredPose: null } : s)),
    rotateHand: () =>
      set((s) => (s.inHand?.kind === "breakbulk" ? { handRotation: rotationNext(s.handRotation) } : s)),
  };
}

/** The item the container layers are driven by: the id in hand, and ONLY when it is a container — a
 * project-cargo hand must leave the slot picker, the slot placeholders and the container ghost dark,
 * which is what "never both layers" means in one expression. A plain string|null, so a component that
 * needs it subscribes with no shallow compare. */
export const activeContainerId = (s: { inHand: Hand | null }): string | null =>
  s.inHand?.kind === "container" ? s.inHand.id : null;

/** The same for project cargo: the id whose regions/ghost/plane are mounted, else null. */
export const activeBreakbulkId = (s: { inHand: Hand | null }): string | null =>
  s.inHand?.kind === "breakbulk" ? s.inHand.id : null;

/** A DRAG is in flight — the button is held, so the camera must not orbit under it (OrbitLock) and the
 * window needs the release listener mounted (the drop release). True for both kinds. */
export const dragInFlight = (s: { inHand: Hand | null; handMode: HandMode }): boolean =>
  s.inHand !== null && s.handMode === "drag";

/** SOMETHING is in hand, whatever kind and whichever mode — the viewer's "get the ship out of the way"
 * condition (`Hull`'s `hidden`). Deliberately broader than `dragInFlight`: a PICK holds no button down
 * and must still get the same view as a drag, and deliberately kind-agnostic, because a container
 * gesture needs the plating gone exactly as much as a project-cargo one does. A boolean, so a
 * subscriber re-renders on the gesture boundary and on nothing else. */
export const handInUse = (s: { inHand: Hand | null }): boolean => s.inHand !== null;
