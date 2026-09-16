/**
 * The ONLY place scene↔x_m offsets live (spec §4.3, principle "one coordinate helper").
 *
 * BreakbulkPlacement.x_m is symmetric about vessel.length_m/2 (0 at the LOA stern end, +bow) and
 * deliberately needs no VesselGeometry; scene x is midship-relative. The conversion is a pure
 * translation: sceneX = x_m - lengthM/2. This was a real bug once when the mesh builder assumed
 * x_m WAS ship-frame (see types/domain.ts's comment and the p1 phase-03 Deviations) — every
 * producer/consumer of x_m must go through here instead of re-deriving the offset.
 *
 * Phase A moved these out of breakbulk-mesh-builder.ts and lib/breakbulk-weight-item.ts, which
 * each did the shift by hand.
 */
import type { Rect } from "@/engine/breakbulk-overlap-check";

/** x_m -> scene x. */
export function placementXToSceneX(x_m: number, lengthM: number): number {
  return x_m - lengthM / 2;
}

/** scene x -> x_m (the inverse of placementXToSceneX). */
export function sceneXToPlacementX(sceneX: number, lengthM: number): number {
  return sceneX + lengthM / 2;
}

/** A placement's anchor as a scene position: [sceneX, surfaceY + lift, z]. `surfaceY` is the
 * area's resting surface (see StowageArea.surfaceY), so cargo sits on it rather than at y = 0. */
export function placementToScene(
  x_m: number,
  z_m: number,
  surfaceY: number,
  lengthM: number,
  lift = 0,
): [number, number, number] {
  return [placementXToSceneX(x_m, lengthM), surfaceY + lift, z_m];
}

/** The rectangle an item of `lengthM_` × `widthM_` occupies when centred on (x_m, z_m) — mirrors
 * engine/breakbulk-overlap-check.ts's footprintRect, including the 90° swap. */
export function rectFromCenter(
  x_m: number,
  z_m: number,
  lengthM_: number,
  widthM_: number,
  rotationDeg = 0,
): Rect {
  const rotated = rotationDeg === 90;
  const xExtent = rotated ? widthM_ : lengthM_;
  const zExtent = rotated ? lengthM_ : widthM_;
  return {
    xMin: x_m - xExtent / 2,
    xMax: x_m + xExtent / 2,
    zMin: z_m - zExtent / 2,
    zMax: z_m + zExtent / 2,
  };
}

/** Point-in-rect, edges inclusive (unlike rectsOverlap, where touching is not overlapping). */
export function rectContainsPoint(rect: Rect, x: number, z: number): boolean {
  return x >= rect.xMin && x <= rect.xMax && z >= rect.zMin && z <= rect.zMax;
}

/** True when `inner` lies entirely inside `outer` (edges may touch). */
export function rectContainsRect(outer: Rect, inner: Rect): boolean {
  return (
    inner.xMin >= outer.xMin &&
    inner.xMax <= outer.xMax &&
    inner.zMin >= outer.zMin &&
    inner.zMax <= outer.zMax
  );
}

/** Round `value` to the nearest multiple of `step` (e.g. project-cargo snapping, D2). */
export function snap(value: number, step: number): number {
  return Math.round(value / step) * step;
}
