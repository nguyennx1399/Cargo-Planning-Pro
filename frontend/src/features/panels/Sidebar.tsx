import { useEffect } from "react";
import type { StowagePlan, ValidationReport, Vessel } from "@/types/domain";
import type { StabilityResult } from "@/engine/stability-indicative";
import { useShallow } from "zustand/react/shallow";
import { usePlanStore } from "@/store/usePlanStore";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { SeverityAlertList } from "@/components/severity-alert-list";
import { ColorModeControl } from "./ColorModeControl";
import { StabilityPanel } from "./StabilityPanel";
import { LoadingSequencePanel } from "./LoadingSequencePanel";

interface Props {
  vessel: Vessel;
  plan: StowagePlan;
  report?: ValidationReport;
  attitude: StabilityResult | null;
  cargoLoaded: boolean;
  onToggleCargo: () => void;
  projectCargoLoaded: boolean;
  onToggleProjectCargo: () => void;
}

export function Sidebar({ vessel, plan, report, attitude, cargoLoaded, onToggleCargo, projectCargoLoaded, onToggleProjectCargo }: Props) {
  // Shallow-selected subset: Sidebar never reads playbackCount/exaggerate, so this must NOT be
  // a whole-store subscription — that would re-render on every ~60/sec playback tick for nothing.
  const s = usePlanStore(
    useShallow((state) => ({
      selectedId: state.selectedId,
      hoveredId: state.hoveredId,
      showHull: state.showHull,
      toggleHull: state.toggleHull,
      showOnDeck: state.showOnDeck,
      toggleOnDeck: state.toggleOnDeck,
      showUnderDeck: state.showUnderDeck,
      toggleUnderDeck: state.toggleUnderDeck,
      bayFilter: state.bayFilter,
      setBayFilter: state.setBayFilter,
      setSelected: state.setSelected,
    }))
  );
  const bayIndex = s.bayFilter === null ? -1 : vessel.bays.indexOf(s.bayFilter);
  const gotoBay = (delta: number) => {
    const next = bayIndex === -1 ? (delta > 0 ? 0 : vessel.bays.length - 1) : bayIndex + delta;
    if (next >= 0 && next < vessel.bays.length) s.setBayFilter(vessel.bays[next]);
  };
  // Arrow-key bay navigation — Sidebar only mounts in demo mode (no text inputs there), but guard
  // against a focused input/textarea anyway so this can't hijack typing if that ever changes.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "ArrowLeft") gotoBay(-1);
      else if (e.key === "ArrowRight") gotoBay(1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [bayIndex, vessel.bays]);
  const focusId = s.selectedId ?? s.hoveredId;
  const focus = focusId ? plan.containers.find((c) => c.id === focusId) : undefined;
  const focusSlot = focusId ? plan.placements.find((p) => p.container_id === focusId)?.slot : undefined;

  return (
    <aside className="sidebar">
      <header>
        <h1>{vessel.name}</h1>
        <p className="muted">Voyage {plan.voyage}</p>
      </header>

      <section>
        <h2>Cargo</h2>
        <Button variant="outline" onClick={onToggleCargo}>
          {cargoLoaded ? "Clear cargo (show empty hull)" : "Load demo cargo"}
        </Button>
        <p className="muted small">
          {cargoLoaded
            ? `Naive demo fill, not the real auto-stow solver. 40' containers only — 20' fore/aft half-bay placement isn't implemented yet.`
            : "Hull, livery and deck fittings only."}
        </p>
      </section>

      <section>
        <h2>Project cargo</h2>
        <Button variant="outline" onClick={onToggleProjectCargo}>
          {projectCargoLoaded ? "Clear project cargo" : "Load project cargo"}
        </Button>
        <p className="muted small">
          {projectCargoLoaded
            ? `Wind turbine blades/nacelle/tower sections + yachts — DEMO reference sizes, naive deck placement, not real GA. Some items may be unplaced if containers occupy most of the deck.`
            : "Breakbulk demo cargo (wind turbine components, yachts) — independent of container load."}
        </p>
        {projectCargoLoaded && plan.breakbulk_placements.length < plan.breakbulk_cargo.length && (
          <p className="muted small">
            {plan.breakbulk_cargo.length - plan.breakbulk_placements.length} of {plan.breakbulk_cargo.length} items unplaced (not enough free deck).
          </p>
        )}
      </section>

      <LoadingSequencePanel total={plan.placements.length} />

      <ColorModeControl ports={plan.ports} />

      <section>
        <h2>Show</h2>
        <div className="flex items-center gap-2">
          <Checkbox id="show-hull" checked={s.showHull} onCheckedChange={s.toggleHull} />
          <Label htmlFor="show-hull">Hull</Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="show-on-deck" checked={s.showOnDeck} onCheckedChange={s.toggleOnDeck} />
          <Label htmlFor="show-on-deck">On deck</Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="show-under-deck" checked={s.showUnderDeck} onCheckedChange={s.toggleUnderDeck} />
          <Label htmlFor="show-under-deck">Under deck</Label>
        </div>
        <div className="grid gap-1.5 mt-2">
          <Label htmlFor="bay-filter">Bay</Label>
          <div className="flex gap-1.5">
            <Button variant="outline" size="icon" aria-label="Previous bay" disabled={bayIndex === 0} onClick={() => gotoBay(-1)}>
              <ChevronLeft />
            </Button>
            <Select value={s.bayFilter === null ? "all" : String(s.bayFilter)} onValueChange={(v) => s.setBayFilter(v === "all" ? null : Number(v))}>
              <SelectTrigger id="bay-filter" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All bays</SelectItem>
                {vessel.bays.map((b) => <SelectItem key={b} value={String(b)}>Bay {String(b).padStart(2, "0")}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" aria-label="Next bay" disabled={bayIndex === vessel.bays.length - 1} onClick={() => gotoBay(1)}>
              <ChevronRight />
            </Button>
          </div>
        </div>
      </section>

      <StabilityPanel attitude={attitude} />

      <section>
        <h2>Container</h2>
        {focus ? (
          <dl className="kv">
            <dt>ID</dt><dd>{focus.id}</dd>
            <dt>Slot</dt><dd>{focusSlot ? `${pad(focusSlot.bay)}${pad(focusSlot.row)}${pad(focusSlot.tier)}` : "—"}</dd>
            <dt>Size</dt><dd>{focus.size}'{focus.high_cube ? " HC" : ""} {focus.type}</dd>
            <dt>Weight</dt><dd>{focus.weight_t} t</dd>
            <dt>Route</dt><dd>{focus.pol} to {focus.pod}</dd>
          </dl>
        ) : (
          <p className="muted">Hover or click a container to inspect it.</p>
        )}
      </section>

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

const pad = (n: number) => String(n).padStart(2, "0");
