/**
 * AreaDropPlane.tsx — the PICKABLE half of the areas (Phase D requirement 3, rebuilt in Phase 02):
 * ONE invisible volume over the whole cargo region, plus the pure rule that says which area the
 * pointer is on (`lib/nearest-area.ts`).
 *
 * WHY IT IS NO LONGER ONE PLANE PER AREA. It was, and the surfaces were DISJOINT: three only reports a
 * hit where the ray crosses that plane's own height inside that plane's rect, so walking the pointer
 * down one screen line gave `weather deck` → nothing → `Hold 2 tank top` → nothing (measured; the
 * table is in the phase file). The gaps were silent — no pose, no ghost, and a release that did
 * nothing, which is what "dragging project cargo does nothing" turned out to be. And wherever the
 * deck-level crossing fell outside the deck rect while the ray's deeper crossing landed inside the
 * hold rect, pointing AT THE DECK produced a pose in the HOLD.
 *
 * So the geometry no longer decides anything. The box exists ONLY to receive the pointer over the
 * ship; `areaUnderCursor` then answers "which surface is under the cursor" from the ray itself —
 * the same split `EmptySlotPicker` + `nearest-slot.ts` already use for container slots (the pick
 * volume defines REACHABILITY, the pure rule defines PRECISION).
 *
 * `meshBasicMaterial visible={false}`, NOT `object.visible = false`: the material keeps the mesh
 * RAYCASTABLE while drawing nothing. An object-level `visible = false` makes the raycaster skip it
 * entirely, the layer stops receiving pointer events and the ghost silently freezes — a future reader
 * "tidying" this into the object property is the failure mode this comment exists for. `DoubleSide`
 * for the same reason: zoomed in, the camera is INSIDE the box and would otherwise meet only back
 * faces.
 *
 * Still the ONLY writer of the hovered pose, and still the CLICK trigger of the one commit resolver —
 * the pose-shaped twin of `EmptySlotPicker`'s click, which is what makes the WCAG 2.5.7 "pick, then
 * click a target" path work for project cargo. The clamp is applied here and NOWHERE else, so the pose
 * the ghost draws, the pose the chip words and the pose the commit receives are one object.
 */
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";
import type { BreakbulkCargo, Vessel } from "@/types/domain";
import type { StowageArea } from "@/engine/stowage-model";
import { placementXToSceneX, sceneXToPlacementX } from "@/engine/stowage-model";
import { clampPoseToArea, footprintExtents, poseFromScenePoint } from "@/engine/placement/breakbulk-pose";
import type { BreakbulkPose } from "@/engine/placement/can-place-breakbulk";
import { areaUnderCursor, type AreaProbe, type Vec3 } from "@/lib/nearest-area";
import { usePlanStore } from "@/store/usePlanStore";
import { commitBreakbulkPlacement } from "@/store/commit-placement";

export interface AreaDropPlaneProps {
  vessel: Vessel;
  /** The item in hand: the pose is clamped for its footprint, and its id is what a click commits. */
  item: BreakbulkCargo;
  /** The areas whose deck toggle is on — the same set `AreaPlaceholders` draws, so the visible layer
   * and the pickable layer can never disagree. An area the planner has hidden is not a target, which
   * is also how a surface UNDER another one is reached: untick the deck above it. */
  areas: readonly StowageArea[];
}

/** Headroom above the highest surface, so the box still catches the pointer when it is over the ghost
 * standing on that surface rather than over the surface itself. */
const HEADROOM_M = 20;

/** The box that catches the pointer: the union of the areas' footprints, from the lowest surface to
 * the highest plus headroom. Padded by the item's half-footprint for the same reason the resolver pads
 * the rects — the last half item-length before an edge must still be reachable. */
function pickVolume(vessel: Vessel, areas: readonly StowageArea[], padX: number, padZ: number) {
  const xMin = Math.min(...areas.map((a) => a.rect.xMin)) - padX;
  const xMax = Math.max(...areas.map((a) => a.rect.xMax)) + padX;
  const zMin = Math.min(...areas.map((a) => a.rect.zMin)) - padZ;
  const zMax = Math.max(...areas.map((a) => a.rect.zMax)) + padZ;
  const yMin = Math.min(...areas.map((a) => a.surfaceY));
  const yMax = Math.max(...areas.map((a) => a.surfaceY)) + HEADROOM_M;
  return {
    size: [xMax - xMin, yMax - yMin, zMax - zMin] as [number, number, number],
    position: [
      placementXToSceneX((xMin + xMax) / 2, vessel.length_m),
      (yMin + yMax) / 2,
      (zMin + zMax) / 2,
    ] as [number, number, number],
  };
}

export function AreaDropPlane({ vessel, item, areas }: AreaDropPlaneProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const rotationDeg = usePlanStore((s) => s.handRotation);
  const setHoveredPose = usePlanStore((s) => s.setHoveredPose);
  const clearHoveredPose = usePlanStore((s) => s.clearHoveredPose);

  // The item's half-footprint at the CURRENT rotation: both the resolver's padding and the box's own
  // margin, so an edge pose stays reachable whichever way the item is turned.
  const [padX, padZ] = useMemo(() => {
    const [ex, ez] = footprintExtents(item, rotationDeg);
    return [ex / 2, ez / 2] as const;
  }, [item, rotationDeg]);

  const probes = useMemo<AreaProbe[]>(
    () => areas.map((a) => ({ id: a.id, surfaceY: a.surfaceY, rect: a.rect })),
    [areas],
  );
  const volume = useMemo(
    () => (areas.length ? pickVolume(vessel, areas, padX, padZ) : null),
    [vessel, areas, padX, padZ],
  );
  const geometry = useMemo(
    () => (volume ? new THREE.BoxGeometry(...volume.size) : null),
    [volume],
  );
  // Passed to the mesh as a prop, so it is NOT R3F's to dispose (only `<boxGeometry>` children are):
  // without this the layer would leak one buffer per gesture.
  useEffect(() => () => geometry?.dispose(), [geometry]);

  /**
   * The pointer's pose, resolved from the RAY rather than from which surface three entered first.
   *
   * The ray arrives in world space and the areas live in the ship frame (the attitude group heels and
   * trims them with the cargo), so it is transformed through the mesh's PARENT — the group's own
   * matrix — and never by subtracting a position, which would be wrong the moment the ship is not
   * level.
   */
  const poseAt = (e: ThreeEvent<PointerEvent | MouseEvent>): BreakbulkPose | null => {
    const mesh = meshRef.current;
    const parent = mesh?.parent;
    if (!mesh || !parent) return null;
    const toShip = new THREE.Matrix4().copy(parent.matrixWorld).invert();
    const origin = e.ray.origin.clone().applyMatrix4(toShip);
    const dir = e.ray.direction.clone().transformDirection(toShip);
    const hit = areaUnderCursor(
      probes,
      origin.toArray() as unknown as Vec3,
      dir.toArray() as unknown as Vec3,
      [padX, padZ],
      (sceneX) => sceneXToPlacementX(sceneX, vessel.length_m),
    );
    if (!hit) return null;
    const area = areas[hit.index];
    const raw = poseFromScenePoint(vessel, area.id, hit.point[0], hit.point[2], rotationDeg);
    return clampPoseToArea(area, item, raw);
  };

  // R RE-CLAMPS: a rotation swaps the footprint's axes, so a pose that was inside the area at 0° can
  // poke out at 90°. The pointer is not moving when R is pressed, so the clamp has to be re-run here —
  // and here is the right place: this layer knows the areas, and `rotateHand` deliberately knows
  // nothing about geometry.
  useEffect(() => {
    const pose = usePlanStore.getState().hoveredPose;
    if (!pose) return;
    const area = areas.find((a) => a.id === pose.areaId);
    if (!area) return;
    setHoveredPose(clampPoseToArea(area, item, { ...pose, rotation_deg: rotationDeg }));
  }, [rotationDeg, areas, item, setHoveredPose]);

  if (!volume || !geometry) return null;

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      position={volume.position}
      onPointerMove={(e) => {
        // One surface, one writer: nothing else may answer this pointer move, and the container
        // layers have already skipped it (they return early under a project-cargo hand).
        e.stopPropagation();
        const pose = poseAt(e);
        // Off every area (over the sea, over the sky): clear rather than invent a target. The pose's
        // own area owns the clear, so crossing between areas cannot blink the ghost off.
        if (pose) setHoveredPose(pose);
        else {
          const current = usePlanStore.getState().hoveredPose;
          if (current?.areaId) clearHoveredPose(current.areaId);
        }
      }}
      onPointerOut={() => {
        const current = usePlanStore.getState().hoveredPose;
        if (current?.areaId) clearHoveredPose(current.areaId);
      }}
      onClick={(e) => {
        e.stopPropagation();
        // The CLICK trigger of the one commit resolver (WCAG 2.5.7): a PICKED item is placed by this
        // click alone, with no drag gesture anywhere. Same `commitBreakbulkPlacement` the window
        // release calls, so the two can never disagree. A rejected pick stays alive and its reason is
        // recorded by the resolver.
        const pose = poseAt(e);
        if (pose) commitBreakbulkPlacement(pose, "scene");
      }}
    >
      <meshBasicMaterial visible={false} side={THREE.DoubleSide} />
    </mesh>
  );
}
