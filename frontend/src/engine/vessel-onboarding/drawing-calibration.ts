// Maps pixel coordinates on a scanned drawing to ship-frame coordinates, from 2 or 3 known
// point correspondences (e.g. AP and FP on a profile view). A 3rd point (not used to solve the
// transform) gives a residual — the cheapest, most convincing check that the drawing and the
// declared ship-frame origin actually agree (plan phase-05 Key Insight).
export interface Point2 {
  x: number;
  y: number;
}

/** Uniform scale + rotation + translation (no shear) — solved from exactly 2 point pairs via
 * complex-number division, which gives the scale+rotation directly without trigonometry. */
export interface SimilarityTransform {
  a: number; // [[a, -b], [b, a]] + translation
  b: number;
  tx: number;
  ty: number;
}

/** Independent x/y scale + shear + rotation + translation — solved from exactly 3 point pairs.
 * Use when a scan is stretched unevenly (e.g. scanned at a slight angle on a flatbed). */
export interface AffineTransform {
  m11: number;
  m12: number;
  m21: number;
  m22: number;
  tx: number;
  ty: number;
}

export function solveSimilarity(srcA: Point2, tgtA: Point2, srcB: Point2, tgtB: Point2): SimilarityTransform {
  const dSrc = { x: srcB.x - srcA.x, y: srcB.y - srcA.y };
  const dTgt = { x: tgtB.x - tgtA.x, y: tgtB.y - tgtA.y };
  const denom = dSrc.x * dSrc.x + dSrc.y * dSrc.y;
  if (denom < 1e-12) throw new Error("solveSimilarity: the two source points coincide");
  // (a + bi) = dTgt / dSrc, as complex numbers -> scale+rotation in one step
  const a = (dTgt.x * dSrc.x + dTgt.y * dSrc.y) / denom;
  const b = (dTgt.y * dSrc.x - dTgt.x * dSrc.y) / denom;
  const tx = tgtA.x - (a * srcA.x - b * srcA.y);
  const ty = tgtA.y - (b * srcA.x + a * srcA.y);
  return { a, b, tx, ty };
}

export function applySimilarity(t: SimilarityTransform, p: Point2): Point2 {
  return { x: t.a * p.x - t.b * p.y + t.tx, y: t.b * p.x + t.a * p.y + t.ty };
}

export function solveAffine(src: [Point2, Point2, Point2], tgt: [Point2, Point2, Point2]): AffineTransform {
  const [s1, s2, s3] = src;
  const [t1, t2, t3] = tgt;
  // Source basis vectors (columns of M, relative to s1) and their inverse.
  const m11 = s2.x - s1.x;
  const m12 = s3.x - s1.x;
  const m21 = s2.y - s1.y;
  const m22 = s3.y - s1.y;
  const det = m11 * m22 - m12 * m21;
  if (Math.abs(det) < 1e-9) throw new Error("solveAffine: the three source points are collinear");
  const i11 = m22 / det;
  const i12 = -m12 / det;
  const i21 = -m21 / det;
  const i22 = m11 / det;
  // Target basis vectors (columns of M', relative to t1).
  const n11 = t2.x - t1.x;
  const n12 = t3.x - t1.x;
  const n21 = t2.y - t1.y;
  const n22 = t3.y - t1.y;
  // A = M' * M^-1
  const a11 = n11 * i11 + n12 * i21;
  const a12 = n11 * i12 + n12 * i22;
  const a21 = n21 * i11 + n22 * i21;
  const a22 = n21 * i12 + n22 * i22;
  const tx = t1.x - (a11 * s1.x + a12 * s1.y);
  const ty = t1.y - (a21 * s1.x + a22 * s1.y);
  return { m11: a11, m12: a12, m21: a21, m22: a22, tx, ty };
}

export function applyAffine(t: AffineTransform, p: Point2): Point2 {
  return { x: t.m11 * p.x + t.m12 * p.y + t.tx, y: t.m21 * p.x + t.m22 * p.y + t.ty };
}

/** Distance between a mapped point and its expected target — the calibration quality signal. */
export function residual(mapped: Point2, expected: Point2): number {
  return Math.hypot(mapped.x - expected.x, mapped.y - expected.y);
}
