import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useShallow } from "zustand/react/shallow";
import type { ThreeEvent } from "@react-three/fiber";
import type { Container, StowagePlan, Vessel } from "@/types/domain";
import { DIM, slotToPosition } from "@/lib/geometry";
import { HIGHLIGHT, containerColor, podColorMap } from "@/lib/colors";
import { usePlanStore } from "@/store/usePlanStore";
import { visiblePlacements } from "@/engine/playback-slice";

interface Props {
  vessel: Vessel;
  plan: StowagePlan;
}

interface Item {
  container: Container;
  position: [number, number, number];
  height: number;
  length: number;
}

const LENGTH_BY_SIZE: Record<Container["size"], number> = { "20": DIM.len20, "40": DIM.len40, "45": DIM.len45 };

/**
 * All containers in ONE InstancedMesh (one draw call) — length varies per instance's own matrix
 * scale (LENGTH_BY_SIZE), so mixed 20'/40'/45' render at their correct size even sharing one mesh.
 * TODO(phase-1): outline shader for selection.
 */
export function ContainerInstances({ vessel, plan }: Props) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const { colorMode, showOnDeck, showUnderDeck, bayFilter, hoveredId, selectedId, playbackCount, setHovered, setSelected } =
    usePlanStore(
      useShallow((s) => ({
        colorMode: s.colorMode,
        showOnDeck: s.showOnDeck,
        showUnderDeck: s.showUnderDeck,
        bayFilter: s.bayFilter,
        hoveredId: s.hoveredId,
        selectedId: s.selectedId,
        playbackCount: s.playbackCount,
        setHovered: s.setHovered,
        setSelected: s.setSelected,
      }))
    );

  const byId = useMemo(() => new Map(plan.containers.map((c) => [c.id, c])), [plan.containers]);
  const pods = useMemo(() => podColorMap(plan.ports), [plan.ports]);

  const items: Item[] = useMemo(() => {
    return visiblePlacements(plan.placements, playbackCount)
      .filter((p) => {
        const onDeck = p.slot.tier >= 80;
        if (onDeck && !showOnDeck) return false;
        if (!onDeck && !showUnderDeck) return false;
        if (bayFilter !== null && p.slot.bay !== bayFilter) return false;
        return true;
      })
      .map((p) => {
        const container = byId.get(p.container_id)!;
        return {
          container,
          position: slotToPosition(vessel, p.slot),
          height: container.high_cube ? DIM.heightHC : DIM.height,
          length: LENGTH_BY_SIZE[container.size],
        };
      });
  }, [plan.placements, playbackCount, byId, vessel, showOnDeck, showUnderDeck, bayFilter]);

  // matrices: only when layout changes
  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    items.forEach((it, i) => {
      m.compose(
        new THREE.Vector3(...it.position),
        q,
        new THREE.Vector3(it.length, it.height, DIM.width),
      );
      mesh.setMatrixAt(i, m);
    });
    mesh.count = items.length;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [items]);

  // colors: when mode / hover / selection changes
  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const color = new THREE.Color();
    items.forEach((it, i) => {
      const id = it.container.id;
      const hex =
        id === selectedId ? HIGHLIGHT.selected
        : id === hoveredId ? HIGHLIGHT.hover
        : containerColor(it.container, colorMode, pods);
      mesh.setColorAt(i, color.set(hex));
    });
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [items, colorMode, pods, hoveredId, selectedId]);

  const idAt = (e: ThreeEvent<PointerEvent | MouseEvent>) =>
    e.instanceId !== undefined ? items[e.instanceId]?.container.id ?? null : null;

  const capacity = plan.placements.length || 1;

  return (
    <instancedMesh
      key={capacity} // remount if capacity changes
      ref={meshRef}
      args={[undefined, undefined, capacity]}
      onPointerMove={(e) => {
        e.stopPropagation();
        setHovered(idAt(e));
      }}
      onPointerOut={() => setHovered(null)}
      onClick={(e) => {
        e.stopPropagation();
        setSelected(idAt(e));
      }}
    >
      {/* unit cube, scaled per instance; slight inset so stacks read as separate boxes */}
      <boxGeometry args={[0.97, 0.96, 0.95]} />
      <meshStandardMaterial roughness={0.7} metalness={0.1} />
    </instancedMesh>
  );
}
