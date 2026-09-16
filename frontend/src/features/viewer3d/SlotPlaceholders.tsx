import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useShallow } from "zustand/react/shallow";
import type { Container, StowagePlan, Vessel } from "@/types/domain";
import { DIM } from "@/lib/geometry";
import { DROP_TINT, slotVisible, verdictsForSlots } from "@/lib/drop-verdict";
import { validSlotsFor } from "@/engine/placement/placeholders";
import { activeContainerId, usePlanStore } from "@/store/usePlanStore";

const LENGTH_BY_SIZE: Record<Container["size"], number> = {
  "20": DIM.len20,
  "40": DIM.len40,
  "45": DIM.len45,
};

/**
 * A translucent box on every VALID slot while a container is being dragged or picked (Phase C) —
 * "these are the boxes' positions this one can occupy", so the planner sees the drop set instead of
 * having to hunt for it with the cursor. Same one-InstancedMesh-per-set technique as
 * `ContainerInstances`/`EmptySlotPicker`: one draw call regardless of how many slots there are.
 *
 * Renders nothing when no gesture is active; `raycast={() => null}` so the boxes can never intercept
 * the pick that `EmptySlotPicker` owns (the placeholders are a hint layer, not a target layer).
 *
 * Matrices are translation-only from `SlotDef.center` (the model's own centre, never recomputed) —
 * the geometry carries the candidate's real footprint, which is uniform across the set because every
 * slot in it belongs to the same container.
 */
export function SlotPlaceholders({ vessel, plan }: { vessel: Vessel; plan: StowagePlan }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const activeId = usePlanStore(activeContainerId);
  const view = usePlanStore(
    useShallow((s) => ({
      showOnDeck: s.showOnDeck,
      showUnderDeck: s.showUnderDeck,
      bayFilter: s.bayFilter,
    })),
  );

  const container = activeId ? plan.containers.find((c) => c.id === activeId) : undefined;

  // ONE sweep per gesture start (`validSlotsFor` is the engine's set), then the viewer's own
  // visibility rule — the SAME `slotVisible` the picker applies, so an empty slot that can be
  // clicked is never one whose placeholder is hidden (a placeholder inside an unticked hull or in
  // another bay would read as clutter).
  const slots = useMemo(() => {
    if (!container) return [];
    return validSlotsFor(vessel, plan, container).filter((s) => slotVisible(s, vessel, view));
  }, [vessel, plan, container, view]);

  // Tint pass, over the VALID subset only (never per pointer move). `validSlotsFor` cannot separate
  // "clean" from "accepted but recorded" — that needs the predicate result, and an amber-worthy slot
  // must read amber here too, not only on the ghost. Blocked slots are not in this set at all, so
  // the expensive part of a full sweep (their reason messages) is skipped.
  const verdicts = useMemo(
    () => (container ? verdictsForSlots(vessel, plan, container, slots) : null),
    [vessel, plan, container, slots],
  );

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    slots.forEach((slot, i) => {
      m.setPosition(...slot.center);
      mesh.setMatrixAt(i, m);
    });
    mesh.count = slots.length;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [slots]);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || !verdicts) return;
    const color = new THREE.Color();
    slots.forEach((slot, i) => {
      mesh.setColorAt(i, color.set(DROP_TINT[verdicts.get(slot.key)?.verdict ?? "valid"]));
    });
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [slots, verdicts]);

  if (!container || slots.length === 0) return null;

  const capacity = slots.length;
  const height = container.high_cube ? DIM.heightHC : DIM.height;

  return (
    <instancedMesh
      key={capacity} // remount if the valid-slot count changes, same as ContainerInstances
      ref={meshRef}
      args={[undefined, undefined, capacity]}
      raycast={() => null}
    >
      <boxGeometry args={[LENGTH_BY_SIZE[container.size], height, DIM.width]} />
      {/* the material stays white: per-instance `instanceColor` multiplies it into the verdict tint */}
      <meshBasicMaterial transparent opacity={0.18} depthWrite={false} />
    </instancedMesh>
  );
}
