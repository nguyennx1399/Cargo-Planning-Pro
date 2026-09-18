import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useShallow } from "zustand/react/shallow";
import type { BreakbulkCargo, StowagePlan, Vessel } from "@/types/domain";
import { WEATHER_DECK_AREA_ID, buildStowageModel } from "@/engine/stowage-model";
import {
  dropOutcomeText, dropPoseVerdictText, dropVerdictText, type DropFeedback,
} from "@/lib/drop-feedback";
import { verdictForSlot } from "@/lib/drop-verdict";
import { verdictForPose } from "@/lib/pose-verdict";
import { activeContainerId, usePlanStore } from "@/store/usePlanStore";

/** The chip's offset from the cursor's tip — close enough to read without covering the target. */
const OFFSET_X = 16;
const OFFSET_Y = 18;

/**
 * The chip's transform for one cursor position, flipped to the cursor's other side when it would leave
 * the viewport. A pure function of numbers so the pointer-move path never reads layout.
 */
function chipTransform(
  x: number,
  y: number,
  size: { w: number; h: number },
  viewport: { w: number; h: number },
): string {
  const left = x + OFFSET_X + size.w > viewport.w ? x - OFFSET_X - size.w : x + OFFSET_X;
  const top = y + OFFSET_Y + size.h > viewport.h ? y - OFFSET_Y - size.h : y + OFFSET_Y;
  return `translate3d(${Math.max(0, left)}px, ${Math.max(0, top)}px, 0)`;
}

/** Everything the chip needs to word the CURRENT state: both kinds of hand, both kinds of target, and
 * the recorded outcome. Built by the component below so this stays a pure function of the store. */
interface ChipText {
  /** The project-cargo pose under the cursor, when a project-cargo item is in hand. */
  poseText: DropFeedback | null;
  /** The container slot under the cursor, when a container is in hand. */
  slotText: DropFeedback | null;
  /** The last committed scene drop, when nothing is under the cursor. */
  outcomeText: DropFeedback | null;
}

/**
 * The ONE sentence this chip shows, in priority order: the pose under the cursor, the slot under the
 * cursor, then the last committed scene outcome. The first two can never both apply — the hand's kind
 * decides which pick layer is mounted, so at most one of them has a target at all — and the third is
 * the fallback that keeps a refused drop readable after the pointer has moved on (review M2).
 */
function chipText(input: ChipText): DropFeedback | null {
  return input.poseText ?? input.slotText ?? input.outcomeText;
}

/**
 * The at-cursor drop verdict (P1, requirement 1; decision D4): while an item is in hand and a target
 * is hovered it repeats the Sidebar's verdict at the point of action, and after a committed drop it
 * becomes the outcome — so a refused PICK, whose reason used to be visible only while the pointer
 * stayed on the target (review M2), now leaves a readable record beside the cursor.
 *
 * All branches render `drop-feedback.ts`, the SAME functions the Sidebar and the 2D notice use, so no
 * two surfaces can word one drop differently. The reason is a WebGL mesh cannot: a mesh carries tint
 * only, and this is the DOM half of that pair.
 *
 * The pose branch reads the store's `hoveredPose` (Phase 03): the drop plane publishes it, so the mesh
 * the planner sees and the sentence beside the cursor come from one value and one memoised predicate
 * call — the prop-seam this component used to expose for the second cargo kind is gone with it.
 *
 * `aria-hidden` is deliberate, not an oversight: the Sidebar renders the same sentence accessibly, and
 * an `aria-live` region rewritten on every pointer move would flood a screen reader with verdicts for
 * targets the planner is merely passing over. This element is a pointer-user affordance only.
 *
 * `position: fixed` + `transform` written imperatively from a window `pointermove` listener: no store
 * write and no `setState` per move, which would re-render the whole sidebar tree at pointer frequency.
 * (Fixed positioning resolves against the browser viewport here — no ancestor of `.viewport` may
 * acquire a transform/filter/`contain`, which would silently make it a containing block.)
 */
export function DropVerdictChip({ vessel, plan }: { vessel: Vessel; plan: StowagePlan }) {
  const { hoveredSlot, hoveredPose, dropOutcome, hand } = usePlanStore(
    useShallow((s) => ({
      hoveredSlot: s.hoveredSlot,
      hoveredPose: s.hoveredPose,
      dropOutcome: s.dropOutcome,
      hand: s.inHand,
    })),
  );
  // The container id, and ONLY for a container hand: the pose branch below must not see one.
  const activeId = usePlanStore(activeContainerId);

  const container = activeId ? plan.containers.find((c) => c.id === activeId) : undefined;
  const cargo: BreakbulkCargo | undefined =
    hand?.kind === "breakbulk" ? plan.breakbulk_cargo.find((c) => c.id === hand.id) : undefined;

  // The same call, with the same arguments, that the ghost / placeholders / Sidebar make — so the
  // one-entry memos collapse every reader into ONE predicate call per pointer move (review M4 must not
  // be undone by adding this one, which is why it does not re-implement the target lookup).
  const slotVerdict = useMemo(
    () => (container && hoveredSlot ? verdictForSlot(vessel, plan, container, hoveredSlot) : null),
    [vessel, plan, container, hoveredSlot],
  );
  const poseVerdict = useMemo(
    () => (cargo && hoveredPose ? verdictForPose(vessel, plan, cargo, hoveredPose) : null),
    [vessel, plan, cargo, hoveredPose],
  );
  // The area's own label ("weather deck", "Hold 2 tank top") — the chip takes it from the model the
  // drop plane's `areaId` came from, rather than from a second prop the caller would have to thread.
  const areaLabel = useMemo(() => {
    if (!hoveredPose) return null;
    const label = buildStowageModel(vessel).areaById.get(hoveredPose.areaId || WEATHER_DECK_AREA_ID)?.label ?? null;
    // On a stacking support, say so first: "on FRAME-1, weather deck 87.5 / 0.5 m".
    return label && hoveredPose.onCargoId ? `on ${hoveredPose.onCargoId}, ${label}` : label;
  }, [vessel, hoveredPose]);

  const text = chipText({
    slotText: container && hoveredSlot && slotVerdict ? dropVerdictText(hoveredSlot, slotVerdict, container.id) : null,
    poseText:
      cargo && hoveredPose && poseVerdict && areaLabel
        ? dropPoseVerdictText(areaLabel, hoveredPose, poseVerdict, cargo.id)
        : null,
    // Only a "scene" outcome belongs at the cursor: a bay-plan cell's outcome is rendered by that
    // panel, beside the grid it is about.
    outcomeText: dropOutcome && dropOutcome.origin === "scene" ? dropOutcomeText(dropOutcome) : null,
  });

  const elRef = useRef<HTMLDivElement>(null);
  const cursor = useRef({ x: 0, y: 0 });
  const size = useRef({ w: 0, h: 0 });

  const place = (x: number, y: number) => {
    const el = elRef.current;
    if (el) el.style.transform = chipTransform(x, y, size.current, { w: window.innerWidth, h: window.innerHeight });
  };

  // Measured when the CONTENT changes, never per pointer move (`offsetWidth` is a layout read, and this
  // element moves at pointer frequency). Measuring here also places it before the first paint, so a
  // chip that appears under an already-stationary cursor is not briefly at the browser's origin.
  const headline = text?.headline ?? null;
  const detail = text?.detail ?? null;
  useLayoutEffect(() => {
    const el = elRef.current;
    if (!el) return;
    size.current = { w: el.offsetWidth, h: el.offsetHeight };
    place(cursor.current.x, cursor.current.y);
    // Keyed on the rendered text only: `place` reads the refs, so the size is the sole input that can
    // change without a pointer move. Same content → same size → nothing to re-measure.
  }, [headline, detail]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      cursor.current = { x: e.clientX, y: e.clientY };
      place(e.clientX, e.clientY);
    };
    // Passive: this listener never prevents anything, and it must not delay the canvas's own handling.
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
    // Attached ONCE: `onMove`/`place` touch refs and the DOM node only, so no dependency can go stale.
  }, []);

  if (!text) return null;

  return (
    <div ref={elRef} className={`drop-chip ${text.tone}`} aria-hidden="true">
      {text.headline && <p className="drop-chip-headline">{text.headline}</p>}
      <p className="drop-chip-detail">{text.detail}</p>
    </div>
  );
}
