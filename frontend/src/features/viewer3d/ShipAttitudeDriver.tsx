import type { RefObject } from "react";
import type * as THREE from "three";
import type { ShipAttitudeInput } from "@/lib/ship-attitude-transform";
import { useShipAttitude } from "./useShipAttitude";

interface Props {
  groupRef: RefObject<THREE.Group>;
  attitude: ShipAttitudeInput;
  depthM: number;
  lbpM: number;
  exaggerate: number;
}

/** Thin wrapper so useShipAttitude's useFrame call happens INSIDE the R3F tree — r3f hooks only
 * work within <Canvas>'s own reconciler, and VesselScene's function body (which returns <Canvas>
 * as one of its children) runs OUTSIDE that context. Calling the hook directly there throws
 * "R3F: Hooks can only be used within the Canvas component!" at runtime (a white-screen crash,
 * not caught by typecheck/tests/curl — only visible via an actual browser render). */
export function ShipAttitudeDriver({ groupRef, attitude, depthM, lbpM, exaggerate }: Props) {
  useShipAttitude(groupRef, attitude, depthM, lbpM, exaggerate);
  return null;
}
