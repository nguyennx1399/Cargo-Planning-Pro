import type { StowagePlan, ValidationReport, Vessel } from "@/types/domain";
import type { StabilityResult } from "@/engine/stability-indicative";
import { useShallow } from "zustand/react/shallow";
import { usePlanStore, type SidebarTab } from "@/store/usePlanStore";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ColorModeControl } from "./ColorModeControl";
import { ContainerInspector } from "./ContainerInspector";
import { StabilityPanel } from "./StabilityPanel";
import { LoadingSequencePanel } from "./LoadingSequencePanel";
import { UnplacedCargoList } from "./UnplacedCargoList";
import { UnplacedProjectCargoList } from "./UnplacedProjectCargoList";
import { ProjectCargoPanel } from "./ProjectCargoPanel";
import { ViewOptionsPanel } from "./ViewOptionsPanel";
import { ChecksPanel } from "./ChecksPanel";
import { SidebarStatusStrip } from "./SidebarStatusStrip";
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
  // Only the tab state — every panel subscribes to its own slice. This must NOT be a whole-store
  // subscription: the sidebar would re-render on every ~60/sec playback tick for nothing.
  const { sidebarTab, setSidebarTab } = usePlanStore(
    useShallow((state) => ({ sidebarTab: state.sidebarTab, setSidebarTab: state.setSidebarTab })),
  );

  return (
    <aside className="sidebar">
      {/* ── ALWAYS VISIBLE: vessel, plan health ─────────────────────────────────────────────────── */}
      <header className="sidebar-header">
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
        {/* Errors must not hide behind a tab: an error made while on Load is still visible here. */}
        <SidebarStatusStrip plan={plan} report={report} />
      </header>

      {/* ── TABS BY TASK (sidebar reorganisation plan) ──────────────────────────────────────────────
          Load = placing cargo, View = adjusting the picture, Check = reviewing the result. Every panel is
          the same component as before; only WHERE it renders changed. The two global hooks above stay
          at this root on purpose — a tab body unmounts when inactive, and taking them with it would
          break drop-release and every keyboard shortcut. */}
      <Tabs
        value={sidebarTab}
        onValueChange={(value) => setSidebarTab(value as SidebarTab)}
        className="sidebar-tabs"
      >
        <TabsList>
          <TabsTrigger value="load">Load</TabsTrigger>
          <TabsTrigger value="view">View</TabsTrigger>
          <TabsTrigger value="check">Check</TabsTrigger>
        </TabsList>

        <TabsContent value="load" className="sidebar-tab-body">
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
          {/* The inspector is the readout of the thing being placed, so it sits next to where placing starts. */}
          <ContainerInspector vessel={vessel} plan={plan} />
          <UnplacedCargoList vessel={vessel} plan={plan} />
          <ProjectCargoPanel
            vessel={vessel}
            plan={plan}
            projectCargoLoaded={projectCargoLoaded}
            onToggleProjectCargo={onToggleProjectCargo}
          />
          <UnplacedProjectCargoList vessel={vessel} plan={plan} />
        </TabsContent>

        <TabsContent value="view" className="sidebar-tab-body">
          <ColorModeControl ports={plan.ports} />
          <ViewOptionsPanel vessel={vessel} plan={plan} />
        </TabsContent>

        <TabsContent value="check" className="sidebar-tab-body">
          <ChecksPanel report={report} />
          <StabilityPanel attitude={attitude} />
          <LoadingSequencePanel total={plan.placements.length} />
        </TabsContent>
      </Tabs>

      {/* Safety text, not decoration — fixed so it is on screen on every tab. */}
      <footer className="sidebar-footer muted small">
        Planning aid only. Verify stability on the approved loading computer.
      </footer>
    </aside>
  );
}
