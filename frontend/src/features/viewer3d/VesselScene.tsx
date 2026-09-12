import { useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, GizmoHelper, GizmoViewport } from "@react-three/drei";
import * as THREE from "three";
import type { StowagePlan, Vessel } from "@/types/domain";
import type { StabilityResult } from "@/engine/stability-indicative";
import { Hull } from "./Hull";
import { ContainerInstances } from "./ContainerInstances";
import { BreakbulkCargoInstances } from "./BreakbulkCargoInstances";
import { WaterlineReference } from "./WaterlineReference";
import { LoadingSequenceDriver } from "./LoadingSequenceDriver";
import { ShipAttitudeDriver } from "./ShipAttitudeDriver";
import { usePlanStore } from "@/store/usePlanStore";
import { getVesselGeometry } from "@/data/vessel-geometry-catalog";
import { shipAttitudeInputFromStability } from "@/lib/ship-attitude-transform";

export function VesselScene({ vessel, plan, attitude }: { vessel: Vessel; plan: StowagePlan; attitude: StabilityResult | null }) {
  const setSelected = usePlanStore((s) => s.setSelected);
  const exaggerate = usePlanStore((s) => s.exaggerate);
  const shipGroupRef = useRef<THREE.Group>(null!);

  const geometry = vessel.geometry_id ? getVesselGeometry(vessel.geometry_id) : undefined;
  const depthM = geometry?.particulars.depth_m ?? 14;
  const lbpM = geometry?.particulars.lbp_m ?? vessel.length_m;

  return (
    <Canvas
      camera={{ position: [90, 55, 90], fov: 40, near: 0.5, far: 2000 }}
      onPointerMissed={() => setSelected(null)}
      dpr={[1, 2]}
    >
      <color attach="background" args={["#DCE3E9"]} />
      <hemisphereLight args={["#ffffff", "#8a9aa8", 0.9]} />
      <directionalLight position={[60, 120, 40]} intensity={1.2} />

      <WaterlineReference vessel={vessel} />
      <LoadingSequenceDriver totalPlacements={plan.placements.length} />
      <ShipAttitudeDriver
        groupRef={shipGroupRef}
        attitude={shipAttitudeInputFromStability(attitude)}
        depthM={depthM}
        lbpM={lbpM}
        exaggerate={exaggerate}
      />
      <group ref={shipGroupRef}>
        <Hull vessel={vessel} />
        <ContainerInstances vessel={vessel} plan={plan} />
        <BreakbulkCargoInstances vessel={vessel} plan={plan} />
      </group>

      <OrbitControls makeDefault target={[0, 0, 0]} maxPolarAngle={Math.PI * 0.49} />
      <GizmoHelper alignment="bottom-right" margin={[64, 64]}>
        <GizmoViewport labelColor="white" axisHeadScale={0.9} />
      </GizmoHelper>
    </Canvas>
  );
}
