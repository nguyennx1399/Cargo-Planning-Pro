/**
 * BayOverview.tsx — the whole ship's container stow as one print-style bay-plan sheet (all-bay overview
 * plan, phase 03): the colour key on top, then every 40' bay pair bow → stern, left → right.
 *
 * SHIP-WIDE TIER AXIS: every card is drawn on the union of all bays' deck and hold tiers, so every hatch
 * line sits at the same height across the sheet (a bay with fewer tiers shows blanks), as on a printed
 * stowage plan. The single-bay view keeps its own tiers.
 *
 * Interaction is the single-bay view's, through the same `useBayPlanInteraction` object: hover/select sync
 * with 3D, and with cargo in hand every bay's valid cells are outlined and a click places it.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import type { DeckLevel, StowagePlan } from "@/types/domain";
import { boxesOf, type BayPair } from "@/lib/bay-sheet";
import { BayPairCard } from "./BayPairCard";
import { ColorLegend } from "./ColorLegend";
import type { BayPlanInteraction } from "./use-bay-plan-interaction";

/** Where the strip was scrolled to, per vessel. Opening a bay unmounts the overview; "← All bays" must
 * bring the planner back to the bays they were looking at, not to bay 01. Module state on purpose: it is
 * a view convenience that no other component needs, and it must outlive the component. */
const scrollByVessel = new Map<string, number>();

export function BayOverview({ plan, pairs, ix, cellPx, selectedBay, detailBelow, headerExtra }: {
  plan: StowagePlan;
  pairs: BayPair[];
  ix: BayPlanInteraction;
  cellPx: number;
  /** The bay shown in detail below (big layout), highlighted here; null in the compact layout. */
  selectedBay: number | null;
  /** Big layout: a bay number shows that bay BELOW the overview instead of opening it in its place. */
  detailBelow: boolean;
  headerExtra?: ReactNode;
}) {
  const stripRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (stripRef.current) stripRef.current.scrollLeft = scrollByVessel.get(plan.vessel_id) ?? 0;
  }, [plan.vessel_id]);
  // A bay picked ELSEWHERE (the sidebar's bay stepper, `[` / `]`) scrolls its card into view.
  useEffect(() => {
    if (selectedBay === null) return;
    stripRef.current?.querySelector(`[data-bay="${selectedBay}"]`)?.scrollIntoView({ inline: "nearest", block: "nearest" });
  }, [selectedBay]);
  const shipPairs = useMemo(() => {
    const union = (deck: DeckLevel) => [...new Set(pairs.flatMap((p) => p.tiers[deck]))].sort((a, b) => b - a);
    const tiers = { on: union("on"), under: union("under") };
    return pairs.map((p) => ({ ...p, tiers }));
  }, [pairs]);
  const boxes = useMemo(() => boxesOf(pairs), [pairs]);
  const notice = ix.noticeFor(null);

  return (
    <div className="bay-overview">
      <div className="bay-overview-top">
        {headerExtra}
        <strong>Bay plan</strong>
        <span className="muted small">
          {pairs.length} bays · click a bay number to {detailBelow ? "show it below" : "open it"}
        </span>
        <ColorLegend boxes={boxes} mode={ix.colorMode} pods={ix.pods} ports={plan.ports} />
      </div>
      {ix.activeContainer && (
        <p className="muted small">
          Placing {ix.activeContainer.id} ({ix.activeContainer.size}') — outlined cells in any bay are valid. Click one to place it, Esc to cancel.
        </p>
      )}
      {notice && <p className={`small ${notice.tone}`}>{notice.detail}</p>}
      <div
        className="bay-overview-strip"
        ref={stripRef}
        onScroll={(e) => scrollByVessel.set(plan.vessel_id, e.currentTarget.scrollLeft)}
      >
        {shipPairs.map((pair) => (
          <BayPairCard key={pair.fortyBay} pair={pair} ix={ix} cellPx={cellPx} selected={pair.fortyBay === selectedBay} detailBelow={detailBelow} />
        ))}
      </div>
    </div>
  );
}
