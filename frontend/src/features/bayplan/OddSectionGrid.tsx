/**
 * OddSectionGrid.tsx — one 20' (odd) bay section, one deck: rows across (port → starboard), tiers down
 * (all-bay overview plan, phase 02). Drawn from the bay-sheet model, so every box — 20' and 40' — is here.
 *
 * Cell looks (print-style bay plan):
 *  - a 20' box, or a 40' box in the FORE section: filled with the colour-mode colour;
 *  - the same 40' box in the AFT section: its colour, faded, with a "×" — "the other half of a 40'";
 *  - hovered / selected: the shared HIGHLIGHT colours, on every cell of that box (its × too) — painted by
 *    `SheetHighlight` through `data-box`, so a hover re-renders no cell;
 *  - a valid position for the box in hand: an OUTLINE, never a fill (a fill already means "cargo here").
 * A position the stack does not have is a blank, so rows and tiers stay aligned across decks and bays.
 */
import type { DeckLevel } from "@/types/domain";
import { containerColor } from "@/lib/colors";
import { sheetCellKey, stackSlotKey, type BayPair } from "@/lib/bay-sheet";
import type { SectionSide } from "@/lib/bay-sheet/bay-cell-target";
import type { BayPlanInteraction } from "./use-bay-plan-interaction";
import { sheetColumns } from "./sheet-columns";
import { TEXT_MIN_CELL_PX } from "./bay-plan-sizes";
import { cellWeightText, readableInk, shortPod } from "@/lib/bay-sheet/cell-text";

const pad2 = (n: number) => String(n).padStart(2, "0");

export function OddSectionGrid({
  pair,
  side,
  deck,
  cellPx,
  tierLabels,
  ix,
}: {
  pair: BayPair;
  side: SectionSide;
  deck: DeckLevel;
  cellPx: number;
  /** A leading column of tier numbers (the single-bay view's fore section). */
  tierLabels: boolean;
  ix: BayPlanInteraction;
}) {
  const tiers = pair.tiers[deck];
  if (tiers.length === 0) return null;
  const section = side === "fore" ? pair.fore : pair.aft;
  // SEACOS info-area style: big cells print the POD and weight. The aft "×" of a 40' prints nothing —
  // its data is written once, in the fore cell, as on a printed plan.
  const withText = cellPx >= TEXT_MIN_CELL_PX;

  return (
    <div className="sheet-grid" style={{ gridTemplateColumns: sheetColumns(pair.rows.length, cellPx, tierLabels) }}>
      {tiers.map((tier) => [
        tierLabels ? <span key={`t${tier}`} className="sheet-tier-label">{pad2(tier)}</span> : null,
        ...pair.rows.map((row) => {
          const key = `${row}:${tier}`;
          if (!pair.stackTiers.get(stackSlotKey(deck, row))?.has(tier)) return <div key={key} className="sheet-blank" />;
          const cell = section.cells.get(sheetCellKey(row, tier));
          const box = cell?.box;
          const valid = !cell && ix.isValid(pair.fortyBay, side, row, tier);
          const cls = ["sheet-cell", cell ? `sheet-cell-${cell.kind}` : "", valid ? "sheet-cell-valid" : ""].join(" ");
          const code = `${pad2(section.bay)}${pad2(row)}${pad2(tier)}`;
          const title = box
            ? `${code} — ${box.id} · ${box.size}' ${box.type} · ${box.weight_t} t · ${box.pod}${cell.kind === "fortyTail" ? " (aft half of a 40')" : ""}`
            : valid ? `${code} — valid position, click to place` : `${code} — empty`;
          const color = box ? containerColor(box, ix.colorMode, ix.pods) : null;
          const text = box && withText && cell.kind !== "fortyTail";
          return (
            <div
              key={key}
              className={cls}
              data-box={box?.id}
              style={color ? ({ "--c": color, "--t": readableInk(color) } as React.CSSProperties) : undefined}
              title={title}
              onMouseEnter={() => box && ix.setHovered(box.id)}
              onMouseLeave={() => box && ix.setHovered(null)}
              onClick={() => ix.onCellClick(pair.fortyBay, side, row, tier, cell)}
            >
              {text && (
                <span className="sheet-cell-text">
                  {shortPod(box.pod)}
                  <br />
                  {cellWeightText(box.weight_t)}
                </span>
              )}
            </div>
          );
        }),
      ])}
    </div>
  );
}
