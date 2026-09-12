import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { computeShipTransform, type ShipAttitudeInput } from "@/lib/ship-attitude-transform";

const DAMPING_RATE = 3; // higher = snappier; tune once a browser tool can check the feel

/** Applies computeShipTransform's target to a group ref every frame, smoothed with
 * THREE.MathUtils.damp so the ship eases into a new attitude instead of snapping. */
export function useShipAttitude(
  groupRef: React.RefObject<THREE.Group>,
  attitude: ShipAttitudeInput,
  depthM: number,
  lbpM: number,
  exaggerate: number
) {
  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;
    const target = computeShipTransform(attitude, depthM, lbpM);
    group.position.y = THREE.MathUtils.damp(group.position.y, target.positionY, DAMPING_RATE, delta);
    group.rotation.x = THREE.MathUtils.damp(group.rotation.x, target.rotationX * exaggerate, DAMPING_RATE, delta);
    group.rotation.z = THREE.MathUtils.damp(group.rotation.z, target.rotationZ * exaggerate, DAMPING_RATE, delta);
  });
}
