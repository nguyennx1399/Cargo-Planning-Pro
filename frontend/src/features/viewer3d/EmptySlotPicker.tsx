import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";
import type { StowagePlan, Vessel } from "@/types/domain";
import { DIM, LAYOUT, slotToPosition } from "@/lib/geometry";
import { emptySlots } from "@/engine/all-slots";
import { usePlanStore } from "@/store/usePlanStore";

/**
 * Invisible pickable mesh over every EMPTY slot (E3-04a) — occupied slots are already resolvable
 * via ContainerInstances' own mesh + hoveredId, so this fills the gap the drag-and-drop editor
 * (E3-04b+) needs next: identifying a drop target where nothing is rendered yet. Same
 * one-InstancedMesh-per-set technique as ContainerInstances, so raycast cost scales the same way
 * regardless of camera angle.
 */
export function EmptySlotPicker({ vessel, plan }: { vessel: Vessel; plan: StowagePlan }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const setHoveredSlot = usePlanStore((s) => s.setHoveredSlot);

  const slots = useMemo(() => emptySlots(vessel, plan.placements), [vessel, plan.placements]);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    slots.forEach((slot, i) => {
      m.setPosition(...slotToPosition(vessel, slot));
      mesh.setMatrixAt(i, m);
    });
    mesh.count = slots.length;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [slots, vessel]);

  const slotAt = (e: ThreeEvent<PointerEvent | MouseEvent>) =>
    e.instanceId !== undefined ? (slots[e.instanceId] ?? null) : null;

  const capacity = slots.length || 1;

  return (
    <instancedMesh
      key={capacity} // remount if the empty-slot count changes, same as ContainerInstances
      ref={meshRef}
      args={[undefined, undefined, capacity]}
      onPointerMove={(e) => {
        e.stopPropagation();
        setHoveredSlot(slotAt(e));
      }}
      onPointerOut={() => setHoveredSlot(null)}
    >
      {/* Pick volume sized to the full grid PITCH (not the container's own size) — it extends
          halfway into the gap on every side (bayGap between bays, rowGap between rows, the small
          tier clearance vertically), so adjacent slots' pick boxes tile with zero dead zones.
          That makes raycasting itself do nearest-slot snapping (E3-04c): any pointer position
          over the ship's slot grid resolves to *some* slot, never a miss in a gap. */}
      <boxGeometry args={[DIM.len40 + LAYOUT.bayGap, LAYOUT.tierPitch, DIM.width + LAYOUT.rowGap]} />
      <meshBasicMaterial visible={false} />
    </instancedMesh>
  );
}
