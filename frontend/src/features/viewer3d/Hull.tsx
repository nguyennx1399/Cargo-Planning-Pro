import { useMemo } from "react";
import { Detailed, Edges } from "@react-three/drei";
import * as THREE from "three";
import type { Vessel } from "@/types/domain";
import type { Livery, VesselGeometry } from "@/types/vessel-geometry";
import { holdDepth } from "@/lib/geometry";
import { usePlanStore } from "@/store/usePlanStore";
import { getVesselGeometry } from "@/data/vessel-geometry-catalog";
import { buildHullLoftMesh } from "@/engine/hull/hull-loft-mesh-builder";
import { buildStaticComponentMeshes } from "@/engine/vessel-components/merge-static-components";
import { createHullLiveryMaterial } from "@/engine/vessel-components/hull-livery-material";
import { meshDataToBufferGeometry } from "@/lib/mesh-data-to-buffer-geometry";

/** Flat per-material-group color for the merged static fittings (see merge-static-components.ts
 * — everything in one group shares one draw call, so it can only have one color today). */
const COMPONENT_GROUP_COLORS: Record<string, string> = {
  superstructure: "#E8ECEF",
  "deck-fittings": "#B5C0C9",
  crane: "#C97B2E",
};

/**
 * Renders the real lofted hull + component library (vessel-3d-model-pipeline phases 2-3) when
 * the vessel has a `geometry_id` with generated offsets; otherwise falls back to the old
 * simplified box hull (unchanged) so any vessel without geometry still renders.
 * TODO(phase-3+): funnel logo decal, water-transparency toggle and draft marks all wait on
 * P1-demo phase-04's `Water`, which doesn't exist yet.
 */
export function Hull({ vessel }: { vessel: Vessel }) {
  const geometry = vessel.geometry_id ? getVesselGeometry(vessel.geometry_id) : undefined;
  if (geometry?.hull.offsets) {
    // LOD (E3-01c): past this distance, hull surface detail (plating, hatch covers) isn't
    // visually resolvable anyway, so swap to the cheap box silhouette to cut draw/fill cost.
    // THREE.LOD only toggles visibility per frame — both levels stay mounted, so this doesn't
    // avoid the LoftedHull build, only its per-frame render cost once past the threshold.
    const farDistance = Math.max(200, vessel.length_m * 1.3);
    return (
      <Detailed distances={[0, farDistance]}>
        <LoftedHull vessel={vessel} geometry={geometry} />
        <SimpleBoxHull vessel={vessel} />
      </Detailed>
    );
  }
  return <SimpleBoxHull vessel={vessel} />;
}

function resolveLivery(geometry: VesselGeometry, vessel: Vessel): Livery {
  return vessel.livery_override ? { ...geometry.livery, ...vessel.livery_override } : geometry.livery;
}

function LoftedHull({ vessel, geometry }: { vessel: Vessel; geometry: VesselGeometry }) {
  const showHull = usePlanStore((s) => s.showHull);
  const livery = useMemo(() => resolveLivery(geometry, vessel), [geometry, vessel]);

  const hullGeometry = useMemo(() => {
    const offsets = geometry.hull.offsets;
    return offsets ? meshDataToBufferGeometry(buildHullLoftMesh(offsets, geometry.particulars)) : null;
  }, [geometry]);

  const hullMaterial = useMemo(
    () => createHullLiveryMaterial(livery, geometry.particulars.depth_m),
    [livery, geometry.particulars.depth_m]
  );

  const componentGeometries = useMemo(() => {
    const groups = buildStaticComponentMeshes(vessel, geometry);
    const result: Record<string, THREE.BufferGeometry> = {};
    for (const [name, mesh] of Object.entries(groups)) result[name] = meshDataToBufferGeometry(mesh);
    return result;
  }, [vessel, geometry]);

  if (!hullGeometry) return <SimpleBoxHull vessel={vessel} />;

  if (!showHull) return null;
  return (
    <group>
      <mesh geometry={hullGeometry} material={hullMaterial} raycast={() => null} />
      {Object.entries(componentGeometries).map(([group, geom]) => (
        <mesh key={group} geometry={geom} raycast={() => null}>
          <meshStandardMaterial color={COMPONENT_GROUP_COLORS[group] ?? "#C9D2DA"} />
        </mesh>
      ))}
    </group>
  );
}

function SimpleBoxHull({ vessel }: { vessel: Vessel }) {
  const showHull = usePlanStore((s) => s.showHull);
  const depth = holdDepth() + 1.5;
  const L = vessel.length_m;
  const B = vessel.beam_m;

  if (!showHull) return null;
  return (
    <group>
      {/* hull body (below deck) */}
      <mesh position={[0, -depth / 2, 0]}>
        <boxGeometry args={[L, depth, B]} />
        <meshStandardMaterial color="#4A5D6E" transparent opacity={0.18} depthWrite={false} />
        <Edges color="#4A5D6E" />
      </mesh>

      {/* deck line */}
      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[L, B]} />
        <meshStandardMaterial color="#6B7C8C" transparent opacity={0.12} depthWrite={false} />
      </mesh>

      {/* accommodation / bridge aft — hard-coded fallback only; LoftedHull draws this from
          VesselGeometry.components instead (merge-static-components.ts). */}
      <mesh position={[-L / 2 + 10, 7, 0]}>
        <boxGeometry args={[10, 14, B * 0.8]} />
        <meshStandardMaterial color="#E8ECEF" />
        <Edges color="#8795A1" />
      </mesh>
    </group>
  );
}
