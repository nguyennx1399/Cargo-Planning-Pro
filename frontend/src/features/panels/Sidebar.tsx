import { useMemo } from "react";
import type { StowagePlan, ValidationReport, Vessel } from "@/types/domain";
import type { StabilityResult } from "@/engine/stability-indicative";
import { useShallow } from "zustand/react/shallow";
import { usePlanStore, type ColorMode } from "@/store/usePlanStore";
import { podColorMap } from "@/lib/colors";
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

const MODES: { id: ColorMode; label: string }[] = [
  { id: "pod", label: "POD" },
  { id: "weight", label: "Weight" },
  { id: "type", label: "Type" },
];

export function Sidebar({ vessel, plan, report, attitude, cargoLoaded, onToggleCargo, projectCargoLoaded, onToggleProjectCargo }: Props) {
  // Shallow-selected subset: Sidebar never reads playbackCount/exaggerate, so this must NOT be
  // a whole-store subscription — that would re-render on every ~60/sec playback tick for nothing.
  const s = usePlanStore(
    useShallow((state) => ({
      selectedId: state.selectedId,
      hoveredId: state.hoveredId,
      colorMode: state.colorMode,
      setColorMode: state.setColorMode,
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
  const pods = useMemo(() => podColorMap(plan.ports), [plan.ports]);
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
        <button className="btn" onClick={onToggleCargo}>
          {cargoLoaded ? "Clear cargo (show empty hull)" : "Load demo cargo"}
        </button>
        <p className="muted small">
          {cargoLoaded
            ? `Naive demo fill, not the real auto-stow solver. 40' containers only — 20' fore/aft half-bay placement isn't implemented yet.`
            : "Hull, livery and deck fittings only."}
        </p>
      </section>

      <section>
        <h2>Project cargo</h2>
        <button className="btn" onClick={onToggleProjectCargo}>
          {projectCargoLoaded ? "Clear project cargo" : "Load project cargo"}
        </button>
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

      <section>
        <h2>Color by</h2>
        <div className="segmented" role="radiogroup" aria-label="Color by">
          {MODES.map((m) => (
            <button key={m.id} role="radio" aria-checked={s.colorMode === m.id}
              className={s.colorMode === m.id ? "active" : ""} onClick={() => s.setColorMode(m.id)}>
              {m.label}
            </button>
          ))}
        </div>
        {s.colorMode === "pod" && (
          <ul className="legend">
            {plan.ports.filter((p) => p.sequence > 0).map((p) => (
              <li key={p.locode}>
                <i style={{ background: pods[p.locode] }} /> {p.name} <span className="muted">{p.locode}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2>Show</h2>
        <label className="check"><input type="checkbox" checked={s.showHull} onChange={s.toggleHull} /> Hull</label>
        <label className="check"><input type="checkbox" checked={s.showOnDeck} onChange={s.toggleOnDeck} /> On deck</label>
        <label className="check"><input type="checkbox" checked={s.showUnderDeck} onChange={s.toggleUnderDeck} /> Under deck</label>
        <label className="field">
          Bay
          <select value={s.bayFilter ?? ""} onChange={(e) => s.setBayFilter(e.target.value ? Number(e.target.value) : null)}>
            <option value="">All bays</option>
            {vessel.bays.map((b) => <option key={b} value={b}>Bay {String(b).padStart(2, "0")}</option>)}
          </select>
        </label>
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
                <ul className="violations">
                  {report.violations.slice(0, 50).map((v, i) => (
                    <li key={i} className={v.severity}
                      onClick={() => v.container_ids[0] && s.setSelected(v.container_ids[0])}>
                      {v.message}
                    </li>
                  ))}
                </ul>
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
