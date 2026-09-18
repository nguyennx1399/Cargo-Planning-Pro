/**
 * SheetStrips.tsx — the thin rows that run beneath a bay section, all on `sheetColumns` so each lines up
 * with its row (all-bay overview plan, phase 02):
 *  - `StackWeightRow`: each stack's weight against its limit — the SAME numbers the `stack_weight` rule
 *    judges (`BayPair.stackWeights`). The limit is per 40' STACK, so it is drawn once per pair (under the
 *    fore section); drawing it under both 20' sections would invite adding the same tonnes twice.
 *    With room (single-bay view) it prints the tonnes; in the overview a cell is too narrow for digits, so
 *    it shows utilisation as a tint and the numbers in the tooltip. Over the limit is red either way.
 *  - `RowLabels`: the row numbers.
 *  - `RowWeightBars`: the bay's port ↔ starboard weight profile (both decks), as before — now fed from
 *    the stack weights, so 20' boxes count.
 */
import type { DeckLevel } from "@/types/domain";
import { stackSlotKey, type BayPair, type StackWeight } from "@/lib/bay-sheet";
import { sheetColumns } from "./sheet-columns";

/** Utilisation bands for the overview tint. */
const loadClass = (w: StackWeight): string =>
  w.over ? "sheet-stack-over" : w.weightT / w.maxT > 0.8 ? "sheet-stack-high" : w.weightT > 0 ? "sheet-stack-some" : "";

export function StackWeightRow({ pair, deck, cellPx, numbers, labelColumn }: {
  pair: BayPair; deck: DeckLevel; cellPx: number; numbers: boolean; labelColumn: boolean;
}) {
  if (pair.tiers[deck].length === 0) return null;
  return (
    <div className="sheet-strip sheet-stack-row" style={{ gridTemplateColumns: sheetColumns(pair.rows.length, cellPx, labelColumn), height: cellPx }}>
      {labelColumn && <span className="sheet-tier-label" title="Stack weight, t (40' stack)">t</span>}
      {pair.rows.map((row) => {
        const w = pair.stackWeights.get(stackSlotKey(deck, row));
        if (!w) return <span key={row} />;
        return (
          <span
            key={row}
            className={`sheet-stack ${numbers ? (w.over ? "sheet-stack-over-text" : "") : loadClass(w)}`}
            title={`Row ${String(row).padStart(2, "0")} (${deck === "on" ? "on deck" : "in hold"}): ${w.weightT.toFixed(1)} / ${w.maxT} t${w.over ? " — over the limit" : ""}`}
          >
            {numbers && w.weightT > 0 ? Math.round(w.weightT) : ""}
          </span>
        );
      })}
    </div>
  );
}

export function RowLabels({ pair, cellPx, labelColumn }: { pair: BayPair; cellPx: number; labelColumn: boolean }) {
  return (
    <div className="sheet-strip sheet-row-labels" style={{ gridTemplateColumns: sheetColumns(pair.rows.length, cellPx, labelColumn) }}>
      {labelColumn && <span />}
      {pair.rows.map((row) => <span key={row}>{String(row).padStart(2, "0")}</span>)}
    </div>
  );
}

export function RowWeightBars({ pair, cellPx, labelColumn }: { pair: BayPair; cellPx: number; labelColumn: boolean }) {
  const byRow = pair.rows.map((row) =>
    (["on", "under"] as const).reduce((sum, deck) => sum + (pair.stackWeights.get(stackSlotKey(deck, row))?.weightT ?? 0), 0),
  );
  const max = Math.max(1, ...byRow);
  return (
    <div className="sheet-strip sheet-row-weights" style={{ gridTemplateColumns: sheetColumns(pair.rows.length, cellPx, labelColumn) }}>
      {labelColumn && <span />}
      {pair.rows.map((row, i) => (
        <span key={row} className="sheet-row-weight" title={`Row ${String(row).padStart(2, "0")}: ${byRow[i].toFixed(1)} t`}>
          <i style={{ height: `${Math.round((byRow[i] / max) * 100)}%` }} />
        </span>
      ))}
    </div>
  );
}
