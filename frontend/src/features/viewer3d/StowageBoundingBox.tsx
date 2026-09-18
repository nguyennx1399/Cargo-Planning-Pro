/**
 * StowageBoundingBox.tsx — a wireframe around the volume cargo can occupy, one box per deck level.
 *
 * It answers "where can cargo go AT ALL", so it is derived from the SLOT GRID (`model.slots`), never from
 * the plan: the box must not shrink as cargo is taken off, and it does not recompute when cargo moves.
 *
 * ONE BOX PER DECK LEVEL, not one spanning both (user's choice, bounding-box plan): the on-deck and
 * under-deck volumes are physically separate spaces with the hatch covers between them, and a single box
 * would enclose deck structure that is not stowage space. The extent arithmetic is `slotEnvelopeBoxes`,
 * which shares its fold with the drag-time outline so the two can never disagree about a level.
 *
 * ALWAYS AVAILABLE — unlike the free-space overlay it does NOT yield to a gesture. It is thin edges on an
 * invisible box, not a translucent mass, so it does not compete with the drop layers, and seeing the
 * envelope while placing is part of its point.
 *
 * Deck toggles and the bay filter apply through `slotVisible`, the same rule every other drawn layer
 * uses: a box describing space the planner has filtered out would read as a bug.
 *
 * `raycast={() => null}` — a hint layer never takes the pointer.
 */
import { useMemo } from "react";
import { Edges } from "@react-three/drei";
import { useShallow } from "zustand/react/shallow";
import type { Vessel } from "@/types/domain";
import { buildStowageModel, placementXToSceneX } from "@/engine/stowage-model";
import { DIM } from "@/lib/geometry";
import { slotEnvelopeBoxes } from "@/lib/slot-envelope";
import { slotVisible } from "@/lib/drop-verdict";
import { usePlanStore } from "@/store/usePlanStore";

/** Neutral, and deliberately not a `DROP_TINT` colour: this is structure, not a verdict about a drop. */
const EDGE_COLOR = { on: "#3F6E8C", under: "#6B5B8C" } as const;

export function StowageBoundingBox({ vessel }: { vessel: Vessel }) {
  const view = usePlanStore(
    useShallow((s) => ({ showOnDeck: s.showOnDeck, showUnderDeck: s.showUnderDeck, bayFilter: s.bayFilter })),
  );

  // Vessel + toggles only: the grid does not depend on the plan, so cargo moving must not recompute this.
  const boxes = useMemo(() => {
    const slots = buildStowageModel(vessel).slots.filter((slot) => slotVisible(slot, vessel, view));
    return slotEnvelopeBoxes(slots, DIM.height).map((box) => ({
      deck: box.deck,
      size: [box.rect.xMax - box.rect.xMin, box.ceilY - box.floorY, box.rect.zMax - box.rect.zMin] as [
        number,
        number,
        number,
      ],
      position: [
        placementXToSceneX((box.rect.xMin + box.rect.xMax) / 2, vessel.length_m),
        (box.floorY + box.ceilY) / 2,
        (box.rect.zMin + box.rect.zMax) / 2,
      ] as [number, number, number],
    }));
  }, [vessel, view]);

  return (
    <group>
      {boxes.map((box) => (
        <mesh key={box.deck} position={box.position} raycast={() => null}>
          <boxGeometry args={box.size} />
          {/* invisible faces — only the edges are the picture */}
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          <Edges color={EDGE_COLOR[box.deck]} />
        </mesh>
      ))}
    </group>
  );
}
