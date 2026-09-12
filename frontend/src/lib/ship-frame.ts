// Ship-frame <-> Three.js scene conversions, and frame(station) <-> x helpers.
// Ship frame: x from AP toward the bow (m), y +starboard (m), z from baseline up (m).
// Scene: x = longitudinal (bow +x, origin at midship), y = up (0 = deck), z = transverse (+stbd).
// See plans/260911-1409-vessel-3d-model-pipeline/phase-01.
import type { FrameSegment, VesselGeometry } from "@/types/vessel-geometry";

export type ShipPoint = [x: number, y: number, z: number];
export type ScenePoint = [x: number, y: number, z: number];

type ParticularsSource = Pick<VesselGeometry, "particulars">;

export function shipToScene(geometry: ParticularsSource, [x, y, z]: ShipPoint): ScenePoint {
  const { lbp_m, depth_m } = geometry.particulars;
  return [x - lbp_m / 2, z - depth_m, y];
}

export function sceneToShip(geometry: ParticularsSource, [sx, sy, sz]: ScenePoint): ShipPoint {
  const { lbp_m, depth_m } = geometry.particulars;
  return [sx + lbp_m / 2, sz, sy + depth_m];
}

/** LCG measured +fwd of midship (stability-booklet convention), from ship-frame x (AP=0, +fwd). */
export function lcgFromMidship(geometry: ParticularsSource, xFromApM: number): number {
  return xFromApM - geometry.particulars.lbp_m / 2;
}

/** Ship-frame x (m, from AP) for a given frame number. Frames must be sorted ascending and
 * contiguous (validated by validateVesselGeometry); extrapolates linearly past either end
 * using the nearest segment's spacing (e.g. for overhangs beyond frame 0 or the last frame). */
export function frameToX(frames: FrameSegment[], frame: number): number {
  if (frames.length === 0) throw new Error("frameToX: frames is empty");
  let x = 0;
  for (const seg of frames) {
    if (frame < seg.from_frame) return x - (seg.from_frame - frame) * seg.spacing_m;
    if (frame <= seg.to_frame) return x + (frame - seg.from_frame) * seg.spacing_m;
    x += (seg.to_frame - seg.from_frame) * seg.spacing_m;
  }
  const last = frames[frames.length - 1];
  return x + (frame - last.to_frame) * last.spacing_m;
}

/** Inverse of frameToX: frame number for a given ship-frame x (m, from AP). */
export function xToFrame(frames: FrameSegment[], xM: number): number {
  if (frames.length === 0) throw new Error("xToFrame: frames is empty");
  let x = 0;
  for (const seg of frames) {
    const segLenM = (seg.to_frame - seg.from_frame) * seg.spacing_m;
    if (xM < x) return seg.from_frame - (x - xM) / seg.spacing_m;
    if (xM <= x + segLenM) return seg.from_frame + (xM - x) / seg.spacing_m;
    x += segLenM;
  }
  const last = frames[frames.length - 1];
  return last.to_frame + (xM - x) / last.spacing_m;
}
