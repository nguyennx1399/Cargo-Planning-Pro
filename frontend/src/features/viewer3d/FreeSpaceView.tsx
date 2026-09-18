/**
 * FreeSpaceView.tsx — what room is left, drawn with NOTHING in hand.
 *
 * Every other hint layer in this viewer is shaped to one item: `SlotPlaceholders` draws the slots THIS
 * box may take, `AreaPlaceholders` draws the areas THIS project-cargo item belongs in, and both vanish
 * when the hand is empty. This is the item-independent picture behind the "Free space" toggle.
 *
 * MOUNTED ONLY WHILE THE HAND IS EMPTY (the gate is in `VesselScene`). With an item in hand the per-item
 * layers are already drawing a DIFFERENT question — valid space, not empty space — and two translucent
 * layers over the same cells would both clutter the scene and disagree with each other.
 *
 * TWO THINGS ARE DRAWN:
 *  - empty container cells, as translucent boxes on the 40' GRID. Never `model.slots`: that lists a 40'
 *    cell and its two 20' halves, so drawing it would paint the same physical space three times.
 *  - what is TAKEN on each area's ground — placed cargo, container stacks, keep-outs — in the same greys
 *    `AreaPlaceholders` uses. Whatever stays clear is the free ground. Shading the obstacles rather than
 *    computing free rectangles is deliberate (see the plan): it reuses data the engine already produces
 *    and claims nothing about what would fit.
 *
 * NEUTRAL COLOURS, never `DROP_TINT`: green/amber/red in this app mean "this drop would be accepted /
 * recorded / refused". Free space is not a verdict about anything, and borrowing that vocabulary would
 * imply a promise this layer cannot make.
 *
 * Every mesh is `raycast={() => null}` — a hint layer must never intercept the pointer.
 */
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useShallow } from "zustand/react/shallow";
import type { StowagePlan, Vessel } from "@/types/domain";
import type { Rect } from "@/engine/breakbulk-overlap-check";
import { allSlots } from "@/engine/all-slots";
import { bayPosition, deckOf, isFortyBay } from "@/engine/slot-helpers";
import { breakbulkOccupancy, buildStowageModel, clipRect, occupiedRectsByArea } from "@/engine/stowage-model";
import { DIM, slotToPosition } from "@/lib/geometry";
import { areaVisible, slotInBay } from "@/lib/drop-verdict";
import { usePlanStore } from "@/store/usePlanStore";
import { AreaRectFill, AreaRectOutline } from "./area-rect-graphics";

/** Free space is not a verdict — see the header. Cool neutral for open cells, the same greys
 * `AreaPlaceholders` uses for ground that is already taken. */
const FREE_CELL_COLOR = "#7FA8C9";
const TAKEN = { fill: "#39424B", keepOut: "#8A97A3" };
const LIFT = { taken: 0.02, outline: 0.04 };

export function FreeSpaceView({ vessel, plan }: { vessel: Vessel; plan: StowagePlan }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const view = usePlanStore(
    useShallow((s) => ({ showOnDeck: s.showOnDeck, showUnderDeck: s.showUnderDeck, bayFilter: s.bayFilter })),
  );

  /** Empty 40' cells the viewer can see. One entry per physical cell (see the header on `model.slots`). */
  const cells = useMemo(() => {
    const taken = new Set<string>();
    for (const p of plan.placements) {
      const pos = bayPosition(p.slot.bay, vessel.bays);
      if (pos) taken.add(`${pos.fortyBay}|${p.slot.row}|${p.slot.tier}`);
    }
    return allSlots(vessel)
      .filter((slot) => isFortyBay(slot.bay))
      .filter((slot) => (deckOf(slot.tier) === "on" ? view.showOnDeck : view.showUnderDeck))
      .filter((slot) => view.bayFilter === null || slotInBay(slot, view.bayFilter, vessel))
      .filter((slot) => !taken.has(`${slot.bay}|${slot.row}|${slot.tier}`))
      .map((slot) => slotToPosition(vessel, slot));
  }, [vessel, plan.placements, view]);

  /** Ground already taken on each visible area, clipped to the area it belongs to. */
  const areas = useMemo(() => {
    const model = buildStowageModel(vessel);
    const stacksByArea = occupiedRectsByArea(vessel, plan.placements);
    const cargoByArea = breakbulkOccupancy(plan.breakbulk_cargo, plan.breakbulk_placements);
    return model.areas
      .filter((area) => areaVisible(area, view))
      .map((area) => ({
        area,
        taken: [...(cargoByArea.get(area.id) ?? []), ...(stacksByArea[area.id] ?? [])]
          .map((r) => clipRect(r, area.rect))
          .filter((r): r is Rect => r !== null),
        keepOuts: area.keepOuts.map((k) => clipRect(k, area.rect)).filter((r): r is Rect => r !== null),
      }));
  }, [vessel, plan.placements, plan.breakbulk_cargo, plan.breakbulk_placements, view]);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    cells.forEach((position, i) => {
      m.setPosition(position[0], position[1], position[2]);
      mesh.setMatrixAt(i, m);
    });
    mesh.count = cells.length;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [cells]);

  return (
    <group>
      {cells.length > 0 && (
        <instancedMesh
          key={cells.length} // remount when the count changes, as the other instanced layers do
          ref={meshRef}
          args={[undefined, undefined, cells.length]}
          raycast={() => null}
        >
          <boxGeometry args={[DIM.len40, DIM.height, DIM.width]} />
          <meshBasicMaterial color={FREE_CELL_COLOR} transparent opacity={0.12} depthWrite={false} />
        </instancedMesh>
      )}
      {areas.map(({ area, taken, keepOuts }) => (
        <group key={area.id}>
          <AreaRectOutline rect={area.rect} lengthM={vessel.length_m} y={area.surfaceY + LIFT.outline} color={FREE_CELL_COLOR} />
          {taken.map((rect, i) => (
            <AreaRectFill
              key={`taken-${i}`}
              rect={rect}
              lengthM={vessel.length_m}
              y={area.surfaceY + LIFT.taken}
              color={TAKEN.fill}
              opacity={0.55}
            />
          ))}
          {keepOuts.map((rect, i) => (
            <AreaRectFill
              key={`keep-out-${i}`}
              rect={rect}
              lengthM={vessel.length_m}
              y={area.surfaceY + LIFT.taken}
              color={TAKEN.keepOut}
              opacity={0.8}
            />
          ))}
        </group>
      ))}
    </group>
  );
}
