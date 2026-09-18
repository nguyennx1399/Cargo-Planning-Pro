/**
 * BayPairCard.tsx — one 40' bay in the all-bay overview (all-bay overview plan, phase 03): a header that
 * opens the bay, a problem dot that opens the Check tab, project-cargo bars, the small bay sheet, and a
 * footer with the bay's figures.
 *
 * Two separate buttons on purpose — the header DRILLS IN, the dot opens the CHECKS, and cells only ever
 * select or place — so no click means two things.
 *
 * The project-cargo bars always take their space (empty when there is none), so every card's hatch line
 * stays level with its neighbours', as on a printed sheet.
 */
import { memo } from "react";
import type { BayPair } from "@/lib/bay-sheet";
import { usePlanStore } from "@/store/usePlanStore";
import { BayPairSheet } from "./BayPairSheet";
import { pairSummaryText } from "./sheet-text";
import type { BayPlanInteraction } from "./use-bay-plan-interaction";

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Memoised: a card re-renders only when its pair (the plan) or the interaction object changes. */
export const BayPairCard = memo(function BayPairCard({ pair, ix, cellPx, selected, detailBelow }: {
  pair: BayPair;
  ix: BayPlanInteraction;
  cellPx: number;
  /** Shown in detail below the overview (big layout). */
  selected: boolean;
  /** Only changes what the header's tooltip SAYS — the click is `setBayFilter` in both layouts. */
  detailBelow: boolean;
}) {
  const setBayFilter = usePlanStore((s) => s.setBayFilter);
  const setSidebarTab = usePlanStore((s) => s.setSidebarTab);
  const { facts } = pair;
  const pcBar = (deck: "on" | "under") => {
    const ids = facts.projectCargo[deck];
    return (
      <div
        className={`pc-bar${ids.length ? " pc-bar-on" : ""}`}
        title={ids.length ? `Project cargo ${deck === "on" ? "on deck" : "in the hold"}: ${ids.join(", ")}` : undefined}
      >
        {ids.length ? `PC ${ids.length}` : ""}
      </div>
    );
  };

  return (
    <div className={`pair-card${selected ? " pair-card-selected" : ""}`} data-bay={pair.fortyBay} aria-current={selected || undefined}>
      <div className="pair-card-head">
        <button type="button" className="pair-card-open" onClick={() => setBayFilter(pair.fortyBay)} title={`${detailBelow ? "Show bay" : "Open bay"} ${pad2(pair.fortyBay)}${detailBelow ? " below" : ""}`}>
          {pad2(pair.fortyBay)}
        </button>
        {facts.worst && (
          <button
            type="button"
            className={`problem-dot problem-dot-${facts.worst}`}
            onClick={() => setSidebarTab("check")}
            title={`${facts.worst === "error" ? "Errors" : "Warnings"} in bay ${pad2(pair.fortyBay)} — open the Check tab`}
            aria-label={`${facts.worst} in bay ${pad2(pair.fortyBay)}`}
          />
        )}
      </div>
      {pcBar("on")}
      <BayPairSheet pair={pair} cellPx={cellPx} detailed={false} ix={ix} />
      {pcBar("under")}
      <div className="pair-card-foot muted">{pairSummaryText(facts)}</div>
    </div>
  );
});
