import { Suspense, useEffect, useMemo } from "react";
import { Detailed, Edges, useGLTF } from "@react-three/drei";
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
 * the vessel has a `geometry_id` with generated offsets; a pre-baked GLB (dynamic-vessel-switching
 * plan) when it has `hull.source === "mesh"` instead; otherwise falls back to the old simplified
 * box hull (unchanged) so any vessel without geometry still renders.
 *
 * `hidden` is the caller's "something is in hand" flag: the shell plating sits between the camera and
 * the targets the planner is aiming at — a tank top for project cargo, the under-deck placeholders for
 * a container — so the hull steps aside for the duration of the gesture instead of the planner having
 * to untick the viewer's own hull toggle and remember to tick it back. It applies to BOTH kinds of
 * cargo and to both gesture modes (a pick has no button held, and must still get the same view); the
 * narrower "project cargo AND under-deck shown" rule it started as (D-P5) left a container drag staring
 * at the plating. It is a PROP rather than a store read so this file stays free of the hand.
 *
 * The viewer's own `showHull` toggle still wins (`!showHull || hidden` below): unticking Hull hides it
 * with nothing in hand, and no gesture re-shows it.
 *
 * Hiding DOES remove the three.js objects from the scene — what a hidden path preserves is the
 * expensive WORK behind them: the lofted geometry stays in its `useMemo` and the GLB stays in drei's
 * `useGLTF` cache, because every hook runs before the early return. So a gesture start never re-lofts a
 * hull or re-parses a GLB. Keep the early return where it is (after the hooks) — moving the hide up
 * into a conditional mount, or into the caller, is what would make each gesture pay for the rebuild.
 *
 * TODO(phase-3+): funnel logo decal, water-transparency toggle and draft marks all wait on
 * P1-demo phase-04's `Water`, which doesn't exist yet.
 */
export function Hull({ vessel, hidden = false }: { vessel: Vessel; hidden?: boolean }) {
  const geometry = vessel.geometry_id ? getVesselGeometry(vessel.geometry_id) : undefined;
  if (geometry?.hull.offsets) {
    // LOD (E3-01c): past this distance, hull surface detail (plating, hatch covers) isn't
    // visually resolvable anyway, so swap to the cheap box silhouette to cut draw/fill cost.
    // THREE.LOD only toggles visibility per frame — both levels stay mounted, so this doesn't
    // avoid the LoftedHull build, only its per-frame render cost once past the threshold.
    const farDistance = Math.max(200, vessel.length_m * 1.3);
    return (
      <Detailed distances={[0, farDistance]}>
        <LoftedHull vessel={vessel} geometry={geometry} hidden={hidden} />
        <SimpleBoxHull vessel={vessel} hidden={hidden} />
      </Detailed>
    );
  }
  if (geometry?.hull.source === "mesh") {
    // Suspense fallback covers the GLB streaming in; SimpleBoxHull also still catches the case
    // where the file is genuinely missing/404 (no error boundary here — see GltfHull comment).
    return (
      <Suspense fallback={<SimpleBoxHull vessel={vessel} hidden={hidden} />}>
        <GltfHull geometry={geometry} meshUri={geometry.hull.mesh_uri} hidden={hidden} />
      </Suspense>
    );
  }
  return <SimpleBoxHull vessel={vessel} hidden={hidden} />;
}

function resolveLivery(geometry: VesselGeometry, vessel: Vessel): Livery {
  return vessel.livery_override ? { ...geometry.livery, ...vessel.livery_override } : geometry.livery;
}

/**
 * Pre-baked GLB hull (dynamic-vessel-switching plan) — for vessels whose exterior is authored
 * externally (Blender) rather than lofted from offsets, e.g. BBC SAO PAULO. Materials are baked
 * into the GLB itself, unlike LoftedHull's procedural livery, so nothing here reads
 * `geometry.livery`.
 * TODO: Draco/KTX2 decoder self-hosting (per the source Confluence plan's "no external CDN"
 * preference) is not wired up yet — this environment's tooling currently blocks reading
 * node_modules to copy the decoder files into public/decoders/. Not needed for today's
 * uncompressed placeholder GLB; wire `useGLTF(meshUri, "/decoders/draco/")` (drei's string-path
 * overload) once a real Draco/KTX2-compressed asset replaces it.
 */
function GltfHull({ geometry, meshUri, hidden }: { geometry: VesselGeometry; meshUri: string; hidden: boolean }) {
  const showHull = usePlanStore((s) => s.showHull);
  const { scene } = useGLTF(meshUri);

  // Hull shouldn't steal clicks from EmptySlotPicker/ContainerInstances — mirrors LoftedHull's
  // `raycast={() => null}` on its own meshes, but has to be applied per-mesh across the whole
  // loaded scene graph since `<primitive>` inserts the object as-is.
  useEffect(() => {
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh) child.raycast = () => null;
    });
  }, [scene]);

  // Translates the assumed ship-frame authoring convention (x: AP=0->FP=lbp_m, y: keel=0->
  // deck=depth_m up, z: centered on centerline) into this app's scene convention — the same
  // [-lbp_m/2, -depth_m, +0] translation lib/ship-frame.ts's shipToScene applies elsewhere. NOT
  // verified against a Blender asset: the generated GLB (scripts/build-bbc-sao-paulo-glb.mjs) is built
  // to this same assumed convention so it renders centered/grounded today, but the actual
  // exported GLB's true axes/origin must be checked once that asset exists (see
  // bbc-sao-paulo-geometry.ts's module comment).
  const position: [number, number, number] = [-geometry.particulars.lbp_m / 2, -geometry.particulars.depth_m, 0];

  if (!showHull || hidden) return null;
  return <primitive object={scene} position={position} />;
}

function LoftedHull({ vessel, geometry, hidden }: { vessel: Vessel; geometry: VesselGeometry; hidden: boolean }) {
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

  if (!hullGeometry) return <SimpleBoxHull vessel={vessel} hidden={hidden} />;

  if (!showHull || hidden) return null;
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

function SimpleBoxHull({ vessel, hidden = false }: { vessel: Vessel; hidden?: boolean }) {
  const showHull = usePlanStore((s) => s.showHull);
  const depth = holdDepth(vessel) + 1.5;
  const L = vessel.length_m;
  const B = vessel.beam_m;

  if (!showHull || hidden) return null;
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
