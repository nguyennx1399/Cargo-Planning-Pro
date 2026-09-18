/**
 * BayPairSheet.tsx — one 40' bay as a print-style bay-plan pair: the FORE and AFT 20' sections side by
 * side, each with the deck above the hatch line and the hold below (all-bay overview plan, phase 02).
 *
 * The single-bay view draws it large with numbers and tier labels; the overview draws it small without
 * them. It is the same component, fed the same model, so the two views cannot show different things.
 *
 * Stack weights sit OUTSIDE the stacks they describe — the deck's above the deck block, the hold's below
 * the hold block — and only under the fore section (the limit is per 40' stack; see `SheetStrips`). The
 * aft column keeps an equal-height spacer so both sections' decks stay level.
 */
import type { SectionSide } from "@/lib/bay-sheet/bay-cell-target";
import type { BayPair } from "@/lib/bay-sheet";
import { OddSectionGrid } from "./OddSectionGrid";
import { NUMBERS_MIN_CELL_PX } from "./bay-plan-sizes";
import { RowLabels, RowWeightBars, StackWeightRow } from "./SheetStrips";
import type { BayPlanInteraction } from "./use-bay-plan-interaction";

const pad2 = (n: number) => String(n).padStart(2, "0");

export interface BayPairSheetProps {
  pair: BayPair;
  cellPx: number;
  /** The single-bay detail: tier labels and the row-weight profile. (Stack tonnes are printed whenever the
   * cell is big enough — `NUMBERS_MIN_CELL_PX` — so the big overview gets them too.) */
  detailed: boolean;
  ix: BayPlanInteraction;
}

export function BayPairSheet({ pair, cellPx, detailed, ix }: BayPairSheetProps) {
  const column = (side: SectionSide) => {
    const section = side === "fore" ? pair.fore : pair.aft;
    const labels = detailed && side === "fore";
    const stackRow = (deck: "on" | "under") =>
      side === "fore" ? (
        <StackWeightRow pair={pair} deck={deck} cellPx={cellPx} numbers={cellPx >= NUMBERS_MIN_CELL_PX} labelColumn={labels} />
      ) : pair.tiers[deck].length > 0 ? (
        <div className="sheet-stack-spacer" style={{ height: cellPx }} />
      ) : null;
    return (
      <div className="sheet-section" key={side}>
        <div className="sheet-section-head" title={`${side === "fore" ? "Fore" : "Aft"} 20' bay of 40' bay ${pad2(pair.fortyBay)}`}>
          {pad2(section.bay)}
        </div>
        {stackRow("on")}
        <OddSectionGrid pair={pair} side={side} deck="on" cellPx={cellPx} tierLabels={labels} ix={ix} />
        <div className="sheet-hatchline" />
        <OddSectionGrid pair={pair} side={side} deck="under" cellPx={cellPx} tierLabels={labels} ix={ix} />
        {stackRow("under")}
        <RowLabels pair={pair} cellPx={cellPx} labelColumn={labels} />
        {detailed && side === "fore" && <RowWeightBars pair={pair} cellPx={cellPx} labelColumn={labels} />}
      </div>
    );
  };
  return <div className="sheet-pair">{column("fore")}{column("aft")}</div>;
}
