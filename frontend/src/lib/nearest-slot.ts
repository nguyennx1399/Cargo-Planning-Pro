/**
 * nearest-slot.ts — the PURE decision rule behind pointer-driven slot resolution (P1, decision D2).
 *
 * Why it exists: the pick volumes are pitch-sized so that they tile with ZERO dead zones, which means
 * neighbouring boxes OVERLAP wherever a vessel's real bay pitch is smaller than the pitch box (BBC SAO
 * PAULO's minimum pitch is 12.99 m against a 13.392 m box → a 0.402 m overlap band). three.js
 * resolves overlapping boxes by distance-sorted intersection, i.e. by which box's surface the ray
 * ENTERS first — a *depth* question asked where a *lateral position* question is meant. The camera
 * azimuth therefore picked the winner: that is the recorded H2 defect (a pointer on the aft placeholder
 * of a 40' bay snapping to the fore half, ~6 m away, for the whole shared band) and the 0.402 m BBC
 * band where the neighbouring bay could win. Deciding by "which slot centre is nearest the cursor"
 * makes the winner a function of the POINTER alone, at the same cost.
 *
 * `EmptySlotPicker` owns the three.js plumbing (the ray, the tier plane, the mesh transforms) and
 * calls these two functions; everything that carries a precision claim lives here, in a module with
 * no three/react/store imports, swept over every real slot centre on both vessels by its test.
 */

/** A point or direction in scene space. Structurally compatible with `SlotDef.center`. */
export type Vec3 = readonly [number, number, number];

/** Below this the cursor ray is parallel enough to the deck that the tier-plane crossing is
 * meaningless — the divisor `dir.y` would put the crossing a million metres away. */
const PARALLEL_EPS = 1e-6;

/**
 * Where the cursor ray crosses the horizontal plane at height `tierY` — i.e. the point on the deck
 * level the pointer is actually over.
 *
 * Deliberately NOT `e.point` (the raycast's hit): that lies on the box's ENTRY FACE, not under the
 * pointer. For a box at the ship's centre under the default camera a slab calculation puts the entry
 * on its +z face and biases x by roughly a metre — a split that is a few percent of a bay pitch AND
 * flips sign when the camera orbits 180°, which is precisely the movable/azimuth-dependent split this
 * phase removes.
 *
 * Returns null when the ray never crosses that plane in front of the camera: parallel to the deck
 * (`|dir.y| < 1e-6`) or crossing behind it (`t < 0`). Callers fall back to three's first hit.
 */
export function cursorOnTierPlane(tierY: number, origin: Vec3, dir: Vec3): Vec3 | null {
  if (Math.abs(dir[1]) < PARALLEL_EPS) return null;
  const t = (tierY - origin[1]) / dir[1];
  if (t < 0) return null;
  return [origin[0] + dir[0] * t, tierY, origin[2] + dir[2] * t];
}

/**
 * Index of the centre nearest `cursor`, or -1 when there is no candidate at all (`centres[-1]` is
 * `undefined`, so a caller's `?? fallback` covers that without a special case).
 *
 * SQUARED 3D distance, not horizontal distance: the cursor sits on the HOVERED tier's plane, so the
 * vertical term is what keeps the answer inside one tier. A point inside a tier's pick box is at most
 * half a tier pitch (1.325 m) from its own centre, while any other tier's centre is at least that far
 * away — so the box's own tier always wins. Without the vertical term a slot two decks down at the
 * same (x, z) could win on the tie-break, which is exactly the ambiguity the pick box exists to avoid.
 *
 * A tie — a point exactly on the midpoint between two centres — resolves to the LOWEST index, so the
 * outcome depends only on the caller's candidate order. That order is stable in production
 * (`StowageModel.slots` filtered, never re-sorted), which is what makes the rule deterministic; it is
 * never three's distance-sorted intersection order.
 */
export function nearestSlotIndex(cursor: Vec3, centres: readonly Vec3[]): number {
  let best = -1;
  let bestDistSq = Infinity;
  for (let i = 0; i < centres.length; i++) {
    const c = centres[i];
    const dx = cursor[0] - c[0];
    const dy = cursor[1] - c[1];
    const dz = cursor[2] - c[2];
    const distSq = dx * dx + dy * dy + dz * dz;
    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      best = i;
    }
  }
  return best;
}
