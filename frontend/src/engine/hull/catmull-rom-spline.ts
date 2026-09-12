// Centripetal Catmull-Rom spline through 2D control points, plus even-arc-length resampling.
// Shared by the parametric hull generator (phase 2) and, later, offsets lofting from real
// bodyplan traces (phase 4) — one mesher, one spline implementation (plan G2).

export type Point2 = [number, number];

/** Evaluates the spline at t in [0, 1] across the WHOLE control-point sequence (t=0 is the
 * first point, t=1 the last). Passes exactly through every control point. Endpoints are
 * extrapolated linearly (mirrored) so the curve doesn't need points outside the given range. */
export function catmullRomEval(points: Point2[], t: number): Point2 {
  if (points.length === 0) throw new Error("catmullRomEval: points is empty");
  if (points.length === 1) return [...points[0]];
  if (points.length === 2) return lerp(points[0], points[1], clamp01(t));

  const before = mirror(points[1], points[0]);
  const after = mirror(points[points.length - 2], points[points.length - 1]);
  const extended = [before, ...points, after];

  const segCount = points.length - 1;
  const segT = clamp01(t) * segCount;
  const i = Math.min(Math.floor(segT), segCount - 1);
  const localT = segT - i;
  return centripetalSegment(extended[i], extended[i + 1], extended[i + 2], extended[i + 3], localT);
}

/** Resamples the spline to `n` points evenly spaced by arc length (not by parameter t). */
export function catmullRomResample(points: Point2[], n: number): Point2[] {
  if (n < 2) throw new Error("catmullRomResample: n must be >= 2");
  if (points.length === 1) return Array.from({ length: n }, () => [...points[0]] as Point2);

  const DENSE = Math.max(200, n * 8);
  const dense: Point2[] = Array.from({ length: DENSE + 1 }, (_, i) => catmullRomEval(points, i / DENSE));
  const cumLength = [0];
  for (let i = 1; i <= DENSE; i++) cumLength.push(cumLength[i - 1] + dist(dense[i - 1], dense[i]));
  const total = cumLength[DENSE];

  const out: Point2[] = [];
  for (let k = 0; k < n; k++) {
    const target = (total * k) / (n - 1);
    let lo = 0;
    let hi = DENSE;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cumLength[mid] < target) lo = mid + 1;
      else hi = mid;
    }
    const i = Math.max(1, lo);
    const t0 = cumLength[i - 1];
    const t1 = cumLength[i];
    const f = t1 > t0 ? (target - t0) / (t1 - t0) : 0;
    out.push(lerp(dense[i - 1], dense[i], f));
  }
  return out;
}

function centripetalSegment(p0: Point2, p1: Point2, p2: Point2, p3: Point2, t: number): Point2 {
  const alpha = 0.5;
  const t0 = 0;
  const t1 = t0 + Math.max(dist(p0, p1), 1e-9) ** alpha;
  const t2 = t1 + Math.max(dist(p1, p2), 1e-9) ** alpha;
  const t3 = t2 + Math.max(dist(p2, p3), 1e-9) ** alpha;
  const tt = t1 + t * (t2 - t1);
  const a1 = lerpAt(p0, p1, t0, t1, tt);
  const a2 = lerpAt(p1, p2, t1, t2, tt);
  const a3 = lerpAt(p2, p3, t2, t3, tt);
  const b1 = lerpAt(a1, a2, t0, t2, tt);
  const b2 = lerpAt(a2, a3, t1, t3, tt);
  return lerpAt(b1, b2, t1, t2, tt);
}

function lerpAt(p: Point2, q: Point2, ta: number, tb: number, t: number): Point2 {
  if (tb - ta < 1e-9) return p;
  return lerp(p, q, (t - ta) / (tb - ta));
}

function lerp(p: Point2, q: Point2, f: number): Point2 {
  return [p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f];
}

function mirror(from: Point2, about: Point2): Point2 {
  return [2 * about[0] - from[0], 2 * about[1] - from[1]];
}

function dist(a: Point2, b: Point2): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function clamp01(t: number): number {
  return Math.min(Math.max(t, 0), 1);
}
