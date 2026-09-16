import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useShallow } from "zustand/react/shallow";
import type { ThreeEvent } from "@react-three/fiber";
import type { StowagePlan, Vessel } from "@/types/domain";
import { DIM, LAYOUT } from "@/lib/geometry";
import { slotVisible } from "@/lib/drop-verdict";
import { buildStowageModel } from "@/engine/stowage-model";
import { isFortyBay } from "@/engine/slot-helpers";
import { sizeFitsBay } from "@/engine/placement-checks";
import { activeContainerId, usePlanStore } from "@/store/usePlanStore";
import { commitPlacement } from "@/store/commit-placement";

/**
 * Invisible pickable mesh over the slots the cursor may target. Same one-InstancedMesh-per-set
 * technique as ContainerInstances, so raycast cost scales the same way regardless of camera angle.
 *
 * Which set — every case is EMPTY slots (`model.slots` minus `plan.placements`), never
 * `validSlotsFor ∪ blockedSlots`: those two PARTITION every model slot, occupied ones included, so a
 * pick volume over a placed box would win the raycast where `hoveredId` is expected
 * (ContainerInstances' hover, and the Sidebar readout that follows it). On top of that:
 *  - the viewer's `slotVisible` rule (deck toggles + bay filter), the same one the placeholders use,
 *    so a box can never be dropped into a bay or deck the planner cannot see;
 *  - nothing in hand → the vessel's 40' grid, the bays the selector addresses;
 *  - a container in hand (drag or pick) → every empty slot of the bays its SIZE can use, BLOCKED ones
 *    included, so hovering a refusal answers "why not" (red ghost + the first reason, spec §6).
 *
 * Slot keys are the model's authoritative `"bay|row|tier"` (`SlotDef.key`), never
 * `engine/all-slots.ts`'s private `"bay:row:tier"` — a `slotByKey` lookup built with the wrong
 * separator fails OPEN.
 */
export function EmptySlotPicker({ vessel, plan }: { vessel: Vessel; plan: StowagePlan }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const setHoveredSlot = usePlanStore((s) => s.setHoveredSlot);
  const activeId = usePlanStore(activeContainerId);
  const view = usePlanStore(
    useShallow((s) => ({
      showOnDeck: s.showOnDeck,
      showUnderDeck: s.showUnderDeck,
      bayFilter: s.bayFilter,
    })),
  );

  const container = activeId ? plan.containers.find((c) => c.id === activeId) : undefined;

  const slots = useMemo(() => {
    const occupied = new Set(
      plan.placements.map((p) => `${p.slot.bay}|${p.slot.row}|${p.slot.tier}`),
    );
    const empty = buildStowageModel(vessel).slots.filter(
      (s) => !occupied.has(s.key) && slotVisible(s, vessel, view),
    );
    if (!container) {
      // Idle: the 40' grid the bay selector addresses. A half (odd-bay) slot's pick box is as long as
      // its parent's and both are hit at the same pointer position, so rendering both would make this
      // readout flip between bay 21/22/23 with the camera angle. Halves are drop positions for a 20'
      // box, which the size filter below supplies the moment one is in hand.
      return empty.filter((s) => isFortyBay(s.bay));
    }
    // In hand: the whole EMPTY grid of the bays this size can use — valid AND blocked. The size test
    // is not a placement rule (`canPlaceContainer` still gates the commit) but the parity guard that
    // keeps these boxes from overlapping across parities: a 40' candidate's box ends 6.7 m off its
    // own centre, so a neighbouring 20' HALF's box (offset ±HALF_BAY_OFFSET_M) reaches further toward
    // the camera and would win the raycast, leaving the valid 40' slot underneath unreachable.
    return empty.filter((s) => sizeFitsBay(container, s.bay));
  }, [vessel, plan, container, view]);

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

  const slotAt = (e: ThreeEvent<PointerEvent | MouseEvent>) =>
    e.instanceId !== undefined ? slots[e.instanceId] ?? null : null;

  // The pick volume's length: the full grid PITCH for a 40'/45' candidate (it extends halfway into
  // the gap on every side — bayGap between bays, rowGap between rows, the small tier clearance
  // vertically — so adjacent slots tile with ZERO dead zones and raycasting itself does
  // nearest-slot snapping, E3-04c), but the candidate's OWN length for a 20' one. The two 20' halves
  // of a 40' bay sit `2 × HALF_BAY_OFFSET_M` = 6.134 m apart, so a 13.392 m box would overlap its
  // sibling by 7.258 m and three's distance sort would let the CAMERA side pick the winner instead of
  // the pointer (measured before this fix: 2400 overlapping pairs on MV Demo Horizon, 1554 on BBC).
  // At 6.058 m the siblings clear each other with a 0.076 m dead zone — a hair of a gap the pointer
  // can fall into, versus silently placing into the wrong half of the bay.
  // A vessel whose 40' and 20' positions interleave WITHIN one bay pitch would still need
  // per-parity volumes; the parity filter above is what stops the cross-parity steal today.
  const pickLength = container?.size === "20" ? DIM.len20 : DIM.len40 + LAYOUT.bayGap;
  const capacity = slots.length || 1;

  return (
    <instancedMesh
      key={`${capacity}|${pickLength}`} // remount when the count or the volume changes, as ContainerInstances does
      ref={meshRef}
      args={[undefined, undefined, capacity]}
      onPointerMove={(e) => {
        e.stopPropagation();
        setHoveredSlot(slotAt(e));
      }}
      onPointerOut={() => setHoveredSlot(null)}
      onClick={(e) => {
        e.stopPropagation();
        const target = slotAt(e);
        // The CLICK trigger of the one commit resolver (WCAG 2.5.7): a PICKED container is placed by
        // this click alone, with no drag gesture anywhere. It is the same `commitPlacement` the drop
        // release calls, so the two can never disagree. A rejected pick deliberately stays alive
        // (the planner may click another slot) and its reason is on screen via the Container readout,
        // so nothing is cancelled here.
        if (target) commitPlacement(target);
      }}
    >
      <boxGeometry args={[pickLength, LAYOUT.tierPitch, DIM.width + LAYOUT.rowGap]} />
      <meshBasicMaterial visible={false} />
    </instancedMesh>
  );
}
