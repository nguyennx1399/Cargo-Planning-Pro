/**
 * area-fit-hint.ts — the ONE wording for "where could this item go AT ALL" (Phase D, requirement 2).
 * Two surfaces ask it: every row of the unplaced list (its badge) and the sidebar's line for the item
 * currently in hand. They used to be free to differ ("no area fits" on the row, "nothing fits" in the
 * hint), which is how a planner ends up reading two different answers to one question.
 *
 * The list of area labels comes from `freeRegionsFor`'s `feasible` set — never from a second rule —
 * so this module owns phrasing only and stays pure (no three/react/store imports), which is what lets
 * a node test pin the two sentences.
 */

/** `"fits in: weather deck, Hold 2 tank top"`, or `"nothing fits"` when no area admits the item at
 * all. The empty case is a real answer, not an error: a 62 m item on a 30 m hatch fits nowhere, and
 * saying so is what stops a planner from hunting for a hole in the area list. */
export function fitsInText(areaLabels: readonly string[]): string {
  return areaLabels.length === 0 ? "nothing fits" : `fits in: ${areaLabels.join(", ")}`;
}

/**
 * The same sentence for the item IN HAND, extended with what the free-space scan found (Phase 03).
 * `fitsInText` answers "does this item BELONG anywhere on this ship"; it says nothing about whether
 * the ground is taken, and on a loaded ship that is how a planner ends up aiming at four areas that
 * refuse every single pose.
 *
 * Three states, and the wording is deliberately as strong as the evidence and no stronger:
 *  - nothing fits at all            -> `fitsInText`'s own sentence, unchanged;
 *  - fits and the scan found room   -> the plain "fits in: …" (the ghost still owns the per-pose promise);
 *  - fits but the scan found none   -> says so, and names what is in the way.
 *
 * "no free spot found" rather than "there is no room": the scan walks a 2 m lattice (see
 * `area-free-space.ts`), so it can miss a gap a careful hand could still hit.
 */
export function handFitsInText(
  areaLabels: readonly string[],
  freeSpace: { found: boolean; blocker: string | null },
): string {
  const fits = fitsInText(areaLabels);
  if (areaLabels.length === 0 || freeSpace.found) return fits;
  return `${fits} — but no free spot found${freeSpace.blocker ? ` (${freeSpace.blocker})` : ""}`;
}
