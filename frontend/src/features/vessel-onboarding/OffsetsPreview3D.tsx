import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { HullOffsets, MainParticulars } from "@/types/vessel-geometry";
import { buildHullLoftMesh } from "@/engine/hull/hull-loft-mesh-builder";

/** Raw lofted hull only — no livery/components (this is a shape-check preview during import,
 * not the decorated demo view). Uses the same shared mesher as phase 2 (plan G2). */
export function OffsetsPreview3D({ offsets, particulars }: { offsets: HullOffsets; particulars: MainParticulars }) {
  const bufferGeometry = useMemo(() => {
    const mesh = buildHullLoftMesh(offsets, particulars);
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(mesh.positions, 3));
    geom.setAttribute("normal", new THREE.BufferAttribute(mesh.normals, 3));
    geom.setIndex(new THREE.BufferAttribute(mesh.index, 1));
    return geom;
  }, [offsets, particulars]);

  return (
    <Canvas camera={{ position: [80, 50, 80], fov: 40, near: 0.5, far: 2000 }} dpr={[1, 2]}>
      <color attach="background" args={["#DCE3E9"]} />
      <hemisphereLight args={["#ffffff", "#8a9aa8", 0.9]} />
      <directionalLight position={[60, 120, 40]} intensity={1.2} />
      <mesh geometry={bufferGeometry}>
        <meshStandardMaterial color="#4A5D6E" side={THREE.DoubleSide} />
      </mesh>
      <OrbitControls makeDefault />
    </Canvas>
  );
}
