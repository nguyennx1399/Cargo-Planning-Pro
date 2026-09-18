import { useMemo, useRef } from "react";
import { useShallow } from "zustand/react/shallow";
import type { ThreeEvent } from "@react-three/fiber";
import type { StowagePlan, Vessel } from "@/types/domain";
import { buildBreakbulkMesh } from "@/engine/cargo/breakbulk-mesh-builder";
import { meshDataToBufferGeometry } from "@/lib/mesh-data-to-buffer-geometry";
import { isUnderDeck } from "@/engine/breakbulk-deck-area";
import { HIGHLIGHT } from "@/lib/colors";
import { usePlanStore } from "@/store/usePlanStore";
import { cargoClickAction } from "@/store/cargo-click-action";
import { cancelPlacement } from "@/store/commit-placement";
import { GESTURE_LAYER, isFrontmostGestureHit } from "./press-ownership";

const CATEGORY_COLOR: Record<string, string> = {
  wind_turbine_blade: "#D8DEE4",
  wind_turbine_nacelle: "#8A97A3",
  wind_turbine_tower: "#B7C0C8",
  yacht: "#F2F4F6",
  // Planner-defined cargo: a warmer neutral so a hand-entered item reads as distinct from the demo fleet
  // without implying a verdict (green/red belong to the drop layers).
  general: "#C2B49A",
};

/** How far the pointer must travel with the button down before a press counts as a MOVE rather than a
 * click. The SAME constant `ContainerInstances` uses — one threshold for "press-vs-click" everywhere,
 * so the two cargo kinds cannot end up needing different hand movements (Session-1 decision). */
const DRAG_THRESHOLD_PX = 4;

/**
 * One <mesh> per breakbulk placement — unlike ContainerInstances, these are individually shaped
 * (box vs cylinder, different sizes), so an InstancedMesh doesn't apply; the item count is small
 * (a few dozen at most) so per-item draw calls are not a performance concern here. No
 * VesselGeometry needed (unlike Hull's LoftedHull) — buildBreakbulkMesh positions everything in
 * scene coordinates directly from `vessel`, same as ContainerInstances' slotToPosition.
 *
 * PLACED ITEMS ARE INTERACTIVE (Phase 03 requirement 5), with the container gesture's own contract:
 *  - a press that travels past `DRAG_THRESHOLD_PX` starts a MOVE — `setHand` takes the item out of the
 *    scene (below), so the ghost drawn under the cursor is the only copy of it;
 *  - a click that did not move still SELECTS the item (a click is the WCAG 2.5.7 alternative to
 *    dragging, exactly as it is for containers), and `hoveredId`/`selectedId` tint it like a box.
 *
 * The item currently in hand is NOT rendered: otherwise the item would collide with its own ghost and
 * its solid footprint would lie under the translucent preview (prototype finding). `hoveredId` is
 * shared with the container layers — an id resolves in exactly one of the two cargo lists, so one
 * focus field serves both without a mapping.
 *
 * No handler here calls `stopPropagation`: the pointer must keep travelling to the area drop plane
 * below (and to the slot picker beside) or a project-cargo drag would freeze wherever an item stands —
 * the same occlusion the container layers fix with an explicit hand guard.
 */
export function BreakbulkCargoInstances({ vessel, plan }: { vessel: Vessel; plan: StowagePlan }) {
  const byId = useMemo(() => new Map(plan.breakbulk_cargo.map((c) => [c.id, c])), [plan.breakbulk_cargo]);
  const { showOnDeck, showUnderDeck, hoveredId, selectedId, handKind, handId, setHovered, setSelected, setHand } =
    usePlanStore(
      useShallow((s) => ({
        showOnDeck: s.showOnDeck,
        showUnderDeck: s.showUnderDeck,
        hoveredId: s.hoveredId,
        selectedId: s.selectedId,
        handKind: s.inHand?.kind ?? null,
        handId: s.inHand?.id ?? null,
        setHovered: s.setHovered,
        setSelected: s.setSelected,
        setHand: s.setHand,
      })),
    );

  // Where a press started, until it either travels past the threshold (a move) or turns out to be a
  // click. A ref, not state: it must not re-render the meshes mid-press.
  const downRef = useRef<{ id: string; x: number; y: number } | null>(null);
  // Set when this press armed a MOVE: the trailing `click` R3F still delivers would otherwise select
  // whatever the ray now finds (the item has left the scene), which is not what the planner pressed.
  const movedRef = useRef(false);
  /** A gesture is in flight: no hover churn under it, and a press that starts mid-gesture is ignored. */
  const gesturing = handKind !== null;

  const meshes = useMemo(() => {
    return plan.breakbulk_placements
      .map((p) => {
        const item = byId.get(p.cargo_id);
        if (!item) return null;
        return {
          id: p.cargo_id,
          underDeck: isUnderDeck(p.area_id),
          color: CATEGORY_COLOR[item.category] ?? "#C9D2DA",
          geom: meshDataToBufferGeometry(buildBreakbulkMesh(item, p, vessel)),
        };
      })
      .filter((m): m is NonNullable<typeof m> => m !== null);
  }, [plan.breakbulk_placements, byId, vessel]);

  const onPointerDown = (e: ThreeEvent<PointerEvent>, id: string) => {
    movedRef.current = false;
    // Left button only, one gesture at a time, and only if this item is the FRONTMOST hit: an item
    // behind a container stack must not arm a move that the stack's own handler would then overwrite
    // (`press-ownership.ts`).
    if (e.nativeEvent.button !== 0 || gesturing || !isFrontmostGestureHit(e)) return;
    downRef.current = { id, x: e.nativeEvent.clientX, y: e.nativeEvent.clientY };
  };

  const onPointerMove = (e: ThreeEvent<PointerEvent>, id: string) => {
    const down = downRef.current;
    if (down && down.id === id) {
      // `buttons` is the finger-up check for a release that happened off this mesh: without it a plain
      // click would arm the next pointer move into a spurious move.
      if ((e.nativeEvent.buttons & 1) === 0) downRef.current = null;
      else if (Math.hypot(e.nativeEvent.clientX - down.x, e.nativeEvent.clientY - down.y) > DRAG_THRESHOLD_PX) {
        downRef.current = null;
        movedRef.current = true;
        // Straight into the ONE hand: the item is lifted out of the scene, the ghost takes over, and
        // the window release (Sidebar's hook) commits it — no breakbulk-specific commit path.
        setHand({ kind: "breakbulk", id }, "drag");
        setHovered(null);
        return;
      }
    }
    if (gesturing) return;
    // The tint belongs to the frontmost item too, or a box in front of a stack would highlight the
    // stack behind it (the container layer's own hover writes after this one in the same dispatch).
    if (isFrontmostGestureHit(e)) setHovered(id);
  };

  /** The hovered item's outline colour; the item in hand is not drawn at all. */
  const colorOf = (id: string, base: string): string =>
    id === selectedId ? HIGHLIGHT.selected : id === hoveredId ? HIGHLIGHT.hover : base;

  return (
    <group>
      {meshes
        .filter((m) => (m.underDeck ? showUnderDeck : showOnDeck))
        .filter((m) => !(handKind === "breakbulk" && m.id === handId))
        .map((m) => (
          <mesh
            key={m.id}
            geometry={m.geom}
            userData={GESTURE_LAYER}
            onPointerDown={(e) => onPointerDown(e, m.id)}
            onPointerMove={(e) => onPointerMove(e, m.id)}
            onPointerOut={() => setHovered(null)}
            onClick={() => {
              if (movedRef.current) return;
              // Click-to-place (Phase 01), the same rule the container layer uses: first click selects,
              // a second click on the SAME item takes it in hand, and one click on an area then places
              // it. NOTE the asymmetry with containers: an item in hand is not rendered at all (below),
              // and `AreaDropPlane` covers the ship while it is held — so there is nothing left to click
              // and `putDown` is unreachable here. Esc is the put-down for project cargo, which is what
              // the list's hint says.
              switch (cargoClickAction(usePlanStore.getState(), m.id)) {
                case "select":
                  setSelected(m.id);
                  break;
                case "pick":
                  setHand({ kind: "breakbulk", id: m.id }, "pick");
                  break;
                case "putDown":
                  cancelPlacement();
                  break;
                case "ignore":
                  break;
              }
            }}
          >
            <meshStandardMaterial color={colorOf(m.id, m.color)} roughness={0.6} metalness={0.15} />
          </mesh>
        ))}
    </group>
  );
}
