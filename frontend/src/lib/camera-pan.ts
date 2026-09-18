/**
 * camera-pan.ts — how far one keyboard pan step moves the view, as pure vector maths.
 *
 * Panning is NOT orbiting: the camera and the orbit target must move by the SAME offset, or the view
 * swings instead of sliding. `OrbitControls.pan()` is internal to three, so the offset is computed here
 * and applied to both by the caller.
 *
 * THE STEP SCALES WITH ZOOM. A fixed metre step is enormous when zoomed into one bay and useless when
 * the whole ship is in frame, so the step is a fraction of the camera-to-target distance — the same
 * feel at every zoom level.
 *
 * THE DIRECTION IS SCREEN-RIGHT, FLATTENED. `direction × up` gives the camera's right vector; flattening
 * its y and re-normalising keeps the ship sliding horizontally rather than drifting up or down as the
 * camera elevation changes. With the camera looking straight down the right vector is still well
 * defined; only a perfectly degenerate case (right vector of zero length) returns no offset, and the
 * caller then does nothing.
 */

/** A point or direction. Structurally what three's `Vector3.toArray()` gives. */
export type Vec3 = readonly [number, number, number];

/** One press moves the view by this fraction of the camera-to-target distance. */
export const PAN_STEP_FRACTION = 0.08;

/** Below this the right vector is degenerate (camera up is parallel to the view direction) and there is
 * no meaningful horizontal direction to pan along. */
const DEGENERATE_EPS = 1e-6;

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const length = (v: Vec3): number => Math.hypot(v[0], v[1], v[2]);

/**
 * The world offset for one horizontal pan step. `dx` is -1 (view slides left) or +1 (right).
 *
 * Returns `[0, 0, 0]` when there is nothing sensible to do — camera sitting on the target, or a
 * degenerate right vector — so a caller can add it unconditionally.
 */
export function horizontalPanOffset(cameraPos: Vec3, target: Vec3, up: Vec3, dx: -1 | 1): Vec3 {
  const toTarget = sub(target, cameraPos);
  const distance = length(toTarget);
  if (distance < DEGENERATE_EPS) return [0, 0, 0];

  const right = cross(toTarget, up);
  const flat: Vec3 = [right[0], 0, right[2]];
  const flatLength = length(flat);
  if (flatLength < DEGENERATE_EPS) return [0, 0, 0];

  // Panning the view RIGHT moves the camera right, which slides the ship left on screen — the
  // direction a planner expects from "push the frame right".
  const step = (distance * PAN_STEP_FRACTION * dx) / flatLength;
  return [flat[0] * step, 0, flat[2] * step];
}
