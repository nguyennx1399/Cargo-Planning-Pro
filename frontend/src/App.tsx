import { useMemo, useState } from "react";
import type { Vessel } from "@/types/domain";
import { Button } from "@/components/ui/button";
import { VesselScene } from "@/features/viewer3d/VesselScene";
import { Sidebar } from "@/features/panels/Sidebar";
import { BayPlanView } from "@/features/bayplan/BayPlanView";
import { OffsetsImportPanel } from "@/features/vessel-onboarding/OffsetsImportPanel";
import {
  buildEmptyDemoPlan,
  buildLoadedDemoPlan,
  withBreakbulkCargo,
} from "@/data/build-demo-plan";
import {
  DEFAULT_VESSEL_ID,
  VESSEL_CATALOG,
  getVesselCatalogEntry,
} from "@/data/vessel-catalog";
import { validatePlan } from "@/engine/validate-plan";
import { useIndicativeStability } from "@/lib/use-indicative-stability";
import { usePlanStore } from "@/store/usePlanStore";

type Mode = "demo" | "onboarding";

const defaultProjectCargo = (v: Vessel): boolean =>
  v.bays.length === 0 || v.breakbulk_deck !== undefined;

export default function App() {
  const [mode, setMode] = useState<Mode>("demo");
  const [vesselId, setVesselId] = useState(DEFAULT_VESSEL_ID);
  const { vessel, containers } = useMemo(
    () => getVesselCatalogEntry(vesselId),
    [vesselId],
  );
  // Containers load by default when the vessel has a container grid; project cargo when it has no
  // grid or has a real breakbulk layout (MPP ships like BBC SAO PAULO show both, sharing the space).
  const [cargoLoaded, setCargoLoaded] = useState(vessel.bays.length > 0);
  const [projectCargoLoaded, setProjectCargoLoaded] = useState(
    defaultProjectCargo(vessel),
  );
  const resetPlayback = usePlanStore((s) => s.resetPlayback);
  const resetForVesselChange = usePlanStore((s) => s.resetForVesselChange);
  const playbackCount = usePlanStore((s) => s.playbackCount);
  const plan = useMemo(() => {
    const base = cargoLoaded
      ? buildLoadedDemoPlan(vessel, containers)
      : buildEmptyDemoPlan(vessel, containers);
    return projectCargoLoaded ? withBreakbulkCargo(vessel, base) : base;
  }, [vessel, containers, cargoLoaded, projectCargoLoaded]);
  const report = useMemo(() => validatePlan(vessel, plan), [plan]);
  const attitude = useIndicativeStability(vessel, plan, playbackCount);

  const onVesselChange = (id: string) => {
    setVesselId(id);
    const next = getVesselCatalogEntry(id).vessel;
    setCargoLoaded(next.bays.length > 0);
    setProjectCargoLoaded(defaultProjectCargo(next));
    resetForVesselChange();
  };

  return (
    <div className="layout">
      <Button
        variant="outline"
        className="mode-toggle"
        onClick={() => setMode((m) => (m === "demo" ? "onboarding" : "demo"))}
      >
        {mode === "demo" ? "Vessel onboarding (L2 import)" : "Back to demo"}
      </Button>
      {mode === "onboarding" ? (
        <OffsetsImportPanel />
      ) : (
        <>
          <Sidebar
            vessel={vessel}
            plan={plan}
            report={report}
            attitude={attitude}
            vesselOptions={VESSEL_CATALOG}
            vesselId={vesselId}
            onVesselChange={onVesselChange}
            cargoLoaded={cargoLoaded}
            onToggleCargo={() => {
              setCargoLoaded((v) => !v);
              resetPlayback();
            }}
            projectCargoLoaded={projectCargoLoaded}
            onToggleProjectCargo={() => setProjectCargoLoaded((v) => !v)}
          />
          <main className="stage">
            <div className="viewport">
              <VesselScene vessel={vessel} plan={plan} attitude={attitude} />
            </div>
            <div className="bayplan">
              <BayPlanView vessel={vessel} plan={plan} />
            </div>
          </main>
        </>
      )}
    </div>
  );
}
