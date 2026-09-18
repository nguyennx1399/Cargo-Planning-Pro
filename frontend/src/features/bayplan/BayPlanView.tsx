import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import type { Container, Slot, StowagePlan, Vessel } from "@/types/domain";
import { activeContainerId, usePlanStore } from "@/store/usePlanStore";
import { commitPlacement } from "@/store/commit-placement";
import { landingSlotFor, landingSlotsOnly } from "@/engine/placement/landing-slot";
import { validSlotsFor } from "@/engine/placement/placeholders";
import { dropOutcomeText } from "@/lib/drop-feedback";
import { podColorMap } from "@/lib/colors";
import { visiblePlacements } from "@/engine/playback-slice";
import { DeckBlock } from "./BayPlanDeckBlock";

// Fixed column width (px) shared by the cell grid, row labels, and weight bars, so all three
// stay visually aligned. Using a fixed size instead of 1fr keeps the whole bay plan compact for
// a quick overview instead of stretching cells to fill the panel's full width.
const CELL_PX = 14;

/**
 * 2D bay plan (cross-section of one bay, rows across, tiers up) — the planner's main working
 * view. Reuses the same colorMode/paletteMode/selection state as the 3D viewer (usePlanStore) so
 * clicking/hovering a cell here highlights the matching container in 3D and vice versa.
 *
 * A cell click is also the 2D DROP TRIGGER (Phase C): with a container dragged or picked, it runs
 * the same `commitPlacement` resolver the 3D release and the 3D placeholder click run, through the
 * same `canPlaceContainer` gate, so this path can never commit something the others would refuse.
 * Valid targets are outlined from `validSlotsFor`, and a rejection surfaces its own reason line.
 */
export function BayPlanView({ vessel, plan }: { vessel: Vessel; plan: StowagePlan }) {
  const s = usePlanStore(
    useShallow((state) => ({
      bay: state.bayFilter,
      colorMode: state.colorMode,
      paletteMode: state.paletteMode,
      playbackCount: state.playbackCount,
      hoveredId: state.hoveredId,
      selectedId: state.selectedId,
      dropOutcome: state.dropOutcome,
      setHovered: state.setHovered,
      setSelected: state.setSelected,
    }))
  );
  const activeId = usePlanStore(activeContainerId);
  // The 2D notice is the STORE's outcome, not local state (P1/D5): one message, one wording for the
  // 3D release, the 3D pick click and this panel, so the three cannot drift apart (review M3).
  // Rendered only for a "bayplan" SLOT outcome and only for the bay on screen — a notice about a cell
  // in a bay the planner is no longer looking at would contradict the grid under it, and an outcome
  // about a project-cargo POSE is not about this grid at all. The Sidebar shows slot outcomes either
  // way, so nothing is hidden by that. (The pose chip is `DropVerdictChip`'s.)
  const target = s.dropOutcome?.target;
  const notice =
    s.dropOutcome && s.dropOutcome.origin === "bayplan" && target?.kind === "slot" && target.slot.bay === s.bay
      ? dropOutcomeText(s.dropOutcome)
      : null;

  const pods = useMemo(() => podColorMap(plan.ports, s.paletteMode), [plan.ports, s.paletteMode]);

  const byId = useMemo(() => new Map(plan.containers.map((c) => [c.id, c])), [plan.containers]);
  // Built together in one pass: containerAt feeds the grid cells, weightByRow feeds the
  // port/starboard weight-distribution strip (E3-03d) below it.
  const { containerAt, weightByRow } = useMemo(() => {
    const containerAt = new Map<string, Container>(); // key `${row}:${tier}`
    const weightByRow = new Map<number, number>();
    for (const p of visiblePlacements(plan.placements, s.playbackCount)) {
      if (p.slot.bay !== s.bay) continue;
      const c = byId.get(p.container_id);
      if (!c) continue;
      containerAt.set(`${p.slot.row}:${p.slot.tier}`, c);
      weightByRow.set(p.slot.row, (weightByRow.get(p.slot.row) ?? 0) + c.weight_t);
    }
    return { containerAt, weightByRow };
  }, [plan.placements, s.playbackCount, s.bay, byId]);
  // Union of rows across both deck levels, port -> starboard — shared column basis for both
  // DeckBlocks and the weight strip below them, so a given row lines up vertically everywhere.
  const bayRows = useMemo(
    () => vessel.rows.filter((r) => vessel.stacks.some((st) => st.bay === s.bay && st.row === r)),
    [vessel.stacks, vessel.rows, s.bay]
  );

  // The container in hand (dragged or picked) and the positions it may take, from the engine's own
  // set — the SAME call the placeholder layer and the Sidebar hint make.
  const activeContainer = activeId ? plan.containers.find((c) => c.id === activeId) : undefined;
  // GRAVITY (landing-slot plan, phase 02): only the slots a box would actually come to rest in are
  // marked, so the grid promises exactly what a click delivers — the same projection the 3D
  // placeholder layer applies to the same `validSlotsFor` set.
  const validKeys = useMemo(
    () =>
      activeContainer
        ? new Set(landingSlotsOnly(vessel, plan, validSlotsFor(vessel, plan, activeContainer)).map((slot) => slot.key))
        : null,
    [vessel, plan, activeContainer]
  );
  /** The 2D half of the ONE commit resolver. With nothing in hand this is still "select what I
   * clicked"; with a container in hand it is a drop attempt (a cell click is a single pointer
   * action, which is what makes the 2D view a WCAG 2.5.7 alternative to dragging). The outcome needs
   * no local bookkeeping: the resolver records it and the store clears it on the next gesture or on
   * hovering a different slot, so it cannot outlive the drop it belongs to. */
  const onCellClick = (slot: Slot, container: Container | undefined) => {
    if (!activeId) {
      s.setSelected(container ? container.id : null);
      return;
    }
    // Same gravity mapping as the 3D pointer path: clicking high in a column lands the box on that
    // column's stack top, so the two triggers cannot behave differently for the same cell.
    commitPlacement(landingSlotFor(vessel, plan, slot) ?? slot, "bayplan");
  };

  if (s.bay === null) {
    return (
      <div className="bayplan-placeholder">
        <strong>Bay plan</strong>
        <span>Pick a bay to see its cross-section. {vessel.bays.length} bays on this vessel.</span>
      </div>
    );
  }

  const containersHere = [...containerAt.values()];
  const totalWeight = containersHere.reduce((sum, c) => sum + c.weight_t, 0);

  return (
    <div className="bayplan-grid">
      <div className="bayplan-header">
        <strong>Bay {String(s.bay).padStart(2, "0")}</strong>
        <span className="muted small">{containersHere.length} containers · {totalWeight.toFixed(1)} t</span>
      </div>
      {activeContainer && (
        <p className="muted small">
          Placing {activeContainer.id} — outlined cells are valid positions. Click one to place it, Esc to cancel.
        </p>
      )}
      {notice && <p className={`small ${notice.tone}`}>{notice.detail}</p>}
      <DeckBlock
        deck="on" bay={s.bay} columns={bayRows} vessel={vessel} containerAt={containerAt} colorMode={s.colorMode} pods={pods}
        hoveredId={s.hoveredId} selectedId={s.selectedId} setHovered={s.setHovered}
        validKeys={validKeys} onCellClick={onCellClick}
      />
      <div className="bayplan-hatchline" />
      <DeckBlock
        deck="under" bay={s.bay} columns={bayRows} vessel={vessel} containerAt={containerAt} colorMode={s.colorMode} pods={pods}
        hoveredId={s.hoveredId} selectedId={s.selectedId} setHovered={s.setHovered}
        validKeys={validKeys} onCellClick={onCellClick}
      />
      <WeightDistribution rows={bayRows} weightByRow={weightByRow} />
    </div>
  );
}

/** Port/starboard weight profile for the bay (E3-03d) — one bar per row, height proportional to
 * that row's total container weight, so an imbalance reads visually left-to-right/right-to-left. */
function WeightDistribution({ rows, weightByRow }: { rows: number[]; weightByRow: Map<number, number> }) {
  if (rows.length === 0) return null;
  const maxWeight = Math.max(1, ...rows.map((r) => weightByRow.get(r) ?? 0));

  return (
    <div className="bayplan-weightdist">
      <div className="bayplan-deck-label muted small">Weight by row (port ↔ starboard)</div>
      <div className="bayplan-weightdist-bars" style={{ gridTemplateColumns: `repeat(${rows.length}, ${CELL_PX}px)` }}>
        {rows.map((r) => {
          const w = weightByRow.get(r) ?? 0;
          return (
            <div key={r} className="bayplan-weightdist-col" title={`Row ${r}: ${w.toFixed(1)} t`}>
              <div className="bayplan-weightdist-bar" style={{ height: `${Math.round((w / maxWeight) * 100)}%` }} />
            </div>
          );
        })}
      </div>
      <div className="bayplan-row-labels" style={{ gridTemplateColumns: `repeat(${rows.length}, ${CELL_PX}px)` }}>
        {rows.map((r) => <span key={r} className="muted">{r}</span>)}
      </div>
    </div>
  );
}
