/**
 * rect-union-area.ts — the area covered by a set of rectangles, counting overlaps ONCE.
 *
 * WHY IT IS NEEDED: the rectangles this app has to add up genuinely overlap — two container stacks in
 * adjacent bays touch, a crane foundation keep-out can sit under a stack, and a project-cargo footprint
 * can straddle both. Summing their areas therefore over-reports "taken ground", which would under-report
 * the free space a planner is trying to read. A capacity number that is quietly wrong is worse than no
 * number at all.
 *
 * ALGORITHM: a sweep over the x edges. Between two consecutive x edges the set of covering rectangles is
 * constant, so the covered z-extent is the union of those rectangles' z intervals (merged), and the
 * strip contributes width × merged-z-length. O(n² log n) for n rectangles, which is nothing at the
 * scale here — a few dozen per area.
 *
 * Degenerate rectangles (zero width or depth) contribute nothing and are skipped rather than special-
 * cased downstream.
 */
import type { Rect } from "./breakbulk-overlap-check";

/** Total z-length covered by these intervals, overlaps merged. */
function mergedLength(intervals: [number, number][]): number {
  if (intervals.length === 0) return 0;
  const sorted = [...intervals].sort((a, b) => a[0] - b[0]);
  let total = 0;
  let [start, end] = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    const [s, e] = sorted[i];
    if (s > end) {
      total += end - start;
      start = s;
      end = e;
    } else if (e > end) {
      end = e;
    }
  }
  return total + (end - start);
}

/** Area covered by the union of `rects` — overlapping ground counted once. */
export function rectUnionArea(rects: readonly Rect[]): number {
  const real = rects.filter((r) => r.xMax > r.xMin && r.zMax > r.zMin);
  if (real.length === 0) return 0;

  const edges = [...new Set(real.flatMap((r) => [r.xMin, r.xMax]))].sort((a, b) => a - b);
  let area = 0;
  for (let i = 0; i < edges.length - 1; i++) {
    const xStart = edges[i];
    const xEnd = edges[i + 1];
    const width = xEnd - xStart;
    if (width <= 0) continue;
    // A rectangle covers this strip when it spans the whole strip — by construction of the edge list it
    // either does or does not overlap it at all.
    const spans = real.filter((r) => r.xMin <= xStart && r.xMax >= xEnd);
    area += width * mergedLength(spans.map((r) => [r.zMin, r.zMax] as [number, number]));
  }
  return area;
}

/** The plain area of one rectangle — here so callers do not re-derive the sign conventions. */
export const rectArea = (rect: Rect): number =>
  Math.max(0, rect.xMax - rect.xMin) * Math.max(0, rect.zMax - rect.zMin);
