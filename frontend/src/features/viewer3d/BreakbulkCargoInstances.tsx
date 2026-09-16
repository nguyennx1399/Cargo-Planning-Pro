import { useMemo } from "react";
import type { StowagePlan, Vessel } from "@/types/domain";
import { buildBreakbulkMesh } from "@/engine/cargo/breakbulk-mesh-builder";
import { meshDataToBufferGeometry } from "@/lib/mesh-data-to-buffer-geometry";
import { isUnderDeck } from "@/engine/breakbulk-deck-area";
import { usePlanStore } from "@/store/usePlanStore";

const CATEGORY_COLOR: Record<string, string> = {
  wind_turbine_blade: "#D8DEE4",
  wind_turbine_nacelle: "#8A97A3",
  wind_turbine_tower: "#B7C0C8",
  yacht: "#F2F4F6",
};

/** One <mesh> per breakbulk placement — unlike ContainerInstances, these are individually shaped
 * (box vs cylinder, different sizes), so an InstancedMesh doesn't apply; the item count is small
 * (a few dozen at most) so per-item draw calls are not a performance concern here. No
 * VesselGeometry needed (unlike Hull's LoftedHull) — buildBreakbulkMesh positions everything in
 * scene coordinates directly from `vessel`, same as ContainerInstances' slotToPosition. */
export function BreakbulkCargoInstances({ vessel, plan }: { vessel: Vessel; plan: StowagePlan }) {
  const byId = useMemo(() => new Map(plan.breakbulk_cargo.map((c) => [c.id, c])), [plan.breakbulk_cargo]);
  // Same "On deck" / "Under deck" toggles the container view uses; hold cargo sits inside the hull,
  // so it's only visible with the hull hidden.
  const showOnDeck = usePlanStore((s) => s.showOnDeck);
  const showUnderDeck = usePlanStore((s) => s.showUnderDeck);

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

  return (
    <group>
      {meshes.filter((m) => (m.underDeck ? showUnderDeck : showOnDeck)).map((m) => (
        <mesh key={m.id} geometry={m.geom}>
          <meshStandardMaterial color={m.color} roughness={0.6} metalness={0.15} />
        </mesh>
      ))}
    </group>
  );
}
