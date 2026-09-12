import type { Vessel } from "@/types/domain";

/**
 * The sea surface — FIXED at world y=0, always. Rendered as a sibling of the ship group in
 * VesselScene.tsx (NOT a child of Hull.tsx anymore, which would move it together with the
 * hull — the whole point of ship-attitude-transform.ts is that the ship moves relative to a
 * water plane that does NOT move). See ship-attitude-transform.ts for how the ship group's own
 * position.y is derived so the two align correctly at any draft.
 */
export function WaterlineReference({ vessel }: { vessel: Vessel }) {
  return (
    <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[vessel.length_m * 3, vessel.beam_m * 6]} />
      <meshStandardMaterial color="#9FB6C8" transparent opacity={0.25} depthWrite={false} />
    </mesh>
  );
}
