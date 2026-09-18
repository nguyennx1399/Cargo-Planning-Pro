/**
 * free-space-text.ts — the ONE sentence that reports remaining room.
 *
 * Wording lives outside the component for the same reason `area-fit-hint.ts` does: it is the part a
 * planner actually reads, and a node test can pin it here.
 *
 * THE WORDING RULE, and it is load-bearing: this says SPACE LEFT, never "you can load". Free means "not
 * occupied and not a keep-out" — it says nothing about stack weight, clear height, deck rating, reefer
 * plugs, 20'/40' parity or overstow, all of which can refuse a specific box in a cell this counts as
 * free. A sentence that implies permission would be wrong the moment someone acts on it.
 */
import type { FreeSpaceReport } from "@/engine/free-space";

/** Metres² with a thin space for thousands, so 1240 reads as "1 240 m²" rather than "1240m²". */
const m2 = (value: number): string => `${Math.round(value).toLocaleString("en-GB").replace(/,/g, " ")} m²`;

/**
 * `"Space left: 148 TEU (96 on deck · 52 under deck) · weather deck 310 m² of 1 240 m² free"`, or a
 * plain statement when the ship is full.
 *
 * The area clause names at most the two largest areas: a heavy-lift vessel has four, and a sentence
 * listing all of them stops being read.
 */
export function freeSpaceSummary(report: FreeSpaceReport): string {
  const teu = report.freeTeuOnDeck + report.freeTeuUnderDeck;
  const ground = report.areas.reduce((sum, a) => sum + a.freeM2, 0);
  if (teu === 0 && ground < 1) return "No space left — every cell is taken and no clear ground remains.";

  const parts: string[] = [];
  parts.push(
    teu === 0
      ? "Space left: no free container cells"
      : `Space left: ${teu} TEU (${report.freeTeuOnDeck} on deck · ${report.freeTeuUnderDeck} under deck)`,
  );

  const biggest = [...report.areas].sort((a, b) => b.freeM2 - a.freeM2).slice(0, 2).filter((a) => a.freeM2 >= 1);
  for (const area of biggest) parts.push(`${area.label} ${m2(area.freeM2)} of ${m2(area.totalM2)} free`);

  return parts.join(" · ");
}

/** The caveat, shown beside the summary. Separate from the sentence so the UI can style it as the
 * footnote it is, and so the test above pins the numbers without the prose. */
export const FREE_SPACE_CAVEAT =
  "Free = nothing standing there. Whether a given item fits also depends on weight, height and the stowage rules.";
