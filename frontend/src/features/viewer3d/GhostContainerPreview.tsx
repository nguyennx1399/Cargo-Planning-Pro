import { useMemo } from "react";
import { Edges } from "@react-three/drei";
import { useShallow } from "zustand/react/shallow";
import type { StowagePlan, Vessel } from "@/types/domain";
import { DIM, slotToPosition } from "@/lib/geometry";
import { HIGHLIGHT } from "@/lib/colors";
import { usePlanStore } from "@/store/usePlanStore";

const LENGTH_BY_SIZE = { "20": DIM.len20, "40": DIM.len40, "45": DIM.len45 } as const;

/**
 * Translucent preview of a dragged container over the empty slot under the cursor (E3-04b) —
 * shows where it would land before dropping. Reuses EmptySlotPicker's hoveredSlot (E3-04a), so no
 * new raycasting; only renders while a drag is active (draggingContainerId set from the Unplaced
 * list in Sidebar). Snap-to-nearest-slot and actually committing the placement are E3-04c/d, not
 * implemented yet — releasing the mouse just cancels the drag for now.
 */
export function GhostContainerPreview({ vessel, plan }: { vessel: Vessel; plan: StowagePlan }) {
  const { draggingContainerId, hoveredSlot } = usePlanStore(
    useShallow((s) => ({ draggingContainerId: s.draggingContainerId, hoveredSlot: s.hoveredSlot }))
  );

  const container = draggingContainerId ? plan.containers.find((c) => c.id === draggingContainerId) : undefined;

  const position = useMemo(
    () => (hoveredSlot ? slotToPosition(vessel, hoveredSlot) : null),
    [vessel, hoveredSlot]
  );

  if (!container || !position) return null;

  const height = container.high_cube ? DIM.heightHC : DIM.height;
  const length = LENGTH_BY_SIZE[container.size];

  return (
    <mesh position={position} raycast={() => null}>
      <boxGeometry args={[length, height, DIM.width]} />
      <meshBasicMaterial color={HIGHLIGHT.ghost} transparent opacity={0.35} depthWrite={false} />
      <Edges color={HIGHLIGHT.ghost} />
    </mesh>
  );
}
