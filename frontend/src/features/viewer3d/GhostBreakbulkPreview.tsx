/**
 * GhostBreakbulkPreview.tsx — the project-cargo item in hand, drawn where it would land and tinted by
 * what a drop there would do (Phase D, requirement 4) — the pose-shaped `GhostContainerPreview`:
 *
 *  - green  (`valid`)   — accepted clean;
 *  - amber  (`warning`) — accepted, but the reason is RECORDED (D1's overridable limits, e.g. a 20 m
 *                         band over its limit). Not a refusal, and it must not read like one;
 *  - red    (`invalid`) — refused; the reason is the first blocking one.
 *
 * The mesh comes from `buildBreakbulkMesh`, the SAME builder `BreakbulkCargoInstances` uses for the
 * placed item, so the preview is the object that would appear — same shape (a tower is a cylinder, not
 * a box), same resting height (the area's own `surfaceY`), same 0/90° footprint. That builder bakes
 * the position into the geometry, so a new pose means a new geometry; it is disposed as it is replaced,
 * or the gesture would leak one GPU buffer per pointer move.
 *
 * The tint comes from `verdictForPose` — the same `canPlaceBreakbulk` gate the commit will call, never
 * a UI-local rule — and `raycast={() => null}` keeps the ghost from ever stealing the pick that
 * `AreaDropPlane` owns.
 */
import { useEffect, useMemo } from "react";
import { Edges } from "@react-three/drei";
import type { BreakbulkCargo, BreakbulkPlacement, StowagePlan, Vessel } from "@/types/domain";
import { buildBreakbulkMesh } from "@/engine/cargo/breakbulk-mesh-builder";
import type { BreakbulkPose } from "@/engine/placement/can-place-breakbulk";
import { meshDataToBufferGeometry } from "@/lib/mesh-data-to-buffer-geometry";
import { DROP_TINT } from "@/lib/drop-verdict";
import { verdictForPose } from "@/lib/pose-verdict";

/** The pose as a placement, for the mesh builder (and, in Phase 03, for the commit): the same shape
 * the predicate's own private `placementOf` builds, `area_id` omitted when the pose names no area —
 * which is how a weather-deck pose reaches the plan. */
function placementOfPose(item: BreakbulkCargo, pose: BreakbulkPose): BreakbulkPlacement {
  return {
    cargo_id: item.id,
    x_m: pose.x_m,
    z_m: pose.z_m,
    rotation_deg: pose.rotation_deg ?? 0,
    ...(pose.areaId ? { area_id: pose.areaId } : {}),
  };
}

export function GhostBreakbulkPreview({
  vessel,
  plan,
  item,
  pose,
}: {
  vessel: Vessel;
  plan: StowagePlan;
  item: BreakbulkCargo | null;
  pose: BreakbulkPose | null;
}) {
  // The same call, with the same arguments, that the chip and the sidebar readout will make for this
  // pose — so the one-entry memo in `drop-verdict.ts` collapses every reader into ONE predicate call
  // per pointer move.
  const verdict = useMemo(
    () => (item && pose ? verdictForPose(vessel, plan, item, pose) : null),
    [vessel, plan, item, pose],
  );

  const geometry = useMemo(
    () => (item && pose ? meshDataToBufferGeometry(buildBreakbulkMesh(item, placementOfPose(item, pose), vessel)) : null),
    [vessel, item, pose],
  );

  // The pose object is stable while the pointer stays on one snapped cell (the drop plane keeps the
  // previous object), so this fires when the ghost actually MOVES, not on every pixel.
  useEffect(() => () => geometry?.dispose(), [geometry]);

  if (!geometry) return null;
  const tint = DROP_TINT[verdict?.verdict ?? "valid"];

  return (
    <mesh geometry={geometry} raycast={() => null}>
      <meshBasicMaterial color={tint} transparent opacity={0.38} depthWrite={false} />
      <Edges color={tint} />
    </mesh>
  );
}
