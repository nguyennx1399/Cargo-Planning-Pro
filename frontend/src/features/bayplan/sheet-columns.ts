/**
 * sheet-columns.ts — the ONE grid template every strip of a bay section uses (cells, stack weights, row
 * labels, row weights), so a row's column lines up from the top of the deck to the bottom of the hold.
 * An optional leading column holds the tier labels; strips without labels leave it empty.
 */
export const TIER_LABEL_PX = 18;

export const sheetColumns = (rows: number, cellPx: number, labelColumn: boolean): string =>
  `${labelColumn ? `${TIER_LABEL_PX}px ` : ""}repeat(${rows}, ${cellPx}px)`;
