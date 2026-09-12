// Turns an indicative stability result into a Three.js group transform (position.y = sinkage,
// rotation.x = list, rotation.z = trim) — pure math, no React/r3f, so the sign conventions below
// are verified by a matrix-math test (ship-attitude-transform.test.ts), not by eye in a browser.
//
// Signs (confirmed via THREE.Object3D.applyMatrix4, not assumed — see the test file):
// - rotation.x = +angle moves +z (starboard) DOWN — so +listDeg needs NO negation.
// - rotation.z = +angle moves +x (bow) UP — the OPPOSITE of "by the head" (bow down), so
//   +trimM (by the head) needs a negated rotation.z.
import type { StabilityResult } from "@/engine/stability-indicative";

export interface ShipAttitudeInput {
  draftMeanM: number | null;
  listDeg: number | null;
  trimM: number | null;
}

export interface ShipTransform {
  positionY: number;
  rotationX: number;
  rotationZ: number;
}

/** Fallback draft fraction of depth when draftMeanM is unavailable (out_of_range status) — a
 * plausible sinkage so the ship doesn't render floating oddly, not a physically meaningful value. */
const FALLBACK_DRAFT_FRACTION_OF_DEPTH = 0.6;

export function computeShipTransform(attitude: ShipAttitudeInput, depthM: number, lbpM: number): ShipTransform {
  const draftM = attitude.draftMeanM ?? depthM * FALLBACK_DRAFT_FRACTION_OF_DEPTH;
  // Local y=-depthM (keel) -> world y=-draftM; local y=0 (deck) -> world y=depthM-draftM.
  const positionY = depthM - draftM;
  const rotationX = ((attitude.listDeg ?? 0) * Math.PI) / 180;
  const rotationZ = -Math.atan((attitude.trimM ?? 0) / lbpM);
  return { positionY, rotationX, rotationZ };
}

/** Adapts engine/stability-indicative.ts's StabilityResult (snake_case, matching the rest of
 * the engine layer) to this module's ShipAttitudeInput (camelCase, matching the r3f/three.js
 * side) — kept as a thin conversion here rather than renaming either side's own convention. */
export function shipAttitudeInputFromStability(
  result: Pick<StabilityResult, "draft_mean_m" | "list_deg" | "trim_m"> | null
): ShipAttitudeInput {
  if (!result) return { draftMeanM: null, listDeg: null, trimM: null };
  return { draftMeanM: result.draft_mean_m, listDeg: result.list_deg, trimM: result.trim_m };
}
