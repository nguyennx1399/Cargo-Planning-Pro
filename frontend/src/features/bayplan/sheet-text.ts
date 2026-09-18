/**
 * sheet-text.ts — the one wording of a bay's figures, used by the overview footer and the single-bay
 * header, so the two always read the same: "12×20' 8×40' · 184 t · 20 TEU free".
 */
import type { BayPairFacts } from "@/lib/bay-sheet";

export const pairSummaryText = (f: BayPairFacts): string =>
  `${f.n20}×20' ${f.n40}×40' · ${Math.round(f.weightT)} t · ${f.freeTeu} TEU free`;
