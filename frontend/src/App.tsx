import { useMemo, useState } from "react";
import { VesselScene } from "@/features/viewer3d/VesselScene";
import { Sidebar } from "@/features/panels/Sidebar";
import { BayPlanView } from "@/features/bayplan/BayPlanView";
import { OffsetsImportPanel } from "@/features/vessel-onboarding/OffsetsImportPanel";
import { buildDemoVesselAndCargo, buildEmptyDemoPlan, buildLoadedDemoPlan, withBreakbulkCargo } from "@/data/build-demo-plan";
import { validatePlan } from "@/engine/validate-plan";
import { useIndicativeStability } from "@/lib/use-indicative-stability";
import { usePlanStore } from "@/store/usePlanStore";

// Frontend-only demo (P1-demo plan decision: "no backend calls"). Built once at module load —
// deterministic seed, stable reference across renders.
const { vessel, containers } = buildDemoVesselAndCargo();

type Mode = "demo" | "onboarding";

export default function App() {
  const [mode, setMode] = useState<Mode>("demo");
  const [cargoLoaded, setCargoLoaded] = useState(true);
  const [projectCargoLoaded, setProjectCargoLoaded] = useState(false);
  const resetPlayback = usePlanStore((s) => s.resetPlayback);
  const playbackCount = usePlanStore((s) => s.playbackCount);
  const plan = useMemo(() => {
    const base = cargoLoaded ? buildLoadedDemoPlan(vessel, containers) : buildEmptyDemoPlan(vessel, containers);
    return projectCargoLoaded ? withBreakbulkCargo(vessel, base) : base;
  }, [cargoLoaded, projectCargoLoaded]);
  const report = useMemo(() => validatePlan(vessel, plan), [plan]);
  const attitude = useIndicativeStability(vessel, plan, playbackCount);

  return (
    <div className="layout">
      <button className="btn mode-toggle" onClick={() => setMode((m) => (m === "demo" ? "onboarding" : "demo"))}>
        {mode === "demo" ? "Vessel onboarding (L2 import)" : "Back to demo"}
      </button>
      {mode === "onboarding" ? (
        <OffsetsImportPanel />
      ) : (
        <>
          <Sidebar
            vessel={vessel}
            plan={plan}
            report={report}
            attitude={attitude}
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
