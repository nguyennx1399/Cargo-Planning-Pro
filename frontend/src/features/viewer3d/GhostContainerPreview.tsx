import { useMemo } from "react";
import { Edges } from "@react-three/drei";
import type { Container, StowagePlan, Vessel } from "@/types/domain";
import { DIM, slotToPosition } from "@/lib/geometry";
import { DROP_TINT, verdictForSlot } from "@/lib/drop-verdict";
import { activeContainerId, usePlanStore } from "@/store/usePlanStore";

const LENGTH_BY_SIZE: Record<Container["size"], number> = {
  "20": DIM.len20,
  "40": DIM.len40,
  "45": DIM.len45,
};

/**
 * Translucent preview of the container in hand over the slot under the cursor — shows WHERE it
 * would land and, through the tint, WHAT a drop there would do (E3-04b/c, Phase C):
 *
 *  - green  (`valid`)   — accepted clean;
 *  - amber  (`warning`) — accepted, but the reason is RECORDED: the plan-wide report will list it
 *                         (D1's overridable limits, e.g. overstow). Not a refusal;
 *  - red    (`invalid`) — refused; the recorded reason is the first blocking one.
 *
 * The tint comes from `verdictForSlot`, the same `canPlaceContainer` gate the validator and the
 * commit call — never a UI-local rule. The wording that goes with it is rendered by the Sidebar
 * readout, because a WebGL mesh has nowhere to put text; `raycast={() => null}` keeps the ghost from
 * ever stealing the pick that `EmptySlotPicker` owns.
 */
export function GhostContainerPreview({ vessel, plan }: { vessel: Vessel; plan: StowagePlan }) {
  // A stored reference, so a plain selector is stable (no `useShallow` needed).
  const hoveredSlot = usePlanStore((s) => s.hoveredSlot);
  const activeId = usePlanStore(activeContainerId);

  const container = activeId ? plan.containers.find((c) => c.id === activeId) : undefined;

  const verdict = useMemo(
    () => (container && hoveredSlot ? verdictForSlot(vessel, plan, container, hoveredSlot) : null),
    [vessel, plan, container, hoveredSlot],
  );

  const position = useMemo(
    () => (hoveredSlot ? slotToPosition(vessel, hoveredSlot) : null),
    [vessel, hoveredSlot],
  );

  if (!container || !position) return null;

  const height = container.high_cube ? DIM.heightHC : DIM.height;
  const length = LENGTH_BY_SIZE[container.size];
  const tint = DROP_TINT[verdict?.verdict ?? "valid"];

  return (
    <mesh position={position} raycast={() => null}>
      <boxGeometry args={[length, height, DIM.width]} />
      <meshBasicMaterial color={tint} transparent opacity={0.35} depthWrite={false} />
      <Edges color={tint} />
    </mesh>
  );
}
