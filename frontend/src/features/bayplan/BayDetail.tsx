/**
 * BayDetail.tsx — one bay pair drawn large, with its figures (stage-swap plan, phase 02). Extracted from
 * `BayPlanView` so the compact layout (drill-in, "← All bays") and the big layout (below the overview,
 * "✕") draw the same thing; the caller supplies the leading control and the cell size.
 */
import type { ReactNode } from "react";
import type { BayPair } from "@/lib/bay-sheet";
import { BayPairSheet } from "./BayPairSheet";
import { pairSummaryText } from "./sheet-text";
import type { BayPlanInteraction } from "./use-bay-plan-interaction";

const pad2 = (n: number) => String(n).padStart(2, "0");

export function BayDetail({ pair, cellPx, ix, lead }: { pair: BayPair; cellPx: number; ix: BayPlanInteraction; lead: ReactNode }) {
  return (
    <>
      <div className="bayplan-header">
        {lead}
        <strong>Bay {pad2(pair.fortyBay)}</strong>
        <span className="muted small">({pad2(pair.fore.bay)} | {pad2(pair.aft.bay)}) · {pairSummaryText(pair.facts)}</span>
      </div>
      <BayPairSheet pair={pair} cellPx={cellPx} detailed ix={ix} />
    </>
  );
}
