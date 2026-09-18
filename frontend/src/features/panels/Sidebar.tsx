import type { StowagePlan, ValidationReport, Vessel } from "@/types/domain";
import type { StabilityResult } from "@/engine/stability-indicative";
import { useShallow } from "zustand/react/shallow";
import { usePlanStore } from "@/store/usePlanStore";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SeverityAlertList } from "@/components/severity-alert-list";
import { ColorModeControl } from "./ColorModeControl";
import { ContainerInspector } from "./ContainerInspector";
import { StabilityPanel } from "./StabilityPanel";
import { LoadingSequencePanel } from "./LoadingSequencePanel";
import { UnplacedCargoList } from "./UnplacedCargoList";
import { UnplacedProjectCargoList } from "./UnplacedProjectCargoList";
import { ProjectCargoPanel } from "./ProjectCargoPanel";
import { ViewOptionsPanel } from "./ViewOptionsPanel";
import { useStowageDropRelease } from "./use-stowage-drop-release";
import { useStowageKeyboardShortcuts } from "./use-stowage-keyboard-shortcuts";

interface Props {
  vessel: Vessel;
  plan: StowagePlan;
  report?: ValidationReport;
  attitude: StabilityResult | null;
  vesselOptions: { id: string; label: string }[];
  vesselId: string;
  onVesselChange: (id: string) => void;
  cargoLoaded: boolean;
  onToggleCargo: () => void;
  projectCargoLoaded: boolean;
  onToggleProjectCargo: () => void;
}

export function Sidebar({
  vessel, plan, report, attitude, vesselOptions, vesselId, onVesselChange,
  cargoLoaded, onToggleCargo, projectCargoLoaded, onToggleProjectCargo,
}: Props) {
  // Undo/redo/Esc/R/Delete in one place (leaves ArrowLeft/Right below alone on purpose — see the hook).
  useStowageKeyboardShortcuts(vessel);
  // The ONE commit trigger's window-level release, for a drag of either kind of cargo (Phase 03 moved
  // it out of this file: the listener needs both doors of the resolver, and this component is at its
  // own LOC budget).
  useStowageDropRelease();
  // Shallow-selected subset: Sidebar never reads playbackCount/exaggerate, so this must NOT be
  // a whole-store subscription — that would re-render on every ~60/sec playback tick for nothing.
  const s = usePlanStore(
    useShallow((state) => ({
      bayFilter: state.bayFilter,
      setBayFilter: state.setBayFilter,
      setSelected: state.setSelected,
    }))
  );
  // Bay navigation lives entirely elsewhere now: the chevron buttons in `ViewOptionsPanel` (which has
  // its own stepper) and the `[` / `]` keys in `use-stowage-keyboard-shortcuts.ts`. The arrow keys this
  // file used to own now PAN the 3D view, and leaving a second handler here would act on one press twice.
  // The ONE commit resolver's window-level trigger, mounted only while a DRAG is in flight, now lives
  // in `use-stowage-drop-release.ts` (Phase 03) so it can serve both kinds of cargo without this file
  // growing past the 200-LOC rule.

  return (
    <aside className="sidebar">
      <header>
        <h1>{vessel.name}</h1>
        <p className="muted">Voyage {plan.voyage}</p>
        {vesselOptions.length > 1 && (
          <div className="grid gap-1.5 mt-2">
            <Label htmlFor="vessel-select">Vessel</Label>
            <Select value={vesselId} onValueChange={(v) => v && onVesselChange(v)}>
              <SelectTrigger id="vessel-select" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {vesselOptions.map((v) => <SelectItem key={v.id} value={v.id}>{v.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
      </header>

      <section>
        <h2>Cargo</h2>
        <Button variant="outline" onClick={onToggleCargo} disabled={vessel.bays.length === 0}>
          {cargoLoaded ? "Clear cargo (show empty hull)" : "Load demo cargo"}
        </Button>
        <p className="muted small">
          {vessel.bays.length === 0
            ? "Containers need a bay/row/tier slot grid, and this vessel doesn't have one yet — use Project cargo below."
            : cargoLoaded
              ? `Naive demo fill, not the real auto-stow solver. Drag any unplaced box onto a slot below, or clear the cargo to place them yourself.`
              : "Hull, livery and deck fittings only."}
        </p>
      </section>

      <ProjectCargoPanel
        vessel={vessel}
        plan={plan}
        projectCargoLoaded={projectCargoLoaded}
        onToggleProjectCargo={onToggleProjectCargo}
      />

      <LoadingSequencePanel total={plan.placements.length} />

      <ColorModeControl ports={plan.ports} />

      <ViewOptionsPanel vessel={vessel} plan={plan} />

      <StabilityPanel attitude={attitude} />

      <ContainerInspector vessel={vessel} plan={plan} />

      <UnplacedCargoList vessel={vessel} plan={plan} />

      <UnplacedProjectCargoList vessel={vessel} plan={plan} />

      <section>
        <h2>Checks</h2>
        {!report ? <p className="muted">Checking plan…</p> : (
          <>
            <dl className="kv">
              <dt>Placed</dt><dd>{report.kpis.placed ?? 0}</dd>
              <dt>Not placed</dt><dd>{report.kpis.unplaced ?? 0}</dd>
              <dt>Overstows</dt><dd>{report.kpis.overstows ?? 0}</dd>
              <dt>Rule errors</dt><dd>{report.kpis.errors ?? 0}</dd>
            </dl>
            {report.violations.length === 0
              ? <p className="ok">No rule violations.</p>
              : (
                <SeverityAlertList
                  items={report.violations.slice(0, 50)}
                  onItemClick={(v) => v.container_ids[0] && s.setSelected(v.container_ids[0])}
                />
              )}
          </>
        )}
      </section>

      <footer className="muted small">
        Planning aid only. Verify stability on the approved loading computer.
      </footer>
    </aside>
  );
}
