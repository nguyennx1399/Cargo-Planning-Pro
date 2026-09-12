// Simplified section/envelope shapes for the L1 parametric hull generator. Deliberately crude
// (no keel rise, no true transom face) — good enough for a demo-quality hull; L2 (offsets
// import, phase 4) is the accuracy standard. See plan Unresolved/Risk notes for phase 2.

/**
 * Longitudinal half-beam envelope, as a fraction of full beam (0..1), at station fraction
 * xi = x/LBP (0 = AP, 1 = FP; xi may be slightly negative, for a station in the aft overhang).
 * Full beam across the parallel midbody [pa, pf]; tapers to 0 at both ends with a power-law
 * entrance/run (bigger `p` = fuller, boxier ends).
 *
 * `aftTaperExtraFrac` extends the AFT taper's reference length past xi=0 by this many LBP
 * fractions (pass `aft_overhang_m / lbp_m`) so the taper reaches exactly 0 at the true stern
 * tip instead of at AP — without it, a station at xi=0 and one further aft in the overhang
 * both clamp to 0 independently, collapsing that whole span into a zero-width "blade" instead
 * of a smooth taper.
 */
export function envelopeHalfBreadth(
  xi: number,
  parallelMidbody: [number, number],
  p: number,
  aftTaperExtraFrac = 0
): number {
  const [pa, pf] = parallelMidbody;
  if (xi >= pa && xi <= pf) return 1;
  const aftTaperLength = pa + aftTaperExtraFrac;
  const dist = xi < pa ? (aftTaperLength > 0 ? (pa - xi) / aftTaperLength : 1) : (xi - pf) / (1 - pf);
  const c = Math.min(Math.max(dist, 0), 1);
  return 1 - c ** p;
}

/**
 * Rounded-rectangle midship-style section: flat bottom of half-width (halfBreadth - bilgeRadius)
 * at the baseline, a circular bilge curving up to full half-width, vertical topsides above.
 * z is measured from the baseline (z=0).
 */
export function sectionHalfBreadth(z: number, halfBreadthM: number, bilgeRadiusM: number): number {
  const r = Math.min(Math.max(bilgeRadiusM, 0), halfBreadthM);
  if (z <= 0) return Math.max(halfBreadthM - r, 0);
  if (z >= r) return halfBreadthM;
  return halfBreadthM - r + Math.sqrt(Math.max(r * r - (r - z) ** 2, 0));
}
