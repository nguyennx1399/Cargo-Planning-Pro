import { useEffect, useMemo } from "react";
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
import { isUnderDeck } from "@/engine/breakbulk-deck-area";

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
  // Shallow-selected subset: Sidebar never reads playbackCount/exaggerate, so this must NOT be
  // a whole-store subscription — that would re-render on every ~60/sec playback tick for nothing.
  const s = usePlanStore(
    useShallow((state) => ({
      selectedId: state.selectedId,
      hoveredId: state.hoveredId,
      hoveredSlot: state.hoveredSlot,
      draggingContainerId: state.draggingContainerId,
      setDraggingContainer: state.setDraggingContainer,
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
  // Ends the drag wherever the mouse is released (E3-04b: ghost preview only, nothing commits
  // yet) — a window listener rather than an onMouseUp on the list item, since the button is
  // usually released over the 3D canvas, not back over the sidebar.
  useEffect(() => {
    if (!s.draggingContainerId) return;
    const onMouseUp = () => s.setDraggingContainer(null);
    window.addEventListener("mouseup", onMouseUp);
    return () => window.removeEventListener("mouseup", onMouseUp);
  }, [s.draggingContainerId, s.setDraggingContainer]);
  const unplacedContainers = useMemo(
    () => plan.unplaced.map((id) => plan.containers.find((c) => c.id === id)).filter((c) => c !== undefined),
    [plan.unplaced, plan.containers]
  );
  const focusId = s.selectedId ?? s.hoveredId;
  const focus = focusId ? plan.containers.find((c) => c.id === focusId) : undefined;
  const focusSlot = focusId ? plan.placements.find((p) => p.container_id === focusId)?.slot : undefined;

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
            ? vessel.breakbulk_deck
              ? `Wind turbine blades/nacelle/tower sections + yachts — DEMO reference sizes, naive placement on this vessel's real hatch covers and holds (stowage spec), not an optimized stow.`
              : `Wind turbine blades/nacelle/tower sections + yachts — DEMO reference sizes, naive deck placement, not real GA. Some items may be unplaced if containers occupy most of the deck.`
            : "Breakbulk demo cargo (wind turbine components, yachts) — independent of container load."}
        </p>
        {projectCargoLoaded && plan.breakbulk_cargo.length > 0 && (
          <p className="muted small">
            {(() => {
              const inHolds = plan.breakbulk_placements.filter((p) => isUnderDeck(p.area_id)).length;
              const onDeck = plan.breakbulk_placements.length - inHolds;
              const unplaced = plan.breakbulk_cargo.length - plan.breakbulk_placements.length;
              const parts = [`${onDeck} on deck`];
              if (vessel.breakbulk_holds?.length) parts.push(`${inHolds} in holds`);
              if (unplaced > 0) parts.push(`${unplaced} unplaced (no room left)`);
              return parts.join(" · ");
            })()}
            {vessel.breakbulk_holds?.length ? " — untick Hull to see cargo in the holds." : ""}
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
        ) : s.hoveredSlot ? (
          // Proof that raycast-to-slot picking (E3-04a) resolves an empty slot — the actual
          // drag/drop UI (ghost preview, snap, commit) is E3-04b onward, not built yet.
          <p className="muted">
            Empty slot {pad(s.hoveredSlot.bay)}{pad(s.hoveredSlot.row)}{pad(s.hoveredSlot.tier)}
          </p>
        ) : (
          <p className="muted">Hover or click a container — or an empty slot — to inspect it.</p>
        )}
      </section>

      {unplacedContainers.length > 0 && (
        <section>
          <h2>Unplaced ({unplacedContainers.length})</h2>
          <p className="muted small">
            Drag onto the hull to preview a slot. Drop doesn't place it yet (E3-04c/d).
          </p>
          <div className="unplaced-list">
            {unplacedContainers.map((c) => (
              <div
                key={c.id}
                className={`unplaced-item${s.draggingContainerId === c.id ? " unplaced-item-dragging" : ""}`}
                onMouseDown={() => s.setDraggingContainer(c.id)}
                title={`${c.id} — ${c.size}'${c.high_cube ? " HC" : ""} ${c.type}, ${c.weight_t} t`}
              >
                {c.id} · {c.size}'{c.high_cube ? " HC" : ""}
              </div>
            ))}
          </div>
        </section>
      )}

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
