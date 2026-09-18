import { useEffect, useMemo, useState } from "react";
import type { StowagePlan, Vessel } from "@/types/domain";
import { Button } from "@/components/ui/button";
import { VesselScene } from "@/features/viewer3d/VesselScene";
import { DropVerdictChip } from "@/features/viewer3d/DropVerdictChip";
import { useDropCursor } from "@/features/viewer3d/use-drop-cursor";
import { Sidebar } from "@/features/panels/Sidebar";
import { BayPlanView } from "@/features/bayplan/BayPlanView";
import { OffsetsImportPanel } from "@/features/vessel-onboarding/OffsetsImportPanel";
import { buildDemoPlan } from "@/data/build-demo-plan";
import { withCustomCargo } from "@/data/with-custom-cargo";
import {
  DEFAULT_VESSEL_ID,
  VESSEL_CATALOG,
  getVesselCatalogEntry,
} from "@/data/vessel-catalog";
import { validatePlan } from "@/engine/validate-plan";
import { useIndicativeStability } from "@/lib/use-indicative-stability";
import { usePlanStore } from "@/store/usePlanStore";
import { usePlanDraftStore } from "@/store/usePlanDraftStore";

type Mode = "demo" | "onboarding";

const defaultProjectCargo = (v: Vessel): boolean =>
  v.bays.length === 0 || v.breakbulk_deck !== undefined;

/** Stand-in for the one frame between a vessel switch and the new demo plan being loaded. The
 * validation/stability hooks still need a plan object, and rendering the OLD vessel's plan against
 * the NEW hull would be worse than useless (ids that no longer resolve, cargo off the new grid). */
const LOADING_PLAN: StowagePlan = {
  id: "loading",
  vessel_id: "",
  voyage: "",
  ports: [],
  containers: [],
  placements: [],
  unplaced: [],
  breakbulk_cargo: [],
  breakbulk_placements: [],
};

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
  const draftPlan = usePlanDraftStore((s) => s.plan);
  const loadPlan = usePlanDraftStore((s) => s.loadPlan);
  const customCargo = usePlanStore((s) => s.customCargo);

  // The demo plan is built once per (vessel, toggles) and loaded into the draft store; there is no
  // memo-derived plan any more — the report, the scene, the sidebar and the bay plan all read the
  // draft. `vessel`/`containers` identities are cached per catalog id, so this cannot loop.
  // Custom project cargo is merged into every rebuild (see `with-custom-cargo.ts`): the plan is rebuilt
  // on each vessel/toggle change, so items the planner typed in would otherwise vanish the first time
  // they press a toggle. Adding one bumps `customCargo` and therefore re-runs this same effect — one
  // path into the draft store, not two.
  useEffect(() => {
    loadPlan(
      vessel,
      withCustomCargo(buildDemoPlan(vessel, containers, { cargoLoaded, projectCargoLoaded }), customCargo),
    );
  }, [vessel, containers, cargoLoaded, projectCargoLoaded, customCargo, loadPlan]);

  const plan = draftPlan ?? LOADING_PLAN;
  const report = useMemo(() => validatePlan(vessel, plan), [vessel, plan]);
  const attitude = useIndicativeStability(vessel, plan, playbackCount);
  // The canvas cursor + the "armed" ring for the drop gesture (P1). Computed here because `.viewport`
  // is this component's element: the class has to sit on the wrapper the canvas inherits from.
  const dropCursor = useDropCursor(vessel, plan);

  const onVesselChange = (id: string) => {
    // Re-picking the already-selected vessel must be a no-op. The catalog memoises `vessel`/`containers`
    // per id and the two toggles below re-derive the same values, so every setState would bail out and
    // the effect above — keyed on those identities — would never re-run: `draftPlan` stays null and the
    // stage would sit on "Loading plan…" until the user toggled cargo or switched vessel and back.
    // (Sidebar's Select has no equality guard: it calls onValueChange for a re-pick.)
    if (id === vesselId) return;
    setVesselId(id);
    const next = getVesselCatalogEntry(id).vessel;
    setCargoLoaded(next.bays.length > 0);
    setProjectCargoLoaded(defaultProjectCargo(next));
    // Drop the old vessel's plan synchronously (the effect above loads the new one right after):
    // the stability hook dereferences container ids and would not survive a cross-vessel plan.
    loadPlan(null, null);
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
      ) : draftPlan === null ? (
        <p className="muted">Loading plan…</p>
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
            <div className={`viewport ${dropCursor}`}>
              <VesselScene vessel={vessel} plan={plan} attitude={attitude} />
              <DropVerdictChip vessel={vessel} plan={plan} />
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
