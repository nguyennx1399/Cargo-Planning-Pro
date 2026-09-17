import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useShallow } from "zustand/react/shallow";
import type { ThreeEvent } from "@react-three/fiber";
import type { StowagePlan, Vessel } from "@/types/domain";
import { DIM, LAYOUT } from "@/lib/geometry";
import { cursorOnTierPlane, nearestSlotIndex } from "@/lib/nearest-slot";
import { slotVisible } from "@/lib/drop-verdict";
import { buildStowageModel, type SlotDef } from "@/engine/stowage-model";
import { isFortyBay } from "@/engine/slot-helpers";
import { sizeFitsBay } from "@/engine/placement-checks";
import { activeContainerId, usePlanStore } from "@/store/usePlanStore";
import { commitPlacement } from "@/store/commit-placement";

/**
 * Invisible pickable mesh over the slots the cursor may target. Same one-InstancedMesh-per-set
 * technique as ContainerInstances, so raycast cost scales the same way regardless of camera angle.
 *
 * WHICH SET — every case is EMPTY slots (`model.slots` minus `plan.placements`), never
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
 *
 * WHERE THE PRECISION COMES FROM (P1/D1+D2) — the box and the rule are two separate jobs:
 *  - the BOX defines REACHABILITY: one grid-pitch volume per candidate
 *    (`DIM.len40 + LAYOUT.bayGap` × `LAYOUT.tierPitch` × `DIM.width + LAYOUT.rowGap`) extends halfway
 *    into the gap on every side, so adjacent boxes TILE — zero dead zones, which is why the box is
 *    never shrunk (phase C's risk table: "do not shrink the pick box — that reintroduces dead zones").
 *    The pitch box costs overlap wherever a vessel's real pitch is smaller (BBC SAO PAULO's minimum is
 *    12.99 m → a 0.402 m band), and the size-aware 20' volume it once paid for that is gone: it bought
 *    0 overlapping sibling halves at the price of a 0.076 m DEAD ZONE between them, which is the worse
 *    trade (1520 overlapping pairs on MV Demo Horizon under the full-grid definition that also yields
 *    BBC's 1554 — the "2400" this comment used to quote was the demo's *slot* count reported as a
 *    pair count).
 *  - the RULE defines PRECISION: `resolveSlot` below picks the candidate whose centre is nearest the
 *    pointer, so overlap no longer decides anything. three's depth-sorted order is used only to learn
 *    the hovered TIER's height — overlapping boxes always belong to the same tier, so that answer is
 *    unambiguous.
 *
 * The parity filter stays RENDERING-ONLY: it keeps a 40' candidate's box (which reaches 6.7 m off its
 * own centre) from being stolen by a neighbouring 20' HALF's box, while the commit gate remains
 * `canPlaceContainer` in the draft store — no UI-local rule can refuse a drop.
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

  // The candidate centres, in the model's stable order — extracted once per candidate set so the
  // per-pointer-move scan below allocates nothing (a 20' gesture is ~1600 candidates at pointer rate).
  const centres = useMemo(() => slots.map((s) => s.center), [slots]);

  const slotAt = (e: ThreeEvent<PointerEvent | MouseEvent>) =>
    e.instanceId !== undefined ? slots[e.instanceId] ?? null : null;

  /**
   * The slot the pointer is over — steps 1-5 of the resolution rule (P1/D2). The click handler uses
   * this too, not `slotAt`: the chip, the ghost and the commit must name the same slot, or the planner
   * would watch the ghost sit on one bay and the click place into its neighbour.
   */
  const resolveSlot = (e: ThreeEvent<PointerEvent | MouseEvent>): SlotDef | null => {
    const slot0 = slotAt(e);
    const mesh = meshRef.current;
    if (!slot0 || !mesh) return slot0;

    // 1-2. three's first hit is used ONLY for the hovered TIER: its pick box spans exactly one tier
    //      pitch, so all overlapping boxes at this pointer belong to the same tier, and its centre is
    //      the world height of the plane the rule works on. The mesh sits under the attitude group, so
    //      this must be the SLOT's own point, not [0, y, 0] — a heeled/trimmed group moves those to
    //      different world heights.
    const yWorld = mesh.localToWorld(new THREE.Vector3(...slot0.center)).y;
    // 3. Where the cursor ray crosses that plane (null = ray parallel to the deck, or the plane behind
    //    the camera: keep three's answer rather than inventing one).
    const crossing = cursorOnTierPlane(
      yWorld,
      [e.ray.origin.x, e.ray.origin.y, e.ray.origin.z],
      [e.ray.direction.x, e.ray.direction.y, e.ray.direction.z],
    );
    if (!crossing) return slot0;
    // 4. Back into slot space (world → local is not a pure translation under the attitude group).
    const local = mesh.worldToLocal(new THREE.Vector3(crossing[0], crossing[1], crossing[2]));
    // 5. The decision rule itself: nearest centre, NEVER three's distance-sorted order.
    return slots[nearestSlotIndex([local.x, local.y, local.z], centres)] ?? slot0;
  };

  const capacity = slots.length || 1;

  return (
    <instancedMesh
      key={capacity} // remount when the candidate count changes, as ContainerInstances does
      ref={meshRef}
      args={[undefined, undefined, capacity]}
      onPointerMove={(e) => {
        e.stopPropagation();
        setHoveredSlot(resolveSlot(e));
      }}
      onPointerOut={() => setHoveredSlot(null)}
      onClick={(e) => {
        e.stopPropagation();
        const target = resolveSlot(e);
        // The CLICK trigger of the one commit resolver (WCAG 2.5.7): a PICKED container is placed by
        // this click alone, with no drag gesture anywhere. It is the same `commitPlacement` the drop
        // release calls, so the two can never disagree. A rejected pick deliberately stays alive
        // (the planner may click another slot) and its reason is recorded by the resolver, so a chip
        // beside the cursor and the Sidebar both carry it after the click (M2).
        if (target) commitPlacement(target, "scene");
      }}
    >
      <boxGeometry args={[DIM.len40 + LAYOUT.bayGap, LAYOUT.tierPitch, DIM.width + LAYOUT.rowGap]} />
      <meshBasicMaterial visible={false} />
    </instancedMesh>
  );
}
