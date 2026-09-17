/**
 * breakbulk-pose.ts — what a pointer position becomes before it can be dropped: the pose arithmetic
 * between the 3D scene and `canPlaceBreakbulk` (spec §4.5/§4.6, decisions D2/D-P1/D-P3). Item/area
 * semantics live here so stowage-model/coords.ts stays plain rectangles and offsets for any caller.
 *
 * D-P1, the load-bearing bit: snap and clamp do NOT commute. Clamp-then-snap rounds the clamped centre
 * back OUT of the area — a 6.5 m wide item in BBC SAO PAULO's Hold 2 tank top (z ±9.1 m) clamps to
 * −5.85 m, which snaps back to −6.0 m and pokes 0.15 m through the edge, silently. So: snap FIRST,
 * then clamp the snapped centre into grid-rounded INWARD bounds, and both the grid and the area hold.
 * Reversing the order fails the regression test in __tests__/breakbulk-pose.test.ts.
 *
 * Cost: one call of each per pointer move (Phase 02 runs these in the drop plane's onPointerMove), so
 * no predicate calls here and no allocations beyond the returned pose — the verdict is the caller's
 * separate, memoised `canPlaceBreakbulk`.
 */
import type { BreakbulkCargo, Vessel } from "@/types/domain";
import { rectFromCenter, sceneXToPlacementX, snap, type StowageArea } from "@/engine/stowage-model";
import type { BreakbulkPose } from "./can-place-breakbulk";

/** The project-cargo drag grid (D2): every pose the UI produces is a multiple of this many metres. */
export const POSE_SNAP_M = 0.5;

/** The item's footprint extents [x, z] at a rotation, read off `rectFromCenter` — the one definition
 * of the 0°/90° swap (it mirrors footprintRect) — rather than repeating the swap here. */
export function footprintExtents(item: BreakbulkCargo, rotationDeg = 0): [number, number] {
  const rect = rectFromCenter(0, 0, item.length_m, item.width_m, rotationDeg);
  return [rect.xMax - rect.xMin, rect.zMax - rect.zMin];
}

/** The pose's centre on the drag grid, area and rotation untouched — the un-clamped path, and the
 * first half of `clampPoseToArea`. */
export function snapPose(pose: BreakbulkPose, step = POSE_SNAP_M): BreakbulkPose {
  return { ...pose, x_m: snap(pose.x_m, step), z_m: snap(pose.z_m, step) };
}

/** The next rotation in the 0↔90 cycle (D-P3, the R key). Anything that is not 90 lands on 90: only
 * those two are meaningful, and `footprintRect` swaps on exactly 90. Typed `0 | 90` so the hand's
 * `handRotation` literal union takes it without a cast. */
export function rotationNext(rotationDeg: number): 0 | 90 {
  return rotationDeg === 90 ? 0 : 90;
}

/** Same pose, same numbers — the rotation is normalised because the predicate treats an absent one as
 * 0, and a pose that "changed" from 0 to undefined is not a new pose. The hand slice uses this to keep
 * the hovered pose's OBJECT identity while the pointer stays on one snapped cell: a fresh object per
 * pointer move would re-render the ghost and re-run its geometry memo once per pixel. */
export const samePose = (a: BreakbulkPose, b: BreakbulkPose): boolean =>
  a.areaId === b.areaId &&
  a.x_m === b.x_m &&
  a.z_m === b.z_m &&
  (a.rotation_deg ?? 0) === (b.rotation_deg ?? 0);

/** First grid multiple whose edge clears `min`, and last whose edge clears `max`. The step is divided
 * out before the rounding, so the 1e-9 only has to absorb float error on an already-aligned bound. */
const loBound = (min: number, half: number, step: number): number => Math.ceil((min + half) / step - 1e-9) * step;
const hiBound = (max: number, half: number, step: number): number => Math.floor((max - half) / step + 1e-9) * step;

/** The grid positions a centre may take on one axis while the footprint stays inside `[min, max]`. */
const gridBounds = (min: number, max: number, half: number): [number, number] => [
  loBound(min, half, POSE_SNAP_M),
  hiBound(max, half, POSE_SNAP_M),
];

/** Keep the footprint inside the area on the drag grid — the "drop anywhere INSIDE" feel (D-P1) — without
 * relaxing any limit: what this returns is refused by `canPlaceBreakbulk` only for the reasons the raw
 * pose would have been (keep-outs, cargo, band weight), never for the area edge.
 *
 * Two poses come back UNCHANGED, by design, so the predicate answers for them with its own real message
 * instead of this module inventing a position, and a clamp can never move a pose further out than it
 * already was: an item larger than the area at that rotation, and a rect that is not a whole number of
 * steps across, where the inward bounds cross and no grid position exists at all. */
export function clampPoseToArea(area: StowageArea, item: BreakbulkCargo, pose: BreakbulkPose): BreakbulkPose {
  const [ex, ez] = footprintExtents(item, pose.rotation_deg ?? 0);
  const rect = area.rect;
  if (rect.xMax - rect.xMin < ex || rect.zMax - rect.zMin < ez) return pose;
  const [xLo, xHi] = gridBounds(rect.xMin, rect.xMax, ex / 2);
  const [zLo, zHi] = gridBounds(rect.zMin, rect.zMax, ez / 2);
  if (xLo > xHi || zLo > zHi) return pose;
  const centre = snapPose(pose);
  const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), hi);
  return {
    ...pose,
    x_m: clamp(centre.x_m, xLo, xHi),
    z_m: clamp(centre.z_m, zLo, zHi),
  };
}

/** Scene point → a pose in `areaId` (Phase 02's drop plane). Scene x is midship-relative while `x_m`
 * is stern-anchored, so this goes through `sceneXToPlacementX` — never a hand-rolled LOA shift.
 * The result is un-snapped and un-clamped: chain `clampPoseToArea` for the droppable pose.
 * `areaId` is kept verbatim — the predicate accepts the weather deck's id, "" or absent alike, and
 * dropping `area_id` on commit is the draft store's `breakbulkPlacementOf`. */
export function poseFromScenePoint(
  vessel: Vessel,
  areaId: string,
  sceneX: number,
  sceneZ: number,
  rotationDeg = 0,
): BreakbulkPose {
  return { areaId, x_m: sceneXToPlacementX(sceneX, vessel.length_m), z_m: sceneZ, rotation_deg: rotationDeg };
}
