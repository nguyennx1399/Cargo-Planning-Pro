import { useMemo, type ReactNode } from "react";
import { useShallow } from "zustand/react/shallow";
import type { StowagePlan, ValidationReport, Vessel } from "@/types/domain";
import { usePlanStore } from "@/store/usePlanStore";
import { useStageLayout } from "@/store/stage-layout-store";
import { buildBayPairs } from "@/lib/bay-sheet";
import { StageSwapButton } from "@/features/stage/StageSwapButton";
import { BayDetail } from "./BayDetail";
import { BayOverview } from "./BayOverview";
import { SHEET_SIZES } from "./bay-plan-sizes";
import { SheetHighlight } from "./SheetHighlight";
import { useBayPlanInteraction, type BayPlanInteraction } from "./use-bay-plan-interaction";

const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * The stage's bay plan (all-bay overview + stage-swap plans): a SEACOS / printed-plan style sheet, built
 * from ONE model (`buildBayPairs`) for every view of it.
 *
 *  - COMPACT (under the 3D view): no bay picked → the overview; a bay picked (`bayFilter`, which also
 *    filters 3D) → that bay's detail with "← All bays".
 *  - BIG (the swapped layout, the 3D view in a corner): the overview AND the picked bay's detail together;
 *    picking a bay shows it below instead of navigating away, "✕" clears it.
 *
 * Each 40' bay is its two 20' (odd) sections: a 20' box in its own section, a 40' box in the fore one and
 * "×" in the aft one. Cells are the 2D trigger of the one commit resolver (`useBayPlanInteraction`).
 */
export function BayPlanView({ vessel, plan, report }: { vessel: Vessel; plan: StowagePlan; report?: ValidationReport }) {
  const { bay, playbackCount, setBayFilter } = usePlanStore(
    useShallow((s) => ({ bay: s.bayFilter, playbackCount: s.playbackCount, setBayFilter: s.setBayFilter })),
  );
  const big = useStageLayout((s) => s.stageLayout) === "plan";
  const pairs = useMemo(() => buildBayPairs(vessel, plan, report, playbackCount), [vessel, plan, report, playbackCount]);
  const ix = useBayPlanInteraction(vessel, plan);
  const pair = bay === null ? undefined : pairs.find((p) => p.fortyBay === bay);
  const sizes = big ? SHEET_SIZES.big : SHEET_SIZES.compact;
  const missing = bay !== null && !pair ? <span>Bay {pad2(bay)} is not a 40' bay on this vessel.</span> : null;

  if (big) {
    return (
      <div className="bayplan-big">
        <SheetHighlight />
        <BayOverview plan={plan} pairs={pairs} ix={ix} cellPx={sizes.overview} selectedBay={bay} detailBelow headerExtra={<StageSwapButton />} />
        <div className="bayplan-big-detail">
          {pair ? (
            <BayDetail pair={pair} cellPx={sizes.detail} ix={ix} lead={<CloseButton onClick={() => setBayFilter(null)} />} />
          ) : (
            missing ?? <p className="muted">Click a bay number above to see its detail here.</p>
          )}
        </div>
      </div>
    );
  }

  if (bay === null) {
    return (
      <>
        <SheetHighlight />
        <BayOverview plan={plan} pairs={pairs} ix={ix} cellPx={sizes.overview} selectedBay={null} detailBelow={false} />
      </>
    );
  }
  const back = <button type="button" className="sheet-back" onClick={() => setBayFilter(null)}>← All bays</button>;
  if (!pair) return <div className="bayplan-placeholder">{back}{missing}</div>;
  return (
    <div className="bayplan-grid">
      <SheetHighlight />
      <PlacingLines ix={ix} bay={bay} />
      <BayDetail pair={pair} cellPx={sizes.detail} ix={ix} lead={back} />
    </div>
  );
}

function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="sheet-back" onClick={onClick} title="Close the bay detail" aria-label="Close the bay detail">
      ✕
    </button>
  );
}

/** The "placing X" hint and the last bay-plan drop outcome for this bay (compact detail only — the big
 * layout's overview shows them for the whole sheet). */
function PlacingLines({ ix, bay }: { ix: BayPlanInteraction; bay: number }): ReactNode {
  const notice = ix.noticeFor(bay);
  return (
    <>
      {ix.activeContainer && (
        <p className="muted small">
          Placing {ix.activeContainer.id} ({ix.activeContainer.size}') — outlined cells are valid positions. Click one to place it, Esc to cancel.
        </p>
      )}
      {notice && <p className={`small ${notice.tone}`}>{notice.detail}</p>}
    </>
  );
}
