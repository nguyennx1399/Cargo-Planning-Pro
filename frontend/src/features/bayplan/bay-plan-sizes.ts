/**
 * bay-plan-sizes.ts — every bay-sheet cell size and the thresholds that depend on it, in one place
 * (stage-swap plan, phase 02).
 *
 *  - compact: the bay plan UNDER the 3D view (a ~315 px panel) — the original sizes;
 *  - big: the bay plan filling the stage (the swapped layout) — overview and detail shown together.
 */
export const SHEET_SIZES = {
  compact: { overview: 10, detail: 14 },
  big: { overview: 14, detail: 28 },
} as const;

/** From this cell size a stack-weight cell has room for two digits of tonnes (else: a tint). */
export const NUMBERS_MIN_CELL_PX = 14;

/** From this cell size a box cell has room for its POD and weight (SEACOS info-area style). */
export const TEXT_MIN_CELL_PX = 26;
