import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useShallow } from "zustand/react/shallow";
import type { StowagePlan, Vessel } from "@/types/domain";
import { dropOutcomeText, dropVerdictText, type DropFeedback } from "@/lib/drop-feedback";
import { verdictForSlot } from "@/lib/drop-verdict";
import { activeContainerId, usePlanStore } from "@/store/usePlanStore";

/** The chip's offset from the cursor's tip — close enough to read without covering the slot. */
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

/**
 * The at-cursor drop verdict (P1, requirement 1; decision D4): while a container is in hand and a slot
 * is hovered it repeats the Sidebar's verdict at the point of action, and after a committed drop it
 * becomes the outcome — so a refused PICK, whose reason used to be visible only while the pointer
 * stayed on the slot (review M2), now leaves a readable record beside the cursor.
 *
 * Both branches render `drop-feedback.ts`, the SAME functions the Sidebar and the 2D notice use, so
 * the three can never word one drop differently. The reason is a WebGL mesh cannot: a mesh carries tint
 * only, and this is the DOM half of that pair.
 *
 * `aria-hidden` is deliberate, not an oversight: the Sidebar renders the same sentence accessibly, and
 * an `aria-live` region rewritten on every pointer move would flood a screen reader with verdicts for
 * slots the planner is merely passing over. This element is a pointer-user affordance only.
 *
 * `position: fixed` + `transform` written imperatively from a window `pointermove` listener: no store
 * write and no `setState` per move, which would re-render the whole sidebar tree at pointer frequency.
 * (Fixed positioning resolves against the browser viewport here — no ancestor of `.viewport` may
 * acquire a transform/filter/`contain`, which would silently make it a containing block.)
 */
export function DropVerdictChip({ vessel, plan }: { vessel: Vessel; plan: StowagePlan }) {
  const { hoveredSlot, dropOutcome, activeId } = usePlanStore(
    useShallow((s) => ({
      hoveredSlot: s.hoveredSlot,
      dropOutcome: s.dropOutcome,
      activeId: activeContainerId(s),
    })),
  );

  const container = activeId ? plan.containers.find((c) => c.id === activeId) : undefined;
  // The same call, with the same arguments, that the ghost / placeholders / Sidebar make — so the
  // one-entry memo in `drop-verdict.ts` collapses every reader into ONE predicate call per pointer
  // move (review M4 must not be undone by adding this one).
  const verdict = useMemo(
    () => (container && hoveredSlot ? verdictForSlot(vessel, plan, container, hoveredSlot) : null),
    [vessel, plan, container, hoveredSlot],
  );

  const text: DropFeedback | null =
    container && hoveredSlot && verdict
      ? dropVerdictText(hoveredSlot, verdict, container.id)
      : // Only a "scene" outcome belongs at the cursor: a bay-plan cell's outcome is rendered by that
        // panel, beside the grid it is about.
        dropOutcome && dropOutcome.origin === "scene"
        ? dropOutcomeText(dropOutcome)
        : null;

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
